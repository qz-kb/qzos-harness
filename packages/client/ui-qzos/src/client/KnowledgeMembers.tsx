/** QZOS member picker: search on the left, selected members and permissions on the right. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, IconUsersOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { storedLogin, type LoginRecord } from './login-client.ts'
import { resourceCopy } from './resource-copy.ts'
import css from './Resources.module.css'

/** Add selected identities with per-member permissions; never resolve an ambiguous display name. */
export function KnowledgeMembers({ kb, onClose, onSaved, ...props }: PanelProps & {
  kb: string
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = props
  const epoch = props.useStore(state => state.businessEpoch)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<Record<string, { user: LoginRecord; power: number }>>({})
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [lifetime] = useState(() => new AbortController())
  const token = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  useEffect(() => { setPage(1) }, [query, kb])
  const remote = props.useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/member-options?id=${encodeURIComponent(kb)}&query=${encodeURIComponent(query)}&epoch=${epoch}&revision=${revision}&page=${page}&page_size=15`)
  const users = remote.value ? knowledgeRows(remote.value.rows) : []
  const total = Number(remote.value?.total ?? users.length)
  const pages = Math.max(1, Math.ceil(total / 15))
  const eligible = users.filter(user => !Number(user.is_added))
  const toggle = (user: LoginRecord, checked: boolean) => {
    const sn = knowledgeText(user.sn)
    setSelected(current => checked ? { ...current, [sn]: { user, power: 3 } }
      : Object.fromEntries(Object.entries(current).filter(([key]) => key !== sn)))
  }
  const save = async () => {
    if (pending.current || Object.keys(selected).length === 0) return
    pending.current = true; setBusy(true); setError('')
    try {
      await knowledgeRequest('/kb.know/teamAdd', { kb_id: Number(kb), users: Object.fromEntries(Object.entries(selected).map(([sn, value]) => [sn, value.power])) }, lifetime.signal, token.current)
      onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Modal open onClose={() => { if (!busy) onClose() }} title={t(resourceCopy.addMember)} closeLabel={t(resourceCopy.close)} className={css.memberDialog as string}
    footer={<><Button disabled={busy} onClick={onClose}>{t(resourceCopy.cancel)}</Button><Button variant="primary" disabled={busy || !Object.keys(selected).length || remote.status === 'failed'} onClick={() => { void save() }}>{t(resourceCopy.confirm)}</Button></>}>
    {error && <p role="alert">{error}</p>}
    {remote.status === 'failed' && <p role="alert">{remote.failure?.message}<Button onClick={() => { setRevision(value => value + 1) }}>{t(resourceCopy.refresh)}</Button></p>}
    <div className={css.memberColumns}><div>
      <Input aria-label={t('knowledgeMemberSearch')} placeholder={t('knowledgeMemberSearch')} disabled={busy} value={query} onChange={(event) => { setQuery(event.target.value) }} />
      <label className={css.memberOption}><input type="checkbox" disabled={busy || remote.status !== 'live' || !eligible.length} checked={eligible.length > 0 && eligible.every(user => selected[knowledgeText(user.sn)])} onChange={(event) => { for (const user of eligible) toggle(user, event.target.checked) }} />{t(resourceCopy.all)}</label>
      {remote.status === 'loading' ? <p role="status">{t('catalogLoading')}</p> : !users.length && <p className={css.empty}>{t('knowledgeMemberSearchHint')}</p>}
      {users.map(user => <label key={knowledgeText(user.sn)} className={css.memberOption}><input type="checkbox" disabled={busy || remote.status !== 'live' || Boolean(Number(user.is_added))} checked={Boolean(selected[knowledgeText(user.sn)])} onChange={(event) => { toggle(user, event.target.checked) }} />
        {user.avatar ? <img className={css.memberAvatar} src={knowledgeText(user.avatar)} alt="" /> : <IconUsersOutlineRegular size={24} />}
        <span>{knowledgeText(user.nickname)} {Number(user.is_added) ? <small>{t('knowledgeMemberAdded')}</small> : null}</span>
      </label>)}
      {total > 15 && <div className={css.pager}><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(current => Math.max(1, current - 1)) }}>{t(resourceCopy.previous)}</Button><span>{page} / {pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => { setPage(current => Math.min(pages, current + 1)) }}>{t(resourceCopy.next)}</Button></div>}
    </div><div><strong>{t('knowledgeSelectedMembers')}：{Object.keys(selected).length}</strong>
      {Object.entries(selected).map(([sn, { user, power }]) => <div key={sn} className={css.memberOption}><span>{knowledgeText(user.nickname)}</span><select aria-label={`${t(resourceCopy.defaultPermission)} · ${knowledgeText(user.nickname)}`} disabled={busy} value={power} onChange={(event) => { const next = Number(event.target.value); setSelected(current => ({ ...current, [sn]: { user, power: next } })) }}>
        <option value={3}>{t(resourceCopy.viewPermission)}</option>
        <option value={2}>{t(resourceCopy.editPermission)}</option>
        <option value={1}>{t(resourceCopy.managePermission)}</option>
      </select><Button disabled={busy} aria-label={`${t(resourceCopy.removeMember)} · ${knowledgeText(user.nickname)}`} onClick={() => { toggle(user, false) }}>×</Button></div>)}
    </div></div>
  </Modal>
}
