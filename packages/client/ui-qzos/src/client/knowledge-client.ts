import { qzosVersionedUrl, qzosSurface, qzosClientVersion, qzosApiVersion } from './product-updates.ts'
/** QZOS knowledge transport and native DSH resource provider. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-resources/client'
import { loginApi, loginCredentials, managedAccount, loginRecord, storedLogin, LoginError, type LoginRecord } from './login-client.ts'
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
  const response = await fetch(qzosVersionedUrl(`${loginApi}${path}`), {
    method: body ? 'POST' : 'GET', credentials: loginCredentials, redirect: 'error', cache: 'no-store',
    headers: { terminal: '4', version: qzosApiVersion, token, ...body instanceof FormData ? {} : { 'Content-Type': 'application/json' } },
    ...body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {},
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
  })
  if (managedAccount && [401, 403].includes(response.status)) globalThis.location.assign('/')
  if (storedLogin(sessionStorage) !== token) throw new LoginError('登录账号已变更，请重新打开页面', -1)
  const result = loginRecord(await response.json().catch(() => { throw new Error(`QZOS HTTP ${response.status}`) }))
  if (!response.ok && typeof result.msg !== 'string') throw new Error(`QZOS HTTP ${response.status}`)
  if (result.code !== 1) throw new LoginError(typeof result.msg === 'string' ? result.msg : 'QZOS request failed', Number(result.code))
  if (!response.ok) throw new Error(`QZOS HTTP ${response.status}`)
  return result.data
}
/** Read one server page and retain its authoritative total for the pager.
 * @param path - Business API path and query.
 * @param page - One-based page number.
 * @param pageSize - Requested rows per page.
 * @param signal - Caller cancellation signal.
 * @returns Validated rows plus pagination metadata.
 */
export async function knowledgePage(path: string, page: number, pageSize: number, signal?: AbortSignal): Promise<{ rows: LoginRecord[]; total: number; page: number; pageSize: number }> {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error('Invalid QZOS pagination')
  const data = loginRecord(await knowledgeRequest(`${path}${path.includes('?') ? '&' : '?'}page_no=${page}&page_size=${pageSize}`, undefined, signal))
  const rows = knowledgeRows(data.lists)
  const total = Number(data.count)
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid QZOS pagination')
  return { rows, total, page, pageSize }
}
/** Read every server page with a bounded traversal; callers that can paginate should use knowledgePage.
 * @param path - Business API path and query.
 * @param signal - Caller cancellation signal.
 * @returns Validated response or mapped presentation value.
 */
export async function knowledgePages(path: string, signal?: AbortSignal): Promise<LoginRecord[]> {
  const result: LoginRecord[] = []
  const maxPages = 100
  for (let page = 1; page <= maxPages; page++) {
    const data = loginRecord(await knowledgeRequest(`${path}${path.includes('?') ? '&' : '?'}page_no=${page}&page_size=100`, undefined, signal))
    const rows = knowledgeRows(data.lists)
    const total = Number(data.count)
    if (!Number.isSafeInteger(total) || total < 0 || (!rows.length && result.length < total)) throw new Error('Invalid QZOS pagination')
    result.push(...rows)
    if (result.length >= total) return result
  }
  throw new Error('QZOS pagination exceeded the page limit')
}
/** Read local connections/history even when new market requests are disabled.
 * @param signal - Owning resource lifetime.
 * @returns Authorized local rows and explicit market availability.
 */
export async function readConnections(signal: AbortSignal): Promise<LoginRecord> {
  let marketDisabled = false
  const [rows, requests, calls] = await Promise.all([
    knowledgeRequest('/plugin.connection/available', undefined, signal),
    knowledgeRequest('/plugin.request/mine', undefined, signal).catch((error: unknown) => {
      if (!(error instanceof LoginError) || error.message !== 'MARKET_DISABLED') throw error
      marketDisabled = true
      return []
    }),
    knowledgeRequest('/plugin.connection/calls', undefined, signal),
  ])
  return { rows: knowledgeRows(rows), requests: knowledgeRows(requests), calls: knowledgeRows(calls), marketDisabled }
}
/** Register API reads under the framework resource lifecycle; refresh changes the address revision.
 * @param ctx - Plugin context owning resource registration.
 * @returns Refresh a retained catalog without discarding its current cards.
 */
