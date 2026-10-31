/** Employee discovery and sharing use the existing QZOS availability checks. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { storedLogin } from './login-client.ts'
import css from './Resources.module.css'

type Props = PanelProps & { onClose: () => void; employeeId?: string; inline?: boolean }
/** Browse available employees or manage the current employee's sharing. */
export function EmployeeSquare(props: Props) {
  const { t, onClose, employeeId, useResource, useStore, openEmployee } = props
  const epoch = useStore(state => state.businessEpoch)
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [lifetime] = useState(() => new AbortController())
  const token = useRef(storedLogin(sessionStorage))
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/${employeeId ? 'employee-share-categories' : 'employee-square'}?epoch=${epoch}&category=${encodeURIComponent(category)}&keyword=${encodeURIComponent(search)}&page=${page}&revision=${revision}`)
  const categories = remote.value ? knowledgeRows(employeeId ? remote.value.rows : remote.value.categories) : []
  const rows = !employeeId && remote.value ? knowledgeRows(remote.value.lists) : []
  const used = !employeeId && remote.value ? knowledgeRows(remote.value.used) : []
  const act = async (path: string, id: string, chatId?: string, name?: string) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setNotice('')
    try {
      await knowledgeRequest(path, { id: Number(id), ...employeeId ? { cate_id: Number(category) } : {} }, lifetime.signal, token.current)
      setRevision(value => value + 1); props.actions.refreshKnowledge(); setNotice(t('kbSaved'))
      if (chatId) { const error = await openEmployee(chatId, name ?? ''); if (error) setNotice(error) }
    } catch (error) { setNotice(error instanceof Error ? error.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  const content = <>
    <p>{t('employeeSquareHint')}</p>
    {remote.status === 'failed' && <p role="alert">{remote.failure?.message}</p>}
    {notice && <p role="status">{notice}</p>}
    <select aria-label={t('employeeCategory')} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}><option value="">{t('employeeCategory')}</option>{categories.map(row => <option key={knowledgeText(row.id)} value={knowledgeText(row.id)}>{knowledgeText(row.name)}</option>)}</select>
    {employeeId ? <div className={css.inline}><Button disabled={busy || !category} onClick={() => { void act('/kb.robot/share', employeeId) }}>{t('employeeShare')}</Button><Button disabled={busy} onClick={() => { void act('/kb.robot/cancelShare', employeeId) }}>{t('employeeUnshare')}</Button></div>
      : <><div className={css.inline}><Input aria-label={t('search')} value={keyword} onChange={(event) => { setKeyword(event.target.value) }} /><Button onClick={() => { setSearch(keyword); setPage(1) }}>{t('search')}</Button><Button onClick={() => { setRevision(value => value + 1) }}>{t('parseRefresh')}</Button></div>
        <div className={css.employeeGrid}>{rows.map(row => <article key={knowledgeText(row.id)} className={css.sharedEmployeeCard}>{row.image ? <img src={knowledgeText(row.image)} alt="" /> : null}<strong>{knowledgeText(row.name)}</strong><p>{knowledgeText(row.intro)}</p><Button disabled={busy} onClick={() => { void act('/kb.square/add', knowledgeText(row.id), knowledgeText(row.robot_id), knowledgeText(row.name)) }}>{t('employeeUse')}</Button></article>)}</div>
        <div className={css.inline}><Button disabled={page === 1} onClick={() => { setPage(value => value - 1) }}>{t('previous')}</Button><span>{page}</span><Button disabled={page * 25 >= Number(remote.value?.count ?? 0)} onClick={() => { setPage(value => value + 1) }}>{t('next')}</Button></div>
        <h3>{t('employeeUsed')}</h3>{used.map(row => <div key={knowledgeText(row.id)} className={css.inline}><span>{knowledgeText(row.name)}</span><Button disabled={busy} onClick={() => { void act('/kb.square/del', knowledgeText(row.square_id)) }}>{t('employeeRemoveUsed')}</Button></div>)}
      </>}
  </>
  return props.inline ? <div className={css.squareContent}>{content}</div>
    : <Modal open onClose={onClose} title={t(employeeId ? 'employeeShare' : 'employeeSquare')} closeLabel={t('loginClose')} className={`${css.dialog} ${css.knowledgeTheme}`} footer={<Button onClick={onClose}>{t('loginClose')}</Button>}>{content}</Modal>
}
