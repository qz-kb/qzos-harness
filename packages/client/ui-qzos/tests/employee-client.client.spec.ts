/** Configuration writes preserve hidden server state instead of replaying mock defaults. */
import { expect, it } from 'vitest'
import { employeeCard, employeeDraft, employeePayload } from '../src/client/employee-client.ts'

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