export function installKnowledgeResources(ctx: Context): (panel: string) => void {
  const refreshes = new EventTarget()
  ctx.effect(() => ctx.resources.register<'qzos-knowledge'>({
    protocol: 'qzos-knowledge',
    async *open(address, { signal }) {
      try {
        const url = new URL(address)
        const id = url.searchParams.get('id') ?? ''
        const fd = url.searchParams.get('fd') ?? ''
        let value: LoginRecord
        const kind = url.pathname.slice(1)
        if (kind === 'list' || kind === 'employees') {
          const all = url.searchParams.get('all') === '1'
          const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
          const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size')) || 24))
          const type = url.searchParams.get('type') ?? (kind === 'list' ? '1' : ' ')
          const keyword = url.searchParams.get('keyword') ?? ''
          const path = kind === 'list'
            ? `/kb.know/lists?type=${encodeURIComponent(type)}`
            : `/kb.robot/lists?type=${encodeURIComponent(type)}&keyword=${encodeURIComponent(keyword)}`
          do {
            // Subscribe before fetching so a refresh during the request queues one more read.
            let resume!: () => void
            const refreshed = new Promise<void>((resolve) => {
              resume = () => { refreshes.removeEventListener(kind, resume); signal.removeEventListener('abort', resume); resolve() }
              refreshes.addEventListener(kind, resume, { once: true })
              signal.addEventListener('abort', resume, { once: true })
              if (signal.aborted) resume()
            })
            try {
              try {
                if (all) {
                  const rows = await knowledgePages(path, signal)
                  if (signal.aborted) return
                  yield { ok: true as const, value: { rows, total: rows.length, page: 1, pageSize: rows.length } }
                } else {
                  const result = await knowledgePage(path, page, pageSize, signal)
                  if (signal.aborted) return
                  yield { ok: true as const, value: result }
                }
              } catch (error) {
                if (signal.aborted) return
                yield { ok: false as const, error: Object.assign(new Error(error instanceof Error ? error.message : 'QZOS request failed'), { code: 'gateway/internal' as const, details: {}, isDSHRemoteError: true as const }) }
              }
              await refreshed
            } finally { resume() }
          } while (!signal.aborted)
          return
        }
        const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
        const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size')) || 15))
        switch (kind) {
          case 'product-updates': value = loginRecord(await knowledgeRequest(`/productUpdate/overview?surface=${qzosSurface()}&version=${qzosClientVersion}&check=${Number(url.searchParams.get('revision') ?? 0) > 0 ? 1 : 0}`, undefined, signal)); break
          case 'models': value = { models: loginRecord(await knowledgeRequest('/index/models', undefined, signal)) }; break
          case 'employee-square': {
            const [categories, page, used] = await Promise.all([
              knowledgeRequest('/kb.square/category', undefined, signal),
              knowledgeRequest(`/kb.square/lists?cid=${encodeURIComponent(url.searchParams.get('category') ?? '')}&keyword=${encodeURIComponent(url.searchParams.get('keyword') ?? '')}&page_no=${encodeURIComponent(url.searchParams.get('page') ?? '1')}&page_size=25`, undefined, signal),
              knowledgeRequest('/kb.square/record', undefined, signal),
            ])
            value = { categories: knowledgeRows(categories), ...loginRecord(page), used: knowledgeRows(used) }; break
          }
          case 'capability-skills': value = { rows: knowledgeRows(await knowledgeRequest('/skill.skill/lists', undefined, signal)) }; break
          case 'capability-connectors': value = await readConnections(signal); break
          case 'capability-templates': {
            const [groups, models] = await Promise.all([
              knowledgeRequest('/chat.skill/lists', undefined, signal), knowledgeRequest('/index/models', undefined, signal),
            ])
            value = {
              rows: knowledgeRows(groups).flatMap(group => knowledgeRows(group.skill).map(row => ({ ...row, category: group.name }))),
              models: loginRecord(models),
            }; break
          }
          case 'capability-market': value = { rows: knowledgeRows(loginRecord(await knowledgeRequest('/market.catalog/lists', undefined, signal)).resources) }; break
          case 'employee-skills': {
            const [rows, bindings] = await Promise.all([knowledgeRequest('/skill.skill/lists', undefined, signal), knowledgeRequest(`/skill.skill/bindings?robot_id=${id}`, undefined, signal)])
            value = { rows: knowledgeRows(rows), bound: knowledgeRows(loginRecord(bindings).skills) }; break
          }
          case 'employee-plugins': {
            const [rows, bound] = await Promise.all([knowledgeRequest('/plugin.connection/available', undefined, signal), knowledgeRequest(`/plugin.connection/bindings?robot_id=${id}`, undefined, signal)])
            value = { rows: knowledgeRows(rows), bound: knowledgeRows(bound) }; break
          }
          case 'employee-session-records': value = { rows: knowledgeRows(await knowledgeRequest(`/kb.dsh/records?session_id=${encodeURIComponent(id)}`, undefined, signal)) }; break
          case 'employee-share-categories': value = { rows: knowledgeRows(await knowledgeRequest('/kb.robot/categoryLists', undefined, signal)) }; break
          case 'employee': value = { detail: loginRecord(await knowledgeRequest(`/kb.robot/detail?id=${encodeURIComponent(id)}`, undefined, signal)) }; break
          case 'employee-keys': value = { rows: knowledgeRows(await knowledgeRequest(`/kb.publish/keyLists?publish_id=${encodeURIComponent(id)}`, undefined, signal)) }; break
          case 'employee-stats': value = loginRecord(await knowledgeRequest(`/kb.chat/dataCount?robot_id=${encodeURIComponent(id)}`, undefined, signal)); break
          case 'employee-usage': value = loginRecord(await knowledgeRequest(`/kb.dsh/summary?robot_id=${encodeURIComponent(id)}`, undefined, signal)); break
          case 'employee-feedback': {
            const to = Math.floor(Date.now() / 1000)
            value = loginRecord(await knowledgeRequest(`/v1/kb/feedback/summary?robot_id=${encodeURIComponent(id)}&from=${to - 30 * 86400}&to=${to}`, undefined, signal)); break
          }
          case 'employee-records': {
            const feedback = ['0', '1'].includes(url.searchParams.get('is_feedback') ?? '') ? url.searchParams.get('is_feedback') : '-1'
            value = await knowledgePage(`/kb.chat/dataRecord?robot_id=${encodeURIComponent(id)}&is_feedback=${encodeURIComponent(feedback ?? '-1')}`, page, pageSize, signal); break
          }
          case 'employee-publications': value = await knowledgePage(`/kb.share/lists?robot_id=${encodeURIComponent(id)}&type=${['1', '2', '4'].includes(url.searchParams.get('type') ?? '') ? url.searchParams.get('type') : 1}`, page, pageSize, signal); break
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
          case 'files': value = await knowledgePage(`/kb.know/files?kb_id=${encodeURIComponent(id)}&keyword=${encodeURIComponent(url.searchParams.get('keyword') ?? '')}`, page, pageSize, signal); break
          case 'file': {
            value = loginRecord(await knowledgeRequest(`/kb.file_gateway/original?fd_id=${encodeURIComponent(fd)}`, undefined, signal))
            if (value.can_edit === true) value.lifecycle = loginRecord(await knowledgeRequest(`/kb.lifecycle/detail?fd_id=${encodeURIComponent(fd)}`, undefined, signal))
            break
          }
          case 'parse': {
            const status = loginRecord(await knowledgeRequest(`/kb.teach/parseStatus?kb_id=${encodeURIComponent(id)}&fd_id=${encodeURIComponent(fd)}`, undefined, signal))
            const processing = status.processing ? loginRecord(status.processing) : {}
            const review = Array.isArray(processing.actions) && processing.actions.includes('review')
              ? loginRecord(await knowledgeRequest(`/kb.teach/parseReview?kb_id=${encodeURIComponent(id)}&fd_id=${encodeURIComponent(fd)}&job_key=${encodeURIComponent(knowledgeText(status.job_key))}`, undefined, signal)) : null
            value = { status, review }; break
          }
          case 'fragments': {
            const status = ['0', '1', '2', '3'].includes(url.searchParams.get('status') ?? '') ? `&status=${url.searchParams.get('status')}` : ''
            const result = await knowledgePage(`/kb.teach/datas?kb_id=${encodeURIComponent(id)}&fd_id=${encodeURIComponent(fd)}&keyword=${encodeURIComponent(url.searchParams.get('keyword') ?? '')}${status}`, page, pageSize, signal)
            const [learning, qa] = await Promise.all([
              knowledgeRequest('/kb.teach/detection', { kb_id: Number(id), fd_id: Number(fd), uuids: result.rows.slice(0, 50).map(row => row.uuid) }, signal),
              knowledgeRequest('/kb.teach/qaCheck', { fd_ids: [Number(fd)] }, signal),
            ])
            value = { ...result, learning: loginRecord(learning), qa: loginRecord(qa) }; break
          }
          case 'import-capabilities': value = { capabilities: loginRecord(await knowledgeRequest('/kb.teach/importCapabilities', undefined, signal)) }; break
          case 'member-options': value = await knowledgePage(`/kb.know/teamUsers?kb_id=${encodeURIComponent(id)}&keyword=${encodeURIComponent(url.searchParams.get('query') ?? '')}`, page, pageSize, signal); break
          case 'members': {
            const [result, profile] = await Promise.all([
              knowledgePage(`/kb.know/teamLists?kb_id=${encodeURIComponent(id)}`, page, pageSize, signal),
              knowledgeRequest('/user/info', undefined, signal),
            ])
            value = { ...result, currentSn: knowledgeText(loginRecord(profile).sn) }; break
          }
          case 'members-all': {
            const [rows, profile] = await Promise.all([
              knowledgePages(`/kb.know/teamLists?kb_id=${encodeURIComponent(id)}`, signal),
              knowledgeRequest('/user/info', undefined, signal),
            ])
            value = { rows, currentSn: knowledgeText(loginRecord(profile).sn) }; break
          }
          default: throw new Error('Unknown QZOS resource')
        }
        yield { ok: true as const, value }
      } catch (error) {
        if (signal.aborted) return
        yield { ok: false as const, error: Object.assign(new Error(error instanceof Error ? error.message : 'QZOS request failed'), { code: 'gateway/internal' as const, details: {}, isDSHRemoteError: true as const }) }
      }
    },
  }), 'qzos knowledge API resources')
  return (panel) => { refreshes.dispatchEvent(new Event(panel === 'knowledge' ? 'list' : panel)) }
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
  return rows.map(row => kind === 'files' ? { ...knowledgeDraft(row), id: knowledgeText(row.id), name: knowledgeText(row.name), waiting: knowledgeText(row.wait_sum ?? 0), trained: knowledgeText(row.ok_sum ?? 0), totalData: knowledgeText(row.total_sum ?? row.count ?? 0), createdAt: knowledgeText(row.create_time ?? ''), parseState: row.parse ? knowledgeText(loginRecord(row.parse).status_msg) : '', hasParse: row.parse ? '1' : '0', status: row.parse && [0, 1].includes(Number(loginRecord(row.parse).status)) ? 'processing' : '' }
    : kind === 'fragments' ? { ...knowledgeDraft(row), id: knowledgeText(row.uuid), name: knowledgeText(row.question ?? ''), status: Number(row.status) === 2 ? 'learned' : Number(row.status) === 3 ? 'failedLearn' : Number(row.status) === 1 ? 'learning' : 'waitingLearn', consumed: knowledgeText(row.tokens ?? 0), updatedAt: knowledgeText(row.update_time ?? '') }
      : { ...knowledgeDraft(row), id: knowledgeText(row.id), name: knowledgeText(row.nickname), role: Number(row.owned) === 1 ? 'owner' : 'member', createdAt: knowledgeText(row.create_time ?? ''), power: Number(row.owned) === 1 ? 'all' : Number(row.power) === 1 ? 'manage' : Number(row.power) === 2 ? 'edit' : 'view' })
}
/** Save only fields supported by the existing knowledge management endpoint.
 * @param id - Existing knowledge ID, or null to create.
 * @param draft - Current form fields.
 * @param signal - Caller cancellation signal.
 * @returns Saved knowledge identity for returning to an employee draft.
 */
