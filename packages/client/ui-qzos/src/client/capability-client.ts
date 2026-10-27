/** Existing market and template contracts, scoped to the current business login. */
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { qzosApiVersion } from './product-updates.ts'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { loginApi, loginCredentials, loginRecord, storedLogin, LoginError, type LoginRecord } from './login-client.ts'

/** Create from a trusted server template and verify the saved employee before navigating.
 * @param template - Selected enabled template.
 * @param name - New employee name.
 * @param model - Existing model and submodel identifiers.
 * @param signal - View lifetime.
 * @param token - Captured login.
 * @returns Saved employee identity.
 */
export async function applyEmployeeTemplate(
  template: string, name: string, model: string, signal: AbortSignal, token?: string,
): Promise<string> {
  if (!/^[1-9]\d*$/.test(template) || !/^[1-9]\d*:[1-9]\d*$/.test(model) || !name.trim()) throw new Error('请选择模板、名称和可用模型')
  const [modelId, subId] = model.split(':').map(Number)
  const result = loginRecord(await knowledgeRequest('/kb.robot/add', { template_id: Number(template), name: name.trim(), model_id: modelId, model_sub_id: subId }, signal, token))
  const id = knowledgeText(result.id)
  if (!/^[1-9]\d*$/.test(id)) throw new Error('员工创建结果无效')
  const saved = loginRecord(await knowledgeRequest(`/kb.robot/detail?id=${id}`, undefined, signal, token))
  if (knowledgeText(saved.id) !== id || saved.name !== name.trim() || Number(saved.model_id) !== modelId || Number(saved.model_sub_id) !== subId) throw new Error('员工保存回读不一致')
  return id
}
/** Resolve selectable model pairs from the existing model catalog.
 * @param value - Authenticated model catalog.
 * @returns Selectable choices with server readiness preserved.
 */
export function capabilityModels(value: LoginRecord): { value: string; label: string; disabled: boolean }[] {
  return knowledgeRows(value.chatModels).flatMap(parent => knowledgeRows(parent.models).map(row => ({
    value: `${knowledgeText(parent.id)}:${knowledgeText(row.id)}`, label: `${knowledgeText(parent.name)} / ${knowledgeText(row.alias ?? row.name)}`,
    disabled: parent.is_ready === false || row.is_ready === false,
  })))
}
/** Download only a server-signed market package without credentials in a navigation URL.
 * @param entry - Market resource identity.
 * @param signal - View lifetime.
 * @param token - Captured login.
 * @returns Signed offline package.
 */
export async function exportSkill(entry: LoginRecord, signal: AbortSignal, token?: string): Promise<Blob> {
  if (!token || storedLogin(sessionStorage) !== token) throw new LoginError('登录账号已变更，请重新打开页面', -1)
  const response = await fetch(`${loginApi}/skill.market/exportOffline`, {
    method: 'POST', credentials: loginCredentials, redirect: 'error', cache: 'no-store',
    headers: { token, terminal: '4', version: qzosApiVersion, 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource_id: entry.resource_id, version: entry.version, request_id: randomUUID() }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
  })
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const error = loginRecord(await response.json()); throw new Error(knowledgeText(error.msg))
  }
  if (!response.ok || !response.headers.get('Content-Type')?.startsWith('application/zip')) throw new Error(`QZOS HTTP ${response.status}`)
  const result = await response.blob()
  signal.throwIfAborted()
  if (storedLogin(sessionStorage) !== token) throw new LoginError('登录账号已变更，请重新打开页面', -1)
  return result
}
