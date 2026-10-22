/** QZOS knowledge transport and native DSH resource provider. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import { loginApi, loginRecord, storedLogin, LoginError, type LoginRecord } from './login-client.ts'
import type { Example } from './catalog.ts'
import type { PreviewRow } from './resource-fixtures.ts'
import type { PreviewValues } from './resource-schema.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface ResourceProtocolMap { 'qzos-knowledge': LoginRecord }
}
/** Read scalar fields without accepting object coercion from the network.
 * @param value - Untrusted response value.
 * @returns Validated response or mapped presentation value.
 */
export function knowledgeText(value: unknown): string {
  if (value == null) return ''
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Invalid QZOS field')
  return String(value)
}
/** Decode a collection without turning malformed responses into an empty result.
 * @param value - Untrusted response value.
 * @returns Validated response or mapped presentation value.
 */
export function knowledgeRows(value: unknown): LoginRecord[] {
  if (!Array.isArray(value)) throw new Error('Invalid QZOS collection')
  return value.map(loginRecord)
}
/** Make an authenticated business request; credentials never enter a resource address.
 * @param path - Business API path and query.
 * @param body - Optional request payload.
 * @param signal - Caller cancellation signal.
 * @param expectedToken - Credential captured when the owning view opened.
 * @returns Validated response or mapped presentation value.
 */
