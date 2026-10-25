/** Original QZOS employee settings, publishing and conversation-data page organization. */
import { useEffect, useRef, useState } from 'react'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { Button, Input, Modal, IconChevronLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { catalogs, type Example } from './catalog.ts'
import type { PreviewRow } from './resource-fixtures.ts'
import { resourceDraft, type PreviewValues, type ResourceForm } from './resource-schema.ts'
import { EmployeeBindings } from './EmployeeBindings.tsx'
import { EmployeePublication } from './EmployeePublication.tsx'
import { publicationUrl } from './publication-client.ts'
import { EmployeeSquare } from './EmployeeSquare.tsx'
import { ResourceFields } from './ResourceForms.tsx'
import { ResourceTable } from './ResourceTable.tsx'
import { resourceCopy, type ResourceText } from './resource-copy.ts'
import css from './Resources.module.css'
import { publicationArtwork } from './resource-artwork.ts'
import { employeeDraft, saveEmployee } from './employee-client.ts'
import { knowledgeDraft, knowledgeRows, knowledgeText, knowledgeRequest } from './knowledge-client.ts'
import { publicVisitorApi, loginRecord, storedLogin, type LoginRecord } from './login-client.ts'
import type { QzosKey } from './locales.ts'

const emptyRows: readonly PreviewRow[] = []
type EmployeeDetailProps = PanelProps & {
  item: Example
  section: string
  onSaved: () => void
  knowledge: Example[]
  modelOptions: Record<string, { value: string; label: string; disabled?: boolean }[]>
}
type EmployeeDialog = { kind: 'menu' | 'share' | 'api' | 'quota' | 'keys' | 'feedback' | 'reply' | 'correct' | 'binding'; row?: PreviewRow; readOnly?: boolean }

/** Load the full configuration before allowing writes to existing fields. */
export function EmployeeDetail(props: EmployeeDetailProps) {
  const epoch = props.useStore(state => state.businessEpoch)
  const revision = props.useStore(state => state.knowledgeRevision)
  const remote = props.useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/employee?id=${props.item.id}&epoch=${epoch}&revision=${revision}`)
  if (remote.status === 'failed') return <p role="alert">{remote.failure?.message}</p>
  if (!remote.value) return <p role="status">{props.t('employeeLoading')}</p>
  return <EmployeeContent key={`${props.item.id}:${revision}`} {...props} original={loginRecord(remote.value.detail)} />
}
function EmployeeContent(props: EmployeeDetailProps & { original: LoginRecord }) {
  const { item, section, useStore, useResource, t, onSaved, knowledge, modelOptions, original } = props
  const r = (key: ResourceText) => key === 'saved' ? t('kbSaved') : t(resourceCopy[key])
  const [lifetime] = useState(() => new AbortController())
  const token = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const request = (path: string, body?: LoginRecord) => knowledgeRequest(path, body, lifetime.signal, token.current)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [revision, setRevision] = useState(0)
  const epoch = useStore(state => state.businessEpoch)
  const [editTab, setEditTab] = useState<ResourceForm | 'bindings'>('employeeBase')
  const [draft, setDraft] = useState(() => employeeDraft(original))
  const [menuValues, setMenuValues] = useState(() => knowledgeRows(original.menus))
  const [channel, setChannel] = useState('')
  const publicationType = channel === 'api' ? 4 : channel === 'js' ? 2 : 1
  const [publicArtifact, setPublicArtifact] = useState<{ row: PreviewRow; poster: boolean } | null>(null)
  const [dialogueTab, setDialogueTab] = useState('data')
  const [feedbackFilter, setFeedbackFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [dialog, setDialog] = useState<EmployeeDialog | null>(null)
  const [dialogDraft, setDialogDraft] = useState<PreviewValues>({})
  const [confirmation, setConfirmation] = useState<{ key: string; ids: string[] } | null>(null)
  const [issuedKey, setIssuedKey] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [calls, setCalls] = useState<LoginRecord[] | null>(null)
  const [notice, setNotice] = useState('')
  const [confirmKnowledgeRemoval, setConfirmKnowledgeRemoval] = useState(false)
  const rebindRequired = Boolean(original.knowledge_rebind_required)
  const knowledgeAction = draft.knowledge_dependency_action || 'preserve'
  const menusKey = `${item.id}:menus`
  const sharesKey = `${item.id}:${channel === 'api' ? 'apps' : 'shares'}`
  const dialoguesKey = `${item.id}:dialogues`
  const menus: PreviewRow[] = menuValues.map((row, index) => ({
    ...knowledgeDraft(row), id: String(index), name: knowledgeText(row.keyword),
  }))
  const query = `id=${item.id}&epoch=${epoch}&revision=${revision}`
  const publicationResource = useResource<'qzos-knowledge'>(section === 'release' && channel ? `dsh-resource://qzos-knowledge/employee-publications?${query}&type=${publicationType}` : '')
  const recordResource = useResource<'qzos-knowledge'>(section === 'dialogue' ? `dsh-resource://qzos-knowledge/employee-records?${query}` : '')
  const feedbackResource = useResource<'qzos-knowledge'>(section === 'dialogue' ? `dsh-resource://qzos-knowledge/employee-feedback?${query}` : '')
  const statsResource = useResource<'qzos-knowledge'>(section === 'dialogue' ? `dsh-resource://qzos-knowledge/employee-stats?${query}` : '')
  const keysResource = useResource<'qzos-knowledge'>(dialog?.kind === 'keys' && dialog.row ? `dsh-resource://qzos-knowledge/employee-keys?id=${dialog.row.id}&epoch=${epoch}&revision=${revision}` : '')
  const keys = keysResource.value ? knowledgeRows(keysResource.value.rows) : []
  const shares: PreviewRow[] = publicationResource.value ? knowledgeRows(publicationResource.value.rows).map(row => ({ ...knowledgeDraft(row), id: knowledgeText(row.id), name: knowledgeText(row.name), entryId: knowledgeText(row.apikey), key: '', password: row.has_password ? 'protected' : '', status: row.status === 'active' ? 'enabled' : 'disabled', lastUsed: knowledgeText(row.use_time), mode: '' })) : []
  const dialogues: PreviewRow[] = recordResource.value ? knowledgeRows(recordResource.value.rows).map(row => ({ ...knowledgeDraft(row), id: knowledgeText(row.id), name: knowledgeText(row.ask), question: knowledgeText(row.ask), answer: knowledgeText(row.reply), questionTime: knowledgeText(row.create_time), reviewed: Number(row.is_feedback) === 1 ? '1' : '0' })) : []
  const bindings = emptyRows
  const perform = async (work: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setNotice('')
    try { await work() } catch (error) { setNotice(error instanceof Error ? error.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  const refresh = () => { setRevision(value => value + 1) }
  const saveConfiguration = () => { void perform(async () => {
    await saveEmployee(original, draft, menuValues, lifetime.signal)
    setConfirmKnowledgeRemoval(false); onSaved()
  }) }
  const unsupported = () => { setNotice(t('employeeUnsupported')) }
  const update = (key: string, value: string) =>{  setDraft(current => ({ ...current, [key]: value })) }
  const show = (kind: EmployeeDialog['kind'], row?: PreviewRow, readOnly = false) => {
    setIssuedKey(''); setSelectedKey(''); setCalls(null)
    setDialogDraft(resourceDraft(row ? { ...row, feedback_type: 'correction', feedback_key: randomUUID(), correction_key: randomUUID(), password: '', quotaDaily: row.limit_today_chat ?? '0', quotaTotal: row.limit_total_chat ?? '0' } : {}))
    setDialog({ kind, readOnly, ...row ? { row } : {} })
  }
  const saveDialog = () => { void perform(async () => {
    if (!dialog || dialog.readOnly) { setDialog(null); return }
    if (dialog.kind === 'menu') {
      const value = { keyword: dialogDraft.keyword ?? '', content: dialogDraft.content ?? '', images: dialog.row ? menuValues[Number(dialog.row.id)]?.images ?? [] : [] }
      setMenuValues(current => dialog.row
        ? current.map((row, index) => index === Number(dialog.row?.id) ? value : row) : [...current, value])
      setDialog(null); return
    }
    if (dialog.kind === 'share' || dialog.kind === 'api') {
      await request(dialog.row ? '/kb.share/update' : '/kb.share/add', { ...dialog.row ? { id: Number(dialog.row.id) } : { robot_id: Number(item.id), type: publicationType }, name: dialogDraft.name, ...dialogDraft.password ? { password: dialogDraft.password } : {} })
    } else if (dialog.kind === 'quota' && dialog.row) {
      await request('/kb.share/edit', { id: Number(dialog.row.id), limit_today_chat: Number(dialogDraft.quotaDaily), limit_total_chat: Number(dialogDraft.quotaTotal) })
    } else if (dialog.kind === 'feedback' && dialog.row) {
      await request('/v1/kb/feedback', { robot_id: Number(item.id), record_id: Number(dialog.row.id), type: dialogDraft.feedback_type, idempotency_key: dialogDraft.feedback_key, content: dialogDraft.feedback_type === 'correction' ? dialogDraft.feedback : '' })
    } else if (dialog.kind === 'correct' && dialogDraft.kb_id) {
      await request('/kb.chat/chatCorrect', { request_id: dialogDraft.correction_key, kb_id: Number(dialogDraft.kb_id), ask: dialogDraft.question, reply: dialogDraft.answer, images: [], files: [], video: [] })
    } else { unsupported(); return }
    setDialog(null); refresh(); setNotice(t('kbSaved'))
  }) }
  const remove = () => { void perform(async () => {
    if (!confirmation) return
    if (confirmation.key === menusKey) setMenuValues(current => current.filter((_, index) => !confirmation.ids.includes(String(index))))
    else if (confirmation.key === dialoguesKey) await request('/kb.chat/dataDelete', { robot_id: Number(item.id), ids: confirmation.ids.map(Number) })
    else if (confirmation.key === sharesKey) for (const id of confirmation.ids) await request('/kb.share/del', { id: Number(id), type: publicationType })
    else { unsupported(); return }
    setConfirmation(null); setSelected([]); refresh()
  }) }
  const dialogueRows = dialogues.filter(row => feedbackFilter === 'all' || row.reviewed === (feedbackFilter === 'reviewed' ? '1' : '0'))
  const dialogTitle: ResourceText = dialog?.kind === 'binding' ? dialogDraft.kind === 'skill' ? 'bindSkill' : 'bindPlugin' : dialog?.kind === 'menu' ? 'addMenu' : dialog?.kind === 'share' ? 'createLink'
    : dialog?.kind === 'api' ? 'createApi' : dialog?.kind === 'quota' ? 'usageSettings' : dialog?.kind === 'keys' ? 'manageKeys'
      : dialog?.kind === 'feedback' ? 'questionFeedback' : dialog?.kind === 'correct' ? 'correct' : 'viewReply'
  const form: ResourceForm = dialog?.kind === 'menu' ? 'menu' : dialog?.kind === 'correct' ? 'fragment' : 'share'
  const [sharing, setSharing] = useState(false)
  const tabList: readonly [ResourceForm | 'bindings', ResourceText][] = [['employeeBase', 'base'], ['bindings', 'skillBindings'], ['employeeSearch', 'modelSearch'], ['employeeInterface', 'interface']]
  const platformGroups: readonly [ResourceText, readonly ResourceText[]][] = [['webapp', ['web', 'js', 'oa', 'poster']], ['apiAccess', ['api', 'qwx', 'rpa']]]
  return <div className={css.employeeDetail} aria-busy={busy}>
    {publicArtifact && <EmployeePublication t={t} publicId={publicArtifact.row.entryId ?? ''} type={Number(publicArtifact.row.type)} name={item.title} poster={publicArtifact.poster} onClose={() => { setPublicArtifact(null) }} />}
    {sharing && <EmployeeSquare {...props} employeeId={item.id} onClose={() => { setSharing(false); onSaved() }} />}
    <Button onClick={() => { setSharing(true) }}>{t('employeeShare')}</Button>
    {[publicationResource, recordResource, statsResource, keysResource, feedbackResource].map((remote, index) => remote.status === 'failed' ? <p key={index} role="alert">{remote.failure?.message}</p> : null)}
    {notice && <p className={css.notice} role="status">{notice}</p>}
    {section === 'edit' && <>
      <p className={css.notice}>{t('employeeWindowModel')}</p>
      {Number(original.flow_status) === 1 && <div className={css.inner}><p>{t('legacyFlowHint')}</p><Button disabled={busy} onClick={() => { update('flow_status', '0') }}>{t('legacyFlowDisable')}</Button>{draft.flow_status === '0' && <p>{t('legacyFlowSave')}</p>}</div>}
      <div className={css.tabs}>
        {tabList.map(([tab, label]) =>
          <Button key={tab} aria-pressed={editTab === tab} onClick={() =>{  setEditTab(tab) }}>{r(label)}</Button>)}
      </div>
      <header className={css.configHeading}><h2>{r(tabList.find(([tab]) => tab === editTab)?.[1] ?? 'base')}</h2></header>
      {editTab === 'employeeBase' && rebindRequired && <div className={css.inner}>
        <p role="status">{t('employeeKnowledgeInvalid')}</p>
        <label>{t('employeeKnowledgeAction')}<select aria-label={t('employeeKnowledgeAction')} value={knowledgeAction} disabled={busy || original.can_manage_knowledge_dependency === false} onChange={(event) => {
          const action = event.target.value
          setDraft(current => ({ ...current, knowledge_dependency_action: action, kb_ids: employeeDraft(original).kb_ids ?? '' }))
        }}>
          <option value="preserve">{t('employeeKnowledgePreserve')}</option><option value="replace">{t('employeeKnowledgeReplace')}</option><option value="remove">{t('employeeKnowledgeRemove')}</option>
        </select></label>
        {knowledgeAction === 'replace' && <p>{t('employeeKnowledgeSelect')}</p>}
        {knowledgeAction === 'remove' && <p>{t('employeeKnowledgeRemoveHint')}</p>}
      </div>}
      {editTab === 'bindings' ? <EmployeeBindings {...props} employeeId={item.id} />
        : <>{editTab === 'employeeFlow' && <p className={css.notice}>{t('employeeFlowUnavailable')}</p>}
          <ResourceFields t={t} form={editTab} draft={draft} knowledge={knowledge} options={modelOptions}
            onChange={update} editing disabled={busy} disabledFields={original.can_manage_knowledge_dependency === false || (rebindRequired && knowledgeAction !== 'replace') ? ['kb_ids'] : []} />
          {editTab === 'employeeBase' && <div className={css.inner}><p className={css.notice}>{r('helpRole')}</p></div>}
          {editTab === 'employeeInterface' && <div className={css.menuEditor}><h3>{r('menus')}</h3><ResourceTable rows={menus} r={r} columns={[['keyword', 'keywordLabel'], ['content', 'replyContent']]} actions={row => [{ label: 'view', run: () =>{  show('menu', row, true) } }, { label: 'edit', run: () =>{  show('menu', row) } }, { label: 'delete', run: () =>{  setConfirmation({ key: menusKey, ids: [row.id] }) } }]} /><Button variant="primary" disabled={menus.length >= 3} onClick={() =>{  show('menu') }}>+ {r('addMenu')}</Button><p className={css.notice}>{t('employeeSavedOnly')}</p></div>}
        </>}
      <div className={css.formFooter}><Button variant="primary" disabled={busy || editTab === 'bindings' || !draft.name?.trim() || (knowledgeAction === 'replace' && !draft.kb_ids)} onClick={() => {
        if (knowledgeAction === 'remove') setConfirmKnowledgeRemoval(true)
        else saveConfiguration()
      }}>{r('save')}</Button></div>
    </>}
    {section === 'release' && <div className={css.inner}>
      <div className={css.toolbar}><div className={css.inline}><Button disabled={busy} onClick={() => { void perform(async () => { await request('/kb.publish/employeeState', { robot_id: Number(item.id), state: 'ready' }); onSaved() }) }}>{r('onDuty')}</Button><Button disabled={busy} onClick={() => { void perform(async () => { await request('/kb.publish/employeeState', { robot_id: Number(item.id), state: 'paused' }); onSaved() }) }}>{r('pauseEmployee')}</Button></div></div>
      {!channel ? platformGroups.map(([group, platforms]) => <div key={group}><h3>{r(group)}</h3><div className={css.platformGrid}>{platforms.map(platform => <button type="button" key={platform} disabled={['oa', 'qwx', 'rpa'].includes(platform)} onClick={() =>{  setChannel(platform === 'poster' ? 'web' : platform) }}><img src={publicationArtwork[platform as keyof typeof publicationArtwork]} alt="" /><span>{r(platform)}<small>{t(`pcPlatform${platform}` as QzosKey)}</small>{['oa', 'qwx', 'rpa'].includes(platform) && <small>{r('comingSoon')}</small>}</span></button>)}</div></div>)
        : <><Button onClick={() =>{  setChannel('') }}><IconChevronLeftOutlineRegular size={16} />{r(channel === 'api' ? 'api' : channel === 'js' ? 'js' : 'web')}</Button><p className={css.notice}>{r('webHint')}</p>
          <div className={css.toolbar}><Button variant="primary" disabled={busy} onClick={() => { show(channel === 'api' ? 'api' : 'share') }}>{r(channel === 'api' ? 'createApi' : 'createLink')}</Button></div>
          <ResourceTable rows={shares} r={r} columns={channel === 'api' ? [['status', 'status'], ['key', 'appSecret'], ['name', 'name'], ['lastUsed', 'lastUsed']] : [['status', 'status'], ['entryId', 'entryId'], ['name', 'shareName'], ['password', 'password'], ['mode', 'mode'], ['lastUsed', 'lastUsed']]}
            cell={(row, key) => key === 'status' ? r(row.status === 'enabled' ? 'enabled' : 'disabled') : key === 'password' ? row.password ? '••••••' : '—' : row[key] ?? '—'} actions={row => [
              { label: row.status === 'enabled' ? 'deactivate' : 'enabled', run: () => { void perform(async () => { await request('/kb.publish/manage', { id: Number(row.id), action: row.status === 'enabled' ? 'disable' : 'enable' }); refresh() }) } },
              ...channel === 'api' ? [{ label: 'manageKeys' as const, run: () =>{  show('keys', row) } }] : [{ label: 'copyLink' as const, run: () => { void perform(async () => { await navigator.clipboard.writeText(publicationUrl(publicVisitorApi, row.entryId ?? '', Number(row.type))); setNotice(t('publicationCopied')) }) } }, { label: 'edit' as const, run: () =>{  show('share', row) } }, { label: 'preview' as const, run: () => { setPublicArtifact({ row, poster: false }) } }, ...channel === 'js' ? [{ label: 'js' as const, run: () => { setPublicArtifact({ row, poster: false }) } }] : [{ label: 'generatePoster' as const, run: () => { setPublicArtifact({ row, poster: true }) } }]],
              { label: 'usageSettings', run: () =>{  show('quota', row) } }, { label: 'delete', run: () =>{  setConfirmation({ key: sharesKey, ids: [row.id] }) } },
            ]} />
        </>}
    </div>}
    {section === 'dialogue' && <div className={css.inner}>
      <div className={css.tabs}><Button aria-pressed={dialogueTab === 'data'} onClick={() =>{  setDialogueTab('data') }}>{r('dialogue')}</Button><Button aria-pressed={dialogueTab === 'records'} onClick={() =>{  setDialogueTab('records') }}>{r('dialogueRecords')}</Button></div>
      <p>{t('feedbackScope')}</p><p>{t('dshUsageScope')}</p>
      {statsResource.value && Number(loginRecord(statsResource.value.dsh).pending_calls) > 0 && <p>{t('usagePending')}</p>}
      {feedbackResource.value && <div className={css.stats}>{(['like', 'dislike', 'correction', 'miss'] as const).map(type => <div key={type}>{t(({ like: 'feedbackLike', dislike: 'feedbackDislike', correction: 'feedbackCorrection', miss: 'feedbackMiss' } as const)[type])}<strong>{knowledgeText(feedbackResource.value?.[type])}</strong></div>)}</div>}
      {dialogueTab === 'data' ? <div className={css.stats}>{(['totalConversations', 'todayConversations', 'totalUsers', 'totalTokens'] as const).map((label, index) => { const stats = statsResource.value; const robot = stats ? loginRecord(stats.robot) : {}; const visitor = stats ? loginRecord(stats.visitor) : {}; const value = [robot.wholeChatCount, robot.todayChatCount, visitor.wholeVisitorCount, stats ? loginRecord(stats.dsh).total_tokens : undefined][index]; return <div key={label}>{r(label)}<strong>{value === undefined ? '—' : knowledgeText(value)}</strong></div> })}</div>
        : <><div className={css.toolbar}><Button disabled={selected.length === 0} onClick={() =>{  setConfirmation({ key: dialoguesKey, ids: selected }) }}>{r('batchDelete')}</Button><select aria-label={r('feedback')} value={feedbackFilter} onChange={(event) =>{  setFeedbackFilter(event.target.value) }}>{(['all', 'unreviewed', 'reviewed'] as const).map(value => <option key={value} value={value}>{r(value)}</option>)}</select></div>
          <ResourceTable rows={dialogueRows} r={r} selection={selected} onSelection={setSelected} columns={[['id', 'id'], ['userInfo', 'userInfo'], ['question', 'question'], ['answer', 'answer'], ['feedback', 'feedback'], ['questionTime', 'questionTime']]} actions={row => [{ label: 'questionFeedback', run: () =>{  show('feedback', row) } }, { label: 'correct', run: () =>{  show('correct', row) } }, { label: 'viewReply', run: () =>{  show('reply', row, true) } }, { label: 'delete', run: () =>{  setConfirmation({ key: dialoguesKey, ids: [row.id] }) } }]} />
        </>}
    </div>}
    <Modal open={dialog !== null} onClose={() => { setIssuedKey(''); setDialog(null) }} closeLabel={r('close')} title={r(dialogTitle)} className={`${css.dialog} ${css.employeeDialog}`}
      footer={<><Button variant="outline" onClick={() => { setIssuedKey(''); setDialog(null) }}>{r('cancel')}</Button>{dialog?.kind !== 'keys' && <Button variant="primary" onClick={saveDialog}>{r('confirm')}</Button>}</>}>
      {dialog?.kind === 'binding' ? <div className={css.checkList}>{catalogs.skills.map(record => <label key={record.id}><input type="radio" name="qzos-binding" disabled={bindings.some(binding => binding.targetId === record.id)} checked={dialogDraft.binding === record.id} onChange={() =>{  setDialogDraft(current => ({ ...current, binding: record.id })) }} />{record.title}</label>)}</div>
        : dialog?.kind === 'keys' ? <>
          <p className={css.notice}>{r('secretHint')}</p>
          <select value={selectedKey} aria-label={r('manageKeys')} onChange={(event) => { setSelectedKey(event.target.value); setIssuedKey('') }}><option value="">—</option>{keys.map(key => <option key={knowledgeText(key.id)} value={knowledgeText(key.id)}>{knowledgeText(key.name)} · {knowledgeText(key.key_prefix)} · {knowledgeText(key.status)}</option>)}</select>
          <div className={css.toolbar}>{(['createKey', 'rotate', 'deactivate', 'recentCalls'] as const).map(command => <Button key={command} disabled={busy || ((command === 'rotate' || command === 'deactivate') && !selectedKey)} onClick={() => { void perform(async () => {
            setIssuedKey('')
            if (command === 'recentCalls') { setCalls(knowledgeRows(await request(`/kb.publish/calls?publish_id=${dialog.row?.id}`))); return }
            const result = await request(`/kb.publish/${command === 'createKey' ? 'keyCreate' : command === 'rotate' ? 'keyRotate' : 'keyDisable'}`, command === 'deactivate' ? { key_id: Number(selectedKey) } : { publish_id: Number(dialog.row?.id), name: dialog.row?.name ?? '', ...command === 'rotate' ? { key_id: Number(selectedKey) } : {} })
            if (command !== 'deactivate') { const issued = loginRecord(result); if (typeof issued.secret !== 'string' || !issued.secret) throw new Error(t('employeeWriteUnknown')); setIssuedKey(issued.secret) }
            refresh()
          }) }}>{r(command)}</Button>)}</div>
          {issuedKey && <div className={css.result}><code>{issuedKey}</code><Button onClick={() => { void navigator.clipboard.writeText(issuedKey).catch(() => { setNotice(t('errorHint')) }) }}>{r('copySecret')}</Button></div>}
          {calls && <div>{calls.length === 0 ? r('empty') : calls.map((row, index) => <p key={index}>{knowledgeText(row.request_id)} · {knowledgeText(row.state)} · {knowledgeText(row.error_code)}</p>)}</div>}
        </>
          : dialog?.kind === 'quota' ? <div className={css.formFields}>{(['quotaDaily', 'quotaTotal'] as const).map(key => <label key={key}>{r(key)}<Input type="number" min={0} value={dialogDraft[key] ?? '0'} onChange={(event) =>{  setDialogDraft(current => ({ ...current, [key]: event.target.value })) }} /></label>)}<label>{r('expiresAt')}<Input disabled type="date" value={dialogDraft.expiresAt ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, expiresAt: event.target.value })) }} /></label></div>
            : dialog?.kind === 'feedback' ? <><select aria-label={r('feedback')} value={dialogDraft.feedback_type} onChange={(event) => { setDialogDraft(current => ({ ...current, feedback_type: event.target.value, feedback_key: randomUUID() })) }}>{(['like', 'dislike', 'correction', 'miss'] as const).map(type => <option key={type} value={type}>{t(({ like: 'feedbackLike', dislike: 'feedbackDislike', correction: 'feedbackCorrection', miss: 'feedbackMiss' } as const)[type])}</option>)}</select>{dialogDraft.feedback_type === 'correction' && <label>{r('feedbackContent')}<textarea className={css.textArea} rows={5} value={dialogDraft.feedback ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, feedback: event.target.value })) }} /></label>}</>
              : dialog?.kind === 'reply' ? <><strong>{dialog.row?.question}</strong><p>{dialog.row?.answer}</p></>
                : dialog?.kind === 'api' ? <label>{r('name')}<Input value={dialogDraft.name ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, name: event.target.value })) }} /></label>
                  : <>{dialog?.kind === 'correct' && <><p>{t('correctionOwnedOnly')}</p><select aria-label={r('knowledge')} value={dialogDraft.kb_id ?? ''} onChange={(event) => { setDialogDraft(current => ({ ...current, kb_id: event.target.value, correction_key: randomUUID() })) }}><option value="">—</option>{knowledge.filter(kb => kb.scope === 'owned').map(kb => <option key={kb.id} value={kb.id}>{kb.title}</option>)}</select></>}<ResourceFields t={t} form={form} draft={dialogDraft} knowledge={knowledge} disabled={dialog?.readOnly ?? false}
                    onChange={(key, value) => {
                      setDialogDraft(current => ({ ...current, [key]: value, correction_key: randomUUID() }))
                    }} /></>}
    </Modal>
    <Modal className={css.employeeDialog as string} open={confirmKnowledgeRemoval} onClose={() => { if (!busy) setConfirmKnowledgeRemoval(false) }} closeLabel={r('close')} title={t('employeeKnowledgeRemove')} description={t('employeeKnowledgeRemoveHint')}
      footer={<><Button disabled={busy} variant="outline" onClick={() => { setConfirmKnowledgeRemoval(false) }}>{r('cancel')}</Button><Button disabled={busy} variant="primary" onClick={saveConfiguration}>{r('confirm')}</Button></>}>
      {notice && <p role="alert">{notice}</p>}
    </Modal>
    <Modal className={css.employeeDialog as string} open={confirmation !== null} onClose={() =>{  setConfirmation(null) }} closeLabel={r('close')} title={r('deleteConfirm')} description={r('deleteHint')}
      footer={<><Button variant="outline" onClick={() =>{  setConfirmation(null) }}>{r('cancel')}</Button><Button variant="primary" disabled={busy} onClick={remove}>{r('confirmDelete')}</Button></>} />
  </div>
}
