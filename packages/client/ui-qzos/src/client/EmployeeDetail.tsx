/** Original QZOS employee settings, publishing and conversation-data page organization. */
import { useState } from 'react'
import { Button, Input, Modal, IconChevronLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { catalogs, type Example } from './catalog.ts'
import type { PreviewRow } from './resource-fixtures.ts'
import { resourceDraft, type PreviewValues, type ResourceForm } from './resource-schema.ts'
import { ResourceFields } from './ResourceForms.tsx'
import { ResourceTable } from './ResourceTable.tsx'
import { resourceCopy, type ResourceText } from './resource-copy.ts'
import css from './Resources.module.css'
import { publicationArtwork } from './resource-artwork.ts'
import type { QzosKey } from './locales.ts'

const emptyRows: readonly PreviewRow[] = []
type EmployeeDetailProps = PanelProps & { item: Example; section: string; onSaved: () => void }
type EmployeeDialog = { kind: 'menu' | 'share' | 'api' | 'quota' | 'keys' | 'feedback' | 'reply' | 'correct' | 'binding'; row?: PreviewRow; readOnly?: boolean }

/** Render employee configuration and publication flows with synthetic records only. */
export function EmployeeDetail({ item, section, useStore, actions, t, openEmployee, syncEmployees, onSaved }: EmployeeDetailProps) {
  const r = (key: ResourceText) => t(resourceCopy[key])
  const employees = useStore(state => state.employees)
  const knowledge = useStore(state => state.knowledge)
  const [editTab, setEditTab] = useState<ResourceForm | 'bindings'>('employeeBase')
  const [draft, setDraft] = useState(() => resourceDraft({ name: item.title, intro: item.description, roles_prompt: item.content, kb_ids: 'kb-team', ...item.values }))
  const [channel, setChannel] = useState('')
  const [dialogueTab, setDialogueTab] = useState('data')
  const [feedbackFilter, setFeedbackFilter] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [dialog, setDialog] = useState<EmployeeDialog | null>(null)
  const [dialogDraft, setDialogDraft] = useState<PreviewValues>({})
  const [confirmation, setConfirmation] = useState<{ key: string; ids: string[] } | null>(null)
  const [notice, setNotice] = useState('')
  const menusKey = `${item.id}:menus`
  const sharesKey = `${item.id}:${channel === 'api' ? 'apps' : 'shares'}`
  const bindingsKey = `${item.id}:bindings`
  const dialoguesKey = `${item.id}:dialogues`
  const menus = useStore(state => state.resourceRows[menusKey] ?? emptyRows)
  const shares = useStore(state => state.resourceRows[sharesKey] ?? emptyRows)
  const dialogues = useStore(state => state.resourceRows[dialoguesKey] ?? emptyRows)
  const bindings = useStore(state => state.resourceRows[bindingsKey] ?? emptyRows)
  const sequence = useStore(state => state.sequence)
  const update = (key: string, value: string) =>{  setDraft(current => ({ ...current, [key]: value })) }
  const show = (kind: EmployeeDialog['kind'], row?: PreviewRow, readOnly = false) => {
    setDialogDraft(resourceDraft(row ? { ...row } : {}))
    setDialog({ kind, readOnly, ...row ? { row } : {} })
  }
  const copy = (value: string) => { void navigator.clipboard.writeText(value).then(() =>{  setNotice(r('copy')) }, () =>{  setNotice(value) }) }
  const saveDialog = () => {
    if (!dialog || dialog.readOnly) { setDialog(null); return }
    if (dialog.kind === 'binding') {
      const selectedBinding = catalogs.skills.find(record => record.id === dialogDraft.binding)
      if (!selectedBinding) return
      actions.saveRow(bindingsKey, null, { name: selectedBinding.title, targetId: selectedBinding.id, kind: dialogDraft.kind ?? 'skill' })
    }
    if (dialog.kind === 'menu') actions.saveRow(menusKey, dialog.row?.id ?? null, { ...dialogDraft, name: dialogDraft.keyword ?? '' })
    if (dialog.kind === 'share' || dialog.kind === 'api') {
      actions.saveRow(sharesKey, dialog.row?.id ?? null, { ...dialogDraft, status: dialog.row?.status ?? 'enabled', entryId: dialog.row?.entryId ?? `preview-${sequence + 1}`, key: dialog.row?.key ?? `qzos_demo_${sequence + 1}`, lastUsed: '—', mode: '文本问答' })
    }
    if (dialog.kind === 'quota' && dialog.row) actions.saveRow(sharesKey, dialog.row.id, { ...dialogDraft })
    if ((dialog.kind === 'feedback' || dialog.kind === 'correct') && dialog.row) actions.saveRow(dialoguesKey, dialog.row.id, { feedback: dialogDraft.feedback ?? dialogDraft.question ?? '', answer: dialogDraft.answer ?? dialog.row.answer ?? '', reviewed: '1' })
    setDialog(null); setNotice(r('saved'))
  }
  const dialogueRows = dialogues.filter(row => feedbackFilter === 'all' || row.reviewed === (feedbackFilter === 'reviewed' ? '1' : '0'))
  const dialogTitle: ResourceText = dialog?.kind === 'binding' ? dialogDraft.kind === 'skill' ? 'bindSkill' : 'bindPlugin' : dialog?.kind === 'menu' ? 'addMenu' : dialog?.kind === 'share' ? 'createLink'
    : dialog?.kind === 'api' ? 'createApi' : dialog?.kind === 'quota' ? 'usageSettings' : dialog?.kind === 'keys' ? 'manageKeys'
      : dialog?.kind === 'feedback' ? 'questionFeedback' : dialog?.kind === 'correct' ? 'correct' : 'viewReply'
  const form: ResourceForm = dialog?.kind === 'menu' ? 'menu' : dialog?.kind === 'correct' ? 'fragment' : 'share'
  const tabList: readonly [ResourceForm | 'bindings', ResourceText][] = [['employeeBase', 'base'], ['bindings', 'skillBindings'], ['employeeSearch', 'modelSearch'], ['employeeInterface', 'interface'], ['employeeFlow', 'flow']]
  const platformGroups: readonly [ResourceText, readonly ResourceText[]][] = [['webapp', ['web', 'js', 'oa', 'poster']], ['apiAccess', ['api', 'qwx', 'rpa']]]
  return <div className={css.employeeDetail}>
    {notice && <p className={css.notice} role="status">{notice}</p>}
    {section === 'edit' && <>
      <div className={css.tabs}>
        {tabList.map(([tab, label]) =>
          <Button key={tab} aria-pressed={editTab === tab} onClick={() =>{  setEditTab(tab) }}>{r(label)}</Button>)}
      </div>
      <header className={css.configHeading}><h2>{r(tabList.find(([tab]) => tab === editTab)?.[1] ?? 'base')}</h2></header>
      {editTab === 'bindings' ? <div className={css.inner}><div className={css.toolbar}><Button onClick={() => { show('binding'); setDialogDraft({ kind: 'skill' }) }}>{r('bindSkill')}</Button><Button onClick={() => { show('binding'); setDialogDraft({ kind: 'plugin' }) }}>{r('bindPlugin')}</Button></div><ResourceTable r={r} rows={bindings} columns={[['name', 'bindingName'], ['kind', 'bindingStatus']]} actions={row => [{ label: 'delete', run: () =>{  setConfirmation({ key: bindingsKey, ids: [row.id] }) } }]} /></div>
        : <>{editTab === 'employeeSearch' && <p className={css.notice}>{r('parameterNotice')}</p>}{editTab === 'employeeFlow' && <div className={css.notice}>{r('flowNotice')}<br />{r('flowNotice2')}</div>}
          <ResourceFields t={t} form={editTab} draft={draft} knowledge={knowledge} onChange={update} editing />
          {editTab === 'employeeBase' && <div className={css.inner}><p className={css.notice}>{r('helpRole')}</p></div>}
          {editTab === 'employeeInterface' && <div className={css.menuEditor}><p className={css.notice}>{r('helpWelcome')}</p><h3>{r('menus')}</h3><ResourceTable rows={menus} r={r} columns={[['keyword', 'keywordLabel'], ['content', 'replyContent']]} actions={row => [{ label: 'view', run: () =>{  show('menu', row, true) } }, { label: 'edit', run: () =>{  show('menu', row) } }, { label: 'delete', run: () =>{  setConfirmation({ key: menusKey, ids: [row.id] }) } }]} /><Button variant="primary" disabled={menus.length >= 3} onClick={() =>{  show('menu') }}>+ {r('addMenu')}</Button><p className={css.notice}>{r('menuHint')}</p></div>}
        </>}
      <div className={css.formFooter}><Button variant="primary" disabled={!draft.name?.trim()} onClick={() => { actions.saveResource('employees', item.id, draft); syncEmployees(employees.map(record => record.id === item.id ? { ...record, title: draft.name ?? record.title, description: draft.intro ?? record.description, values: { ...draft } } : record)); onSaved() }}>{r('save')}</Button></div>
    </>}
    {section === 'release' && <div className={css.inner}>
      <div className={css.toolbar}><div className={css.inline}><Button onClick={() => { actions.employeeStatus(item.id, 'ready'); syncEmployees(employees.map(record => record.id === item.id ? { ...record, status: 'ready' } : record)); setNotice(r('stateReady')) }}>{r('onDuty')}</Button><Button onClick={() => { actions.employeeStatus(item.id, 'pending'); syncEmployees(employees.map(record => record.id === item.id ? { ...record, status: 'pending' } : record)); setNotice(r('statePaused')) }}>{r('pauseEmployee')}</Button></div></div>
      {!channel ? platformGroups.map(([group, platforms]) => <div key={group}><h3>{r(group)}</h3><div className={css.platformGrid}>{platforms.map(platform => <button type="button" key={platform} disabled={['oa', 'qwx', 'rpa'].includes(platform)} onClick={() =>{  setChannel(platform === 'poster' ? 'web' : platform) }}><img src={publicationArtwork[platform as keyof typeof publicationArtwork]} alt="" /><span>{r(platform)}<small>{t(`pcPlatform${platform}` as QzosKey)}</small>{['oa', 'qwx', 'rpa'].includes(platform) && <small>{r('comingSoon')}</small>}</span></button>)}</div></div>)
        : <><Button onClick={() =>{  setChannel('') }}><IconChevronLeftOutlineRegular size={16} />{r(channel === 'api' ? 'api' : channel === 'js' ? 'js' : 'web')}</Button><p className={css.notice}>{r('webHint')}</p>
          {channel === 'js' && <div className={css.result}><pre>{'<iframe src="https://example.invalid/qzos-preview" width="100%" height="600"></iframe>'}</pre><Button onClick={() =>{  copy('<iframe src="https://example.invalid/qzos-preview"></iframe>') }}>{r('copy')}</Button></div>}
          <div className={css.toolbar}><Button variant="primary" onClick={() =>{  show(channel === 'api' ? 'api' : 'share') }}>{r(channel === 'api' ? 'createApi' : 'createLink')}</Button>{channel === 'api' && <span>{r('apiRoot')} https://example.invalid/api</span>}</div>
          <ResourceTable rows={shares} r={r} columns={channel === 'api' ? [['status', 'status'], ['key', 'appSecret'], ['name', 'name'], ['lastUsed', 'lastUsed']] : [['status', 'status'], ['entryId', 'entryId'], ['name', 'shareName'], ['password', 'password'], ['mode', 'mode'], ['lastUsed', 'lastUsed']]}
            cell={(row, key) => key === 'status' ? r(row.status === 'enabled' ? 'enabled' : 'disabled') : key === 'password' ? row.password ? '••••••' : '—' : row[key] ?? '—'} actions={row => [
              { label: row.status === 'enabled' ? 'deactivate' : 'enabled', run: () =>{  actions.saveRow(sharesKey, row.id, { status: row.status === 'enabled' ? 'disabled' : 'enabled' }) } },
              ...channel === 'api' ? [{ label: 'manageKeys' as const, run: () =>{  show('keys', row) } }] : [{ label: 'copyLink' as const, run: () =>{  copy(`https://example.invalid/share/${row.entryId}`) } }, { label: 'edit' as const, run: () =>{  show('share', row) } }, { label: 'preview' as const, run: () => { void openEmployee(item.id, item.title).then((message) => { if (message) setNotice(message) }) } }, { label: 'generatePoster' as const, run: () => { setNotice(`https://example.invalid/share/${row.entryId}`) } }],
              { label: 'usageSettings', run: () =>{  show('quota', row) } }, { label: 'delete', run: () =>{  setConfirmation({ key: sharesKey, ids: [row.id] }) } },
            ]} />
        </>}
    </div>}
    {section === 'dialogue' && <div className={css.inner}>
      <div className={css.tabs}><Button aria-pressed={dialogueTab === 'data'} onClick={() =>{  setDialogueTab('data') }}>{r('dialogue')}</Button><Button aria-pressed={dialogueTab === 'records'} onClick={() =>{  setDialogueTab('records') }}>{r('dialogueRecords')}</Button></div>
      {dialogueTab === 'data' ? <div className={css.stats}>{(['totalConversations', 'todayConversations', 'totalUsers', 'totalTokens'] as const).map((label, index) => <div key={label}>{r(label)}<strong>{index === 3 ? dialogues.length * 224 : dialogues.length}</strong></div>)}</div>
        : <><div className={css.toolbar}><Button disabled={selected.length === 0} onClick={() =>{  setConfirmation({ key: dialoguesKey, ids: selected }) }}>{r('batchDelete')}</Button><select aria-label={r('feedback')} value={feedbackFilter} onChange={(event) =>{  setFeedbackFilter(event.target.value) }}>{(['all', 'unreviewed', 'reviewed'] as const).map(value => <option key={value} value={value}>{r(value)}</option>)}</select></div>
          <ResourceTable rows={dialogueRows} r={r} selection={selected} onSelection={setSelected} columns={[['id', 'id'], ['userInfo', 'userInfo'], ['question', 'question'], ['answer', 'answer'], ['feedback', 'feedback'], ['questionTime', 'questionTime']]} actions={row => [{ label: 'questionFeedback', run: () =>{  show('feedback', row) } }, { label: 'correct', run: () =>{  show('correct', row) } }, { label: 'viewReply', run: () =>{  show('reply', row, true) } }, { label: 'delete', run: () =>{  setConfirmation({ key: dialoguesKey, ids: [row.id] }) } }]} />
        </>}
    </div>}
    <Modal open={dialog !== null} onClose={() =>{  setDialog(null) }} closeLabel={r('close')} title={r(dialogTitle)} className={`${css.dialog} ${css.employeeDialog}`}
      footer={<><Button variant="outline" onClick={() =>{  setDialog(null) }}>{r('cancel')}</Button>{dialog?.kind !== 'keys' && <Button variant="primary" onClick={saveDialog}>{r('confirm')}</Button>}</>}>
      {dialog?.kind === 'binding' ? <div className={css.checkList}>{catalogs.skills.map(record => <label key={record.id}><input type="radio" name="qzos-binding" disabled={bindings.some(binding => binding.targetId === record.id)} checked={dialogDraft.binding === record.id} onChange={() =>{  setDialogDraft(current => ({ ...current, binding: record.id })) }} />{record.title}</label>)}</div>
        : dialog?.kind === 'keys' ? <><p className={css.notice}>{r('secretHint')}<br />{r('localSecretHint')}</p><div className={css.toolbar}>{(['createKey', 'rotate', 'deactivate', 'recentCalls'] as const).map(command => <Button key={command} onClick={() => {
          if (command === 'deactivate') { if (dialog.row) actions.saveRow(sharesKey, dialog.row.id, { status: 'disabled' }); setNotice(r('disabled')) }
          else if (command === 'recentCalls') setNotice(r('empty'))
          else setDialogDraft(current => ({ ...current, secret: `qzos_demo_secret_${sequence + 1}` }))
        }}>{r(command)}</Button>)}</div>{dialogDraft.secret && <div className={css.result}><code>{dialogDraft.secret}</code><Button onClick={() =>{  copy(dialogDraft.secret ?? '') }}>{r('copySecret')}</Button></div>}</>
          : dialog?.kind === 'quota' ? <div className={css.formFields}>{(['quotaDaily', 'quotaTotal'] as const).map(key => <label key={key}>{r(key)}<Input type="number" min={0} value={dialogDraft[key] ?? '0'} onChange={(event) =>{  setDialogDraft(current => ({ ...current, [key]: event.target.value })) }} /></label>)}<label>{r('expiresAt')}<Input type="date" value={dialogDraft.expiresAt ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, expiresAt: event.target.value })) }} /></label></div>
            : dialog?.kind === 'feedback' ? <label>{r('feedbackContent')}<textarea className={css.textArea} rows={5} value={dialogDraft.feedback ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, feedback: event.target.value })) }} /></label>
              : dialog?.kind === 'reply' ? <><strong>{dialog.row?.question}</strong><p>{dialog.row?.answer}</p></>
                : dialog?.kind === 'api' ? <label>{r('name')}<Input value={dialogDraft.name ?? ''} onChange={(event) =>{  setDialogDraft(current => ({ ...current, name: event.target.value })) }} /></label>
                  : <ResourceFields t={t} form={form} draft={dialogDraft} knowledge={knowledge} disabled={dialog?.readOnly ?? false}
                    onChange={(key, value) =>{  setDialogDraft(current => ({ ...current, [key]: value })) }} />}
    </Modal>
    <Modal className={css.employeeDialog as string} open={confirmation !== null} onClose={() =>{  setConfirmation(null) }} closeLabel={r('close')} title={r('deleteConfirm')} description={r('deleteHint')}
      footer={<><Button variant="outline" onClick={() =>{  setConfirmation(null) }}>{r('cancel')}</Button><Button variant="primary" onClick={() => { if (confirmation) actions.deleteRows(confirmation.key, confirmation.ids); setConfirmation(null); setSelected([]) }}>{r('confirmDelete')}</Button></>} />
  </div>
}
