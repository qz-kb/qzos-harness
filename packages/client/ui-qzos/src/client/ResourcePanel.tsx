/** QZOS knowledge and employee pages reproduced inside an independent DSH panel. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, Tag, Menu, MenuItemButton, IconPlusOutlineRegular, IconUsersOutlineRegular, IconFolderOpenOutlineRegular, IconEllipsisOutlineRegular, IconChevronLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import type { Example } from './catalog.ts'
import { ResourceFields } from './ResourceForms.tsx'
import { KnowledgeDetail } from './KnowledgeDetail.tsx'
import { EmployeeDetail } from './EmployeeDetail.tsx'
import { resourceDraft, type PreviewValues } from './resource-schema.ts'
import { resourceCopy, type ResourceText } from './resource-copy.ts'
import { knowledgeCard, knowledgeDraft, knowledgeRows, knowledgeText, saveKnowledge, knowledgeRequest as requestKnowledge } from './knowledge-client.ts'
import { loginRecord, storedLogin } from './login-client.ts'
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
    <div className={css.employeeBody}><div className={css.avatar}>{item.values?.image ? <img src={item.values.image} alt="" /> : <IconUsersOutlineRegular size={24} />}</div><h2>{item.title}</h2><p>{item.description}</p></div>
    <div className={css.employeeFooter}><Button aria-label={`${labels.settings} · ${item.title}`} onClick={() =>{  onCommand('edit', item) }}>{labels.settings}</Button><Button variant="primary" disabled={item.status !== 'ready'} aria-label={`${labels.chat} · ${item.title}`} onClick={() =>{  onCommand('chat', item) }}>{labels.chat}</Button></div>
  </article>
}

/** Preserve QZOS lists, resource dialogs and the detail sidebar using simulated state. */
export function ResourcePanel(props: ResourcePanelProps) {
  const { panel, useStore, actions, t, openEmployee, syncEmployees } = props
  const r = (key: ResourceText) => panel === 'knowledge' && key === 'saved' ? t('kbSaved') : t(resourceCopy[key])
  const previewRecords = useStore(state => state[panel])
  const epoch = useStore(state => state.businessEpoch)
  const revision = useStore(state => state.knowledgeRevision)
  const remote = props.useResource<'qzos-knowledge'>(panel === 'knowledge' ? `dsh-resource://qzos-knowledge/list?epoch=${epoch}&revision=${revision}` : '')
  const records = panel === 'knowledge' ? remote.value ? knowledgeRows(remote.value.rows).map(knowledgeCard) : [] : previewRecords
  const models = remote.value ? loginRecord(remote.value.models) : {}
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
  const knowledge = useStore(state => state.knowledge)
  const filter = useStore(state => state.filters[panel] ?? (panel === 'knowledge' ? 'owned' : 'all'))
  const query = useStore(state => state.queries[panel] ?? '')
  const selected = useStore(state => state.details[panel])
  const section = useStore(state => state.sections[panel] ?? (panel === 'knowledge' ? 'dataStudy' : 'edit'))
  const sequence = useStore(state => state.sequence)
  const [search, setSearch] = useState(query)
  const [configuration, setConfiguration] = useState<{ id: string | null } | null>(null)
  const [draft, setDraft] = useState<PreviewValues>({})
  const [deleting, setDeleting] = useState<Example | null>(null)
  const [notice, setNotice] = useState('')
  const item = records.find(record => record.id === selected)
  const filtered = records.filter(record => (filter === 'all' || record.scope === filter) && record.title.toLowerCase().includes(query.trim().toLowerCase()))
  const configure = (record?: Example) => {
    if (panel === 'knowledge') {
      void perform(async () => {
        const values = record ? knowledgeDraft(loginRecord(await knowledgeRequest(`/kb.know/detail?id=${record.id}`))) : { name: '', intro: '', image: '', embedding_model_id: '', documents_model_id: '' }
        if (record) values.documents_model_id = `${values.documents_model_id}:${values.documents_model_sub_id}`
        setDraft(values); setConfiguration({ id: record?.id ?? null })
      }); return
    }
    setDraft(resourceDraft({ name: record?.title ?? '', intro: record?.description ?? '', roles_prompt: record?.content ?? '', ...record?.values }))
    setConfiguration({ id: record?.id ?? null })
  }
  const open = (record: Example, tab: string) => {
    actions.setDetail(panel, record.id)
    actions.setSection(panel, tab)
    if (panel === 'employees') actions.initializeRows(`${record.id}:dialogues`, 'dialogues')

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
    if (panel === 'knowledge') { void perform(async () => { await saveKnowledge(configuration.id, draft, lifetime.signal); actions.refreshKnowledge(); setConfiguration(null); setNotice(r('saved')) }); return }
    const newId = `${panel}-preview-${sequence + 1}`
    actions.saveResource(panel, configuration.id, draft)
    {
      const previous = records.find(record => record.id === configuration.id)
      const employee: Example = { ...previous, id: configuration.id ?? newId, title: draft.name, description: draft.intro ?? '',
        category: previous?.category ?? '数字员工', scope: previous?.scope ?? 'private', status: previous?.status ?? 'ready',
        content: draft.roles_prompt ?? '', values: { ...draft } }
      syncEmployees([...records.filter(record => record.id !== employee.id), employee])
    }
    if (configuration.id === null) {
      actions.setDetail(panel, newId)
      actions.setSection(panel, 'edit')
    }
    setConfiguration(null)
    setNotice(r('saved'))
  }
  return <section className={css.page} data-qzos-panel={panel}>
    {panel === 'employees' && <span className={css.previewBadge}>{r('previewOnly')}</span>}
    {panel === 'knowledge' && remote.status === 'loading' && <p role="status">{t('kbLoading')}</p>}
    {panel === 'knowledge' && remote.status === 'failed' && <p role="alert">{remote.failure?.message}<Button onClick={() =>{  actions.refreshKnowledge() }}>{r('refresh')}</Button></p>}
    {!item ? <>
      <header className={css.listHead}>
        {panel === 'knowledge' ? <div className={css.tabs}>{(['owned', 'shared'] as const).map(scope => <Button key={scope} aria-pressed={filter === scope} onClick={() =>{  actions.setFilter(panel, scope) }}>{r(scope === 'owned' ? 'mine' : 'shared')}</Button>)}</div>
          : <><h1>{r('employees')}</h1><div className={css.inline}><span>{r('filter')}</span><select aria-label={t('scope')} value={filter} onChange={(event) =>{  actions.setFilter(panel, event.target.value) }}>{(['all', 'public', 'private'] as const).map(scope => <option key={scope} value={scope}>{r(scope)}</option>)}</select><Input aria-label={r('searchEmployee')} placeholder={r('searchEmployee')} value={search} onChange={(event) =>{  setSearch(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter') actions.setQuery(panel, search) }} /><Button variant="primary" onClick={() =>{  actions.setQuery(panel, search) }}>{r('search')}</Button></div></>}
      </header>
      {notice && <p className={css.notice} role="status">{notice}</p>}
      {panel === 'knowledge' ? <div className={css.kbGrid}>
        {filter === 'owned' && <button className={css.kbCreate} type="button" onClick={() =>{  configure() }}><IconPlusOutlineRegular size={24} />{r('newKnowledge')}</button>}
        {filtered.map(record => <article className={css.kbCard} key={record.id}>
          <div className={css.kbCover}>
            <button type="button" className={css.kbCoverButton} aria-label={`${t('detail')} · ${record.title}`} onClick={() =>{  open(record, 'dataStudy') }}>{record.values?.image ? <img src={record.values.image} alt="" /> : <IconFolderOpenOutlineRegular size={32} />}</button>
            <button className={css.memberButton} type="button" aria-label={`${r('shareCounter')} · ${record.title}`} onClick={() =>{  open(record, 'teamData') }}><IconUsersOutlineRegular size={14} />{record.values?.team_people ?? '0'}</button>
            {record.scope === 'owned' && <div className={css.coverActions}><Button aria-label={`${t('editKnowledge')} · ${record.title}`} onClick={() =>{  configure(record) }}>{t('editKnowledge')}</Button><Button aria-label={`${t('deleteKnowledge')} · ${record.title}`} onClick={() =>{  setDeleting(record) }}>{t('deleteKnowledge')}</Button></div>}
          </div>
          <button type="button" className={css.kbBody} onClick={() =>{  open(record, 'dataStudy') }}><h2>{record.title}</h2><p>{record.description || r('noKnowledgeIntro')}</p><small>{r(record.scope === 'owned' ? 'mine' : 'shared')} · {r('stateReady')}</small></button>
        </article>)}
      </div> : <div className={css.employeeGrid}>
        <button className={css.employeeCreate} type="button" onClick={() =>{  configure() }}><IconPlusOutlineRegular size={24} />{r('newEmployee')}</button>
        {filtered.map(record => <EmployeeCard key={record.id} item={record} onCommand={employeeCommand} labels={{ public: r('public'), private: r('private'), more: r('more'), settings: r('settings'), chat: r('chat'), publish: r('publishEmployee'), dialogue: r('dialogue'), delete: r('delete') }} />)}
      </div>}
      {filtered.length === 0 && (panel === 'employees' || remote.status === 'live') && <p className={css.empty}>{r('empty')}</p>}
    </> : <div className={css.detailLayout}>
      <aside className={css.aside}>
        <div className={css.asideTitle}><Button aria-label={t('back')} onClick={() =>{  actions.setDetail(panel, null) }}><IconChevronLeftOutlineRegular size={18} /></Button>
          {panel === 'employees' ? <select aria-label={t('employees')} value={item.id} onChange={(event) => { const target = records.find(record => record.id === event.target.value); if (target) open(target, 'edit') }}>{records.map(record => <option key={record.id} value={record.id}>{record.title}</option>)}</select> : <strong>{item.title}</strong>}
        </div>
        {menus.map(([tab, key]) => <Button key={tab} aria-pressed={section === tab} onClick={() => { if (tab === 'chat') employeeCommand('chat', item); else actions.setSection(panel, tab) }}>{r(key)}</Button>)}
      </aside>
      <div className={css.detailBody}>{panel === 'knowledge'
        ? <KnowledgeDetail key={`${item.id}:${section}`} {...props} item={item} section={section} onDelete={() =>{  setDeleting(item) }} modelOptions={modelOptions} />
        : <EmployeeDetail key={`${item.id}:${section}`} {...props} item={item} section={section} onSaved={() =>{  actions.setDetail(panel, null) }} />}</div>
    </div>}
    <Modal open={configuration !== null} onClose={() =>{  setConfiguration(null) }} closeLabel={r('close')} className={(panel === 'knowledge' ? css.knowledgeDialog : `${css.dialog} ${css.employeeDialog}`) as string}
      title={panel === 'knowledge' ? configuration?.id === null ? r('newKnowledge') : r('editKnowledge') : r('newEmployeeTitle')}
      footer={<><Button variant="outline" onClick={() =>{  setConfiguration(null) }}>{r(panel === 'knowledge' ? 'return' : 'cancel')}</Button><Button variant="primary" disabled={busy} form="qzos-resource-form" type="submit">{r(panel === 'knowledge' ? 'save' : 'createConfigure')}</Button></>}>
      {notice && <p role="alert">{notice}</p>}
      {panel === 'knowledge' && (!modelOptions.embedding_model_id.some(option => !option.disabled) || !modelOptions.documents_model_id.some(option => !option.disabled)) && <p role="status">{t('kbModelsRequired')}</p>}
      <form id="qzos-resource-form" onSubmit={(event) => { event.preventDefault(); save() }}><ResourceFields t={t} form={panel === 'knowledge' ? 'knowledgeCreate' : 'employeeCreate'} draft={draft} {...panel === 'knowledge' ? { options: modelOptions } : {}} disabled={busy} editing={configuration?.id !== null} onChange={(key, value) =>{  setDraft(current => ({ ...current, [key]: value })) }} knowledge={knowledge} /></form>
    </Modal>
    <Modal open={deleting !== null} onClose={() =>{  setDeleting(null) }} closeLabel={r('close')} title={r('deleteConfirm')} description={r('deleteHint')}
      footer={<><Button variant="outline" onClick={() =>{  setDeleting(null) }}>{r('cancel')}</Button><Button variant="primary" onClick={() => { if (deleting && panel === 'knowledge') { const id = deleting.id; void perform(async () => { await knowledgeRequest('/kb.know/del', { id: Number(id) }); actions.setDetail(panel, null); actions.refreshKnowledge(); setDeleting(null) }); return } if (deleting) { actions.deleteResource(panel, deleting.id); if (panel === 'employees') syncEmployees(records.filter(record => record.id !== deleting.id)) } setDeleting(null) }}>{r('confirmDelete')}</Button></>}><strong>{deleting?.title}</strong>{notice && <p role="alert">{notice}</p>}</Modal>
  </section>
}
