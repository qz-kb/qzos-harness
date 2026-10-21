/** QZOS preview panels, composed inside the existing DSH main seat. */
import { useEffect, useState } from 'react'
import { Button, Input, Tag, ReferenceIconRegular, IconSparkleRegular, IconUsersOutlineRegular, IconFolderOpenOutlineRegular, IconLinkOutlineRegular, IconQueueOutlineRegular, IconBrowseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsStore, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { createQzosStore } from './store.ts'
import { catalogs, panels, type Panel } from './catalog.ts'
import css from './Panel.module.css'

type Copy = PropsLocale<'qzos'>
type View = PropsStore<ReturnType<typeof createQzosStore>>
export type PanelProps = Copy & View & {
  panel: Panel
  navigate: (panel: Panel) => void
  developer: boolean
  openEmployee: (id: string) => Promise<string | undefined>
}
const icons = {
  home: IconSparkleRegular, knowledge: IconFolderOpenOutlineRegular, employees: IconUsersOutlineRegular,
  connectors: IconLinkOutlineRegular, skills: IconSparkleRegular, templates: IconQueueOutlineRegular, outputs: IconBrowseOutlineRegular,
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

/** Render one global panel using the shared demo store and local selection state. */
export function QzosPanel({ panel, navigate, developer, openEmployee, t, useStore, actions }: PanelProps) {
  const [openingEmployee, setOpeningEmployee] = useState(false)
  const [employeeError, setEmployeeError] = useState<string>()
  const enterEmployee = async (id: string) => {
    setOpeningEmployee(true)
    setEmployeeError(undefined)
    try { setEmployeeError(await openEmployee(id)) }
    finally { setOpeningEmployee(false) }
  }
  const draft = useStore(s => s.draft)
  const employee = useStore(s => s.employee)
  const knowledge = useStore(s => s.knowledge)
  const current = useStore(s => s.current)
  const conversations = useStore(s => s.conversations)
  const query = useStore(s => s.queries[panel] ?? '')
  const available = useStore(s => s.filters[panel] ?? false)
  const detailId = useStore(s => s.details[panel])
  const previewState = useStore(s => s.previewState)
  const failNext = useStore(s => s.failNext)
  const chat = conversations.find(item => item.id === current)
  const running = conversations.find(item => item.status === 'running')
  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => { actions.settle(running.id) }, 1800)
    return () => { window.clearTimeout(timer) }
  }, [running?.id, actions])
  const employeeName = catalogs.employees.find(item => item.id === (chat?.employee ?? employee))?.title
  const knowledgeName = catalogs.knowledge.find(item => item.id === (chat?.knowledge ?? knowledge))?.title
  const records = panel === 'home' ? [] : catalogs[panel]
  const detail = records.find(item => item.id === detailId)
  const filtered = records.filter(item => (!available || item.status === 'ready') && `${item.title} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  const openOutput = () => { actions.setDetail('outputs', 'output-weekly'); navigate('outputs') }

  return <section className={css.page} data-qzos-panel={panel}>
    <header className={css.header}>
      <span className={css.breadcrumb}>{t('brand')} <span aria-hidden="true">/</span> {t(panel)}</span>
      <Tag>{t('demo')}</Tag>
    </header>
    <div className={css.scroll}>
      {employeeError && <p role="alert">{employeeError}</p>}
      {panel === 'home' ? <div className={css.home}>
        <div className={css.intro}><span className={css.eyebrow}>{t('home')}</span><h1>{t('welcome')}</h1><p>{t('subtitle')}</p></div>
        <div className={css.context}>
          <Button variant="outline" onClick={() => navigate('employees')}>{t('employee')} · {employeeName}</Button>
          <Button variant="outline" onClick={() => navigate('knowledge')}>{t('kb')} · {knowledgeName}</Button>
          <Button onClick={() => actions.newConversation()}>{t('newChat')}</Button>
        </div>
        {chat && <article className={css.conversation} aria-live="polite">
          <div className={css.message}><Tag>{employeeName}</Tag><h2>{chat.prompt}</h2></div>
          <p className={css.status}>{t(chat.status)}</p>
          {chat.status === 'done' && <><p>{t('answer')}</p>{chat.id === 'demo-weekly' && <Button variant="outline" onClick={openOutput}>{t('result')}</Button>}</>}
          {(chat.status === 'failed' || chat.status === 'stopped') && <Button onClick={() => actions.retry(chat.id)}>{t('retry')}</Button>}
        </article>}
        <form className={css.composer} onSubmit={(event) => { event.preventDefault(); actions.send() }}>
          <label className={css.srOnly} htmlFor="qzos-draft">{t('prompt')}</label>
          <textarea id="qzos-draft" placeholder={t('draft')} value={draft} onChange={event => actions.setDraft(event.target.value)} />
          <div className={css.composerFooter}><span>{t('demo')}</span>{running ? <Button variant="outline" onClick={() => actions.stop(running.id)}>{t('stop')}</Button> : <Button variant="primary" type="submit" disabled={!draft.trim()}>{t('send')}</Button>}</div>
        </form>
        <p className={css.hint}>{t('next')}</p>
        <div className={css.sectionHeading}><h2>{t('starter')}</h2><Button onClick={() => navigate('templates')}>{t('templates')}</Button></div>
        <div className={css.grid}>{catalogs.templates.map(item => <button type="button" className={css.starter} key={item.id} onClick={() => actions.setDraft(item.content)}><IconQueueOutlineRegular size={20} /><strong>{item.title}</strong><span>{item.description}</span></button>)}</div>
        <div className={css.sectionHeading}><h2>{t('resources')}</h2></div>
        <div className={css.resources}>{panels.filter(id => id !== 'home').map((id) => { const Icon = icons[id]; return <button type="button" key={id} onClick={() => navigate(id)}><Icon size={20} /><span>{t(id)}</span><small>{catalogs[id].length} {t('count')}</small></button> })}</div>
        <div className={css.sectionHeading}><h2>{t('recent')}</h2></div>
        <div className={css.history}>{conversations.map(item => <button type="button" key={item.id} onClick={() => actions.open(item.id)} aria-current={item.id === current ? 'true' : undefined}><span>{item.prompt}</span><small>{t(item.status)}</small></button>)}</div>
      </div> : <div className={css.catalog}>
        <div className={css.titleRow}><div><span className={css.eyebrow}>{t('brand')}</span><h1>{t(panel)}</h1><p>{t(`${panel}Desc`)}</p></div><Tag>{records.length} {t('count')}</Tag></div>
        {detail ? <>
          <Button onClick={() => actions.setDetail(panel, null)}>{t('back')}</Button>
          <article className={css.detail}>
            <div className={css.sectionHeading}><Tag>{detail.category}</Tag><Tag>{t(detail.status)}</Tag></div>
            <h2>{detail.title}</h2><p>{detail.description}</p><h3>{t('includes')}</h3><pre>{detail.content}</pre>
            <div className={css.actions}>
              {panel === 'employees' && <Button variant="primary" disabled={detail.status !== 'ready' || openingEmployee} onClick={() => { void enterEmployee(detail.id) }}>{t('use')}</Button>}
              {panel === 'knowledge' && <Button variant="primary" disabled={detail.status !== 'ready'} onClick={() => { actions.choose('knowledge', detail.id); navigate('home') }}>{t('select')}</Button>}
              {panel === 'templates' && <Button variant="primary" onClick={() => { actions.setDraft(detail.content); navigate('home') }}>{t('useTemplate')}</Button>}
              {panel === 'outputs' && <Button onClick={() => { actions.open('demo-weekly'); navigate('home') }}>{t('origin')}</Button>}
              {panel !== 'templates' && <Button variant="outline" disabled>{t(panel === 'knowledge' ? 'upload' : panel === 'employees' ? 'publish' : panel === 'connectors' ? 'connectorAction' : panel === 'skills' ? 'skillAction' : 'download')}</Button>}
            </div><p className={css.hint}>{t('disabledHint')}</p>
          </article>
        </> : <>
          <div className={css.toolbar}><Input aria-label={t('search')} placeholder={t('search')} value={query} onChange={event => actions.setQuery(panel, event.target.value)} /><div className={css.filters}><Button aria-pressed={!available} variant={!available ? 'outline' : 'ghost'} onClick={() => actions.setFilter(panel, false)}>{t('all')}</Button><Button aria-pressed={available} variant={available ? 'outline' : 'ghost'} onClick={() => actions.setFilter(panel, true)}>{t('available')}</Button></div></div>
          {previewState === 'loading' ? <div className={css.empty} role="status">{t('loadingHint')}</div> : previewState === 'error' ? <div className={css.empty} role="alert"><p>{t('errorHint')}</p><Button onClick={() => actions.setPreview('normal')}>{t('reset')}</Button></div> : (previewState === 'empty' || filtered.length === 0) ? <div className={css.empty}><p>{t('empty')}</p><Button onClick={() => { actions.setQuery(panel, ''); actions.setFilter(panel, false); actions.setPreview('normal') }}>{t('clear')}</Button></div> : <div className={css.grid}>{filtered.map((item) => { const Icon = icons[panel]; return <article className={css.card} key={item.id}>
            <div className={css.cardTop}><span className={css.icon}><Icon size={24} /></span><Tag>{t(item.status)}</Tag></div><h2>{item.title}</h2><p>{item.description}</p><div className={css.cardFooter}><small>{item.category}</small>{panel === 'employees' && <Button disabled={item.status !== 'ready' || openingEmployee} onClick={() => { void enterEmployee(item.id) }} aria-label={`${t('use')} · ${item.title}`}>{t('use')}</Button>}<Button variant="outline" onClick={() => actions.setDetail(panel, item.id)} aria-label={`${t('detail')} · ${item.title}`}>{t('detail')}</Button></div>
          </article> })}</div>}
        </>}
      </div>}
      {developer && <details className={css.developer}><summary>{t('debug')}</summary><div className={css.actions}>{(['normal', 'loading', 'error', 'empty'] as const).map(value => <Button key={value} onClick={() => actions.setPreview(value)}>{t(value === 'normal' ? 'normal' : `${value}State`)}</Button>)}<label><input type="checkbox" checked={failNext} onChange={event => actions.setFailNext(event.target.checked)} />{t('failed')}</label></div></details>}
    </div>
  </section>
}
