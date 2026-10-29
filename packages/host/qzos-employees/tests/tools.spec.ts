import { afterEach, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { installTools } from '../src/tools.ts'

/** Exercise registered tools through their actual execution functions. */
function fixture(approvals: string[], unknown = false) {
  const definitions = new Map<string, ToolDefinition>()
  const requests: { path: string; body: Record<string, unknown> }[] = []
  let auth: { userId: string; token: string } | undefined = { userId: '1', token: 'synthetic' }
  const approve = vi.fn(async () => approvals.shift() ?? 'rejected')
  const search = vi.fn(async () => [{ kb_id: 29, question: '仓储降本', answer: '按容量计费' }])
  const agent = {
    session: { id: 'synthetic-session' },
    ctx: {
      tools: { register(definition: ToolDefinition) { definitions.set(definition.name, definition) } },
      get: () => ({ request: approve }),
    },
  } as unknown as Agent
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>
    requests.push({ path, body })
    if (path.endsWith('/kb.robot/detail')) return Response.json({ code: 1, data: { id: 7, is_enable: 1, kb_ids: [] } })
    if (path.endsWith('/available')) return Response.json({ code: 1, data: [{ id: 1, name: 'Synthetic', actions: [
      { key: 'send', type: 'send', name: 'send' }, { key: 'read', type: 'read', name: 'read' },
    ] }] })
    if (path.endsWith('/call') && unknown) throw new Error('Response lost')
    return Response.json({ code: 1, data: path.endsWith('/call') && body.action_key === 'send'
      ? { id: 9, status: 'pending_confirm', confirmation: { token: 'private-confirmation', recipient: 'synthetic', params: {} } }
      : { id: 9, status: 'succeeded' } })
  })
  installTools(agent, { apiUrl: 'http://synthetic.invalid/api', requestTimeoutMs: 1000 }, () => auth,
    () => ({ userId: '1', employeeId: '7' }), async () => ({}), search)
  const runTool = (name: string, args: object) => {
    const tool = definitions.get(name)
    if (!tool) throw new Error(`Missing tool ${name}`)
    return tool.execute(args, {
      agent, name: tool.name, callId: 'call-1', signal: new AbortController().signal,
    } as ToolRunContext)
  }
  const run = (action: string) => runTool('qzos_employee_plugin', { connection_id: 1, action_key: action, params: {} })
  return { run, runTool, requests, approve, search, logout() { auth = undefined } }
}
afterEach(() => { vi.unstubAllGlobals() })
it('does not dispatch a mutation without native approval', async () => {
  const test = fixture(['rejected'])
  await expect(test.run('send')).rejects.toThrow('未获确认')
  expect(test.requests.some(r => r.path.endsWith('/call'))).toBe(false)
})
it('confirms the server-frozen recipient only after a second native approval and strips the token', async () => {
  const test = fixture(['allowed-once', 'allowed-once'])
  const result = await test.run('send')
  expect(result).toEqual({ id: 9, status: 'succeeded' })
  expect(test.approve).toHaveBeenCalledTimes(2)
  expect(test.requests.find(r => r.path.endsWith('/confirm'))?.body).toMatchObject({ decision: 'confirm', id: 9 })
})
it('cancelling send confirmation never dispatches the confirmed action', async () => {
  const test = fixture(['allowed-once', 'rejected'])
  await expect(test.run('send')).rejects.toThrow('未获确认')
  expect(test.requests.some(r => r.path.endsWith('/confirm') && r.body.decision === 'confirm')).toBe(false)
})
it('keeps uncertain outcomes queryable without silently resending', async () => {
  const test = fixture([], true)
  const result = await test.run('read') as { status: string; request_id: string }
  expect(result.status).toBe('unknown')
  expect(typeof result.request_id).toBe('string')
  expect(test.requests.filter(r => r.path.endsWith('/call'))).toHaveLength(1)
  expect(test.approve).not.toHaveBeenCalled()
})
it('revokes tools on logout before any business request', async () => {
  const test = fixture([]); test.logout()
  await expect(test.run('read')).rejects.toThrow('账号已变化')
  expect(test.requests).toHaveLength(0)
})
it('searches bound knowledge through the trusted adapter without approval', async () => {
  const test = fixture([])
  const result = await test.runTool('qzos_knowledge_search', { query: '仓储客户降本' })
  expect(result).toEqual({ query: '仓储客户降本', results: [{ kb_id: 29, question: '仓储降本', answer: '按容量计费' }] })
  expect(test.search).toHaveBeenCalledWith(expect.objectContaining({ userId: '1' }), '仓储客户降本', expect.any(AbortSignal))
  expect(test.approve).not.toHaveBeenCalled()
})
