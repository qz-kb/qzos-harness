/** Document candidate status and review remain private QZOS UI concerns. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { loginRecord, storedLogin, LoginError, type LoginRecord } from './login-client.ts'
import { parseOperation, submitParse, reviewFields, reviewChanges, type ParseAction, type ParseOperation } from './knowledge-parse.ts'
import { sourceLocation } from './knowledge-source.ts'
import css from './Resources.module.css'

type ParseProps = PanelProps & { kb: string; fd: string; name: string; editable: boolean; onClose: () => void; onChanged: () => void }

/** Show current candidate state; closing releases the framework resource and pending reads. */
export function KnowledgeParse(props: ParseProps) {
  const { kb, fd, name, t, useResource, useStore, onClose } = props
  const epoch = useStore(state => state.businessEpoch)
  const [revision, setRevision] = useState(0)
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/parse?id=${kb}&fd=${fd}&epoch=${epoch}&revision=${revision}`)
  const refresh = () => { setRevision(value => value + 1); props.onChanged() }
  return <Modal open onClose={onClose} title={`${t('parseTitle')} · ${name}`} closeLabel={t('loginClose')} className={css.dialog as string} footer={<Button onClick={onClose}>{t('loginClose')}</Button>}>
    {remote.status === 'failed' ? <p role="alert">{remote.failure?.message}<Button onClick={refresh}>{t('parseRefresh')}</Button></p>
      : !remote.value ? <p role="status">{t('kbLoading')}</p>
        : <ParseContent key={`${epoch}:${revision}`} {...props} value={remote.value} refresh={refresh} />}
  </Modal>
}

function ParseContent({ value, refresh, editable, t }: ParseProps & { value: LoginRecord; refresh: () => void }) {
  const status = loginRecord(value.status)
  const processing = status.processing ? loginRecord(status.processing) : null
  const review = value.review ? loginRecord(value.review) : null
  const result = review ? loginRecord(review.result) : null
  const sourceLabels = { page: t('sourcePage'), slide: t('sourceSlide'), sheet: t('sourceSheet'), cells: t('sourceCells'), paragraph: t('sourceParagraph'), missing: t('sourceMissing') }
  const fields = result ? reviewFields(result, sourceLabels) : []
  const issues = result ? knowledgeRows(result.issues) : []
  const allowed = processing && Array.isArray(processing.actions) ? processing.actions : status.can_retry === true ? ['retry'] : []
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [action, setAction] = useState<ParseAction | null>(null)
  const [unknownUsage, setUnknownUsage] = useState(false)
  const [replacement, setReplacement] = useState<File | null>(null)
  const [operation, setOperation] = useState<ParseOperation | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [lifetime] = useState(() => new AbortController())
  const token = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const call = (path: string, body?: LoginRecord | FormData) => knowledgeRequest(path, body, lifetime.signal, token.current)
  const perform = async (selected: ParseAction, confirm = false, repeat = false) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      let request = repeat ? operation : null
      if (!request) {
        let extra: LoginRecord = {}
        if (selected === 'review') {
          if (!review || review.revision !== processing?.revision || review.job_key !== status.job_key) throw new Error(t('parseStale'))
          extra = { changes: reviewChanges(fields, drafts, issues, corrections), confirm_issue_ids: confirmed, confirm }
        }
        if (selected === 'retry' && unknownUsage) extra.accept_unknown_usage = true
        if (selected === 'replace') {
          if (!replacement) throw new Error(t('parseSelectFile'))
          const form = new FormData(); form.append('file', replacement); form.append('kb_id', knowledgeText(status.kb_id)); form.append('purpose', 'pending_original')
          extra.object_id = loginRecord(await call('/kb.file_gateway/upload', form)).object_id
        }
        request = parseOperation(status, selected, extra)
        setOperation(request)
      }
      await submitParse(call, request)
      refresh()
    } catch (cause) {
      if (cause instanceof LoginError) setOperation(null)
      setError(cause instanceof Error ? cause.message : t('errorHint'))
    }
    finally { pending.current = false; setBusy(false) }
  }
  const locked = busy || operation !== null || !editable
  const labels = { review: 'parseReview', retry: 'parseRetry', cancel: 'parseCancel', continue: 'parseContinue', replace: 'parseReplace', correct: 'parseCorrect' } as const
  return <div className={css.formFields}>
    <div role="status"><strong>{knowledgeText(status.status_msg) || t('parseNone')}</strong><p>{t('parseVersions')}: {knowledgeText(status.current_version)} / {knowledgeText(status.candidate_version) || '—'}</p>
      {processing && <p>{t('parseProgress')}: {knowledgeText(processing.completed_units)} / {knowledgeText(processing.total_units)}</p>}
      <p>{t('parseActivationHint')}</p>
    </div>
    {Boolean(status.error_message) && <p role="alert">{knowledgeText(status.error_message)} {knowledgeText(status.error_code)}</p>}
    {error && <p role="alert">{error}</p>}
    <div className={css.inline}><Button disabled={busy} onClick={refresh}>{t('parseRefresh')}</Button>
      {operation && !busy && <><span>{t('parseUnknown')}</span><Button disabled={busy} onClick={() => { void perform('retry', false, true) }}>{t('parseResend')}</Button></>}
    </div>
    {review && <>
      <h3>{t('parseReview')}</h3><p>{t('parseReviewHint')}</p>
      {Boolean(review.source) && <p>{t('parseOriginal')}: {knowledgeText(loginRecord(review.source).name)}</p>}
      {fields.map(field => <fieldset key={field.key} disabled={locked}><legend>{field.label}</legend>{Object.entries(field.values).map(([key, original]) => <label key={key}>{t(key === 'text' ? 'parseText' : key === 'display_text' ? 'parseDisplay' : key === 'category' ? 'parseCategory' : key === 'unit' ? 'parseUnit' : 'parseValue')}
        <textarea rows={key === 'text' ? 4 : 2} value={drafts[field.key]?.[key] ?? original} onChange={(event) => { const text = event.target.value; setDrafts(current => ({ ...current, [field.key]: { ...field.values, ...current[field.key], [key]: text } })) }} />
      </label>)}</fieldset>)}
      {issues.map((issue) => {
        const id = knowledgeText(issue.id)
        return <fieldset key={id} disabled={locked}><legend>{knowledgeText(issue.message ?? issue.code)}</legend>
          <p>{issue.source_ref ? sourceLocation(loginRecord(issue.source_ref), sourceLabels) : ''}</p>
          {['IMAGE_CONTENT_UNRESOLVED', 'PAGE_CONTENT_UNRESOLVED', 'CHART_IMAGE_UNRESOLVED'].includes(knowledgeText(issue.code)) && <label>{t('parseMissing')}<textarea rows={4} value={corrections[id] ?? ''} onChange={(event) => { setCorrections(current => ({ ...current, [id]: event.target.value })) }} /></label>}
          {Boolean(issue.resolution) ? <p>{t('parseIssueResolved')}</p> : issue.code === 'TABLE_STRUCTURE_UNRESOLVED' ? <p>{t('parseReplaceHint')}</p> : <label><input type="checkbox" checked={confirmed.includes(id)} onChange={(event) => { setConfirmed(current => event.target.checked ? [...current, id] : current.filter(value => value !== id)) }} />{t('parseIssueConfirmed')}</label>}
        </fieldset> })}
      <div className={css.inline}><Button disabled={locked} onClick={() => { void perform('review') }}>{t('parseSaveDraft')}</Button><Button variant="primary" disabled={locked} onClick={() => { setAction('review') }}>{t('parseConfirmLearn')}</Button></div>
    </>}
    <div className={css.inline}>{(['correct', 'retry', 'continue', 'replace', 'cancel'] as const).filter(key => allowed.includes(key)).map(key => <Button key={key} disabled={locked} onClick={() => { setAction(key) }}>{t(labels[key])}</Button>)}</div>
    {action && !operation && <fieldset disabled={busy}><legend>{t(labels[action])}</legend><p>{t(action === 'correct' ? 'parseCorrectHint' : action === 'cancel' ? 'parseCancelHint' : action === 'review' ? 'parseConfirmHint' : 'parseOperationHint')}</p>
      {action === 'retry' && processing && <label><input type="checkbox" checked={unknownUsage} onChange={(event) => { setUnknownUsage(event.target.checked) }} />{t('parseUsageHint')}</label>}
      {action === 'replace' && <Input type="file" accept=".pdf,.xlsx,.pptx" aria-label={t('parseSelectFile')} onChange={(event) => { setReplacement(event.target.files?.[0] ?? null) }} />}
      <div className={css.inline}><Button onClick={() => { setAction(null) }}>{t('parseBack')}</Button><Button variant="primary" disabled={action === 'replace' && !replacement} onClick={() => { void perform(action, action === 'review') }}>{t('parseConfirm')}</Button></div>
    </fieldset>}
  </div>
}