export async function knowledgeRequest(
  path: string, body?: LoginRecord | FormData, signal?: AbortSignal, expectedToken?: string,
): Promise<unknown> {
  const token = storedLogin(sessionStorage)
  if (expectedToken !== undefined && expectedToken !== token) throw new LoginError('登录账号已变更，请重新打开页面', -1)
  if (!token) throw new LoginError('请先登录 QZOS', -1)
  const response = await fetch(`${loginApi}${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
    headers: { terminal: '4', version: '4.8.0', token, ...body instanceof FormData ? {} : { 'Content-Type': 'application/json' } },
    ...body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {},
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
  })
  if (storedLogin(sessionStorage) !== token) throw new LoginError('登录账号已变更，请重新打开页面', -1)
  if (!response.ok) throw new Error(`QZOS HTTP ${response.status}`)
  const result = loginRecord(await response.json())
  if (result.code !== 1) throw new LoginError(typeof result.msg === 'string' ? result.msg : 'QZOS request failed', Number(result.code))
  return result.data
}
/** Read every server page, preserving errors and refusing truncated pagination.
 * @param path - Business API path and query.
 * @param signal - Caller cancellation signal.
 * @returns Validated response or mapped presentation value.
 */
export async function knowledgePages(path: string, signal?: AbortSignal): Promise<LoginRecord[]> {
  const result: LoginRecord[] = []
  for (let page = 1; ; page++) {
    const data = loginRecord(await knowledgeRequest(`${path}${path.includes('?') ? '&' : '?'}page_no=${page}&page_size=100`, undefined, signal))
    const rows = knowledgeRows(data.lists)
    const total = Number(data.count)
    if (!Number.isSafeInteger(total) || total < 0 || (!rows.length && result.length < total)) throw new Error('Invalid QZOS pagination')
    result.push(...rows)
    if (result.length >= total) return result
  }
}
/** Register API reads under the framework resource lifecycle; refresh changes the address revision.
 * @param ctx - Plugin context owning resource registration.
 */
export function installKnowledgeResources(ctx: Context): void {
  ctx.effect(() => ctx.resources.register<'qzos-knowledge'>({
    protocol: 'qzos-knowledge',
    async *open(address, { signal }) {
      try {
        const url = new URL(address)
        const id = url.searchParams.get('id') ?? ''
        const fd = url.searchParams.get('fd') ?? ''
        let value: LoginRecord
        switch (url.pathname.slice(1)) {
          case 'list': {
            const [rows, models] = await Promise.all([knowledgePages('/kb.know/lists?type=0', signal), knowledgeRequest('/index/models', undefined, signal)])
            value = { rows, models }; break
          }
          case 'acl': {
            const [rows, subjects] = await Promise.all([
              knowledgeRequest(`/kb.documentAcl/rules?fd_id=${encodeURIComponent(fd)}`, undefined, signal),
              knowledgeRequest(`/kb.documentAcl/subjects?fd_id=${encodeURIComponent(fd)}`, undefined, signal),
            ])
            value = { rows: knowledgeRows(rows), subjects: loginRecord(subjects) }; break
          }
          case 'detail': {
            const detail = loginRecord(await knowledgeRequest(`/kb.know/detail?id=${encodeURIComponent(id)}`, undefined, signal))
            value = { detail }; break
          }
          case 'files': value = { rows: await knowledgePages(`/kb.know/files?kb_id=${encodeURIComponent(id)}`, signal) }; break
          case 'fragments': value = { rows: await knowledgePages(`/kb.teach/datas?kb_id=${encodeURIComponent(id)}&fd_id=${encodeURIComponent(fd)}`, signal) }; break
          case 'members': value = { rows: knowledgeRows(await knowledgeRequest(`/kb.know/teamLists?kb_id=${encodeURIComponent(id)}`, undefined, signal)) }; break
          default: throw new Error('Unknown QZOS resource')
        }
        yield { ok: true as const, value }
      } catch (error) {
        if (signal.aborted) return
        yield { ok: false as const, error: Object.assign(new Error(error instanceof Error ? error.message : 'QZOS request failed'), { code: 'gateway/internal' as const, details: {}, isDSHRemoteError: true as const }) }
      }
    },
  }), 'qzos knowledge API resources')
}
/** Map server cards to existing presentation fields, without synthetic counts or permissions.
 * @param row - Server record.
 * @returns Validated response or mapped presentation value.
 */
export function knowledgeCard(row: LoginRecord): Example {
  return { id: knowledgeText(row.id), title: knowledgeText(row.name ?? ''), description: knowledgeText(row.intro ?? ''), category: '', content: '', status: Number(row.is_enable) === 1 ? 'ready' : 'pending', scope: Number(row.is_super) === 1 ? 'owned' : 'shared', values: { image: knowledgeText(row.image ?? ''), team_people: knowledgeText(row.team_people ?? 0) } }
}
/** Preserve numeric model identities in string-valued form controls.
 * @param row - Server record.
 * @returns Validated response or mapped presentation value.
 */
export function knowledgeDraft(row: LoginRecord): PreviewValues {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => typeof value === 'string' || typeof value === 'number').map(([key, value]) => [key, knowledgeText(value)]))
}
/** Map documents, fragments and memberships to the existing table columns.
 * @param rows - Server records.
 * @param kind - Existing table presentation kind.
 * @returns Validated response or mapped presentation value.
 */
export function knowledgeTable(rows: LoginRecord[], kind: 'files' | 'fragments' | 'members'): PreviewRow[] {
  return rows.map(row => kind === 'files' ? { ...knowledgeDraft(row), id: knowledgeText(row.id), name: knowledgeText(row.name), waiting: knowledgeText(row.wait_sum ?? 0), trained: knowledgeText(row.ok_sum ?? 0), totalData: knowledgeText(row.total_sum ?? row.count ?? 0), createdAt: knowledgeText(row.create_time ?? ''), status: row.parse ? 'processing' : '' }
    : kind === 'fragments' ? { ...knowledgeDraft(row), id: knowledgeText(row.uuid), name: knowledgeText(row.question ?? ''), status: Number(row.status) === 2 ? 'learned' : Number(row.status) === 3 ? 'failedLearn' : Number(row.status) === 1 ? 'learning' : 'waitingLearn', consumed: knowledgeText(row.tokens ?? 0), updatedAt: knowledgeText(row.update_time ?? '') }
      : { ...knowledgeDraft(row), id: knowledgeText(row.id), name: knowledgeText(row.nickname), role: Number(row.owned) === 1 ? 'owner' : 'member', power: Number(row.power) === 1 ? 'manage' : Number(row.power) === 2 ? 'edit' : 'view' })
}
/** Save only fields supported by the existing knowledge management endpoint.
 * @param id - Existing knowledge ID, or null to create.
 * @param draft - Current form fields.
 * @param signal - Caller cancellation signal.
 */
export async function saveKnowledge(id: string | null, draft: PreviewValues, signal?: AbortSignal): Promise<void> {
  const token = storedLogin(sessionStorage)
  let image = draft.image ?? ''
  if (image.startsWith('data:')) {
    const blob = await (await fetch(image)).blob()
    const form = new FormData(); form.append('file', blob, `cover.${blob.type.split('/')[1] ?? 'png'}`)
    const uploaded = loginRecord(await knowledgeRequest('/upload/image', form, signal, token)); image = knowledgeText(uploaded.uri ?? uploaded.url ?? '')
  }
  await knowledgeRequest(`/kb.know/${id ? 'edit' : 'add'}`, { ...id ? { id: Number(id) } : { embedding_model_id: Number(draft.embedding_model_id) }, name: draft.name, intro: draft.intro, image, documents_model_id: Number(draft.documents_model_id?.split(':')[0]), documents_model_sub_id: Number(draft.documents_model_id?.split(':')[1] ?? draft.documents_model_sub_id) }, signal, token)
}
