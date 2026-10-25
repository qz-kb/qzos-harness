import { qzosVersionedUrl } from './product-updates.ts'
/** QZOS business authentication; independent from DSH browser/Host credentials. */
declare global {
  var __QZOS_BUSINESS_API__: string | undefined
  var __QZOS_MANAGED_ACCOUNT__: string | undefined
  var __QZOS_PUBLIC_VISITOR_ORIGIN__: string | undefined
}
/** Deployment-injected user identity; authorization remains server-side. */
export const managedAccount = globalThis.__QZOS_MANAGED_ACCOUNT__
/** Same-origin cookies are used only by the enterprise gateway. */
export const loginCredentials: RequestCredentials = managedAccount ? 'same-origin' : 'omit'
/** Business API selected by the private Host composition. */
export const loginApi = managedAccount ? new URL('_qzos/business', document.baseURI).href : globalThis.__QZOS_BUSINESS_API__ ?? 'http://127.0.0.1:3082/api'
/** Public visitor origin configured independently from the authenticated proxy. */
export const publicVisitorApi = globalThis.__QZOS_PUBLIC_VISITOR_ORIGIN__ ?? (managedAccount ? '' : loginApi)
/** Storage key for the API-scoped business credential. */
export const loginSessionKey = 'qzos.business-session.v1'
/** Validated record at the business HTTP boundary. */
export type LoginRecord = Record<string, unknown>
/** Validate untrusted PHP response objects.
 * @param value - Untrusted response value.
 * @returns Validated response or mapped presentation value.
 */
export function loginRecord(value: unknown): LoginRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid QZOS response')
  return value as LoginRecord
}
/** Preserve the backend rejection code without exposing credentials. */
export class LoginError extends Error {
  constructor(message: string, readonly code: number) { super(message) }
}
/** Send only login-related requests to the explicitly selected local test backend.
 * @param path - Business API path and query.
 * @param body - Optional request payload.
 * @param token - Business authentication token.
 * @param signal - Caller cancellation signal.
 * @returns Validated response or mapped presentation value.
 */
export async function loginRequest(path: string, body?: LoginRecord, token?: string, signal?: AbortSignal): Promise<LoginRecord> {
  const response = await fetch(qzosVersionedUrl(`${loginApi}${path}`), {
    method: body ? 'POST' : 'GET', credentials: loginCredentials, redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', terminal: '4', version: '4.8.0', ...token ? { token } : {} },
    ...body ? { body: JSON.stringify(body) } : {},
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  })
  if (managedAccount && [401, 403].includes(response.status)) globalThis.location.assign('/')
  if (!response.ok) throw new Error(`QZOS HTTP ${response.status}`)
  const envelope = loginRecord(await response.json())
  if (envelope.code !== 1) throw new LoginError(typeof envelope.msg === 'string' ? envelope.msg : 'QZOS request failed', typeof envelope.code === 'number' ? envelope.code : -1)
  return Array.isArray(envelope.data) && envelope.data.length === 0 ? {} : loginRecord(envelope.data)
}
/** Read only the business credential owned by this local API, never DSH's token.
 * @param storage - Browser session storage.
 * @returns Validated response or mapped presentation value.
 */
export function storedLogin(storage: Storage): string | undefined {
  if (managedAccount) return `managed:${managedAccount}`
  try {
    const raw = storage.getItem(loginSessionKey)
    if (!raw) return undefined
    const value = loginRecord(JSON.parse(raw))
    return value.api === loginApi && typeof value.token === 'string' && value.token ? value.token : undefined
  } catch { return undefined }
}
