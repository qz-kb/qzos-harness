/** Configuration writes preserve hidden server state instead of replaying mock defaults. */
import { afterEach, expect, it, vi } from 'vitest'
import { employeeCard, employeeDraft, employeePayload, saveEmployee } from '../src/client/employee-client.ts'

const original = {
  id: 7, name: 'Test employee', image: '/employee.png', intro: '', is_enable: 1, is_public: 0,
  kb_ids: [12, 13], menus: [{ keyword: 'help', content: 'reply', images: ['/image.png'] }],
  model_id: 2, model_sub_id: 3, optimize_m_id: 4, optimize_s_id: 5, search_mode: 'similar',
  flow_config: { api_token: 'synthetic-test-only', app_id: 'app', workflow_id: 'flow', bot_id: '' },
  knowledge_dependency_action: 'preserve', knowledge_rebind_required: false,
}
it('maps real identities and disabled state without generating preview IDs', () => {
  expect(employeeCard(original)).toMatchObject({ id: '7', title: 'Test employee', scope: 'private', status: 'ready' })
  expect(employeeCard({ ...original, is_enable: 0 }).status).toBe('pending')
})
it('preserves nested menus, bindings and workflow values when editing a name', () => {
  const draft = { ...employeeDraft(original), name: 'Renamed' }
  const result = employeePayload(original, draft, original.menus)
  expect(result).toMatchObject({ name: 'Renamed', kb_ids: [12, 13], model_id: 2, model_sub_id: 3, optimize_m_id: 4, optimize_s_id: 5, search_mode: 'similar', menus: original.menus, flow_config: original.flow_config, knowledge_dependency_action: 'preserve' })
  expect(result).not.toHaveProperty('is_enable')
})
it('rejects incomplete configuration and implicit removal of unavailable knowledge bindings', () => {
  expect(() => employeeDraft({ id: 7 })).toThrow('配置不完整')
  const changed = { ...original, knowledge_rebind_required: true }
  expect(() => employeePayload(changed, { ...employeeDraft(changed), kb_ids: '' }, original.menus)).toThrow('关联已失效')
})

const invalid = { ...original, kb_ids: [12], knowledge_rebind_required: true, can_manage_knowledge_dependency: true }
it('preserves unavailable links on unrelated edits and explicitly rebinds even to the surviving selection', () => {
  expect(employeePayload(invalid, { ...employeeDraft(invalid), name: 'Renamed' }, original.menus)).toMatchObject({ knowledge_dependency_action: 'preserve', kb_ids: [12] })
  expect(employeePayload(invalid, { ...employeeDraft(invalid), knowledge_dependency_action: 'replace' }, original.menus)).toMatchObject({ knowledge_dependency_action: 'replace', kb_ids: [12] })
  expect(employeePayload(invalid, { ...employeeDraft(invalid), knowledge_dependency_action: 'replace', kb_ids: '14' }, original.menus)).toMatchObject({ knowledge_dependency_action: 'replace', kb_ids: [14] })
})
it('requires a nonempty replacement and permits explicit removal without stale surviving IDs', () => {
  expect(() => employeePayload(invalid, { ...employeeDraft(invalid), knowledge_dependency_action: 'replace', kb_ids: '' }, [])).toThrow('至少选择')
  expect(employeePayload(invalid, { ...employeeDraft(invalid), knowledge_dependency_action: 'remove' }, [])).toMatchObject({ knowledge_dependency_action: 'remove', kb_ids: [] })
  expect(() => employeePayload({ ...invalid, can_manage_knowledge_dependency: false }, { ...employeeDraft(invalid), knowledge_dependency_action: 'remove' }, [])).toThrow('无权')
})
it('does not replay a server preserve action over a new selection or replay removal from a previous save', () => {
  expect(employeePayload(original, { ...employeeDraft(original), kb_ids: '14' }, [])).toMatchObject({ knowledge_dependency_action: 'replace', kb_ids: [14] })
  expect(employeeDraft({ ...original, knowledge_dependency_action: 'remove' }).knowledge_dependency_action).toBe('')
})

afterEach(() => { vi.unstubAllGlobals() })
const reply = (data: unknown) => new Response(JSON.stringify({ code: 1, data }))
async function setupSave() {
  const { loginSessionKey, loginApi } = await import('../src/client/login-client.ts')
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => key === loginSessionKey ? JSON.stringify({ api: loginApi, token: 'test-only' }) : null })
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
it.each(['replace', 'remove'])('reads back %s before reporting successful saving', async (action) => {
  const fetcher = await setupSave()
  const saved = { ...original, kb_ids: action === 'remove' ? [] : [14], knowledge_rebind_required: false }
  fetcher.mockResolvedValueOnce(reply(null)).mockResolvedValueOnce(reply(saved))
  await saveEmployee(invalid, { ...employeeDraft(invalid), knowledge_dependency_action: action, kb_ids: '14' }, original.menus, new AbortController().signal)
  expect(fetcher.mock.calls.map(([url]) => new URL(url instanceof Request ? url.url : url).pathname)).toEqual(['/api/kb.robot/edit', '/api/kb.robot/detail'])
  const body = fetcher.mock.calls[0]?.[1]?.body
  if (typeof body !== 'string') throw new Error('Missing edit body')
  expect(JSON.parse(body)).toMatchObject({ knowledge_dependency_action: action, kb_ids: saved.kb_ids })
})
it('rejects unchanged or still-invalid readback instead of claiming repair succeeded', async () => {
  const fetcher = await setupSave()
  fetcher.mockResolvedValueOnce(reply(null)).mockResolvedValueOnce(reply(invalid))
  await expect(saveEmployee(invalid, { ...employeeDraft(invalid), knowledge_dependency_action: 'replace', kb_ids: '14' }, [], new AbortController().signal)).rejects.toThrow('回读不一致')
})
it('preserves backend rejection and does not attempt readback after failed saving', async () => {
  const fetcher = await setupSave()
  fetcher.mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'Selection denied' })))
  await expect(saveEmployee(invalid, { ...employeeDraft(invalid), knowledge_dependency_action: 'replace', kb_ids: '14' }, [], new AbortController().signal)).rejects.toThrow('Selection denied')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
