/** Private original downloads never put business credentials in navigation URLs. */
import { loginApi, loginCredentials, loginRecord, storedLogin, LoginError } from './login-client.ts'

/** Fetch only a managed QZOS source, rejecting errors and stale identities before saving.
 * @param path - Server-provided managed download path.
 * @param signal - Owning view lifetime.
 * @param expectedToken - Login captured when the view opened.
 * @returns The authenticated original bytes.
 */
export async function downloadOriginal(path: string, signal: AbortSignal, expectedToken: string | undefined): Promise<Blob> {
  if (!/^\/api\/kb\.file_gateway\/download\?object_id=[a-f0-9]{64}$/.test(path)) throw new Error('Invalid managed source')
  const token = storedLogin(sessionStorage)
  if (!token || token !== expectedToken) throw new LoginError('登录账号已变更，请重新打开页面', -1)
  const lifetime = AbortSignal.any([signal, AbortSignal.timeout(60000)])
  lifetime.throwIfAborted()
  const response = await fetch(`${loginApi}${path.slice(4)}`, {
    headers: { token, terminal: '4', version: '4.8.0' }, credentials: loginCredentials, redirect: 'error', cache: 'no-store', signal: lifetime,
  })
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    const error = loginRecord(await response.json())
    throw new LoginError(typeof error.msg === 'string' ? error.msg : 'QZOS download failed', Number(error.code))
  }
  if (!response.ok) throw new Error(`QZOS HTTP ${response.status}`)
  const blob = await response.blob()
  lifetime.throwIfAborted()
  if (storedLogin(sessionStorage) !== token) throw new LoginError('登录账号已变更，请重新打开页面', -1)
  return blob
}

/** Enumerate existing lifecycle edges; the server remains authoritative for each actor.
 * @param state - Current lifecycle state.
 * @returns Permitted state targets before actor-specific checks.
 */
export function lifecycleTargets(state: number): number[] {
  return state === 0 ? [1] : state === 1 ? [0, 2] : state === 2 ? [0, 3] : state === 3 ? [0] : []
}
