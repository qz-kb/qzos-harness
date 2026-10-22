/** Knowledge learning, search, member and settings views from the QZOS user client. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, IconChevronLeftOutlineRegular, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { PanelProps } from './Panel.tsx'
import type { Example } from './catalog.ts'
import type { PreviewRow } from './resource-fixtures.ts'
import { resourceDraft, type PreviewValues, type ResourceForm } from './resource-schema.ts'
import { ResourceFields } from './ResourceForms.tsx'
import { ResourceTable } from './ResourceTable.tsx'
import { resourceCopy, type ResourceText } from './resource-copy.ts'
import { knowledgeRequest as requestKnowledge, knowledgeRows, knowledgeText, knowledgeDraft, knowledgeTable, saveKnowledge } from './knowledge-client.ts'
import { loginRecord, storedLogin } from './login-client.ts'
import { KnowledgeParse } from './KnowledgeParse.tsx'
import { KnowledgeAcl } from './KnowledgeAcl.tsx'
import css from './Resources.module.css'

type KnowledgeDetailProps = PanelProps & {
  item: Example
  section: string
  onDelete: () => void
  modelOptions: Record<string, { value: string; label: string; disabled?: boolean }[]> }
type Dialog = { kind: 'rename' | 'fragment' | 'member' | 'acl' | 'parameters' | 'transfer'; row?: PreviewRow }

/** Preserve the knowledge detail's original navigation and commands in browser memory. */
export function KnowledgeDetail(props: KnowledgeDetailProps) {
  const epoch = props.useStore(state => state.businessEpoch)
  const remote = props.useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/detail?id=${props.item.id}&epoch=${epoch}`)
  if (remote.status === 'failed') return <p role="alert">{remote.failure?.message}</p>
  if (!remote.value) return <p role="status">{props.t('kbLoading')}</p>
  const detail = loginRecord(remote.value.detail)
  return <KnowledgeContent {...props} detail={detail} />
}
function KnowledgeContent(props: KnowledgeDetailProps & { detail: Record<string, unknown> }) {
  const { item, section, useStore, useResource, actions, t, onDelete, modelOptions, detail } = props
  const r = (key: ResourceText) => key === 'saved' || key === 'settingsSaved' ? t('kbSaved') : t(resourceCopy[key])
  const [lifetime] = useState(() => new AbortController())
  const credential = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const knowledgeRequest = (path: string, body?: Record<string, unknown> | FormData) =>
    requestKnowledge(path, body, lifetime.signal, credential.current)
  const [mode, setMode] = useState<'documents' | 'import' | 'fragments'>('documents')
  const [document, setDocument] = useState<PreviewRow | null>(null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selection, setSelection] = useState<string[]>([])
  const [importType, setImportType] = useState('docImport')
  const [files, setFiles] = useState<File[]>([])
  const imports = useRef(new Map<File, Record<string, unknown>>())
  const [parseFile, setParseFile] = useState<PreviewRow | null>(null)
  const [versionTarget, setVersionTarget] = useState<PreviewRow | null>(null)
  const [urls, setUrls] = useState('')
  const [content, setContent] = useState('')
  const [question, setQuestion] = useState('')
  const [tested, setTested] = useState(false)
  const [hits, setHits] = useState<Record<string, unknown>[]>([])
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [revision, setRevision] = useState(0)
  const epoch = useStore(state => state.businessEpoch)
  const perform = async (work: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setNotice('')
    try { await work() } catch (error) { setNotice(error instanceof Error ? error.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  const refresh = () => { setRevision(value => value + 1) }
  const [draft, setDraft] = useState(() => resourceDraft({ ...knowledgeDraft(detail), documents_model_id: `${knowledgeText(detail.documents_model_id)}:${knowledgeText(detail.documents_model_sub_id)}` }))
  const [savedDraft, setSavedDraft] = useState(draft)
  const [externalConfirm, setExternalConfirm] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogDraft, setDialogDraft] = useState<PreviewValues>({})
  const [confirmation, setConfirmation] = useState<{ key: string; ids: string[] } | null>(null)
  const [notice, setNotice] = useState('')
  const documentsKey = `${item.id}:documents`
  const fragmentsKey = `${item.id}:fragments:${document?.id ?? ''}`
  const membersKey = `${item.id}:members`
  const documentsResource = useResource<'qzos-knowledge'>(section === 'dataStudy' || section === 'testData' ? `dsh-resource://qzos-knowledge/files?id=${item.id}&epoch=${epoch}&revision=${revision}` : '')
  const fragmentsResource = useResource<'qzos-knowledge'>(document && mode === 'fragments' ? `dsh-resource://qzos-knowledge/fragments?id=${item.id}&fd=${document.id}&epoch=${epoch}&revision=${revision}` : '')
  const membersResource = useResource<'qzos-knowledge'>(section === 'teamData' || dialog?.kind === 'acl' ? `dsh-resource://qzos-knowledge/members?id=${item.id}&epoch=${epoch}&revision=${revision}` : '')
  const documents = documentsResource.value ? knowledgeTable(knowledgeRows(documentsResource.value.rows), 'files') : []
  const fragments = fragmentsResource.value ? knowledgeTable(knowledgeRows(fragmentsResource.value.rows), 'fragments') : []
  const members = membersResource.value ? knowledgeTable(knowledgeRows(membersResource.value.rows), 'members') : []
  const knowledge = useStore(state => state.knowledge)
  const owned = Number(detail.owned) === 1
  const editable = [1, 2].includes(Number(detail.power))

  const update = (key: string, value: string) =>{  setDraft(current => ({ ...current, [key]: value })) }
  const show = (kind: Dialog['kind'], row?: PreviewRow) => {
    setDialogDraft(resourceDraft(kind === 'parameters' ? draft : row ? { ...row } : {}))
    setDialog({ kind, ...row ? { row } : {} })
  }
  const openDocument = (row: PreviewRow) => {
    setDocument(row); setMode('fragments'); setQuery(''); setSearch(''); setSelection([])
  }
  const saveDialog = () => { void perform(async () => {
    if (!dialog) return
    if (dialog.kind === 'parameters') { setDraft(current => ({ ...current, ...dialogDraft })); setDialog(null); return }
    if (dialog.kind === 'rename') await knowledgeRequest('/kb.know/fileRename', { fd_id: Number(dialog.row?.id), name: dialogDraft.name })
    if (dialog.kind === 'fragment') {
      const original = dialog.row ? loginRecord(await knowledgeRequest(`/kb.teach/detail?uuid=${encodeURIComponent(dialog.row.id)}`)) : {}
      await knowledgeRequest(`/kb.teach/${dialog.row ? 'update' : 'insert'}`, { ...dialog.row ? { uuid: dialog.row.id } : { kb_id: Number(item.id), fd_id: Number(document?.id) }, question: dialogDraft.question, answer: dialogDraft.answer, files: original.files ?? [], images: original.images ?? [], video: original.video ?? [] })
    }
    if (dialog.kind === 'member') {
      const page = loginRecord(await knowledgeRequest(`/kb.know/teamUsers?kb_id=${item.id}&keyword=${encodeURIComponent(dialogDraft.nickname ?? '')}&page_no=1&page_size=100`))
      const users = knowledgeRows(page.lists ?? page.data)
        .filter(user => knowledgeText(user.nickname) === dialogDraft.nickname || knowledgeText(user.sn) === dialogDraft.nickname)
      if (users.length !== 1) throw new Error(t('kbMemberMatch'))
      await knowledgeRequest('/kb.know/teamAdd', { kb_id: Number(item.id), users: { [knowledgeText(users[0]?.sn)]: dialogDraft.power === 'manage' ? 1 : dialogDraft.power === 'edit' ? 2 : 3 } })
    }
    if (dialog.kind === 'transfer') {
      const target = members.find(member => member.id === dialogDraft.member)
      if (!target) throw new Error(t('kbMemberMatch'))
      await knowledgeRequest('/kb.know/transfer', { kb_id: Number(item.id), type: 'kb', sn: Number(target.sn) })
      actions.setDetail('knowledge', null); actions.refreshKnowledge()
    }
    setDialog(null); refresh(); setNotice(r('saved'))
  }) }
  const saveSettings = () => { void perform(async () => {
    const baseChanged = ['name', 'intro', 'image', 'documents_model_id'].some(key => draft[key] !== savedDraft[key])
    if (baseChanged) { await saveKnowledge(item.id, draft, lifetime.signal); setSavedDraft(current => ({ ...draft, external_enabled: current.external_enabled ?? '0' })) }
    if (Number(draft.external_enabled ?? 0) !== Number(savedDraft.external_enabled ?? 0)) {
      await knowledgeRequest('/kb.publish/knowledgeExternal', { kb_id: Number(item.id), enabled: Number(draft.external_enabled) === 1 })
    }
    const actual = loginRecord(await knowledgeRequest(`/kb.know/detail?id=${item.id}`))
    const saved = { ...draft, external_enabled: knowledgeText(actual.external_enabled ?? 0) }
    setDraft(saved); setSavedDraft(saved); setExternalConfirm(false); actions.refreshKnowledge(); setNotice(r('settingsSaved'))
  }) }
  const retry = (ids: string[]) => { void perform(async () => { await knowledgeRequest('/kb.teach/reset', { kb_id: Number(item.id), uuids: ids }); refresh(); setSelection([]) }) }
  const memberPower = (id: string, power: number) => { void perform(async () => { await knowledgeRequest('/kb.know/teamEdit', { id: Number(id), power }); refresh() }) }
  const remove = () => { void perform(async () => {
    if (!confirmation) return
    if (confirmation.key === fragmentsKey) await knowledgeRequest('/kb.teach/delete', { kb_id: Number(item.id), uuids: confirmation.ids })
    else for (const id of confirmation.ids) await knowledgeRequest(confirmation.key === membersKey ? '/kb.know/teamDel' : '/kb.know/fileRemove', confirmation.key === membersKey ? { id: Number(id) } : { fd_id: Number(id) })
    setConfirmation(null); setSelection([]); refresh()
  }) }
  const importData = () => { void perform(async () => {
    const method = importType === 'qaSplit' ? 2 : importType === 'qaImport' ? 3 : importType === 'webImport' ? 4 : 1
    if (versionTarget && method !== 1) throw new Error(t('parseOneVersion'))
    const capabilities = loginRecord(await knowledgeRequest('/kb.teach/importCapabilities'))
    const capability = loginRecord(loginRecord(capabilities.methods)[knowledgeText(method)])
    if (method === 4) {
      await knowledgeRequest('/kb.teach/import', { kb_id: Number(item.id), method, documents: [{ name: urls, path: '', data: [{ q: content, a: '' }] }] })
    } else {
      if (capability.mode !== 'server') throw new Error(t('kbParserRequired'))
      if (!files.length || (versionTarget && files.length !== 1)) throw new Error(t('parseOneVersion'))
      for (const file of files) {
        let submission = imports.current.get(file)
        if (!submission) {
          const form = new FormData(); form.append('file', file); form.append('kb_id', item.id); form.append('purpose', 'pending_original')
          const uploaded = loginRecord(await knowledgeRequest('/kb.file_gateway/upload', form))
          submission = { kb_id: Number(item.id), method, documents: [{
            name: file.name, object_id: uploaded.object_id, request_id: randomUUID(),
            ...versionTarget ? { fd_id: Number(versionTarget.id), expected_version: Number(versionTarget.version) } : {},
          }] }
          imports.current.set(file, submission)
        }
        try { await knowledgeRequest('/kb.teach/import', submission) }
        catch (error) { refresh(); throw error }
        imports.current.delete(file)
        setFiles(current => current.filter(value => value !== file))
      }
    }
    setFiles([]); setVersionTarget(null); setMode('documents'); refresh(); setNotice(t('parseImportAccepted'))
  }) }
  const exportRows = () => {
    const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`
    const data = [[r('documentContent'), r('extraContent')], ...(importType === 'qaImport' && mode === 'import' ? [] : fragments).map(row => [row.question ?? '', row.answer ?? ''])]
    const blob = new Blob(['\ufeff' + data.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = globalThis.document.createElement('a'); anchor.href = url; anchor.download = 'qzos-knowledge.csv'; anchor.click()
    setTimeout(() =>{  URL.revokeObjectURL(url) }, 0)
  }
  const filteredDocuments = documents.filter(row => row.name.includes(search))
  const filteredFragments = fragments.filter(row => `${row.question} ${row.answer}`.includes(search) && (status === 'all' || row.status === status))
  const dialogTitle: ResourceText = dialog?.kind === 'rename' ? 'rename' : dialog?.kind === 'member' ? 'addMember'
    : dialog?.kind === 'acl' ? 'filePermissions'
      : dialog?.kind === 'parameters' ? 'searchParameters' : dialog?.kind === 'transfer' ? 'transferTitle' : 'entryData'
  const dialogForm: ResourceForm = dialog?.kind === 'member' ? 'member' : dialog?.kind === 'parameters' ? 'searchParameters' : 'fragment'

  return <div className={css.inner} aria-busy={busy}>
    {parseFile && <KnowledgeParse {...props} kb={item.id} fd={parseFile.id} name={parseFile.name} editable={editable}
      onChanged={refresh} onClose={() => { setParseFile(null); refresh() }} />}
    {[documentsResource, fragmentsResource, membersResource].map((resource, index) => resource.status === 'failed' ? <p key={index} role="alert">{resource.failure?.message}<Button onClick={refresh}>{r('refresh')}</Button></p> : null)}
    {notice && <p className={css.notice} role="status">{notice}</p>}
    {section === 'dataStudy' && <>
      {mode === 'documents' ? <>
        <div className={css.toolbar}><div className={css.inline}><Button variant="primary" disabled={busy || !editable} onClick={() =>{  setVersionTarget(null); setFiles([]); imports.current.clear(); setMode('import') }}>{r('importData')}</Button><Button aria-label={r('refresh')} onClick={() => { setQuery(''); setSearch(''); refresh() }}><IconRefreshOutlineRegular size={18} /></Button></div><div className={css.inline}><Input aria-label={r('keyword')} placeholder={r('keyword')} value={query} onChange={(event) =>{  setQuery(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter') setSearch(query) }} /><Button variant="primary" onClick={() =>{  setSearch(query) }}>{r('query')}</Button><Button onClick={() => { setQuery(''); setSearch('') }}>{r('reset')}</Button></div></div>
        <ResourceTable rows={filteredDocuments} r={r} columns={[['name', 'name'], ['parseState', 'parseStatus'], ['waiting', 'waiting'], ['trained', 'trained'], ['totalData', 'totalData'], ['createdAt', 'createdAt']]} onOpen={openDocument}
          actions={row => [
            ...row.hasParse === '1' ? [{ label: 'parseStatus' as const, run: () => { setParseFile(row) } }] : [],
            ...owned && row.is_default !== '1' ? [{ label: 'uploadVersion' as const, run: () => { setMode('import'); setImportType('docImport'); setFiles([]); imports.current.clear(); setVersionTarget(row) } }] : [],
            { label: 'rename', disabled: !owned, run: () =>{  show('rename', row) } },
            ...owned ? [{ label: 'filePermissions' as const, run: () =>{  show('acl', row) } }] : [],
            ...owned && row.is_default !== '1' ? [{ label: 'delete' as const, run: () =>{  setConfirmation({ key: documentsKey, ids: [row.id] }) } }] : [],
          ]} />
      </> : mode === 'import' ? <>
        <Button disabled={busy} onClick={() =>{  setMode('documents') }}><IconChevronLeftOutlineRegular size={16} />{r('fileImport')}</Button>
        {versionTarget && <p>{r('uploadVersion')}: {versionTarget.name} · {versionTarget.version}</p>}
        <div className={css.importTabs}>{(['docImport', 'qaImport', 'qaSplit', 'webImport'] as const).map(type => <button type="button" key={type} disabled={busy || Boolean(versionTarget && type !== 'docImport')} aria-pressed={importType === type} onClick={() => { setImportType(type); setFiles([]) }}>{r(type)}<small>{r(`${type}Desc`)}</small></button>)}</div>
        {importType === 'webImport' ? <><textarea className={css.textArea} rows={5} aria-label={r('webUrls')} placeholder={r('webUrls')} value={urls} onChange={(event) =>{  setUrls(event.target.value) }} /><Button onClick={() => { void perform(async () => { const captured = knowledgeRows(await knowledgeRequest('/kb.teach/capture', { url: urls.split('\n').filter(Boolean) })); setContent(captured.map(row => knowledgeText(row.content)).join('\n\n')) }) }}>{r('parse')}</Button><textarea className={css.textArea} rows={8} aria-label={r('fileContent')} placeholder={r('fileContent')} value={content} onChange={(event) =>{  setContent(event.target.value) }} /></>
          : <><div className={css.dropZone}><span>{r('dropFile')}</span><Button>{r('chooseFile')}</Button><input type="file" multiple={!versionTarget} disabled={busy} aria-label={r('chooseFile')} accept={importType === 'qaImport' ? '.csv,.xlsx' : '.pdf,.doc,.docx,.txt,.md,.xlsx,.pptx'} onChange={(event) =>{  imports.current.clear(); setFiles(Array.from(event.target.files ?? [])) }} /></div>{files.map(file => <div className={css.result} key={`${file.name}:${file.lastModified}`}>{file.name}</div>)}{importType === 'qaImport' ? <Button onClick={exportRows}>{r('downloadTemplate')}</Button> : <div className={css.inline}><label>{r('segmentLength')} <input type="number" defaultValue={1000} min={100} max={10000} /></label><Button onClick={() => { setNotice(t('kbParserRequired')) }}>{r('repreview')}</Button></div>}{content && <p className={css.result}>{content}</p>}</>}
        <div className={css.formFooter}><Button variant="primary" disabled={busy || !editable || (importType === 'webImport' ? !content : files.length === 0)} onClick={importData}>{r('save')}</Button></div>
      </> : <>
        <Button onClick={() => { setMode('documents'); setSearch(''); setQuery('') }}><IconChevronLeftOutlineRegular size={16} />{document?.name}</Button>
        <div className={css.toolbar}><div className={css.inline}><Button variant="primary" disabled={busy || !editable} onClick={() =>{  show('fragment') }}>{r('entryData')}</Button><Button disabled={busy || !editable} onClick={exportRows}>{r('exportAll')}</Button><Button disabled={busy || !editable || selection.length === 0} onClick={() =>{  retry(selection) }}>{r('batchRetry')}</Button><Button disabled={busy || !editable || selection.length === 0} onClick={() =>{  setConfirmation({ key: fragmentsKey, ids: selection }) }}>{r('batchDelete')}</Button></div>
          <div className={css.inline}><Input value={query} aria-label={r('keyword')} placeholder={r('keyword')} onChange={(event) => { setQuery(event.target.value); setSearch(event.target.value) }} /><select value={status} onChange={(event) =>{  setStatus(event.target.value) }} aria-label={r('learningStatus')}>{(['all', 'waitingLearn', 'learning', 'failedLearn', 'learned'] as const).map(value => <option key={value} value={value}>{r(value)}</option>)}</select></div></div>
        <ResourceTable rows={filteredFragments} r={r} selection={selection} onSelection={setSelection} columns={[['question', 'documentContent'], ['answer', 'extraContent'], ['status', 'learningStatus'], ['consumed', 'consumed'], ['updatedAt', 'updatedAt']]} cell={(row, key) => key === 'status' ? r(row.status === 'learned' ? 'learned' : row.status === 'failedLearn' ? 'failedLearn' : row.status === 'learning' ? 'learning' : 'waitingLearn') : row[key] ?? '—'} actions={row => [
          { label: 'correct', disabled: !owned, run: () =>{  show('fragment', row) } }, ...row.status === 'failedLearn' ? [{ label: 'retry' as const, disabled: !owned, run: () =>{  retry([row.id]) } }] : [], { label: 'delete', disabled: !owned, run: () =>{  setConfirmation({ key: fragmentsKey, ids: [row.id] }) } },
        ]} />
      </>}
    </>}
    {section === 'testData' && <div className={css.columns}><div><label>{r('testText')}<textarea className={css.textArea} rows={20} value={question} onChange={(event) =>{  setQuestion(event.target.value) }} /></label><div className={css.toolbar}><Button variant="primary" disabled={!question.trim()} onClick={() => { void perform(async () => { setTested(false); setHits([]); const input = Object.fromEntries(['search_tokens', 'search_similar', 'ranking_status', 'ranking_score', 'ranking_model', 'optimize_ask', 'optimize_m_id', 'optimize_s_id'].map(key => [key, Number(draft[key]) || 0])); setHits(knowledgeRows(await knowledgeRequest('/kb.teach/tests', { ...input, search_mode: draft.search_mode, optimize_m_id: Number(draft.optimize_m_id?.split(':')[0]) || 0, optimize_s_id: Number(draft.optimize_m_id?.split(':')[1]) || 0, question, kb_id: Number(item.id) }))); setTested(true) }) }}>{r('test')}</Button><Button onClick={() =>{  show('parameters') }}>{r('searchParameters')}</Button></div></div><div>{tested ? <><h2>{r('results')}</h2>{hits.length === 0 && <p>{r('empty')}</p>}{hits.map((hit, index) => <div key={`${index}:${knowledgeText(hit.question)}`} className={css.result}><strong>{knowledgeText(hit.question ?? '')}</strong><p>{knowledgeText(hit.answer ?? '')}</p><span>{r('score')}：{knowledgeText(hit.score ?? hit.full_score ?? hit.emb_score ?? '')}</span></div>)}</> : <p className={css.empty}>{r('testResult')}</p>}</div></div>}
    {section === 'teamData' && <><h2>{r('myTeam')}</h2><div className={css.toolbar}><span>{r('teamMembers')} ({members.length})</span>{owned && <Button variant="outline" onClick={() =>{  show('member') }}>+ {r('addMember')}</Button>}</div>
      <ResourceTable rows={members} r={r} columns={[['nickname', 'memberInfo'], ['role', 'memberRole'], ['power', 'defaultPermission']]} cell={(row, key) => key === 'role' ? r(row.role === 'owner' ? 'owner' : 'member') : key === 'power' ? r(row.power === 'all' ? 'allPermission' : row.power === 'edit' ? 'editPermission' : row.power === 'manage' ? 'managePermission' : 'viewPermission') : row[key] ?? '—'} actions={row => row.role === 'owner' ? [] : owned ? [
        { label: 'editPermission', run: () =>{  memberPower(row.id, 2) } }, { label: 'viewPermission', run: () =>{  memberPower(row.id, 3) } }, { label: 'managePermission', run: () =>{  memberPower(row.id, 1) } }, { label: 'removeMember', run: () =>{  setConfirmation({ key: membersKey, ids: [row.id] }) } },
      ] : []} />{owned && <Button onClick={() =>{  show('transfer') }}>{r('transfer')}</Button>}</>}
    {section === 'setUp' && <><h2>{r('knowledgeSettings')}</h2><div className={css.tabs}><Button aria-pressed>{r('baseInfo')}</Button></div><ResourceFields t={t} form="knowledgeSettings" draft={draft} options={modelOptions} onChange={update} knowledge={knowledge} editing disabled={busy || !editable} /><p className={css.notice}>{r('enabledExternalHint')}</p><div className={css.formFooter}><Button variant="primary" disabled={busy || !editable} onClick={() => { if (Number(draft.external_enabled) === 1 && Number(savedDraft.external_enabled ?? 0) !== 1) setExternalConfirm(true); else saveSettings() }}>{r('saveSettings')}</Button><Button disabled={busy || !editable} onClick={onDelete}>{r('delete')}</Button></div></>}
    {dialog?.kind === 'acl' && dialog.row && <KnowledgeAcl {...props} fd={dialog.row.id} onClose={() => { setDialog(null) }} />}
    <Modal open={externalConfirm} onClose={() => { setExternalConfirm(false) }} title={t('aclExternalConfirm')} closeLabel={r('close')} footer={<><Button disabled={busy} onClick={() => { setExternalConfirm(false) }}>{r('cancel')}</Button><Button disabled={busy} onClick={saveSettings}>{r('confirm')}</Button></>}>{notice && <p role="alert">{notice}</p>}</Modal>
    <Modal open={dialog !== null && dialog.kind !== 'acl'} onClose={() =>{  setDialog(null) }} closeLabel={r('close')} title={r(dialogTitle)} className={css.dialog as string}
      footer={<><Button variant="outline" onClick={() =>{  setDialog(null) }}>{r('cancel')}</Button><Button variant="primary" disabled={busy || dialog?.kind === 'acl'} onClick={saveDialog}>{r('confirm')}</Button></>}>
      {notice && <p role="alert">{notice}</p>}
      {dialog?.kind === 'rename' ? <label>{r('name')}<Input value={dialogDraft.name ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, name: event.target.value })) }} /></label>
        : dialog?.kind === 'transfer' ? <><p>{r('transferConfirm')}</p><select aria-label={r('memberInfo')} value={dialogDraft.member ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, member: event.target.value })) }}><option value="">—</option>{members.filter(member => member.role !== 'owner').map(member => <option key={member.id} value={member.id}>{member.nickname}</option>)}</select></>
          : <ResourceFields t={t} form={dialogForm} draft={dialogDraft} knowledge={knowledge} options={dialog?.kind === 'parameters' ? { ...modelOptions, optimize_m_id: modelOptions.documents_model_id ?? [] } : {}}
            onChange={(key, value) =>{  setDialogDraft(current => ({ ...current, [key]: value })) }} />}
    </Modal>
    <Modal open={confirmation !== null} onClose={() =>{  setConfirmation(null) }} closeLabel={r('close')} title={r('deleteConfirm')} description={r('deleteHint')}
      footer={<><Button variant="outline" onClick={() =>{  setConfirmation(null) }}>{r('cancel')}</Button><Button variant="primary" disabled={busy} onClick={remove}>{r('confirmDelete')}</Button></>} />
  </div>
}
