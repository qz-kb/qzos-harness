/** Knowledge learning, search, member and settings views from the QZOS user client. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, IconChevronLeftOutlineRegular, IconRefreshOutlineRegular, IconUsersOutlineRegular, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { PanelProps } from './Panel.tsx'
import type { Example } from './catalog.ts'
import type { PreviewRow } from './resource-fixtures.ts'
import { resourceDraft, type PreviewValues, type ResourceForm } from './resource-schema.ts'
import { ResourceFields } from './ResourceForms.tsx'
import { ResourceTable } from './ResourceTable.tsx'
import { resourceCopy, type ResourceText } from './resource-copy.ts'
import { knowledgeRequest as requestKnowledge, knowledgeRows, knowledgeText, knowledgeSearchInput, knowledgeDraft, knowledgeTable, saveKnowledge, knowledgeLearningPending, knowledgeCard } from './knowledge-client.ts'
import { loginRecord, storedLogin } from './login-client.ts'
import { KnowledgeParse } from './KnowledgeParse.tsx'
import { KnowledgeFile } from './KnowledgeFile.tsx'
import { knowledgeImportOptions, acceptsKnowledgeFiles } from './knowledge-import.ts'
import { KnowledgeMembers } from './KnowledgeMembers.tsx'
import { KnowledgeAcl } from './KnowledgeAcl.tsx'
import { sourceCitation } from './knowledge-source.ts'
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
  if (!remote.value) return <div className={css.cardSkeleton} role="status" aria-label={props.t('catalogLoading')} />
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
  const [documentsPage, setDocumentsPage] = useState(1)
  const [fragmentsPage, setFragmentsPage] = useState(1)
  const [membersPage, setMembersPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selection, setSelection] = useState<string[]>([])
  const [importType, setImportType] = useState('docImport')
  const [files, setFiles] = useState<File[]>([])
  const imports = useRef(new Map<File, Record<string, unknown>>())
  const originals = useRef(new Map<File, unknown>())
  const [previews, setPreviews] = useState<Record<string, unknown>[]>([])
  const [segmentLength, setSegmentLength] = useState(1000)
  const [accessFile, setAccessFile] = useState<PreviewRow | null>(null)
  const [parseFile, setParseFile] = useState<PreviewRow | null>(null)
  const [versionTarget, setVersionTarget] = useState<PreviewRow | null>(null)
  const [urls, setUrls] = useState('')
  const [webPages, setWebPages] = useState<{ name: string; content: string }[]>([])
  const [previewFile, setPreviewFile] = useState('')
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
  const [estimate, setEstimate] = useState('')
  const [attachments, setAttachments] = useState<Record<'images' | 'files' | 'video', Record<string, unknown>[]>>({ images: [], files: [], video: [] })
  const documentsKey = `${item.id}:documents`
  const fragmentsKey = `${item.id}:fragments:${document?.id ?? ''}`
  const membersKey = `${item.id}:members`
  const documentsResource = useResource<'qzos-knowledge'>(section === 'dataStudy' || section === 'testData' ? `dsh-resource://qzos-knowledge/files?id=${item.id}&epoch=${epoch}&revision=${revision}&page=${documentsPage}&page_size=15&keyword=${encodeURIComponent(search)}` : '')
  const fragmentsResource = useResource<'qzos-knowledge'>(document && mode === 'fragments' ? `dsh-resource://qzos-knowledge/fragments?id=${item.id}&fd=${document.id}&epoch=${epoch}&revision=${revision}&page=${fragmentsPage}&page_size=15&keyword=${encodeURIComponent(search)}&status=${status === 'all' ? '' : status === 'waitingLearn' ? '0' : status === 'learning' ? '1' : status === 'failedLearn' ? '3' : '2'}` : '')
  const membersResource = useResource<'qzos-knowledge'>(section === 'teamData' || dialog?.kind === 'acl' ? `dsh-resource://qzos-knowledge/members?id=${item.id}&epoch=${epoch}&revision=${revision}&page=${membersPage}&page_size=15` : '')
  const allMembersResource = useResource<'qzos-knowledge'>(dialog?.kind === 'transfer' ? `dsh-resource://qzos-knowledge/members-all?id=${item.id}&epoch=${epoch}&revision=${revision}` : '')
  const correctionResource = useResource<'qzos-knowledge'>(dialog?.kind === 'correct' ? `dsh-resource://qzos-knowledge/list?epoch=${epoch}&revision=${revision}&all=1` : '')
  const knowledge = correctionResource.value ? knowledgeRows(correctionResource.value.rows).map(knowledgeCard) : []
  const capabilitiesResource = useResource<'qzos-knowledge'>(mode === 'import' ? `dsh-resource://qzos-knowledge/import-capabilities?epoch=${epoch}&revision=${revision}` : '')
  const capabilities = loginRecord(capabilitiesResource.value?.capabilities ?? {})
  const importOptions = knowledgeImportOptions(capabilities, importType)
  const selectFiles = (incoming: File[]) => {
    if (busy || !importOptions.available) return
    if (!acceptsKnowledgeFiles(incoming, importOptions.extensions, Boolean(versionTarget))) { setNotice(t('knowledgeFileRejected')); return }
    imports.current.clear(); originals.current.clear(); setPreviews([]); setFiles(incoming); setPreviewFile(''); setNotice('')
  }
  const documents = documentsResource.value ? knowledgeTable(knowledgeRows(documentsResource.value.rows), 'files') : []
  const fragments = fragmentsResource.value ? knowledgeTable(knowledgeRows(fragmentsResource.value.rows), 'fragments') : []
  const members = membersResource.value ? knowledgeTable(knowledgeRows(membersResource.value.rows), 'members') : []
  const allMembers = allMembersResource.value ? knowledgeTable(knowledgeRows(allMembersResource.value.rows), 'members') : []
  const membersTotal = Number(membersResource.value?.total ?? members.length)
  const documentsTotal = Number(documentsResource.value?.total ?? documents.length)
  const fragmentsTotal = Number(fragmentsResource.value?.total ?? fragments.length)
  useEffect(() => { setDocumentsPage(1) }, [search])
  useEffect(() => { setFragmentsPage(1) }, [document?.id, search, status])
  useEffect(() => {
    if (section !== 'dataStudy' || busy) return
    const resource = mode === 'documents' ? documentsResource : mode === 'fragments' ? fragmentsResource : null
    if (!resource?.value || resource.status !== 'live') return
    const active = mode === 'fragments' ? knowledgeLearningPending(resource.value) : knowledgeRows(resource.value.rows).some((row) => {
      const parse = loginRecord(row.parse ?? {})
      const processing = loginRecord(parse.processing ?? {})
      return Boolean(parse.processing) && !processing.cancelled && processing.stage !== 'done' && !processing.hold_reason && !parse.can_retry
    })
    if (!active) return
    const timer = setTimeout(() => { setRevision(value => value + 1) }, 5000)
    return () => { clearTimeout(timer) }
  }, [section, mode, busy, documentsResource.value, documentsResource.status, fragmentsResource.value, fragmentsResource.status])
  const owned = Number(detail.owned) === 1
  const manageable = Number(detail.power) === 1
  const editable = [1, 2].includes(Number(detail.power))

  const update = (key: string, value: string) =>{  setDraft(current => ({ ...current, [key]: value })) }
  const show = (kind: Dialog['kind'], row?: PreviewRow) => {
    setEstimate('')
    setDialogDraft(resourceDraft(kind === 'parameters' ? draft : row ? { ...row } : {}))
    if (kind === 'fragment' && row) {
      void perform(async () => {
        const original = loginRecord(await knowledgeRequest(`/kb.teach/detail?uuid=${encodeURIComponent(row.id)}`))
        setDialogDraft(resourceDraft({ ...row, question: knowledgeText(original.question), answer: knowledgeText(original.answer) }))
        setAttachments({
          images: knowledgeRows(original.images), files: knowledgeRows(original.files), video: knowledgeRows(original.video),
        })
        setDialog({ kind, row })
      }); return
    }
    if (kind === 'fragment') setAttachments({ images: [], files: [], video: [] })
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
      await knowledgeRequest(`/kb.teach/${dialog.row ? 'update' : 'insert'}`, { ...dialog.row ? { uuid: dialog.row.id } : { kb_id: Number(item.id), fd_id: Number(document?.id) }, question: dialogDraft.question, answer: dialogDraft.answer, ...attachments })
    }
    if (dialog.kind === 'transfer') {
      const target = allMembers.find(member => member.id === dialogDraft.member)
      if (!target) throw new Error(t('kbMemberMatch'))
      await knowledgeRequest('/kb.know/transfer', { kb_id: Number(item.id), type: 'kb', sn: Number(target.sn) })
      actions.setDetail('knowledge', null); actions.refreshKnowledge()
    }
    setDialog(null); refresh(); setNotice(r('saved'))
  }) }
  const uploadAttachments = (kind: 'images' | 'files' | 'video', files: File[]) => { void perform(async () => {
    if ((kind === 'images' && (attachments.images.length + files.length > 9 || files.some(file => !file.type.startsWith('image/')))) ||
        (kind === 'video' && (files.length !== 1 || files.some(file => !file.name.toLowerCase().endsWith('.mp4') || file.size > 20 * 1024 * 1024)))) throw new Error(t('knowledgeMediaInvalid'))
    for (const file of files) {
      const form = new FormData(); form.append('file', file)
      const value = loginRecord(await knowledgeRequest(`/upload/${kind === 'images' ? 'image' : kind === 'files' ? 'file' : 'video'}`, form))
      const attachment = { url: knowledgeText(value.uri ?? value.url), name: file.name }
      if (!attachment.url) throw new Error(t('employeeWriteUnknown'))
      setAttachments(current => ({ ...current, [kind]: kind === 'video' ? [attachment] : [...current[kind], attachment] }))
    }
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
  const previewImport = () => { void perform(async () => {
    const method = importType === 'qaSplit' ? 2 : 3
    const capabilities = loginRecord(await knowledgeRequest('/kb.teach/importCapabilities'))
    if (loginRecord(loginRecord(capabilities.methods)[knowledgeText(method)]).supports_server_preview !== true) throw new Error(t('kbParserRequired'))
    imports.current.clear(); setPreviews([])
    const prepared: Record<string, unknown>[] = []
    for (const file of files) {
      let objectId = originals.current.get(file)
      if (!objectId) {
        const form = new FormData(); form.append('file', file); form.append('kb_id', item.id); form.append('purpose', 'pending_original')
        objectId = loginRecord(await knowledgeRequest('/kb.file_gateway/upload', form)).object_id
        originals.current.set(file, objectId)
      }
      const preview = loginRecord(await knowledgeRequest('/kb.teach/importPreview', { kb_id: Number(item.id), method, object_id: objectId, segment_length: segmentLength }))
      const rows: Record<string, unknown>[] = knowledgeRows(preview.rows).map(row => ({ ...row, file_name: file.name }))
      imports.current.set(file, { kb_id: Number(item.id), method, documents: [{ request_id: randomUUID(), preview_key: preview.preview_key, name: file.name, path: '', object_id: objectId, data: rows.map(row => ({ q: row.q, a: row.a, location: row.location })) }] })
      prepared.push(...rows)
    }
    setPreviews(prepared); setPreviewFile(files[0]?.name ?? '')
  }) }
  const importData = () => { void perform(async () => {
    const method = importType === 'qaSplit' ? 2 : importType === 'qaImport' ? 3 : importType === 'webImport' ? 4 : 1
    if (versionTarget && method !== 1) throw new Error(t('parseOneVersion'))
    const capabilities = loginRecord(await knowledgeRequest('/kb.teach/importCapabilities'))
    const capability = loginRecord(loginRecord(capabilities.methods)[knowledgeText(method)])
    if (method === 4) {
      if (capability.mode === 'unavailable' || !webPages.length) throw new Error(t('knowledgeImportUnavailable'))
      await knowledgeRequest('/kb.teach/import', { kb_id: Number(item.id), method, documents: webPages.filter(page => page.content.trim()).map(page => ({ name: page.name, path: page.name, data: [{ q: page.content, a: '' }] })) })
    } else {
      if (method === 1 ? capability.mode !== 'server' : capability.supports_server_preview !== true) throw new Error(t('kbParserRequired'))
      if (!files.length || (versionTarget && files.length !== 1)) throw new Error(t('parseOneVersion'))
      for (const file of files) {
        let submission = imports.current.get(file)
        if (!submission && method !== 1) throw new Error(t('importPreviewRequired'))
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
    const data = [importType === 'qaImport' && mode === 'import' ? ['q', 'a'] : [r('documentContent'), r('extraContent')], ...(importType === 'qaImport' && mode === 'import' ? [] : fragments).map(row => [row.question ?? '', row.answer ?? ''])]
    const blob = new Blob(['\ufeff' + data.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = globalThis.document.createElement('a'); anchor.href = url; anchor.download = 'qzos-knowledge.csv'; anchor.click()
    setTimeout(() =>{  URL.revokeObjectURL(url) }, 0)
  }
  const filteredDocuments = documents
  const filteredFragments = fragments
  const dialogTitle: ResourceText = dialog?.kind === 'rename' ? 'rename' : dialog?.kind === 'member' ? 'addMember'
    : dialog?.kind === 'acl' ? 'filePermissions'
      : dialog?.kind === 'parameters' ? 'searchParameters' : dialog?.kind === 'transfer' ? 'transferTitle' : 'entryData'
  const dialogForm: ResourceForm = dialog?.kind === 'member' ? 'member' : dialog?.kind === 'parameters' ? 'searchParameters' : 'fragment'

  return <div className={css.inner} aria-busy={busy}>
    {accessFile && <KnowledgeFile {...props} fd={accessFile.id} name={accessFile.name}
      onClose={() => { setAccessFile(null); refresh() }} onChanged={refresh} />}
    {parseFile && <KnowledgeParse {...props} kb={item.id} fd={parseFile.id} name={parseFile.name} editable={editable}
      onChanged={refresh} onClose={() => { setParseFile(null); refresh() }} />}
    {[documentsResource, fragmentsResource, membersResource].map((resource, index) => resource.status === 'failed' ? <p key={index} role="alert">{resource.failure?.message}<Button onClick={refresh}>{r('refresh')}</Button></p> : null)}
    {notice && <p className={css.notice} role="status">{notice}</p>}
    {section === 'dataStudy' && <>
      {mode === 'documents' ? <>
        <div className={css.toolbar}><div className={css.inline}><Button variant="primary" disabled={busy || !editable} onClick={() =>{  setVersionTarget(null); setFiles([]); setPreviews([]); setWebPages([]); imports.current.clear(); setMode('import') }}>{r('importData')}</Button><Button aria-label={r('refresh')} onClick={() => { setQuery(''); setSearch(''); refresh() }}><IconRefreshOutlineRegular size={18} /></Button></div><div className={css.inline}><Input aria-label={r('keyword')} placeholder={r('keyword')} value={query} onChange={(event) =>{  setQuery(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter') setSearch(query) }} /><Button variant="primary" onClick={() =>{  setSearch(query) }}>{r('query')}</Button><Button onClick={() => { setQuery(''); setSearch('') }}>{r('reset')}</Button></div></div>
        <ResourceTable paginate page={documentsPage} total={documentsTotal} pageSize={15} onPage={setDocumentsPage} loading={!documentsResource.value && documentsResource.status !== 'failed'} rows={filteredDocuments} r={r} columns={[['name', 'name'], ['waiting', 'waiting'], ['trained', 'trained'], ['totalData', 'totalData'], ['createdAt', 'createdAt']]} onOpen={openDocument}
          actions={row => [
            { label: 'fileAccess' as const, run: () => { setAccessFile(row) } },
            ...row.hasParse === '1' ? [{ label: 'parseStatus' as const, run: () => { setParseFile(row) } }] : [],
            ...owned && row.is_default !== '1' ? [{ label: 'uploadVersion' as const, run: () => { setMode('import'); setImportType('docImport'); setFiles([]); imports.current.clear(); setVersionTarget(row) } }] : [],
            { label: 'rename', disabled: !owned, run: () =>{  show('rename', row) } },
            ...manageable ? [{ label: 'filePermissions' as const, run: () =>{  show('acl', row) } }] : [],
            ...owned && row.is_default !== '1' ? [{ label: 'delete' as const, run: () =>{  setConfirmation({ key: documentsKey, ids: [row.id] }) } }] : [],
          ]} />
      </> : mode === 'import' ? <>
        <Button disabled={busy} onClick={() =>{  setMode('documents') }}><IconChevronLeftOutlineRegular size={16} />{r('fileImport')}</Button>
        {versionTarget && <p>{r('uploadVersion')}: {versionTarget.name} · {versionTarget.version}</p>}
        <div className={css.importTabs}>{(['docImport', 'qaImport', 'qaSplit', 'webImport'] as const).map(type => <button type="button" key={type} disabled={busy || Boolean(versionTarget && type !== 'docImport')} aria-pressed={importType === type} onClick={() => { setImportType(type); setFiles([]); setPreviews([]); imports.current.clear(); originals.current.clear() }}>{r(type)}<small>{r(`${type}Desc`)}</small></button>)}</div>
        <p className={css.notice} role="status">{capabilitiesResource.status === 'loading' ? t('knowledgeImportLoading') : capabilitiesResource.status === 'failed' ? capabilitiesResource.failure?.message : `${t('knowledgeImportMode')}：${importOptions.mode}`}{(!importOptions.available || capabilitiesResource.status === 'failed') && <Button onClick={refresh}>{r('refresh')}</Button>}</p>
        {importType === 'webImport' ? <>
          <textarea className={css.textArea} rows={6} disabled={busy} aria-label={r('webUrls')} placeholder={r('webUrls')} value={urls} onChange={(event) => { setUrls(event.target.value) }} />
          <Button variant="primary" disabled={busy || !importOptions.available || !urls.trim()} onClick={() => { void perform(async () => {
            const captured = knowledgeRows(await knowledgeRequest('/kb.teach/capture', { url: urls.split('\n').filter(Boolean) }))
            setWebPages(captured.map(row => ({ name: knowledgeText(row.url ?? row.name), content: knowledgeText(row.content) })))
          }) }}>{r('parse')}</Button>
          {webPages.map((page, index) => <div className={css.result} key={page.name}><div className={css.toolbar}><strong>{page.name}</strong><Button disabled={busy} aria-label={`${r('delete')} · ${page.name}`} onClick={() => { setWebPages(current => current.filter((_, i) => i !== index)) }}>{r('delete')}</Button></div><textarea className={css.textArea} rows={10} disabled={busy} aria-label={`${r('fileContent')} · ${page.name}`} value={page.content} onChange={(event) => { const content = event.target.value; setWebPages(current => current.map((value, i) => i === index ? { ...value, content } : value)) }} /></div>)}
        </> : <>
          <div className={css.dropZone} onDragOver={(event) => { event.preventDefault() }}
            onDrop={(event) => { event.preventDefault(); selectFiles(Array.from(event.dataTransfer.files)) }}>
            <span>{r('dropFile')}</span><span className={css.link}>{r('chooseFile')}</span>
            <input type="file" multiple={!versionTarget} disabled={busy || !importOptions.available} aria-label={r('chooseFile')} accept={importOptions.extensions.join(',')} onChange={(event) => { selectFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
            <small>{t('knowledgeSupportedFiles')}：{importOptions.extensions.join(', ') || '—'}</small>
          </div>
          {importType === 'docImport' && <p className={css.notice}>{importOptions.available ? <>{t('knowledgeImportServer')} {t('knowledgeOcr')}：{t(capabilities.ocr_enabled === true ? 'knowledgeEnabled' : 'knowledgeDisabled')}</> : t('knowledgeImportUnavailable')}</p>}
          {importType === 'qaImport' && <Button onClick={exportRows}>{r('downloadTemplate')}</Button>}
          <div className={css.importFiles}>{files.map(file => <div key={`${file.name}:${file.lastModified}`}><Button onClick={() => { setPreviewFile(file.name) }}>{file.name}</Button><Button disabled={busy} aria-label={`${r('delete')} · ${file.name}`} onClick={() => { imports.current.delete(file); originals.current.delete(file); setFiles(current => current.filter(value => value !== file)); setPreviews(current => current.filter(row => row.file_name !== file.name)); if (previewFile === file.name) setPreviewFile('') }}>{r('delete')}</Button></div>)}</div>
          {importType !== 'docImport' && <div className={css.inline}>{importType === 'qaSplit' && <label>{r('segmentLength')} <input type="number" disabled={busy} value={segmentLength} min={100} max={10000} onChange={(event) => { setSegmentLength(Number(event.target.value)); imports.current.clear(); setPreviews([]) }} /></label>}<Button disabled={busy || !importOptions.available || files.length === 0} onClick={previewImport}>{r('repreview')}</Button></div>}
          {previews.length > 0 && <div className={css.result}><h3>{t('knowledgePreview')} · {previewFile}</h3>{previews.filter(row => row.file_name === previewFile).map((row, index) => <div key={index} className={css.result}><p>{knowledgeText(row.q)}</p><p>{knowledgeText(row.a)}</p></div>)}</div>}
        </>}
        <div className={css.importFooter}><Button variant="primary" disabled={busy || !editable || !importOptions.available || (importType === 'webImport' ? !webPages.some(page => page.content.trim()) : files.length === 0 || (importType !== 'docImport' && previews.length === 0))} onClick={importData}>{r('save')}</Button></div>
      </> : <>
        <Button onClick={() => { setMode('documents'); setSearch(''); setQuery('') }}><IconChevronLeftOutlineRegular size={16} />{document?.name}</Button>
        <Button disabled={busy} onClick={refresh}>{t('parseRefresh')}</Button>
        {fragmentsResource.value && loginRecord(fragmentsResource.value.learning).pending === true && <p role="status">{t('learningPending')}</p>}
        {fragmentsResource.value && knowledgeRows(loginRecord(fragmentsResource.value.qa).lists).map(qa => <p key={knowledgeText(qa.id)} role="status">
          {knowledgeText(qa.status_msg)} {knowledgeText(qa.error)}
          {Number(qa.status) === 3 && <Button disabled={busy || !editable} onClick={() => { void perform(async () => { await knowledgeRequest('/kb.teach/qaRetry', { kb_id: Number(item.id), fd_id: Number(document?.id) }); refresh() }) }}>{r('retry')}</Button>}
        </p>)}
        <div className={css.toolbar}><div className={css.inline}><Button variant="primary" disabled={busy || !editable} onClick={() =>{  show('fragment') }}>{r('entryData')}</Button><Button disabled={busy || !editable} onClick={exportRows}>{r('exportAll')}</Button><Button disabled={busy || selection.length === 0 || selection.some(id => fragments.find(row => row.id === id)?.can_retry !== '1')} onClick={() =>{  retry(selection) }}>{r('batchRetry')}</Button><Button disabled={busy || selection.length === 0 || selection.some(id => fragments.find(row => row.id === id)?.can_delete !== '1')} onClick={() =>{  setConfirmation({ key: fragmentsKey, ids: selection }) }}>{r('batchDelete')}</Button></div>
          <div className={css.inline}><Input value={query} aria-label={r('keyword')} placeholder={r('keyword')} onChange={(event) => { setQuery(event.target.value); setSearch(event.target.value) }} /><select value={status} onChange={(event) =>{  setStatus(event.target.value) }} aria-label={r('learningStatus')}>{(['all', 'waitingLearn', 'learning', 'failedLearn', 'learned'] as const).map(value => <option key={value} value={value}>{r(value)}</option>)}</select></div></div>
        <ResourceTable paginate page={fragmentsPage} total={fragmentsTotal} pageSize={15} onPage={setFragmentsPage} loading={!fragmentsResource.value && fragmentsResource.status !== 'failed'} rows={filteredFragments} r={r} selection={selection} onSelection={setSelection} columns={[['question', 'documentContent'], ['answer', 'extraContent'], ['status', 'learningStatus'], ['consumed', 'consumed'], ['updatedAt', 'updatedAt']]} cell={(row, key) => key === 'status' ? r(row.status === 'learned' ? 'learned' : row.status === 'failedLearn' ? 'failedLearn' : row.status === 'learning' ? 'learning' : 'waitingLearn') : row[key] ?? '—'} actions={row => [
          { label: 'correct', disabled: row.can_edit !== '1', run: () =>{  show('fragment', row) } }, ...row.status === 'failedLearn' ? [{ label: 'retry' as const, disabled: row.can_retry !== '1', run: () =>{  retry([row.id]) } }] : [], { label: 'delete', disabled: row.can_delete !== '1', run: () =>{  setConfirmation({ key: fragmentsKey, ids: [row.id] }) } },
        ]} />
      </>}
    </>}
    {section === 'testData' && <div className={`${css.columns} ${css.searchColumns}`}><div><label className={css.searchField}><span>{r('testText')}</span><textarea className={css.textArea} rows={20} value={question} onChange={(event) =>{  setQuestion(event.target.value) }} /></label><div className={`${css.toolbar} ${css.searchButtons}`}><Button variant="primary" disabled={busy || !question.trim()} onClick={() => { void perform(async () => { setTested(false); setHits([]); setHits(knowledgeRows(await knowledgeRequest('/kb.teach/tests', { ...knowledgeSearchInput(draft), question, kb_id: Number(item.id) }))); setTested(true) }) }}>{r('test')}</Button><Button onClick={() =>{  show('parameters') }}>{t(draft.search_mode === 'full' ? 'pc35' : draft.search_mode === 'mix' ? 'pc36' : 'pc34')}</Button></div></div><div>{tested ? <><h2>{r('results')}</h2>{hits.length === 0 && <p>{r('empty')}</p>}{hits.map((hit, index) => <div key={`${index}:${knowledgeText(hit.question)}`} className={css.result}><strong>{knowledgeText(hit.question ?? '')}</strong><p>{knowledgeText(hit.answer ?? '')}</p><p>{sourceCitation(hit, { page: t('sourcePage'), slide: t('sourceSlide'), sheet: t('sourceSheet'), cells: t('sourceCells'), paragraph: t('sourceParagraph'), missing: t('sourceMissing') })}</p><span>{r('score')}：{knowledgeText(hit.score ?? hit.full_score ?? hit.emb_score ?? '')}</span></div>)}</> : <div className={css.searchEmpty}>{r('testResult')}</div>}</div></div>}
    {section === 'teamData' && <><h2>{r('myTeam')}</h2><div className={css.toolbar}><span>{r('teamMembers')} ({membersTotal})</span>{owned && <Button variant="outline" onClick={() =>{  show('member') }}>+ {r('addMember')}</Button>}</div>
      <ResourceTable paginate page={membersPage} total={membersTotal} pageSize={15} onPage={setMembersPage} loading={!membersResource.value && membersResource.status !== 'failed'} rows={members} r={r} columns={[['nickname', 'memberInfo'], ['role', 'memberRole'], ['power', 'defaultPermission'], ['createdAt', 'joinedAt']]} cell={(row, key) => key === 'nickname' ? <span className={css.memberIdentity}>{row.avatar ? <img className={css.memberAvatar} src={row.avatar} alt="" /> : <IconUsersOutlineRegular size={28} />}<span>{row.nickname}</span>{row.sn === membersResource.value?.currentSn && <Tag>{t('knowledgeMe')}</Tag>}</span> : key === 'role' ? r(row.role === 'owner' ? 'owner' : 'member') : key === 'power' ? r(row.power === 'all' ? 'allPermission' : row.power === 'edit' ? 'editPermission' : row.power === 'manage' ? 'managePermission' : 'viewPermission') : row[key] ?? '—'} actions={row => row.role === 'owner' ? [] : owned ? [
        { label: 'editPermission', run: () =>{  memberPower(row.id, 2) } }, { label: 'viewPermission', run: () =>{  memberPower(row.id, 3) } }, { label: 'managePermission', run: () =>{  memberPower(row.id, 1) } }, { label: 'removeMember', run: () =>{  setConfirmation({ key: membersKey, ids: [row.id] }) } },
      ] : []} />{owned && membersTotal > 1 && <Button onClick={() =>{ show('transfer') }}>{r('transfer')}</Button>}</>}
    {section === 'setUp' && <><h2>{r('knowledgeSettings')}</h2><div className={css.tabs}><Button aria-pressed>{r('baseInfo')}</Button></div><ResourceFields t={t} form="knowledgeSettings" draft={draft} options={modelOptions} onChange={update} knowledge={knowledge} editing disabled={busy || !manageable} /><div className={css.formFooter}><Button variant="primary" disabled={busy || !manageable} onClick={() => { if (Number(draft.external_enabled) === 1 && Number(savedDraft.external_enabled ?? 0) !== 1) setExternalConfirm(true); else saveSettings() }}>{r('saveSettings')}</Button><Button variant="outline" className={css.dangerAction} disabled={busy || !owned} onClick={onDelete}>{r('delete')}</Button></div></>}
    {dialog?.kind === 'member' && <KnowledgeMembers {...props} kb={item.id} onClose={() => { setDialog(null) }} onSaved={refresh} />}
    {dialog?.kind === 'acl' && dialog.row && <KnowledgeAcl {...props} fd={dialog.row.id} onClose={() => { setDialog(null) }} />}
    <Modal open={externalConfirm} onClose={() => { setExternalConfirm(false) }} title={t('aclExternalConfirm')} closeLabel={r('close')} className={css.dialog as string} footer={<><Button disabled={busy} onClick={() => { setExternalConfirm(false) }}>{r('cancel')}</Button><Button disabled={busy} onClick={saveSettings}>{r('confirm')}</Button></>}>{notice && <p role="alert">{notice}</p>}</Modal>
    <Modal open={dialog !== null && dialog.kind !== 'acl' && dialog.kind !== 'member'} onClose={() =>{ if (!busy) setDialog(null) }} closeLabel={r('close')} title={r(dialogTitle)} className={(dialog?.kind === 'fragment' ? css.fragmentDialog : css.dialog) as string}
      footer={<><Button variant="outline" disabled={busy} onClick={() =>{ setDialog(null) }}>{r('cancel')}</Button><Button variant="primary" disabled={busy || dialog?.kind === 'acl' || (dialog?.kind === 'fragment' && !dialogDraft.question?.trim())} onClick={saveDialog}>{r('confirm')}</Button></>}>
      {notice && <p role="alert">{notice}</p>}
      {dialog?.kind === 'fragment' && <><Button disabled={busy || !dialogDraft.question?.trim()} onClick={() => { void perform(async () => { const value = loginRecord(await knowledgeRequest('/kb.teach/charging', { kb_id: Number(item.id), text: `${dialogDraft.question ?? ''}\n${dialogDraft.answer ?? ''}` })); setEstimate(knowledgeText(value.tokens)) }) }}>{t('learningEstimate')}</Button>{estimate && <p role="status">{t('learningEstimateHint')}: {estimate}</p>}</>}
      {dialog?.kind === 'rename' ? <label>{r('name')}<Input value={dialogDraft.name ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, name: event.target.value })) }} /></label>
        : dialog?.kind === 'transfer' ? <><p>{r('transferConfirm')}</p><select aria-label={r('memberInfo')} value={dialogDraft.member ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, member: event.target.value })) }}><option value="">—</option>{allMembers.filter(member => member.role !== 'owner').map(member => <option key={member.id} value={member.id}>{member.nickname}</option>)}</select></>
          : <ResourceFields t={t} form={dialogForm} disabled={busy} draft={dialogDraft} knowledge={knowledge} options={dialog?.kind === 'parameters' ? { ...modelOptions, optimize_m_id: modelOptions.documents_model_id ?? [] } : {}}
            onChange={(key, value) =>{  setDialogDraft(current => ({ ...current, [key]: value })) }} />}
      {dialog?.kind === 'fragment' && <div className={css.attachmentFields}>
        {(['images', 'video', 'files'] as const).map(kind => <div key={kind}><label className={css.attachmentPicker}>{t(kind === 'images' ? 'knowledgeImages' : kind === 'video' ? 'knowledgeVideo' : 'knowledgeAttachments')}<input type="file" disabled={busy} multiple={kind !== 'video'} accept={kind === 'images' ? 'image/*' : kind === 'video' ? '.mp4' : undefined} onChange={(event) => { uploadAttachments(kind, Array.from(event.target.files ?? [])); event.target.value = '' }} /></label>
          {attachments[kind].map((value, index) => <div className={css.inline} key={`${knowledgeText(value.url)}:${index}`}><span>{knowledgeText(value.name) || knowledgeText(value.url)}</span><Button disabled={busy} aria-label={`${r('delete')} · ${knowledgeText(value.name)}`} onClick={() => { setAttachments(current => ({ ...current, [kind]: current[kind].filter((_, i) => i !== index) })) }}>{r('delete')}</Button></div>)}
        </div>)}<small>{t('knowledgeMediaHint')}</small>
      </div>}
    </Modal>
    <Modal open={confirmation !== null} onClose={() =>{  setConfirmation(null) }} closeLabel={r('close')} title={r('deleteConfirm')} description={r('deleteHint')}
      footer={<><Button variant="outline" onClick={() =>{  setConfirmation(null) }}>{r('cancel')}</Button><Button variant="outline" className={css.dangerAction} disabled={busy} onClick={remove}>{r('confirmDelete')}</Button></>} />
  </div>
}
