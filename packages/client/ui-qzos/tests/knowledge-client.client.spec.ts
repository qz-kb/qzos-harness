/** Real transport behavior without contacting external providers. */
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ResourceRegistry } from '../../resources/src/client/resources.ts'
import { installKnowledgeResources, readConnections, knowledgeSearchInput, knowledgeRequest, knowledgePages, knowledgeTable, saveKnowledge } from '../src/client/knowledge-client.ts'
import { loginApi, loginSessionKey } from '../src/client/login-client.ts'

function setup() {
  const values = new Map([[loginSessionKey, JSON.stringify({ api: loginApi, token: 'business-test' })]])
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null })
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  return { values, fetcher }
}
const reply = (data: unknown) => new Response(JSON.stringify({ code: 1, data }), { status: 200 })
afterEach(() => { vi.unstubAllGlobals() })

it('uses business authorization and preserves array responses without Host cookies', async () => {
  const { fetcher } = setup(); fetcher.mockResolvedValue(reply([{ id: 0, owned: 1 }]))
  expect(await knowledgeRequest('/kb.know/teamLists?kb_id=1')).toEqual([{ id: 0, owned: 1 }])
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', redirect: 'error', headers: { token: 'business-test' } })
})
it('rejects requests without login and drops a response after an identity change', async () => {
  const { fetcher, values } = setup()
  fetcher.mockImplementation(() => { values.clear(); return Promise.resolve(reply({ id: 1 })) })
  await expect(knowledgeRequest('/kb.know/detail?id=1')).rejects.toThrow('登录账号已变更')
  await expect(knowledgeRequest('/kb.know/detail?id=1')).rejects.toThrow('请先登录')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('does not treat a business failure as successful saving', async () => {
  const { fetcher } = setup(); fetcher.mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'model unavailable' })))
  await expect(saveKnowledge(null, { name: 'test', image: '/cover.png', embedding_model_id: '2', documents_model_id: '1:3' })).rejects.toThrow('model unavailable')
  const body = fetcher.mock.calls[0]?.[1]?.body
  if (typeof body !== 'string') throw new Error('Missing request body')
  expect(JSON.parse(body)).toMatchObject({ documents_model_id: 1, documents_model_sub_id: 3, embedding_model_id: 2 })
})
it('reads all pages and rejects a truncated collection', async () => {
  const { fetcher } = setup()
  fetcher.mockResolvedValueOnce(reply({ lists: [{ id: 1 }], count: 2 })).mockResolvedValueOnce(reply({ lists: [{ id: 2 }], count: 2 }))
  expect(await knowledgePages('/kb.know/lists?type=0')).toHaveLength(2)
  fetcher.mockResolvedValue(reply({ lists: [], count: 1 }))
  await expect(knowledgePages('/kb.know/lists')).rejects.toThrow('pagination')
})
it('maps server member identities and learning states without fabricated values', () => {
  expect(knowledgeTable([{ id: 0, sn: 42, nickname: 'Owner', power: 1, owned: 1 }], 'members')[0]).toMatchObject({ id: '0', sn: '42', role: 'owner' })
  expect(knowledgeTable([{ uuid: 'fragment-1', status: 1, tokens: 12 }], 'fragments')[0]).toMatchObject({ id: 'fragment-1', status: 'learning', consumed: '12' })
})

it('sends semantic search using the server mode and paired optimization model identity', async () => {
  const { fetcher } = setup(); fetcher.mockResolvedValue(reply([{ question: 'Current fact', version: 2 }]))
  const input = knowledgeSearchInput({ search_mode: 'semantic', search_tokens: '3000', search_similar: '0.6', optimize_m_id: '411:40011' })
  expect(await knowledgeRequest('/kb.teach/tests', { ...input, kb_id: 8, question: 'Policy?' })).toEqual([{ question: 'Current fact', version: 2 }])
  const body = fetcher.mock.calls[0]?.[1]?.body
  if (typeof body !== 'string') throw new Error('Missing request body')
  expect(JSON.parse(body)).toMatchObject({ search_mode: 'similar', search_tokens: 3000, search_similar: 0.6, optimize_m_id: 411, optimize_s_id: 40011 })
  expect(knowledgeSearchInput({ search_mode: 'full' }).search_mode).toBe('full')
  expect(knowledgeSearchInput({ search_mode: 'mix' }).search_mode).toBe('mix')
})

it('keeps authorized connections and history when the market is disabled, but propagates authorization failures', async () => {
  const { fetcher } = setup()
  fetcher.mockResolvedValueOnce(reply([{ id: 1 }]))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, msg: 'MARKET_DISABLED' })))
    .mockResolvedValueOnce(reply([{ id: 7, status: 'success' }]))
  expect(await readConnections(new AbortController().signal)).toEqual({
    rows: [{ id: 1 }], requests: [], calls: [{ id: 7, status: 'success' }], marketDisabled: true,
  })
  fetcher.mockResolvedValueOnce(reply([]))
    .mockResolvedValueOnce(new Response(JSON.stringify({ code: -1, msg: 'expired' })))
    .mockResolvedValueOnce(reply([]))
  await expect(readConnections(new AbortController().signal)).rejects.toThrow('expired')
})

it('retains native catalog cards across navigation, refreshes in place and releases the account', async () => {
  const { fetcher, values } = setup()
  fetcher.mockResolvedValue(reply({ lists: [{ id: 1, name: 'first' }], count: 1 }))
  const ctx = new Context()
  const registry = new ResourceRegistry(ctx)
  ctx.reflect.provide('resources', registry)
  let refresh!: (panel: string) => void
  const fiber = ctx.plugin({ apply: (child: Context) => { refresh = installKnowledgeResources(child) } })
  await fiber.await()
  const account = new AbortController()
  const address = 'dsh-resource://qzos-knowledge/list?epoch=1&revision=0'
  const source = registry.source(address)
  try {
    registry.pin(address, account.signal)
    let off = source.subscribe(() => {})
    await vi.waitFor(() => { expect(source.getSnapshot().status).toBe('live') })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/kb.know/lists')
    off(); off = source.subscribe(() => {})
    expect(source.getSnapshot().value).toEqual({ rows: [{ id: 1, name: 'first' }] })
    expect(fetcher).toHaveBeenCalledTimes(1)
    let finish: ((value: Response) => void) | undefined
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    refresh('knowledge')
    await vi.waitFor(() => { expect(finish).toBeDefined() })
    expect(source.getSnapshot()).toMatchObject({ status: 'live', value: { rows: [{ id: 1 }] } })
    finish!(reply({ lists: [{ id: 2, name: 'updated' }], count: 1 }))
    await vi.waitFor(() => { expect(source.getSnapshot().value).toEqual({ rows: [{ id: 2, name: 'updated' }] }) })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, msg: 'offline' })))
    refresh('knowledge')
    await vi.waitFor(() => { expect(source.getSnapshot().status).toBe('failed') })
    expect(source.getSnapshot().value).toEqual({ rows: [{ id: 2, name: 'updated' }] })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: -1, msg: 'expired' })))
    refresh('knowledge')
    await vi.waitFor(() => { expect(source.getSnapshot().value).toEqual({ rows: [] }) })
    off(); account.abort(); values.clear()
    expect(source.getSnapshot().value).toBeUndefined()
    const next = registry.source('dsh-resource://qzos-knowledge/list?epoch=2&revision=0')
    expect(next.getSnapshot().value).toBeUndefined()
  } finally { account.abort(); await fiber.dispose() }
})
