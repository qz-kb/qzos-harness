/** Original access and lifecycle controls for the private QZOS workbench. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { knowledgeRequest, knowledgeText } from './knowledge-client.ts'
import { loginRecord, storedLogin, type LoginRecord } from './login-client.ts'
import { downloadOriginal, lifecycleTargets } from './knowledge-file.ts'
import css from './Resources.module.css'

type FileProps = PanelProps & { fd: string; name: string; onClose: () => void; onChanged: () => void }
const operations = ['fileWithdraw', 'fileSubmitReview', 'fileApprove', 'fileArchive'] as const
const states = ['fileDraft', 'fileReview', 'filePublished', 'fileArchived', 'fileDeleting', 'fileDeleted'] as const

/** Resolve live access metadata and release pending requests when the dialog closes. */
export function KnowledgeFile(props: FileProps) {
  const { fd, name, useResource, useStore, t } = props
  const epoch = useStore(state => state.businessEpoch)
  const [revision, setRevision] = useState(0)
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/file?fd=${fd}&epoch=${epoch}&revision=${revision}`)
  const refresh = () => { setRevision(value => value + 1); props.onChanged() }
  return <Modal open title={`${t('fileAccess')} · ${name}`} closeLabel={t('loginClose')} onClose={props.onClose} className={css.dialog as string} footer={<Button onClick={props.onClose}>{t('loginClose')}</Button>}>
    <Button onClick={refresh}>{t('parseRefresh')}</Button>
    {remote.status === 'failed' ? <p role="alert">{remote.failure?.message}</p> : !remote.value ? <p role="status">{t('kbLoading')}</p>
      : <FileContent key={`${epoch}:${revision}`} {...props} value={remote.value} refresh={refresh} />}
  </Modal>
}
function FileContent({ fd, name, t, value, refresh }: FileProps & { value: LoginRecord; refresh: () => void }) {
  const source = value.source ? loginRecord(value.source) : null
  const lifecycle = value.lifecycle ? loginRecord(value.lifecycle) : null
  const [lifetime] = useState(() => new AbortController())
  const token = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [target, setTarget] = useState<number | null>(null)
  const [validFrom, setValidFrom] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await action() } catch (failure) { setError(failure instanceof Error ? failure.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  const download = () => { void run(async () => {
    const blob = await downloadOriginal(knowledgeText(source?.url), lifetime.signal, token.current)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = knowledgeText(source?.name) || name
    document.body.append(anchor); anchor.click(); anchor.remove()
    setTimeout(() => { URL.revokeObjectURL(url) }, 1000)
  }) }
  const transition = () => { void run(async () => {
    if (!lifecycle || target === null) return
    const valid = target === 2 && validFrom ? Math.floor(new Date(validFrom).getTime() / 1000) : 0
    const expires = target === 2 && expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : 0
    if (!Number.isFinite(valid) || !Number.isFinite(expires) || (expires > 0 && expires <= valid)) throw new Error(t('fileInvalidDates'))
    setUncertain(true)
    await knowledgeRequest('/kb.lifecycle/transition', { fd_id: Number(fd), revision: Number(lifecycle.revision), state: target, valid_from: valid, expires_at: expires }, lifetime.signal, token.current)
    refresh()
  }) }
  const state = Number(lifecycle?.state)
  return <div className={css.fileContent}>
    {error && <p role="alert">{error}</p>}
    <h3>{t('fileOriginal')}</h3><p>{source ? knowledgeText(source.status_message) : t('fileNoOriginal')}</p>
    <Button disabled={busy || source?.can_open !== true || !source.url} onClick={download}>{t('fileDownload')}</Button>
    {lifecycle && <><h3>{t('fileLifecycle')}</h3><p>{t(states[state] ?? 'fileUnavailable')} · {t('fileRevision')} {knowledgeText(lifecycle.revision)}</p>
      <p>{Number(lifecycle.projection_status) === 1 && lifecycle.effective === true ? t('fileEffective') : t('fileNotEffective')}</p>
      <p>{t('fileValidFrom')}: {Number(lifecycle.valid_from) > 0 ? new Date(Number(lifecycle.valid_from) * 1000).toLocaleString() : '—'} · {t('fileExpiresAt')}: {Number(lifecycle.expires_at) > 0 ? new Date(Number(lifecycle.expires_at) * 1000).toLocaleString() : '—'}</p>
      <p>{t('fileReviewHint')}</p>
      {lifecycle.transitions_enabled !== true ? <p>{t('fileDisabled')}</p> : <div className={css.inline}>{lifecycleTargets(state).map(next => <Button key={next} disabled={busy || uncertain} onClick={() => { setTarget(next) }}>{t(operations[next] ?? 'fileUnavailable')}</Button>)}</div>}
      {target !== null && <fieldset disabled={busy || uncertain}><legend>{t('fileTransitionConfirm')} {t(states[target] ?? 'fileUnavailable')}</legend>
        {target === 2 && <><label>{t('fileValidFrom')}<Input type="datetime-local" value={validFrom} onChange={(event) => { setValidFrom(event.target.value) }} /></label><label>{t('fileExpiresAt')}<Input type="datetime-local" value={expiresAt} onChange={(event) => { setExpiresAt(event.target.value) }} /></label></>}
        <Button onClick={() => { setTarget(null) }}>{t('parseBack')}</Button><Button onClick={transition}>{t('parseConfirm')}</Button>
      </fieldset>}
      {uncertain && <p role="status">{t('fileReadbackRequired')}<Button disabled={busy} onClick={refresh}>{t('parseRefresh')}</Button></p>}
    </>}
  </div>
}
