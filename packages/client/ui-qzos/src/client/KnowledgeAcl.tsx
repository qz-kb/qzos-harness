/** File rules use the existing QZOS ACL endpoints and native resource lifecycle. */
import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { loginRecord, storedLogin, type LoginRecord } from './login-client.ts'
import css from './Resources.module.css'

/** Edit one server rule without replacing other subjects' rules. */
export function KnowledgeAcl({ fd, onClose, ...props }: PanelProps & { fd: string; onClose: () => void }) {
  const { t, useResource, useStore } = props
  const epoch = useStore(state => state.businessEpoch)
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState<LoginRecord>({ allow_mask: 0, deny_mask: 0, is_active: 1 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [lifetime] = useState(() => new AbortController())
  const token = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/acl?fd=${fd}&epoch=${epoch}&revision=${revision}`)
  const rows = remote.value ? knowledgeRows(remote.value.rows) : []
  const subjects = remote.value ? loginRecord(remote.value.subjects) : {}
  const options = Object.entries(subjects).flatMap(([type, entries]) => knowledgeRows(entries).map(row => ({ value: `${type}:${knowledgeText(row.id)}`, name: knowledgeText(row.name) })))
  const subject = draft.subject_type ? `${knowledgeText(draft.subject_type)}:${knowledgeText(draft.subject_id)}` : ''
  const change = (patch: LoginRecord) => { setDraft(current => ({ ...current, ...patch })) }
  const mutate = async (remove = false) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      await knowledgeRequest(`/kb.documentAcl/${remove ? 'del' : draft.id ? 'edit' : 'add'}`, remove ? { id: Number(draft.id) } : {
        ...draft.id ? { id: Number(draft.id) } : { fd_id: Number(fd) },
        subject_type: Number(draft.subject_type), subject_id: Number(draft.subject_id),
        allow_mask: Number(draft.allow_mask), deny_mask: Number(draft.deny_mask), is_active: Number(draft.is_active),
        include_descendants: Number(draft.include_descendants ?? 0),
      }, lifetime.signal, token.current)
      setDraft({ allow_mask: 0, deny_mask: 0, is_active: 1 }); setRevision(value => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  const permissions = [[1, 'aclView'], [2, 'aclReference'], [4, 'aclDownload'], [8, 'aclEdit'], [16, 'aclDelete']] as const
  return <Modal open onClose={onClose} title={t('aclSubject')} closeLabel={t('loginClose')} className={css.dialog as string} footer={<Button onClick={onClose}>{t('loginClose')}</Button>}>
    {remote.status === 'failed' && <p role="alert">{remote.failure?.message}</p>}
    {error && <p role="alert">{error}</p>}
    {!remote.value ? <p role="status">{t('kbLoading')}</p> : <div className={css.formFields}>
      <div className={css.inline}>{rows.map(row => <Button key={knowledgeText(row.id)} disabled={busy} onClick={() => { setDraft(row); setError('') }}>{knowledgeText(row.subject_name)} · {knowledgeText(row.id)} · {Number(row.is_active) === 1 ? t('aclActive') : t('aclInactive')}</Button>)}<Button disabled={busy} onClick={() => { setDraft({ allow_mask: 0, deny_mask: 0, is_active: 1 }) }}>{t('aclAdd')}</Button></div>
      <label>{t('aclSubject')}<select disabled={busy} value={subject} onChange={(event) => { const [type, id] = event.target.value.split(':'); change({ subject_type: Number(type), subject_id: Number(id) }) }}><option value="">—</option>{subject && !options.some(option => option.value === subject) && <option value={subject}>{knowledgeText(draft.subject_name)}</option>}{options.map(option => <option key={option.value} value={option.value}>{option.name} ({option.value})</option>)}</select></label>
      {permissions.map(([bit, label]) => <label key={bit}>{t(label)}<select disabled={busy} value={Number(draft.deny_mask) & bit ? 'deny' : Number(draft.allow_mask) & bit ? 'allow' : 'neutral'} onChange={(event) => { change({ allow_mask: (Number(draft.allow_mask) & ~bit) | (event.target.value === 'allow' ? bit : 0), deny_mask: (Number(draft.deny_mask) & ~bit) | (event.target.value === 'deny' ? bit : 0) }) }}><option value="neutral">{t('aclNeutral')}</option><option value="allow">{t('aclAllow')}</option><option value="deny">{t('aclDeny')}</option></select></label>)}
      <label><input type="checkbox" disabled={busy} checked={Number(draft.is_active) === 1} onChange={(event) => { change({ is_active: event.target.checked ? 1 : 0 }) }} />{t('aclActive')}</label>
      {Number(draft.subject_type) === 2 && <label><input type="checkbox" disabled={busy} checked={Number(draft.include_descendants) === 1} onChange={(event) => { change({ include_descendants: event.target.checked ? 1 : 0 }) }} />{t('aclDescendants')}</label>}
      <div className={css.formFooter}><Button disabled={busy || !subject} variant="primary" onClick={() => { void mutate() }}>{t('aclSave')}</Button>{Boolean(draft.id) && <Button disabled={busy} onClick={() => { void mutate(true) }}>{t('aclDelete')}</Button>}</div>
    </div>}
  </Modal>
}
