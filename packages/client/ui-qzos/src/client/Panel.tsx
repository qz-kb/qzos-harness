/** QZOS catalogs use native DSH controls and leave conversation rendering to DSH. */
import {
  ReferenceIconRegular, IconSparkleRegular, IconUsersOutlineRegular,
  IconFolderOpenOutlineRegular, IconLinkOutlineRegular, IconQueueOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsStore, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { createQzosStore } from './store.ts'
import { type Example, type Panel } from './catalog.ts'
import css from './Panel.module.css'
import { ResourcePanel } from './ResourcePanel.tsx'
import { CapabilityPanel } from './CapabilityPanel.tsx'

type Copy = PropsLocale<'qzos'>
type View = PropsStore<ReturnType<typeof createQzosStore>>
export type PanelProps = Copy & View & Pick<PropsRuntime<'main'>, 'useResource'> & {
  panel: Panel
  refreshCatalog: (panel: string) => void
  developer: boolean
  openEmployee: (id: string, title?: string) => Promise<string | undefined>
  syncEmployees: (employees: readonly Example[]) => void
}
const icons = {
  knowledge: IconFolderOpenOutlineRegular, employees: IconUsersOutlineRegular,
  connectors: IconLinkOutlineRegular, skills: IconSparkleRegular, templates: IconQueueOutlineRegular,
}

/** Render a sidebar glyph using the shared icon library. */
export function PanelIcon({ panel, size }: PropsRuntime<'sidebar.panellist'> & { panel: Panel }) {
  const Icon = icons[panel]
  return <Icon size={size} />
}
/** Link to the existing DSH conversation without replacing its main renderer. */
export function NativePanelIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <ReferenceIconRegular kind="session" size={size} />
}
/** Render the QZOS brand without replacing sidebar behavior. */
export function Brand({ t }: Copy) { return <strong className={css.brand}>{t('brand')}</strong> }

/** Render one catalog with QZOS resource organization and DSH page styling. */
export function QzosPanel(props: PanelProps) {
  const user = props.useStore(state => state.businessUser)
  const epoch = props.useStore(state => state.businessEpoch)
  if (!user) return null
  return props.panel === 'knowledge' || props.panel === 'employees'
    ? <ResourcePanel key={`${props.panel}:${epoch}`} {...props} panel={props.panel} /> : <CapabilityPanel key={`${props.panel}:${epoch}`} {...props} panel={props.panel} />
}