export async function saveKnowledge(id: string | null, draft: PreviewValues, signal?: AbortSignal): Promise<string> {
  const token = storedLogin(sessionStorage)
  let image = draft.image ?? ''
  if (image.startsWith('data:')) {
    const blob = await (await fetch(image)).blob()
    const form = new FormData(); form.append('file', blob, `cover.${blob.type.split('/')[1] ?? 'png'}`)
    const uploaded = loginRecord(await knowledgeRequest('/upload/image', form, signal, token)); image = knowledgeText(uploaded.uri ?? uploaded.url ?? '')
  }
  const result = await knowledgeRequest(`/kb.know/${id ? 'edit' : 'add'}`, { ...id ? { id: Number(id) } : { embedding_model_id: Number(draft.embedding_model_id) }, name: draft.name, intro: draft.intro, image, documents_model_id: Number(draft.documents_model_id?.split(':')[0]), documents_model_sub_id: Number(draft.documents_model_id?.split(':')[1] ?? draft.documents_model_sub_id) }, signal, token)
  return id ?? knowledgeText(loginRecord(result).id)
}

/** Translate form controls to the existing retrieval API contract.
 * @param draft - Current search form values.
 * @returns Numeric limits, model identities and the server search mode.
 */
export function knowledgeSearchInput(draft: PreviewValues): LoginRecord {
  const numbers = Object.fromEntries(['search_tokens', 'search_similar', 'ranking_status', 'ranking_score', 'ranking_model', 'optimize_ask']
    .map(key => [key, Number(draft[key]) || 0]))
  return { ...numbers, search_mode: draft.search_mode === 'semantic' ? 'similar' : draft.search_mode,
    optimize_m_id: Number(draft.optimize_m_id?.split(':')[0]) || 0, optimize_s_id: Number(draft.optimize_m_id?.split(':')[1]) || 0 }
}

/** Whether visible or staged fragments still need status refresh; supports both learning modes.
 * @param value - Current fragment resource, including legacy rows and incremental detection.
 * @returns True while learning or question splitting is in progress.
 */
export function knowledgeLearningPending(value: LoginRecord): boolean {
  return loginRecord(value.learning ?? {}).pending === true
    || knowledgeRows(value.rows ?? []).some(row => [0, 1].includes(Number(row.status)))
    || knowledgeRows(loginRecord(value.qa ?? {}).lists ?? []).some(row => [0, 1].includes(Number(row.status)))
}
