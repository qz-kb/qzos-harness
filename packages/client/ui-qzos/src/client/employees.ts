/** Employee entry creates an independent native conversation with authorized opening context. */
import type { Context } from '@deepseek-ai/cordis'
import type { ReferenceInsert } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { type Example } from './catalog.ts'
import { knowledgePages, knowledgeRequest } from './knowledge-client.ts'
import { employeeCard } from './employee-client.ts'
import { employeeHost } from './employee-host.ts'
import { storedLogin, loginRecord } from './login-client.ts'
import type { QzosKey } from './locales.ts'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** Short-lived employee conversation preparation. */
    'qzos-employee': unknown
  }
}

const sourceName = 'qzos-employee'
type Translate = (key: QzosKey) => string

/** Resolve a ready fixture into a source-owned native reference chip.
 * @param id - employee identity.
 * @param employees - current employee directory.
 * @returns the reference, or undefined for an unavailable employee.
 */
export function employeeReference(id: string, employees: readonly Example[]): ReferenceInsert | undefined {
  const employee = employees.find(item => item.id === id && item.status === 'ready')
  return employee && { source: sourceName, ref: employee.id, label: `@${employee.title}`, clipboardText: `@${employee.title}`, appearance: 'session' }
}

/** Register employee discovery and return the catalog's native-conversation action.
 * @param ctx - plugin-owned presentation services.
 * @param t - localized interface copy.
 * @returns an action reporting a localized refusal without discarding a draft.
 */
