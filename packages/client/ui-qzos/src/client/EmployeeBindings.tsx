/** Binding edits preserve the other capability family and always read back current server state. */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { storedLogin, type LoginRecord } from './login-client.ts'
import css from './Resources.module.css'

/** Employee skill and plugin-action bindings. */
export function EmployeeBindings(props: PanelProps & { employeeId: string }) {
  return <div className={css.inner}><p>{props.t('bindingsExecution')}</p>{(['skills', 'plugins'] as const).map(kind => <BindingFamily key={kind} {...props} kind={kind} />)}</div>
}
function BindingFamily(props: PanelProps & { employeeId: string; kind: 'skills' | 'plugins' }) {
  const { t, kind, employeeId, useResource, useStore } = props
  const epoch = useStore(s => s.businessEpoch)
  const [revision, setRevision] = useState(0)
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/employee-${kind}?id=${employeeId}&epoch=${epoch}&revision=${revision}`)
  if (remote.status === 'failed') return <section><h3>{t(kind === 'skills' ? 'skills' : 'bindingPlugins')}</h3><p role="alert">{remote.failure?.message}</p><Button onClick={() => { setRevision(v => v + 1) }}>{t('parseRefresh')}</Button></section>
  if (!remote.value) return <p>{t('employeeLoading')}</p>
  return <BindingEditor key={`${kind}:${revision}`} {...props} data={remote.value} onSaved={() => { setRevision(v => v + 1) }} />
}
function BindingEditor({ t, kind, employeeId, data, onSaved }: PanelProps & { employeeId: string; kind: 'skills' | 'plugins'; data: LoginRecord; onSaved: () => void }) {
  const rows = knowledgeRows(data.rows)
  const bound = knowledgeRows(data.bound)
  const choices = kind === 'skills' ? rows.map(r => ({ key: knowledgeText(r.id), name: knowledgeText(r.name), disabled: Number(r.status) !== 1 }))
    : rows.flatMap(c => knowledgeRows(c.actions).map(a => ({ key: `${knowledgeText(c.id)}:${knowledgeText(a.key)}`, name: `${knowledgeText(c.name)} · ${knowledgeText(a.name)}`, disabled: false })))
  const initial = bound.map(r => kind === 'skills' ? knowledgeText(r.id) : `${knowledgeText(r.connection_id)}:${knowledgeText(r.action_key)}`)
  const [selected, setSelected] = useState(initial)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const token = useRef(storedLogin(sessionStorage))
  const [lifetime] = useState(() => new AbortController())
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const save = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true); setNotice('')
    try {
      await knowledgeRequest(kind === 'skills' ? '/skill.skill/bind' : '/plugin.connection/bind', { robot_id: Number(employeeId), ...kind === 'skills' ? { skill_ids: selected.map(Number) } : { actions: selected.map((key) => { const [connection, ...action] = key.split(':'); return { connection_id: Number(connection), action_key: action.join(':') } }) } }, lifetime.signal, token.current)
      onSaved()
    } catch (error) { setNotice(error instanceof Error ? error.message : t('errorHint')) }
    finally { pending.current = false; setBusy(false) }
  }
  const all = [...choices, ...initial.filter(key => !choices.some(c => c.key === key)).map(key => ({ key, name: `${key} · ${t('bindingUnavailable')}`, disabled: false }))]
  return <section><h3>{t(kind === 'skills' ? 'skills' : 'bindingPlugins')}</h3><div className={css.checkList}>{all.map(choice => <label key={choice.key}><input type="checkbox" disabled={busy || (choice.disabled && !selected.includes(choice.key))} checked={selected.includes(choice.key)} onChange={(event) => { setSelected(current => event.target.checked ? [...current, choice.key] : current.filter(key => key !== choice.key)) }} />{choice.name}</label>)}</div>{!all.length && <p>{t('empty')}</p>}{notice && <p role="alert">{notice}</p>}<Button disabled={busy} onClick={() => { void save() }}>{t('bindingSave')}</Button></section>
}
