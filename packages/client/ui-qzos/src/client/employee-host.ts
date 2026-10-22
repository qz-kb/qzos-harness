/** Authenticated same-origin calls to the private QZOS Host adapter. */
import { loginRecord } from './login-client.ts'

/** Update Host business authorization or bind a new native employee Session.
 * @param body - Explicit operation; tokens travel only in request bodies, never URLs or model messages.
 * @param signal - UI operation cancellation.
 * @returns Completion after Host validation and any durable binding write.
 */
export async function employeeHost(body: { action: 'authorize'; token: string } | { action: 'logout' } | {
  action: 'bind'
  token: string
  sessionId: string
  employeeId: string
}, signal?: AbortSignal): Promise<void> {
  const response = await fetch(new URL('qzos/employees', document.baseURI), {
    method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
  })
  const result = loginRecord(await response.json().catch(() => { throw new Error('员工服务尚未启动，请用固定命令重启 DSH') }))
  if (!response.ok || result.ok !== true) throw new Error(typeof result.message === 'string' ? result.message : '员工服务请求失败')
}