export function installEmployeeMentions(ctx: Context, t: Translate): ((id: string, title?: string) => Promise<string | undefined>) & {
  update: (employees: readonly Example[]) => void
} {
  let employees: readonly Example[] = []
  const referenceFor = (id: string) => employeeReference(id, employees)
  const lifetime = new AbortController()
  ctx.effect(() => () =>{  lifetime.abort() }, 'qzos employee navigation')
  const scopedReference = (reference: ReferenceInsert, sessionId: SessionId): ReferenceInsert => ({
    ...reference, ref: JSON.stringify({ id: reference.ref, sessionId, label: reference.clipboardText }),
  })
  const decode = (ref: string): { id: string; sessionId: SessionId; label: string } => {
    const value: unknown = JSON.parse(ref)
    if (!value || typeof value !== 'object' || !('id' in value) || !('sessionId' in value)
      || typeof value.id !== 'string' || typeof value.sessionId !== 'string') throw new Error(t('employeeLeading'))
    return { id: value.id, sessionId: value.sessionId as SessionId, label: 'label' in value && typeof value.label === 'string' ? value.label : `@${value.id}` }
  }
  const source: InputTriggerSource = {
    trigger: '@', name: sourceName, order: -10, showGroupTitle: false,
    async candidates(_session, { query, quoted, signal }) {
      if (quoted || !storedLogin(sessionStorage)) return []
      employees = (await knowledgePages('/kb.robot/lists', AbortSignal.any([lifetime.signal, signal]))).map(employeeCard)
      return (employees.filter(item => item.status === 'ready'
        && `${item.title} ${item.category} ${item.description} ${item.content} ${item.id}`.toLowerCase().includes(query.toLowerCase())).map(item => ({
        name: item.title, value: item.id, description: item.description, section: t('employees'), icon: 'session' as const,
      })))
    },
    onPick({ candidate, session }) {
      const insert = referenceFor(candidate.value ?? '')
      if (!insert) return undefined
      const summary = ctx.sessions.list.getSnapshot().byId[session.sessionId]
      const scope = ctx.sessions.scope(session.sessionId)
      const occurrences = scope ? ctx.conversation.input.for(scope).state.getSnapshot().occurrences : []
      if (summary?.blank && !occurrences.some(item => item.source === sourceName)) {
        return { insert: scopedReference(insert, session.sessionId) }
      }
      // Never replace the current conversation or its draft when selecting another employee.
      void open(insert.ref).then((message) => {
        if (message && scope && !lifetime.signal.aborted) ctx.conversation.input.for(scope).notify('error', message)
      })
      return 'handled'
    },
    codec: {
      clipboardText(ref) {
        try { return decode(ref).label } catch { return t('employees') }
      },
      serialize(ref, signal) {
        // The native input calls codecs synchronously before committing the detached draft.
        // Capture it here, before any asynchronous business request can observe a later edit.
        const { id, sessionId } = decode(ref)
        const scope = ctx.sessions.scope(sessionId)
        if (!scope) return Promise.reject(new Error(t('employeeOpenFailed')))
        const input = ctx.conversation.input.for(scope).state.getSnapshot()
        const references = input.occurrences.filter(item => item.source === sourceName)
        const reference = references[0]
        if (references.length !== 1 || !reference || reference.ref !== ref || reference.offset !== 0) return Promise.reject(new Error(t('employeeLeading')))
        if (!ctx.sessions.list.getSnapshot().byId[sessionId]?.blank) return Promise.reject(new Error(t('employeeNewConversation')))
        if (!input.draft.slice(reference.length).trim()) return Promise.reject(new Error(t('employeeLeading')))
        const token = storedLogin(sessionStorage)
        if (!token) return Promise.reject(new Error(t('unavailable')))
        return employeeHost({ action: 'bind', token, sessionId, employeeId: id }, signal).then(() => {
          if (storedLogin(sessionStorage) !== token) throw new Error(t('unavailable'))
          return decode(ref).label
        })
      },
    },
  }
  ctx.effect(() => ctx.inputTriggers.registerSource(source), 'qzos employee mentions')

  const insertEmployee = (sessionId: SessionId, reference: ReferenceInsert): void => {
    lifetime.signal.throwIfAborted()
    const scope = ctx.sessions.scope(sessionId)
    if (!scope) throw new Error(t('employeeOpenFailed'))
    const input = ctx.conversation.input.for(scope)
    const state = input.state.getSnapshot()
    if (!input.insertReference(scopedReference(reference, sessionId), { start: 0, end: 0, draftRev: state.draftRev })) {
      throw new Error(t('employeeBusy'))
    }
    input.notify('info', t('employeeConversationReady'))
  }

  const open = async (id: string, _title?: string): Promise<string | undefined> => {
    const token = storedLogin(sessionStorage)
    if (!token) return t('unavailable')
    try {
      const detail = loginRecord(await knowledgeRequest(`/kb.robot/detail?id=${encodeURIComponent(id)}`, undefined, lifetime.signal, token))
      if (detail.work_state === 'paused' || detail.work_state === 'retired' || detail.knowledge_rebind_required || Number(detail.flow_status) === 1) return t('unavailable')
      const selected = employeeCard(detail)
      employees = [...employees.filter(item => item.id !== id), selected]
    } catch (error) { return error instanceof Error ? error.message : t('employeeOpenFailed') }
    const reference = referenceFor(id)
    if (!reference) return t('unavailable')
    try {
      const current = Object.values(ctx.sessions.list.getSnapshot().byId)
        .find(item => (item.retainedBy.mainView ?? 0) > 0)
      const workspaces = ctx.workspaces.list.getSnapshot().items
      const workspace = workspaces.find(item => current !== undefined && item.sessionIds.includes(current.id))
        ?? (workspaces.length === 1 ? workspaces[0] : undefined)
      if (!workspace) return t('employeeWorkspace')
      // No sessionId reuse: every catalog action creates a fresh native Session.
      const sessionId = await ctx.sessions.create({ workspaceId: workspace.workspaceId })
      await ctx.sessions.using(sessionId, { source: 'qzos-employee', signal: lifetime.signal }, async (retained) => {
        await retained.ready
        const renamed = await retained.binding.session.rename(reference.label)
        if (!renamed.ok) throw new Error(t('employeeOpenFailed'))
        if (storedLogin(sessionStorage) !== token) throw new Error(t('unavailable'))
        insertEmployee(sessionId, reference)
        ctx.uiWorkspace.openSession(sessionId)
      })
      return undefined
    } catch (error: unknown) {
      if (lifetime.signal.aborted) return undefined
      return error instanceof Error ? `${t('employeeOpenFailed')} ${error.message}` : t('employeeOpenFailed')
    }
  }
  return Object.assign(open, { update: (rows: readonly Example[]) => { employees = rows.map(row => ({ ...row })) } })
}
