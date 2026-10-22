/** QZOS employee configuration adapter; business identity stays in the shared transport. */
import { knowledgeDraft, knowledgeText, knowledgeRequest } from './knowledge-client.ts'
import { loginRecord, storedLogin, type LoginRecord } from './login-client.ts'
import type { Example } from './catalog.ts'
import type { PreviewValues } from './resource-schema.ts'

/** Map an owned server employee to the existing card.
 * @param row - Owned employee list record.
 * @returns Existing card shape, with a real server identity.
 */
export function employeeCard(row: LoginRecord): Example {
  return { id: knowledgeText(row.id), title: knowledgeText(row.name), description: knowledgeText(row.intro), category: '', content: '', scope: Number(row.is_public) === 1 ? 'public' : 'private', status: Number(row.is_enable) === 1 ? 'ready' : 'pending', values: knowledgeDraft(row) }
}
/** Keep nested configuration intact while exposing existing string fields.
 * @param row - Full employee configuration.
 * @returns Form fields for the existing controls.
 */
export function employeeDraft(row: LoginRecord): PreviewValues {
  if (!Array.isArray(row.kb_ids) || !Array.isArray(row.menus)) throw new Error('员工配置不完整，请重新读取')
  return { ...knowledgeDraft(row), ...knowledgeDraft(loginRecord(row.flow_config ?? {})), kb_ids: row.kb_ids.map(knowledgeText).join(','), model_id: `${knowledgeText(row.model_id)}:${knowledgeText(row.model_sub_id)}`, optimize_m_id: `${knowledgeText(row.optimize_m_id)}:${knowledgeText(row.optimize_s_id)}`, search_mode: row.search_mode === 'similar' ? 'semantic' : knowledgeText(row.search_mode) }
}
/** Build a full write, preserving fields not edited by the current tab.
 * @param original - Latest complete detail response.
 * @param draft - Edited UI fields.
 * @param menus - Existing or edited shortcut menus, including image arrays.
 * @returns Existing employee edit API payload.
 */
export function employeePayload(original: LoginRecord, draft: PreviewValues, menus: LoginRecord[]): LoginRecord {
  employeeDraft(original)
  const result: LoginRecord = { ...original, ...draft, menus, kb_ids: (draft.kb_ids ?? '').split(',').filter(Boolean).map(Number), search_mode: draft.search_mode === 'semantic' ? 'similar' : draft.search_mode }
  for (const key of ['model_id', 'optimize_m_id']) {
    const [main, sub] = (draft[key] ?? '').split(':')
    result[key] = Number(main) || 0; result[key === 'model_id' ? 'model_sub_id' : 'optimize_s_id'] = Number(sub) || 0
  }
  result.flow_config = { ...loginRecord(original.flow_config ?? {}), ...Object.fromEntries(['app_id', 'workflow_id', 'bot_id', 'api_token'].map(key => [key, draft[key] ?? ''])) }
  const readOnly = new Set(['user_id', 'is_enable', 'is_share', 'work_state', 'create_time', 'update_time', 'knowledge_dependency_status', 'knowledge_rebind_required', 'knowledge_dependency_message', 'can_manage_knowledge_dependency', 'digital'])
  if (original.knowledge_rebind_required && draft.kb_ids !== employeeDraft(original).kb_ids) throw new Error('知识库关联已失效，请先在 QZOS 确认关联处理，避免覆盖原配置')
  return Object.fromEntries(Object.entries(result).filter(([key]) => !readOnly.has(key)))
}
/** Upload a selected image with the same business identity as the following write.
 * @param image - Existing URL or newly selected data URL.
 * @param signal - View lifetime cancellation.
 * @param token - Credential captured by the caller.
 * @returns Backend-owned image URI.
 */
export async function employeeImage(image: string, signal: AbortSignal, token: string | undefined): Promise<string> {
  if (!image.startsWith('data:')) return image
  const blob = await (await fetch(image)).blob()
  const form = new FormData(); form.append('file', blob, 'employee.png')
  const uploaded = loginRecord(await knowledgeRequest('/upload/image', form, signal, token))
  return knowledgeText(uploaded.uri ?? uploaded.url)
}
/** Save full employee configuration through the existing backend.
 * @param original - Full configuration response.
 * @param draft - Current form values.
 * @param menus - Shortcut menus to preserve or save.
 * @param signal - View lifetime cancellation.
 */
export async function saveEmployee(original: LoginRecord, draft: PreviewValues, menus: LoginRecord[], signal: AbortSignal): Promise<void> {
  const token = storedLogin(sessionStorage)
  const payload = employeePayload(original, draft, menus)
  payload.image = await employeeImage(knowledgeText(payload.image), signal, token)
  payload.icons = await employeeImage(knowledgeText(payload.icons), signal, token)
  await knowledgeRequest('/kb.robot/edit', payload, signal, token)
}
