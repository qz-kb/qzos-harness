/** Opening context uses business authorization and leaves task execution to native DSH. */
import { afterEach, expect, it, vi } from 'vitest'
import { context as retrieve } from '../src/business.ts'
const employeeContext = (id: string, question: string, signal: AbortSignal) => retrieve({ apiUrl:'http://qzos.invalid/api',requestTimeoutMs:1000 }, 'synthetic-business-token', id, question, signal)
const loginApi = ''; const loginSessionKey = 'test'

const employee = { id: 7, name: 'Researcher', is_enable: 1, work_state: 'ready', roles_prompt: 'Summarize sources.', kb_ids: [12], search_mode: 'similar', search_tokens: 1000, search_similar: 0.4, flow_config: { api_token: 'must-not-leak' } }
const reply = (data: unknown) => new Response(JSON.stringify({ code: 1, data }))
function setup() {
  const values = new Map([[loginSessionKey, JSON.stringify({ api: loginApi, token: 'synthetic-business-token' })]])
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null })
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  return { values, fetcher, signal: new AbortController().signal }
}
afterEach(() => { vi.unstubAllGlobals() })
it('serializes only role and authorized excerpts, not credentials or backend execution config', async () => {
  const { fetcher, signal } = setup()
  fetcher.mockResolvedValueOnce(reply(employee)).mockResolvedValueOnce(reply([{ question: 'Source', answer: 'Evidence' }]))
  const context = await employeeContext('7', 'Summarize', signal)
  expect(context).toContain('Evidence')
  expect(context).not.toContain('must-not-leak')
  expect(context).not.toContain('synthetic-business-token')
  const body = fetcher.mock.calls[1]?.[1]?.body
  if (typeof body !== 'string') throw new Error('Missing request body')
  expect(JSON.parse(body)).toMatchObject({ kb_id: 12, question: 'Summarize', search_mode: 'similar' })
})
it.each([
  { is_enable: 0 }, { work_state: 'paused' }, { work_state: 'retired' },
  { knowledge_rebind_required: true }, { kb_ids: undefined }, { flow_status: 1 },
])('refuses unavailable employee configuration before retrieval: %j', async (override) => {
  const { fetcher, signal } = setup()
  fetcher.mockResolvedValue(reply({ ...employee, ...override }))
  await expect(employeeContext('7', 'Task', signal)).rejects.toThrow()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('refuses the entire opening task when retrieval fails instead of silently dropping knowledge', async () => {
  const { fetcher, signal } = setup()
  fetcher.mockResolvedValueOnce(reply(employee)).mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, msg: 'Knowledge access denied' })))
  await expect(employeeContext('7', 'Task', signal)).rejects.toThrow('Knowledge access denied')
})
it('does not retrieve for an employee without knowledge', async () => {
  const { fetcher,signal }=setup()
  fetcher.mockResolvedValue(reply({ ...employee,kb_ids:[] }))
  expect(await employeeContext('7','Task',signal)).toContain('\"sources\":[]')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
