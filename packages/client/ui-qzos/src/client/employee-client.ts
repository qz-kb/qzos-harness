/** QZOS employee configuration adapter; business identity stays in the shared transport. */
import { knowledgeDraft, knowledgeText, knowledgeRequest } from './knowledge-client.ts'
import { loginApi, loginRecord, storedLogin, type LoginRecord } from './login-client.ts'
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
  return { ...knowledgeDraft(row), ...knowledgeDraft(loginRecord(row.flow_config ?? {})), knowledge_dependency_action: '', kb_ids: row.kb_ids.map(knowledgeText).join(','), model_id: `${knowledgeText(row.model_id)}:${knowledgeText(row.model_sub_id)}`, optimize_m_id: `${knowledgeText(row.optimize_m_id)}:${knowledgeText(row.optimize_s_id)}`, search_mode: row.search_mode === 'similar' ? 'semantic' : knowledgeText(row.search_mode) }
}
/** Build a full write, preserving fields not edited by the current tab.
 * @param original - Latest complete detail response.
 * @param draft - Edited UI fields.
 * @param menus - Existing or edited shortcut menus, including image arrays.
 * @returns Existing employee edit API payload.
 */
export function employeePayload(original: LoginRecord, draft: PreviewValues, menus: LoginRecord[]): LoginRecord {
  employeeDraft(original)
  const kbIds = (draft.kb_ids ?? '').split(',').filter(Boolean).map(Number)
  const result: LoginRecord = { ...original, ...draft, menus, kb_ids: kbIds, search_mode: draft.search_mode === 'semantic' ? 'similar' : draft.search_mode }
  for (const key of ['model_id', 'optimize_m_id']) {
    const [main, sub] = (draft[key] ?? '').split(':')
    result[key] = Number(main) || 0; result[key === 'model_id' ? 'model_sub_id' : 'optimize_s_id'] = Number(sub) || 0
  }
  result.flow_config = { ...loginRecord(original.flow_config ?? {}), ...Object.fromEntries(['app_id', 'workflow_id', 'bot_id', 'api_token'].map(key => [key, draft[key] ?? ''])) }
  const readOnly = new Set(['user_id', 'is_enable', 'is_share', 'work_state', 'create_time', 'update_time', 'knowledge_dependency_status', 'knowledge_rebind_required', 'knowledge_dependency_message', 'can_manage_knowledge_dependency', 'digital'])
  const changed = draft.kb_ids !== employeeDraft(original).kb_ids
  const action = draft.knowledge_dependency_action || (changed && !original.knowledge_rebind_required ? kbIds.length ? 'replace' : 'remove' : 'preserve')
  if (!['preserve', 'replace', 'remove'].includes(action)) throw new Error('知识库关联操作异常')
  if (action === 'preserve' && changed) throw new Error('知识库关联已失效，请明确选择重新绑定或移除')
  if (action !== 'preserve' && original.can_manage_knowledge_dependency === false) throw new Error('无权修改知识库关联')
  if (action === 'replace' && (!kbIds.length || kbIds.some(id => !Number.isSafeInteger(id) || id <= 0))) throw new Error('请至少选择一个有效知识库')
  result.knowledge_dependency_action = action
  if (action === 'remove') result.kb_ids = []
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
/** Save configuration and verify explicit knowledge changes through a fresh detail read.
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
  const saved = loginRecord(await knowledgeRequest(`/kb.robot/detail?id=${encodeURIComponent(knowledgeText(original.id))}`, undefined, signal, token))
  const savedDraft = employeeDraft(saved)
  if (payload.knowledge_dependency_action !== 'preserve') {
    const expected = payload.knowledge_dependency_action === 'remove' ? [] : (draft.kb_ids ?? '').split(',').filter(Boolean).map(id => String(Number(id))).sort()
    const actual = (savedDraft.kb_ids ?? '').split(',').filter(Boolean).sort()
    if (saved.knowledge_rebind_required || JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('知识库关联保存回读不一致，请刷新核对后重试')
  }
}

/** Scope a pending correction to its backend, account and conversation record.
 * @param userId - Authenticated business account.
 * @param employeeId - Employee owning the record.
 * @param recordId - Server-owned conversation record.
 * @returns Browser session-storage key containing no credentials.
 */
export function correctionStorageKey(userId: string, employeeId: string, recordId: string): string {
  return 'qzos.correction.v1:' + JSON.stringify([loginApi, userId, employeeId, recordId])
}
const correctionFields = ['correction_key', 'kb_id', 'question', 'answer'] as const
/** Restore only submitted correction fields; invalid saved state must not silently create a new request.
 * @param storage - Current tab's session storage.
 * @param key - Account/employee/record-scoped key.
 * @returns Pending submission, or undefined when none exists.
 */
export function readCorrection(storage: Storage, key: string): PreviewValues | undefined {
  const raw = storage.getItem(key)
  if (raw === null) return undefined
  const value = loginRecord(JSON.parse(raw))
  if (correctionFields.some(field => typeof value[field] !== 'string')
    || !/^[a-zA-Z0-9_-]{8,128}$/.test(String(value.correction_key)) || !/^[1-9][0-9]*$/.test(String(value.kb_id))) {
    throw new Error('Invalid pending correction')
  }
  return knowledgeDraft(Object.fromEntries(correctionFields.map(field => [field, value[field]])))
}
/** Persist the submitted payload before the API call, excluding unrelated UI fields and credentials.
 * @param storage - Current tab's session storage.
 * @param key - Account/employee/record-scoped key.
 * @param draft - Exact correction about to be submitted.
 */
export function rememberCorrection(storage: Storage, key: string, draft: PreviewValues): void {
  storage.setItem(key, JSON.stringify(Object.fromEntries(correctionFields.map(field => [field, draft[field] ?? '']))))
}
