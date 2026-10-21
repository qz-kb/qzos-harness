/** Synthetic employee references share the native composer; they never dispatch a business task. */
import type { Context } from '@deepseek-ai/cordis'
import type { ReferenceInsert } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { catalogs } from './catalog.ts'
import type { QzosKey } from './locales.ts'

const sourceName = 'qzos-employee'
type Translate = (key: QzosKey) => string

/** Resolve a ready fixture into a source-owned native reference chip.
 * @param id - synthetic employee identity.
 * @returns the reference, or undefined for an unavailable employee.
 */
export function employeeReference(id: string): ReferenceInsert | undefined {
  const employee = catalogs.employees.find(item => item.id === id && item.status === 'ready')
  return employee && { source: sourceName, ref: employee.id, label: `@${employee.title}`, clipboardText: `@${employee.title}`, appearance: 'session' }
}

/** Register employee discovery and return the catalog's native-conversation action.
 * @param ctx - plugin-owned presentation services.
 * @param t - localized interface copy.
 * @returns an action reporting a localized refusal without discarding a draft.
 */
export function installEmployeeMentions(ctx: Context, t: Translate): (id: string) => Promise<string | undefined> {
  const lifetime = new AbortController()
  ctx.effect(() => () => lifetime.abort(), 'qzos employee navigation')
  const source: InputTriggerSource = {
    trigger: '@', name: sourceName, order: -10, showGroupTitle: false,
    async candidates(_session, { query, quoted }) {
      if (quoted) return []
      return catalogs.employees.filter(item => item.status === 'ready'
        && `${item.title} ${item.category} ${item.description} ${item.content} ${item.id}`.toLowerCase().includes(query.toLowerCase())).map(item => ({
        name: item.title, value: item.id, description: t('demo'), section: t('employees'), icon: 'session' as const,
      }))
    },
    onPick({ candidate, session }) {
      const insert = employeeReference(candidate.value ?? '')
      if (!insert) return undefined
      const scope = ctx.sessions.scope(session.sessionId)
      if (scope) ctx.conversation.input.for(scope).notify('info', t('employeePreview'))
      return { insert }
    },
    async matchEnter(_session, line) {
      if (catalogs.employees.some(item => line.includes(`@${item.title}`))) throw new Error(t('employeePreview'))
      return undefined
    },
    codec: {
      clipboardText: id => employeeReference(id)?.clipboardText ?? id,
      async serialize() { throw new Error(t('employeePreview')) },
    },
  }
  ctx.effect(() => ctx.inputTriggers.registerSource(source), 'qzos employee mentions')

  const insertEmployee = (sessionId: SessionId, reference: ReferenceInsert): void => {
    lifetime.signal.throwIfAborted()
    const scope = ctx.sessions.scope(sessionId)
    if (!scope) throw new Error(t('employeeOpenFailed'))
    const input = ctx.conversation.input.for(scope)
    const state = input.state.getSnapshot()
    if (!state.occurrences.some(item => item.source === sourceName && item.ref === reference.ref)
      && !input.insertReference(reference, { start: 0, end: 0, draftRev: state.draftRev })) {
      throw new Error(t('employeeBusy'))
    }
    input.notify('info', t('employeePreview'))
  }

  return async (id) => {
    const reference = employeeReference(id)
    if (!reference) return t('unavailable')
    try {
      const current = Object.values(ctx.sessions.list.getSnapshot().byId)
        .find(item => (item.retainedBy.mainView ?? 0) > 0)
      if (current) {
        insertEmployee(current.id, reference)
        ctx.uiWorkspace.openSession(current.id)
      } else {
        const workspaces = ctx.workspaces.list.getSnapshot().items
        const [workspace] = workspaces
        if (workspaces.length !== 1 || !workspace) return t('employeeWorkspace')
        await ctx.uiWorkspace.openWorkspace(workspace.workspaceId, sessionId => insertEmployee(sessionId, reference))
      }
      return undefined
    } catch (error: unknown) {
      if (lifetime.signal.aborted) return undefined
      return error instanceof Error ? `${t('employeeOpenFailed')} ${error.message}` : t('employeeOpenFailed')
    }
  }
}
