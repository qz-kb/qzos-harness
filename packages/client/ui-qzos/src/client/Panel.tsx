/** QZOS catalogs use native DSH controls and leave conversation rendering to DSH. */
import {
  Button, Input, Tag, ReferenceIconRegular, IconSparkleRegular, IconUsersOutlineRegular,
  IconFolderOpenOutlineRegular, IconLinkOutlineRegular, IconQueueOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsStore, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { createQzosStore } from './store.ts'
import { catalogs, type Example, type Panel } from './catalog.ts'
import css from './Panel.module.css'
import { ResourcePanel } from './ResourcePanel.tsx'

type Copy = PropsLocale<'qzos'>
type View = PropsStore<ReturnType<typeof createQzosStore>>
export type PanelProps = Copy & View & Pick<PropsRuntime<'main'>, 'useResource'> & {
  panel: Panel
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
  if (props.panel === 'knowledge' && !user) return null
  return props.panel === 'knowledge' || props.panel === 'employees'
    ? <ResourcePanel key={props.panel === 'knowledge' ? epoch : props.panel} {...props} panel={props.panel} /> : <CatalogPanel {...props} />
}

function CatalogPanel({ panel, developer, t, useStore, actions }: PanelProps) {
  const query = useStore(state => state.queries[panel] ?? '')
  const available = useStore(state => state.filters[panel] === 'available')
  const detailId = useStore(state => state.details[panel])
  const previewState = useStore(state => state.previewState)
  const records = catalogs[panel]
  const detail = records.find(item => item.id === detailId)
  const filtered = records.filter(item => (!available || item.status === 'ready') && `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase()))
  const Icon = icons[panel]
  const clear = () => { actions.setQuery(panel, ''); actions.setFilter(panel, 'all'); actions.setPreview('normal') }
  return <section className={css.page} data-qzos-panel={panel}><div className={css.content}>
    <header className={css.heading}><div><h1>{detail?.title ?? t(panel)}</h1><p>{detail?.description ?? t(`${panel}Desc`)}</p></div><Tag>{t('demo')}</Tag></header>
    {detail ? <><Button onClick={() =>{  actions.setDetail(panel, null) }}>{t('back')}</Button><article className={css.detail}><h2>{t('includes')}</h2><pre>{detail.content}</pre><Button disabled>{t(panel === 'connectors' ? 'connectorAction' : panel === 'skills' ? 'skillAction' : 'useTemplate')}</Button><p className={css.hint}>{t('disabledHint')}</p></article></>
      : <><div className={css.toolbar}><div className={css.filters}><Button aria-pressed={!available} onClick={() =>{  actions.setFilter(panel, 'all') }}>{t('all')}</Button><Button aria-pressed={available} onClick={() =>{  actions.setFilter(panel, 'available') }}>{t('available')}</Button></div><Input value={query} aria-label={t('search')} placeholder={t('search')} onChange={(event) =>{  actions.setQuery(panel, event.target.value) }} /></div>
        {previewState === 'loading' ? <p role="status">{t('loadingHint')}</p> : previewState === 'error' ? <div role="alert"><p>{t('errorHint')}</p><Button onClick={() =>{  actions.setPreview('normal') }}>{t('reset')}</Button></div> : previewState === 'empty' || filtered.length === 0 ? <div className={css.empty}><p>{t('empty')}</p><Button onClick={clear}>{t('clear')}</Button></div>
          : <div className={css.list}>{filtered.map(item => <article className={css.card} key={item.id}><div className={css.cardHeading}><Icon size={22} /><h2>{item.title}</h2><Tag>{t(item.status)}</Tag></div><p>{item.description}</p><span className={css.metadata}>{item.category}</span><div className={css.cardActions}><Button variant="outline" aria-label={`${t('detail')} · ${item.title}`} onClick={() =>{  actions.setDetail(panel, item.id) }}>{t('detail')}</Button></div></article>)}</div>}
      </>}
    {developer && <details className={css.developer}><summary>{t('debug')}</summary><div className={css.actions}>{(['normal', 'loading', 'error', 'empty'] as const).map(value => <Button key={value} onClick={() =>{  actions.setPreview(value) }}>{t(value === 'normal' ? 'normal' : `${value}State`)}</Button>)}</div></details>}
  </div></section>
}
