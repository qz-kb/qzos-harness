/** QZOS knowledge and employee pages reproduced inside an independent DSH panel. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, Tag, Menu, MenuItemButton, IconPlusOutlineRegular, IconUsersOutlineRegular, IconFolderOpenOutlineRegular, IconEllipsisOutlineRegular, IconChevronLeftOutlineRegular, IconSearchOutlineRegular, IconSettingsOutlineRegular, IconQueueOutlineRegular, IconEditOutlineRegular, IconTrashOutlineRegular, IconPaperPlaneOutlineRegular, IconQueueOutlineRegular as ChatIcon } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import type { Example } from './catalog.ts'
import { resourceModelDefaults } from './resource-models.ts'
import { ResourceFields } from './ResourceForms.tsx'
import { KnowledgeDetail } from './KnowledgeDetail.tsx'
import { EmployeeSquare } from './EmployeeSquare.tsx'
import { EmployeeDetail } from './EmployeeDetail.tsx'
import { resourceDraft, type PreviewValues } from './resource-schema.ts'
import { resourceCopy, type ResourceText } from './resource-copy.ts'
import { knowledgeCard, knowledgeDraft, knowledgeRows, knowledgeText, saveKnowledge, knowledgeRequest as requestKnowledge } from './knowledge-client.ts'
import { loginRecord, storedLogin } from './login-client.ts'
import { employeeCard, employeeImage, employeeDraft, saveEmployee } from './employee-client.ts'
import css from './Resources.module.css'

type ResourcePanelProps = PanelProps & { panel: 'knowledge' | 'employees' }
type EmployeeCardProps = {
  item: Example
  onCommand: (command: 'edit' | 'release' | 'dialogue' | 'delete' | 'chat', item: Example) => void
  labels: {
    public: string
    private: string
    more: string
    settings: string
    chat: string
    publish: string
    dialogue: string
    delete: string
    noIntro: string
  }
}

function EmployeeCard({ item, onCommand, labels }: EmployeeCardProps) {
  const [menu, setMenu] = useState(false)
  return <article className={css.employeeCard}>
    <div className={css.employeeTop}><Tag>{item.scope === 'public' ? labels.public : labels.private}</Tag>
      <Menu open={menu} anchor={<Button aria-label={`${labels.more} · ${item.title}`} onMouseEnter={() =>{  setMenu(true) }} onClick={() =>{  setMenu(value => !value) }}><IconEllipsisOutlineRegular size={18} /></Button>} onClose={() =>{  setMenu(false) }} portal closeOnPointerLeave>
        {(['release', 'dialogue', 'delete'] as const).map(command => <MenuItemButton key={command} danger={command === 'delete'} onSelect={() => { setMenu(false); onCommand(command, item) }}>{labels[command === 'release' ? 'publish' : command]}</MenuItemButton>)}
      </Menu>
    </div>
    <div className={css.employeeBody}><div className={css.avatar}>{item.values?.image ? <img src={item.values.image} alt="" /> : <IconUsersOutlineRegular size={24} />}</div><h2>{item.title}</h2><p>{item.description || labels.noIntro}</p></div>
    <div className={css.employeeFooter}><Button aria-label={`${labels.settings} · ${item.title}`} onClick={() =>{  onCommand('edit', item) }}><IconPaperPlaneOutlineRegular size={16} />{labels.settings}</Button><Button disabled={item.status !== 'ready'} aria-label={`${labels.chat} · ${item.title}`} onClick={() =>{  onCommand('chat', item) }}><ChatIcon size={16} />{labels.chat}</Button></div>
  </article>
}

/** Preserve QZOS lists, resource dialogs and the detail sidebar using authenticated business resources. */
export function ResourcePanel(props: ResourcePanelProps) {
  const { panel, useStore, actions, t, openEmployee } = props
  const r = (key: ResourceText) => key === 'saved' ? t('kbSaved') : t(resourceCopy[key])
  const epoch = useStore(state => state.businessEpoch)
  const revision = useStore(state => state.knowledgeRevision)
  const filter = useStore(state => state.filters[panel] ?? (panel === 'knowledge' ? 'owned' : 'all'))
  const query = useStore(state => state.queries[panel] ?? '')
  const [page, setPage] = useState(1)
  const pageSize = 24
  useEffect(() => { setPage(1) }, [panel, filter, query, epoch])
  const listParams = new URLSearchParams({ epoch: String(epoch), revision: String(revision), page: String(page), page_size: String(pageSize) })
  if (panel === 'knowledge') listParams.set('type', filter === 'shared' ? '2' : '1')
  else {
    listParams.set('type', filter === 'public' ? '1' : filter === 'private' ? '0' : ' ')
    listParams.set('keyword', query)
  }
  const remote = props.useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/${panel === 'knowledge' ? 'list' : 'employees'}?${listParams.toString()}`)
  const records = remote.value ? knowledgeRows(remote.value.rows).map(panel === 'knowledge' ? knowledgeCard : employeeCard) : []
  const total = Number(remote.value?.total ?? records.length)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const [configuration, setConfiguration] = useState<{ id: string | null } | null>(null)
  const selected = useStore(state => state.details[panel])
  const [nestedKnowledge, setNestedKnowledge] = useState<PreviewValues | null>(null)
  const [nestedKnowledgeId, setNestedKnowledgeId] = useState<string | null>(null)
  const [createdKnowledge, setCreatedKnowledge] = useState<Example | null>(null)
  const optionsRemote = props.useResource<'qzos-knowledge'>(configuration || selected ? `dsh-resource://qzos-knowledge/models?epoch=${epoch}&revision=${revision}` : '')
  const linkedRemote = props.useResource<'qzos-knowledge'>(panel === 'employees' ? `dsh-resource://qzos-knowledge/list?epoch=${epoch}&revision=${revision}&all=1` : '')
  const models = optionsRemote.value ? loginRecord(optionsRemote.value.models) : {}
  const defaults = resourceModelDefaults(models)
  useEffect(() => { props.refreshCatalog(panel) }, [panel, props.refreshCatalog])
  const vector = Array.isArray(models.vectorModels) ? knowledgeRows(models.vectorModels) : []
  const rankings = Array.isArray(models.rankingModels) ? knowledgeRows(models.rankingModels) : []
  const modelOptions = {
    ranking_model: rankings.map(row => ({
      value: knowledgeText(row.id), label: knowledgeText(row.name), disabled: row.is_ready === false,
    })),
    embedding_model_id: vector.map(row => ({
      value: knowledgeText(row.id), label: knowledgeText(row.name), disabled: row.is_ready === false,
    })),
    documents_model_id: Array.isArray(models.chatModels) ? knowledgeRows(models.chatModels).flatMap(row => Array.isArray(row.models) ? knowledgeRows(row.models).map(child => ({ value: `${knowledgeText(row.id)}:${knowledgeText(child.id)}`, label: `${knowledgeText(row.name)} / ${knowledgeText(child.alias ?? child.name)}`, disabled: row.is_ready === false || child.is_ready === false })) : []) : [],
  }
  const [square, setSquare] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [lifetime] = useState(() => new AbortController())
  const credential = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const knowledgeRequest = (path: string, body?: Record<string, unknown>) =>
    requestKnowledge(path, body, lifetime.signal, credential.current)
  const perform = async (work: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setNotice('')
    try { await work() } catch (error) { setNotice(error instanceof Error ? error.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  const knowledge = linkedRemote.value ? knowledgeRows(linkedRemote.value.rows).map(knowledgeCard) : []
  if (createdKnowledge && !knowledge.some(item => item.id === createdKnowledge.id)) knowledge.push(createdKnowledge)
  const section = useStore(state => state.sections[panel] ?? (panel === 'knowledge' ? 'dataStudy' : 'edit'))
  const [search, setSearch] = useState(query)
  const [draft, setDraft] = useState<PreviewValues>({})
  const [deleting, setDeleting] = useState<Example | null>(null)
  const [notice, setNotice] = useState('')
  const item = records.find(record => record.id === selected)
  const filtered = records
  const configure = (record?: Example) => {
    if (panel === 'knowledge') {
      void perform(async () => {
        const values = record ? knowledgeDraft(loginRecord(await knowledgeRequest(`/kb.know/detail?id=${record.id}`))) : { name: '', intro: '', image: '' }
        if (record) values.documents_model_id = `${values.documents_model_id}:${values.documents_model_sub_id}`
        setDraft(values); setConfiguration({ id: record?.id ?? null })
      }); return
    }
    setDraft(Object.fromEntries(Object.entries(resourceDraft({ name: record?.title ?? '', intro: record?.description ?? '', roles_prompt: record?.content ?? '', ...record?.values })).filter(([key]) => record || key !== 'model_id')))
    setConfiguration({ id: record?.id ?? null })
  }
  const open = (record: Example, tab: string) => {
    actions.setDetail(panel, record.id)
    actions.setSection(panel, tab)


  }
  const employeeCommand = (command: 'edit' | 'release' | 'dialogue' | 'delete' | 'chat', record: Example) => {
    if (command === 'delete') setDeleting(record)
    else if (command === 'chat') { void openEmployee(record.id, record.title).then((message) => { if (message) setNotice(message) }) }
    else open(record, command)
  }
  const menus: readonly [string, ResourceText][] = panel === 'knowledge'
    ? [['dataStudy', 'files'], ['testData', 'searchTest'], ['teamData', 'members'], ['setUp', 'knowledgeSettings']]
    : [['edit', 'employeeSettings'], ['release', 'employeeRelease'], ['dialogue', 'dialogue'], ['chat', 'immediateChat']]
  const save = () => {
    if (!configuration || !draft.name?.trim()) return
    if (panel === 'knowledge') { void perform(async () => { await saveKnowledge(configuration.id, { ...defaults, ...draft }, lifetime.signal); actions.refreshKnowledge(); setPage(1); setConfiguration(null); setNotice(r('saved')) }); return }
    void perform(async () => {
      const image = await employeeImage(draft.image ?? '', lifetime.signal, credential.current)
      const result = configuration.id ? { id: configuration.id } : loginRecord(await knowledgeRequest('/kb.robot/add', { name: draft.name, intro: draft.intro ?? '', ...image ? { image } : {} }))
      const id = knowledgeText(result.id)
      if (!id) throw new Error(t('employeeWriteUnknown'))
      setConfiguration({ id }); actions.refreshKnowledge()
      const detail = loginRecord(await knowledgeRequest(`/kb.robot/detail?id=${id}`))
      const fullDraft = { ...employeeDraft(detail), ...draft, ...defaults, model_id: draft.model_id ?? defaults.documents_model_id ?? '0:0', image: image || knowledgeText(detail.image) }
      await saveEmployee(detail, fullDraft, knowledgeRows(detail.menus), lifetime.signal)
      actions.refreshKnowledge(); setPage(1); setConfiguration(null); actions.setDetail(panel, id); actions.setSection(panel, 'edit'); setNotice(t('kbSaved'))
    })
  }
  return <section className={`${css.page} ${panel === 'knowledge' ? css.knowledgePage : css.employeePage}`} data-qzos-panel={panel}>
    {remote.status === 'failed' && <p role="alert">{remote.failure?.message}<Button onClick={() =>{  actions.refreshKnowledge() }}>{r('refresh')}</Button></p>}
    {!item ? <>
      <div className={css.knowledgeHeading}><h1>{panel === 'knowledge' ? r('knowledge') : t('employeeHeading')}</h1><p>{t(panel === 'knowledge' ? 'knowledgeOverview' : 'employeeOverview')}</p></div>
      {panel === 'employees' && <div className={css.employeeSwitch}><Button aria-pressed={!square} onClick={() => { setSquare(false) }}>{r('employees')}</Button><Button aria-pressed={square} onClick={() => { setSquare(true) }}>{t('employeeSharedTab')}</Button></div>}
      {panel === 'employees' && square ? <EmployeeSquare {...props} inline onClose={() => { setSquare(false) }} /> : <>
        <header className={css.listHead}>
          {panel === 'knowledge' ? <div className={css.tabs}>{(['owned', 'shared'] as const).map(scope => <Button key={scope} aria-pressed={filter === scope} onClick={() =>{  actions.setFilter(panel, scope) }}>{r(scope === 'owned' ? 'mine' : 'shared')}</Button>)}</div>
            : <><div className={css.inline}><span>{r('filter')}</span><select aria-label={t('scope')} value={filter} onChange={(event) =>{  actions.setFilter(panel, event.target.value) }}>{(['all', 'public', 'private'] as const).map(scope => <option key={scope} value={scope}>{r(scope)}</option>)}</select><Input aria-label={r('searchEmployee')} placeholder={r('searchEmployee')} value={search} onChange={(event) =>{  setSearch(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter') actions.setQuery(panel, search) }} /><Button variant="primary" onClick={() =>{  actions.setQuery(panel, search) }}>{r('search')}</Button></div></>}
        </header>
        <div className={css.listRefresh}><Button aria-label={r('refresh')} onClick={() => { props.refreshCatalog(panel) }}>{r('refresh')}</Button></div>
        {notice && <p className={css.notice} role="status">{notice}</p>}
        {panel === 'knowledge' ? <div className={css.kbGrid}>
          {filter === 'owned' && page === 1 && <button className={css.kbCreate} type="button" onClick={() =>{  configure() }}><IconPlusOutlineRegular size={24} />{r('newKnowledge')}</button>}
          {!remote.value && remote.status === 'loading' && <div className={css.cardSkeleton} role="status" aria-label={t('catalogLoading')} />}
          {filtered.map(record => <article className={css.kbCard} key={record.id}>
            <div className={css.kbCover}>
              <button type="button" className={css.kbCoverButton} aria-label={`${t('detail')} · ${record.title}`} onClick={() =>{  open(record, 'dataStudy') }}>{record.values?.image ? <img src={record.values.image} alt="" /> : <IconFolderOpenOutlineRegular size={32} />}</button>
              <button className={css.memberButton} type="button" aria-label={`${r('shareCounter')} · ${record.title}`} onClick={() =>{  open(record, 'teamData') }}><IconUsersOutlineRegular size={14} />{record.values?.team_people ?? '0'}</button>
              {record.scope === 'owned' && <div className={css.coverActions}><Button aria-label={`${t('editKnowledge')} · ${record.title}`} onClick={() =>{  configure(record) }}><IconEditOutlineRegular size={16} />{r('edit')}</Button><Button aria-label={`${t('deleteKnowledge')} · ${record.title}`} onClick={() =>{  setDeleting(record) }}><IconTrashOutlineRegular size={16} />{r('delete')}</Button></div>}
            </div>
            <button type="button" className={css.kbBody} onClick={() =>{  open(record, 'dataStudy') }}><h2>{record.title}</h2><p>{record.description || r('noKnowledgeIntro')}</p><small>{r(record.scope === 'owned' ? 'mine' : 'shared')} · {r('stateReady')}</small></button>
          </article>)}
        </div> : <div className={css.employeeGrid}>
          <button className={css.employeeCreate} type="button" onClick={() =>{  configure() }}><IconPlusOutlineRegular size={24} />{r('newEmployee')}</button>
          {!remote.value && remote.status === 'loading' && <div className={css.cardSkeleton} role="status" aria-label={t('catalogLoading')} />}
          {filtered.map(record => <EmployeeCard key={record.id} item={record} onCommand={employeeCommand} labels={{ public: r('public'), private: r('private'), more: r('more'), settings: r('settings'), chat: r('chat'), publish: r('publishEmployee'), dialogue: r('dialogue'), delete: r('delete'), noIntro: t('employeeNoIntro') }} />)}
        </div>}
        {total === 0 && remote.status === 'live' && <p className={css.empty}>{r('empty')}</p>}
        {total > pageSize && <div className={css.pager}>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(current => Math.max(1, current - 1)) }}>{r('previous')}</Button>
          <span>{page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => { setPage(current => Math.min(totalPages, current + 1)) }}>{r('next')}</Button>
        </div>}
      </>}
    </> : <div className={css.detailLayout}>
      <aside className={css.aside}>
        <div className={css.asideTitle}><Button aria-label={t('back')} onClick={() =>{  actions.setDetail(panel, null) }}><IconChevronLeftOutlineRegular size={18} /></Button>
          {panel === 'employees' ? <select aria-label={t('employees')} value={item.id} onChange={(event) => { const target = records.find(record => record.id === event.target.value); if (target) open(target, 'edit') }}>{records.map(record => <option key={record.id} value={record.id}>{record.title}</option>)}</select> : <strong>{item.title}</strong>}
        </div>
        {menus.map(([tab, key]) => <Button key={tab} aria-pressed={section === tab} onClick={() => { if (tab === 'chat') employeeCommand('chat', item); else actions.setSection(panel, tab) }}>{panel === 'employees' ? tab === 'edit' ? <IconSettingsOutlineRegular size={16} /> : tab === 'release' ? <IconPaperPlaneOutlineRegular size={16} /> : <ChatIcon size={16} /> : (tab === 'dataStudy' ? <IconQueueOutlineRegular size={16} /> : tab === 'testData' ? <IconSearchOutlineRegular size={16} /> : tab === 'teamData' ? <IconUsersOutlineRegular size={16} /> : <IconSettingsOutlineRegular size={16} />)}{r(key)}</Button>)}
      </aside>
      <div className={css.detailBody}>{panel === 'knowledge'
        ? <KnowledgeDetail key={`${item.id}:${section}`} {...props} item={item} section={section} onDelete={() =>{  setDeleting(item) }} modelOptions={modelOptions} />
        : <EmployeeDetail key={`${item.id}:${section}`} {...props} item={item} section={section} knowledge={knowledge} modelDefaults={defaults} modelOptions={{ ...modelOptions, model_id: modelOptions.documents_model_id, optimize_m_id: modelOptions.documents_model_id }} onSaved={() => { props.refreshCatalog('employees') }} />}</div>
    </div>}
    <Modal open={configuration !== null && nestedKnowledge === null} onClose={() =>{ if (!busy) setConfiguration(null) }} closeLabel={r('close')} className={(panel === 'knowledge' ? css.knowledgeDialog : `${css.dialog} ${css.employeeDialog}`) as string}
      title={panel === 'knowledge' ? configuration?.id === null ? r('newKnowledge') : r('editKnowledge') : r('newEmployeeTitle')}
      footer={<><Button variant="outline" disabled={busy} onClick={() =>{  setConfiguration(null) }}>{r(panel === 'knowledge' ? 'return' : 'cancel')}</Button><Button variant="primary" disabled={busy || optionsRemote.status !== 'live'} form="qzos-resource-form" type="submit">{r(panel === 'knowledge' ? 'save' : 'createConfigure')}</Button></>}>
      {notice && <p role="alert">{notice}</p>}
      {optionsRemote.status === 'failed' && <p role="alert">{optionsRemote.failure?.message}<Button onClick={() => { actions.refreshKnowledge() }}>{r('refresh')}</Button></p>}
      {panel === 'employees' && <p className={css.notice}>{t('employeeLocalModel')}</p>}
      {panel === 'knowledge' && optionsRemote.status === 'live' && (!modelOptions.embedding_model_id.some(option => !option.disabled) || !modelOptions.documents_model_id.some(option => !option.disabled)) && <p role="status">{t('kbModelsRequired')}</p>}
      <form id="qzos-resource-form" onSubmit={(event) => { event.preventDefault(); save() }}><ResourceFields t={t} form={panel === 'knowledge' ? 'knowledgeCreate' : 'employeeCreate'} draft={panel === 'knowledge' ? { ...defaults, ...draft } : { model_id: defaults.documents_model_id ?? '', ...draft }} options={panel === 'knowledge' ? modelOptions : { ...modelOptions, model_id: modelOptions.documents_model_id }} disabled={busy} editing={configuration?.id !== null} onChange={(key, value) =>{  setDraft(current => ({ ...current, [key]: value })) }} knowledge={knowledge} knowledgeLoading={linkedRemote.status === 'loading'} knowledgeError={linkedRemote.failure?.message} onCreateKnowledge={panel === 'employees' ? () => { setNestedKnowledgeId(null); setNestedKnowledge({ name: '', intro: '', image: '' }); setNotice('') } : undefined} /></form>
    </Modal>
    <Modal open={nestedKnowledge !== null} onClose={() => { if (!busy) setNestedKnowledge(null) }} closeLabel={r('close')} className={css.knowledgeDialog as string} title={r('newKnowledge')}
      footer={<><Button disabled={busy} onClick={() => { setNestedKnowledge(null) }}>{t('backToEmployee')}</Button><Button variant="primary" disabled={busy || optionsRemote.status !== 'live'} form="qzos-linked-knowledge-form" type="submit">{t('createAndLink')}</Button></>}>
      {notice && <p role="alert">{notice}</p>}
      {optionsRemote.status === 'failed' && <p role="alert">{optionsRemote.failure?.message}<Button onClick={() => { actions.refreshKnowledge() }}>{r('refresh')}</Button></p>}
      <form id="qzos-linked-knowledge-form" onSubmit={(event) => { event.preventDefault(); if (!nestedKnowledge) return; const values = { ...defaults, ...nestedKnowledge }; void perform(async () => {
        const id = nestedKnowledgeId ?? await saveKnowledge(null, values, lifetime.signal)
        if (!id) throw new Error(t('employeeWriteUnknown'))
        setNestedKnowledgeId(id)
        const created = knowledgeCard(loginRecord(await knowledgeRequest(`/kb.know/detail?id=${encodeURIComponent(id)}`)))
        setCreatedKnowledge(created)
        setDraft(current => ({ ...current, kb_ids: [...new Set([...(current.kb_ids ?? '').split(',').filter(Boolean), id])].join(',') }))
        props.refreshCatalog('knowledge'); setNestedKnowledge(null); setNotice(t('knowledgeLinked'))
      }) }}><ResourceFields t={t} form="knowledgeCreate" draft={{ ...defaults, ...nestedKnowledge }} options={modelOptions} disabled={busy || nestedKnowledgeId !== null || optionsRemote.status !== 'live'} onChange={(key, value) => { setNestedKnowledge(current => ({ ...current, [key]: value })) }} knowledge={[]} /></form>
    </Modal>
    <Modal open={deleting !== null} onClose={() =>{  setDeleting(null) }} closeLabel={r('close')} title={r('deleteConfirm')} className={css.dialog as string}
      footer={<><Button variant="outline" onClick={() =>{  setDeleting(null) }}>{r('cancel')}</Button><Button variant="outline" className={css.dangerAction} onClick={() => { if (deleting) { const id = deleting.id; void perform(async () => { await knowledgeRequest(panel === 'knowledge' ? '/kb.know/del' : '/kb.robot/del', { id: Number(id) }); actions.setDetail(panel, null); actions.refreshKnowledge(); setDeleting(null) }) } }}>{r('confirmDelete')}</Button></>}><p className={css.deletePrompt}>{t('knowledgeDeletePrompt')} {deleting?.title}？</p>{notice && <p role="alert">{notice}</p>}</Modal>
  </section>
}
