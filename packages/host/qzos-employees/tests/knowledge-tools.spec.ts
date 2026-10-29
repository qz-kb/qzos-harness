import { afterEach, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { installKnowledgeTools } from '../src/knowledge-tools.ts'

function fixture() {
  const definitions = new Map<string, ToolDefinition>()
  let auth: { userId: string; token: string } | undefined = { userId: '1', token: 'synthetic' }
  const search = vi.fn(async () => [{ kb_id: 29, question: '仓储降本', answer: '按容量计费' }])
  const agent = {
    session: { id: 'synthetic-session' },
    ctx: { tools: { register(definition: ToolDefinition) { definitions.set(definition.name, definition) } } },
  } as unknown as Agent
  vi.stubGlobal('fetch', async (url: string) => {
    const path = new URL(url).pathname
    if (path.endsWith('/kb.know/all')) return Response.json({ code: 1, data: [{ id: 29, name: '产品知识库' }] })
    if (path.endsWith('/kb.know/lists')) return Response.json({ code: 1, data: { lists: [{ id: 26, name: '销售知识库' }], count: 1 } })
    return Response.json({ code: 1, data: {} })
  })
  installKnowledgeTools(agent, { apiUrl: 'http://synthetic.invalid/api', requestTimeoutMs: 1000 }, () => auth, search)
  const run = (name: string, args: object) => {
    const tool = definitions.get(name)
    if (!tool) throw new Error(`Missing tool ${name}`)
    return tool.execute(args, { agent, name: tool.name, callId: 'call-1', signal: new AbortController().signal } as ToolRunContext)
  }
  return { run, search, logout() { auth = undefined } }
}

afterEach(() => { vi.unstubAllGlobals() })

it('lists own and shared knowledge bases without duplicates', async () => {
  const result = await fixture().run('qzos_knowledge_catalog', {}) as { knowledgeBases: { id: string; name: string }[] }
  expect(result.knowledgeBases).toEqual([{ id: '29', name: '产品知识库' }, { id: '26', name: '销售知识库' }])
})

it('searches explicit knowledge ids and returns source rows', async () => {
  const test = fixture()
  const result = await test.run('qzos_knowledge_search', { query: '仓储客户降本', knowledge_ids: [29, 26] })
  expect(result).toEqual({
    query: '仓储客户降本', knowledge_ids: [29, 26],
    results: [{ kb_id: 29, question: '仓储降本', answer: '按容量计费' }],
  })
  expect(test.search).toHaveBeenCalledWith(expect.objectContaining({ userId: '1' }), [29, 26], '仓储客户降本', expect.any(AbortSignal))
})

it('refuses knowledge tools after logout', async () => {
  const test = fixture(); test.logout()
  await expect(test.run('qzos_knowledge_search', { query: '仓储', knowledge_ids: [29] })).rejects.toThrow('请先登录 QZOS')
  expect(test.search).not.toHaveBeenCalled()
})
