/** QZOS global panels; upstream Sessions and their navigation stay independent. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { installKnowledgeResources } from './knowledge-client.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { EmployeeFeedback, EmployeeFeedbackButton } from './EmployeeFeedback.tsx'
import { ProductUpdates } from './ProductUpdates.tsx'
import { Login } from './Login.tsx'
import { CatalogRetention } from './CatalogRetention.tsx'
import { Brand, NativePanelIcon, PanelIcon, QzosPanel } from './Panel.tsx'
import { createQzosStore } from './store.ts'
import { panels } from './catalog.ts'
import { en, zh, type QzosKey } from './locales.ts'
import { installEmployeeMentions } from './employees.ts'
import { installEmployeeContextPresentation } from './employee-context.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** QZOS synthetic resource catalog copy. */
    qzos: QzosKey
  }
}
/** Native presentation and draft services; no employee business transport. */
export const inject = ['slots', 'locale', 'layout', 'sessions', 'workspaces', 'conversation', 'uiConversation', 'inputTriggers', 'uiWorkspace', 'resources']

/** Register removable QZOS UI contributions.
 * @param ctx - Browser plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('qzos', { zh, en }), 'qzos dictionaries')
  const t = ctx.locale.bind('qzos')
  const store = createQzosStore()
  const refreshCatalog = installKnowledgeResources(ctx)
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'qzos-catalogs', locale: 'qzos', store }, CatalogRetention))
  installEmployeeContextPresentation(ctx)
  const feedback = createSnapshotStore<SessionId | null>(null)
  const closeFeedback = () => { feedback.set(null) }
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'qzos-feedback', locale: 'qzos', inject: sessionId => ({ onOpen: () => { feedback.set(sessionId) } }) }, EmployeeFeedbackButton))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'qzos-feedback', locale: 'qzos', store, inject: () => ({ hooks: { feedback }, onClose: closeFeedback }) }, EmployeeFeedback))
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'qzos-product-updates', locale: 'qzos', store }, ProductUpdates))
  const openEmployee = installEmployeeMentions(ctx, t)
  const developer = window.sessionStorage.getItem('qzos.preview') === '1'
  ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({ name: 'sidebar.brand.name', priority: -10, locale: 'qzos' }, Brand))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: 'conversation', order: -110, label: () => t('native'),
  }, NativePanelIcon))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'qzos-login', locale: 'qzos', store }, Login))
  for (const [order, panel] of panels.entries()) {
    const id = `qzos-${panel}` as MainPanelId
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: id, locale: 'qzos', store, inject: () => ({ panel, developer, refreshCatalog, openEmployee }) }, QzosPanel))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id, order: order - 100, label: () => t(panel), inject: () => ({ panel }) }, PanelIcon))
  }
  ctx.slots.inject('main', () => {
    return () => {
      if (ctx.layout.panelInfo.getSnapshot().activePanelId?.startsWith('qzos-')) ctx.layout.selectPanel(null)
    }
  })
}
