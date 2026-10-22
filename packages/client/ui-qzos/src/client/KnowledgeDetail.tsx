/** Knowledge learning, search, member and settings views from the QZOS user client. */
import { useState } from 'react'
import { Button, Input, Modal, IconChevronLeftOutlineRegular, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import type { Example } from './catalog.ts'
import type { PreviewRow } from './resource-fixtures.ts'
import { resourceDraft, type PreviewValues, type ResourceForm } from './resource-schema.ts'
import { ResourceFields } from './ResourceForms.tsx'
import { ResourceTable } from './ResourceTable.tsx'
import { resourceCopy, type ResourceText } from './resource-copy.ts'
import css from './Resources.module.css'

const emptyRows: readonly PreviewRow[] = []
type KnowledgeDetailProps = PanelProps & { item: Example; section: string; onDelete: () => void }
type Dialog = { kind: 'rename' | 'fragment' | 'member' | 'acl' | 'parameters' | 'transfer'; row?: PreviewRow }

/** Preserve the knowledge detail's original navigation and commands in browser memory. */
export function KnowledgeDetail({ item, section, useStore, actions, t, onDelete }: KnowledgeDetailProps) {
  const r = (key: ResourceText) => t(resourceCopy[key])
  const [mode, setMode] = useState<'documents' | 'import' | 'fragments'>('documents')
  const [document, setDocument] = useState<PreviewRow | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selection, setSelection] = useState<string[]>([])
  const [importType, setImportType] = useState('docImport')
  const [files, setFiles] = useState<string[]>([])
  const [urls, setUrls] = useState('')
  const [content, setContent] = useState('')
  const [question, setQuestion] = useState('')
  const [tested, setTested] = useState(false)
  const [draft, setDraft] = useState(() => resourceDraft({ name: item.title, intro: item.description, ...item.values }))
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogDraft, setDialogDraft] = useState<PreviewValues>({})
  const [confirmation, setConfirmation] = useState<{ key: string; ids: string[] } | null>(null)
  const [notice, setNotice] = useState('')
  const documentsKey = `${item.id}:documents`
  const fragmentsKey = `${item.id}:fragments:${document?.id ?? ''}`
  const membersKey = `${item.id}:members`
  const documents = useStore(state => state.resourceRows[documentsKey] ?? emptyRows)
  const fragments = useStore(state => state.resourceRows[fragmentsKey] ?? emptyRows)
  const members = useStore(state => state.resourceRows[membersKey] ?? emptyRows)
  const knowledge = useStore(state => state.knowledge)
  const owned = item.scope === 'owned'
  const update = (key: string, value: string) =>{  setDraft(current => ({ ...current, [key]: value })) }
  const show = (kind: Dialog['kind'], row?: PreviewRow) => {
    setDialogDraft(resourceDraft(kind === 'parameters' ? draft : row ? { ...row } : {}))
    setDialog({ kind, ...row ? { row } : {} })
  }
  const openDocument = (row: PreviewRow) => {
    actions.initializeRows(`${item.id}:fragments:${row.id}`, 'fragments')
    setDocument(row); setMode('fragments'); setQuery(''); setSearch(''); setSelection([])
  }
  const saveDialog = () => {
    if (!dialog) return
    if (dialog.kind === 'parameters') setDraft(current => ({ ...current, ...dialogDraft }))
    if ((dialog.kind === 'fragment' && !dialogDraft.question?.trim()) || (dialog.kind === 'member' && !dialogDraft.nickname?.trim()) || (dialog.kind === 'rename' && !dialogDraft.name?.trim())) return
    if (dialog.kind === 'rename') actions.saveRow(documentsKey, dialog.row?.id ?? null, { name: dialogDraft.name ?? '' })
    if (dialog.kind === 'fragment') actions.saveRow(fragmentsKey, dialog.row?.id ?? null, { ...dialogDraft, name: dialogDraft.question ?? '', status: 'waitingLearn', consumed: '0', updatedAt: '2026-10-21 10:00' })
    if (dialog.kind === 'member') actions.saveRow(membersKey, null, { ...dialogDraft, name: dialogDraft.nickname ?? '', role: 'member' })
    if (dialog.kind === 'acl' && dialog.row) actions.saveRow(documentsKey, dialog.row.id, { acl: dialogDraft.power ?? 'inherit' })
    if (dialog.kind === 'transfer') {
      actions.transferKnowledge(item.id, dialogDraft.member ?? '')
      setNotice(r('saved'))
    }
    setDialog(null)
  }
  const retry = (ids: string[]) => { for (const id of ids) actions.saveRow(fragmentsKey, id, { status: 'waitingLearn' }); setSelection([]) }
  const exportRows = () => {
    const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`
    const data = [[r('documentContent'), r('extraContent')], ...fragments.map(row => [row.question ?? '', row.answer ?? ''])]
    const blob = new Blob(['\ufeff' + data.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = globalThis.document.createElement('a'); anchor.href = url; anchor.download = 'qzos-preview.csv'; anchor.click()
    setTimeout(() =>{  URL.revokeObjectURL(url) }, 0)
  }
  const filteredDocuments = documents.filter(row => row.name.includes(search))
  const filteredFragments = fragments.filter(row => `${row.question} ${row.answer}`.includes(search) && (status === 'all' || row.status === status))
  const dialogTitle: ResourceText = dialog?.kind === 'rename' ? 'rename' : dialog?.kind === 'member' ? 'addMember'
    : dialog?.kind === 'acl' ? 'filePermissions'
      : dialog?.kind === 'parameters' ? 'searchParameters' : dialog?.kind === 'transfer' ? 'transferTitle' : 'entryData'
  const dialogForm: ResourceForm = dialog?.kind === 'member' ? 'member' : dialog?.kind === 'parameters' ? 'searchParameters' : 'fragment'

  return <div className={css.inner}>
    {notice && <p className={css.notice} role="status">{notice}</p>}
    {section === 'dataStudy' && <>
      {mode === 'documents' ? <>
        <div className={css.toolbar}><div className={css.inline}><Button variant="primary" disabled={!owned} onClick={() =>{  setMode('import') }}>{r('importData')}</Button><Button aria-label={r('refresh')} onClick={() => { setQuery(''); setSearch('') }}><IconRefreshOutlineRegular size={18} /></Button></div><div className={css.inline}><Input aria-label={r('keyword')} placeholder={r('keyword')} value={query} onChange={(event) =>{  setQuery(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter') setSearch(query) }} /><Button variant="primary" onClick={() =>{  setSearch(query) }}>{r('query')}</Button><Button onClick={() => { setQuery(''); setSearch('') }}>{r('reset')}</Button></div></div>
        <ResourceTable rows={filteredDocuments} r={r} columns={[['name', 'name'], ['waiting', 'waiting'], ['trained', 'trained'], ['totalData', 'totalData'], ['createdAt', 'createdAt']]} onOpen={openDocument}
          actions={row => [
            ...owned && row.id !== 'manual' ? [{ label: 'uploadVersion' as const, run: () => { setMode('import'); setFiles([row.name]) } }] : [],
            { label: 'rename', disabled: !owned, run: () =>{  show('rename', row) } },
            ...owned ? [{ label: 'filePermissions' as const, run: () =>{  show('acl', row) } }] : [],
            ...owned && row.id !== 'manual' ? [{ label: 'delete' as const, run: () =>{  setConfirmation({ key: documentsKey, ids: [row.id] }) } }] : [],
          ]} />
      </> : mode === 'import' ? <>
        <Button onClick={() =>{  setMode('documents') }}><IconChevronLeftOutlineRegular size={16} />{r('fileImport')}</Button>
        <div className={css.importTabs}>{(['docImport', 'qaImport', 'qaSplit', 'webImport'] as const).map(type => <button type="button" key={type} aria-pressed={importType === type} onClick={() => { setImportType(type); setFiles([]) }}>{r(type)}<small>{r(`${type}Desc`)}</small></button>)}</div>
        {importType === 'webImport' ? <><textarea className={css.textArea} rows={5} aria-label={r('webUrls')} placeholder={r('webUrls')} value={urls} onChange={(event) =>{  setUrls(event.target.value) }} /><Button onClick={() =>{  setContent(urls.split('\n').filter(Boolean).map(url => `${url}\n${item.description}`).join('\n\n')) }}>{r('parse')}</Button><textarea className={css.textArea} rows={8} aria-label={r('fileContent')} placeholder={r('fileContent')} value={content} onChange={(event) =>{  setContent(event.target.value) }} /></>
          : <><div className={css.dropZone}><span>{r('dropFile')}</span><Button>{r('chooseFile')}</Button><input type="file" multiple aria-label={r('chooseFile')} accept={importType === 'qaImport' ? '.csv,.xlsx' : '.pdf,.doc,.docx,.txt,.md,.xlsx,.pptx'} onChange={(event) =>{  setFiles(Array.from(event.target.files ?? [], file => file.name)) }} /></div>{files.map(file => <div className={css.result} key={file}>{file}</div>)}{importType === 'qaImport' ? <Button onClick={exportRows}>{r('downloadTemplate')}</Button> : <div className={css.inline}><label>{r('segmentLength')} <input type="number" defaultValue={1000} min={100} max={10000} /></label><Button onClick={() =>{  setContent(item.description) }}>{r('repreview')}</Button></div>}{content && <p className={css.result}>{content}</p>}</>}
        <div className={css.formFooter}><Button variant="primary" disabled={!owned || (importType === 'webImport' ? !content : files.length === 0)} onClick={() => {
          for (const name of importType === 'webImport' ? urls.split('\n').filter(Boolean) : files) actions.saveRow(documentsKey, null, { name, waiting: '1', trained: '0', totalData: '1', createdAt: '2026-10-21 10:00', status: 'processing' })
          setMode('documents'); setNotice(r('saved'))
        }}>{r('save')}</Button></div>
      </> : <>
        <Button onClick={() => { setMode('documents'); setSearch(''); setQuery('') }}><IconChevronLeftOutlineRegular size={16} />{document?.name}</Button>
        <div className={css.toolbar}><div className={css.inline}><Button variant="primary" disabled={!owned} onClick={() =>{  show('fragment') }}>{r('entryData')}</Button><Button disabled={!owned} onClick={exportRows}>{r('exportAll')}</Button><Button disabled={!owned || selection.length === 0} onClick={() =>{  retry(selection) }}>{r('batchRetry')}</Button><Button disabled={!owned || selection.length === 0} onClick={() =>{  setConfirmation({ key: fragmentsKey, ids: selection }) }}>{r('batchDelete')}</Button></div>
          <div className={css.inline}><Input value={query} aria-label={r('keyword')} placeholder={r('keyword')} onChange={(event) => { setQuery(event.target.value); setSearch(event.target.value) }} /><select value={status} onChange={(event) =>{  setStatus(event.target.value) }} aria-label={r('learningStatus')}>{(['all', 'waitingLearn', 'learning', 'failedLearn', 'learned'] as const).map(value => <option key={value} value={value}>{r(value)}</option>)}</select></div></div>
        <ResourceTable rows={filteredFragments} r={r} selection={selection} onSelection={setSelection} columns={[['question', 'documentContent'], ['answer', 'extraContent'], ['status', 'learningStatus'], ['consumed', 'consumed'], ['updatedAt', 'updatedAt']]} cell={(row, key) => key === 'status' ? r(row.status === 'learned' ? 'learned' : row.status === 'failedLearn' ? 'failedLearn' : 'waitingLearn') : row[key] ?? '—'} actions={row => [
          { label: 'correct', disabled: !owned, run: () =>{  show('fragment', row) } }, ...row.status === 'failedLearn' ? [{ label: 'retry' as const, disabled: !owned, run: () =>{  retry([row.id]) } }] : [], { label: 'delete', disabled: !owned, run: () =>{  setConfirmation({ key: fragmentsKey, ids: [row.id] }) } },
        ]} />
      </>}
    </>}
    {section === 'testData' && <div className={css.columns}><div><label>{r('testText')}<textarea className={css.textArea} rows={20} value={question} onChange={(event) =>{  setQuestion(event.target.value) }} /></label><div className={css.toolbar}><Button variant="primary" disabled={!question.trim()} onClick={() =>{  setTested(true) }}>{r('test')}</Button><Button onClick={() =>{  show('parameters') }}>{r('searchParameters')}</Button></div></div><div>{tested ? <><h2>{r('results')}</h2><p className={css.notice}>{r('searchPreview')}</p><div className={css.result}><strong>{r('source')}：{documents[1]?.name}</strong><p>{item.description}</p><span>{r('score')}：0.92</span></div></> : <p className={css.empty}>{r('testResult')}</p>}</div></div>}
    {section === 'teamData' && <><h2>{r('myTeam')}</h2><div className={css.toolbar}><span>{r('teamMembers')} ({members.length})</span>{owned && <Button variant="outline" onClick={() =>{  show('member') }}>+ {r('addMember')}</Button>}</div>
      <ResourceTable rows={members} r={r} columns={[['nickname', 'memberInfo'], ['role', 'memberRole'], ['power', 'defaultPermission']]} cell={(row, key) => key === 'role' ? r(row.role === 'owner' ? 'owner' : 'member') : key === 'power' ? r(row.power === 'all' ? 'allPermission' : row.power === 'edit' ? 'editPermission' : row.power === 'manage' ? 'managePermission' : 'viewPermission') : row[key] ?? '—'} actions={row => row.role === 'owner' ? [] : owned ? [
        { label: 'editPermission', run: () =>{  actions.saveRow(membersKey, row.id, { power: 'edit' }) } }, { label: 'viewPermission', run: () =>{  actions.saveRow(membersKey, row.id, { power: 'view' }) } }, { label: 'managePermission', run: () =>{  actions.saveRow(membersKey, row.id, { power: 'manage' }) } }, { label: 'removeMember', run: () =>{  setConfirmation({ key: membersKey, ids: [row.id] }) } },
      ] : []} />{owned && <Button onClick={() =>{  show('transfer') }}>{r('transfer')}</Button>}</>}
    {section === 'setUp' && <><h2>{r('knowledgeSettings')}</h2><div className={css.tabs}><Button aria-pressed>{r('baseInfo')}</Button></div><ResourceFields t={t} form="knowledgeSettings" draft={draft} onChange={update} knowledge={knowledge} editing disabled={!owned} /><p className={css.notice}>{r('enabledExternalHint')}</p><div className={css.formFooter}><Button variant="primary" disabled={!owned} onClick={() => { actions.saveResource('knowledge', item.id, draft); setNotice(r('settingsSaved')) }}>{r('saveSettings')}</Button><Button disabled={!owned} onClick={onDelete}>{r('delete')}</Button></div></>}
    <Modal open={dialog !== null} onClose={() =>{  setDialog(null) }} closeLabel={r('close')} title={r(dialogTitle)} className={css.dialog as string}
      footer={<><Button variant="outline" onClick={() =>{  setDialog(null) }}>{r('cancel')}</Button><Button variant="primary" onClick={saveDialog}>{r('confirm')}</Button></>}>
      {dialog?.kind === 'rename' ? <label>{r('name')}<Input value={dialogDraft.name ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, name: event.target.value })) }} /></label>
        : dialog?.kind === 'acl' ? <><label>{r('accessScope')}<select value={dialogDraft.power ?? 'inherit'} onChange={(event) =>{  setDialogDraft(current => ({ ...current, power: event.target.value })) }}>{(['inherit', 'custom'] as const).map(value => <option key={value} value={value}>{r(value)}</option>)}</select></label>{members.map(member => <p key={member.id}>{member.nickname}</p>)}</>
          : dialog?.kind === 'transfer' ? <><p>{r('transferConfirm')}</p><select aria-label={r('memberInfo')} value={dialogDraft.member ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, member: event.target.value })) }}><option value="">—</option>{members.filter(member => member.role !== 'owner').map(member => <option key={member.id} value={member.id}>{member.nickname}</option>)}</select></>
            : <ResourceFields t={t} form={dialogForm} draft={dialogDraft} knowledge={knowledge}
              onChange={(key, value) =>{  setDialogDraft(current => ({ ...current, [key]: value })) }} />}
    </Modal>
    <Modal open={confirmation !== null} onClose={() =>{  setConfirmation(null) }} closeLabel={r('close')} title={r('deleteConfirm')} description={r('deleteHint')}
      footer={<><Button variant="outline" onClick={() =>{  setConfirmation(null) }}>{r('cancel')}</Button><Button variant="primary" onClick={() => { if (confirmation) actions.deleteRows(confirmation.key, confirmation.ids); setConfirmation(null); setSelection([]) }}>{r('confirmDelete')}</Button></>} />
  </div>
}
