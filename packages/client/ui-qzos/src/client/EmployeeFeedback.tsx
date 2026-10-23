/** Native conversation feedback resolves server-owned employee record IDs for the active account. */
import { useEffect, useRef, useState } from 'react'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { createQzosStore } from './store.ts'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { storedLogin, type LoginRecord } from './login-client.ts'
import css from './Resources.module.css'

type Props = PropsRuntime<'shell.overlay'> & PropsLocale<'qzos'> & PropsStore<ReturnType<typeof createQzosStore>> & InjectFace<{ hooks: { feedback: ObservableSnapshot<SessionId | null> }; onClose: () => void }>
/** Native header action; the root overlay owns account-sensitive state. */
export function EmployeeFeedbackButton({ t, onOpen }: PropsLocale<'qzos'> & { onOpen: () => void }) {
  return <Button onClick={onOpen}>{t('nativeFeedback')}</Button>
}
/** Feedback overlay shares the root business account lifecycle. */
export function EmployeeFeedback(props: Props) {
  const user = props.useStore(s => s.businessUser)
  const epoch = props.useStore(s => s.businessEpoch)
  const sessionId = props.useFeedback(value => value)
  useEffect(() => { props.onClose() }, [epoch, props.onClose])
  if (!user || !sessionId) return null
  return <FeedbackContent key={`${sessionId}:${epoch}`} {...props} sessionId={sessionId} epoch={epoch} />
}
function FeedbackContent({ t, sessionId, epoch, useResource, onClose }: Props & { sessionId: SessionId; epoch: number }) {
  const [revision, setRevision] = useState(0)
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/employee-session-records?id=${encodeURIComponent(sessionId)}&epoch=${epoch}&revision=${revision}`)
  const rows = remote.value ? knowledgeRows(remote.value.rows) : []
  const unique = [...new Map(rows.filter(r => Number(r.record_id) > 0).map(r => [knowledgeText(r.record_id), r])).values()]
  return <Modal open onClose={onClose} title={t('nativeFeedback')} closeLabel={t('loginClose')} className={css.dialog as string} footer={<Button onClick={onClose}>{t('loginClose')}</Button>}>
    <Button onClick={() => { setRevision(v => v + 1) }}>{t('parseRefresh')}</Button>
    {remote.status === 'failed' && <p role="alert">{remote.failure?.message}</p>}
    {remote.value && unique.length === 0 && <p>{t('feedbackNoRecord')}</p>}
    {unique.map(row => <FeedbackRow key={knowledgeText(row.record_id)} t={t} row={row} />)}
  </Modal>
}
function FeedbackRow({ t, row }: PropsLocale<'qzos'> & { row: LoginRecord }) {
  const [kind, setKind] = useState<'like' | 'dislike' | 'correction' | 'miss'>('like')
  const [content, setContent] = useState('')
  const [key, setKey] = useState(randomUUID)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const token = useRef(storedLogin(sessionStorage))
  const [lifetime] = useState(() => new AbortController())
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const submit = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setNotice('')
    try {
      await knowledgeRequest('/v1/kb/feedback', { robot_id: Number(row.robot_id), record_id: Number(row.record_id), type: kind, content: kind === 'correction' ? content : '', idempotency_key: key }, lifetime.signal, token.current)
      setNotice(t('kbSaved'))
    } catch (error) { setNotice(error instanceof Error ? error.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className={css.result}><strong>{knowledgeText(row.question)}</strong><p>{knowledgeText(row.reply)}</p>{row.usage_pending === true && <p>{t('usagePending')}</p>}<div className={css.inline}>{(['like', 'dislike', 'correction', 'miss'] as const).map(type => <Button key={type} disabled={busy} aria-pressed={kind === type} onClick={() => { setKind(type); setKey(randomUUID()); setNotice('') }}>{t(({ like: 'feedbackLike', dislike: 'feedbackDislike', correction: 'feedbackCorrection', miss: 'feedbackMiss' } as const)[type])}</Button>)}</div>{kind === 'correction' && <Input aria-label={t('feedbackContent')} value={content} disabled={busy} onChange={(event) => { setContent(event.target.value); setKey(randomUUID()) }} />}<Button disabled={busy || (kind === 'correction' && !content.trim())} onClick={() => { void submit() }}>{t('feedbackSubmit')}</Button>{notice && <p role="status">{notice}</p>}</section>
}
