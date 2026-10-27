/** Authenticated skills, authorized connections and employee templates use existing QZOS APIs. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PanelProps } from './Panel.tsx'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { knowledgeRequest, knowledgeRows, knowledgeText } from './knowledge-client.ts'
import { loginRecord, storedLogin, type LoginRecord } from './login-client.ts'
import { applyEmployeeTemplate, capabilityModels, exportSkill } from './capability-client.ts'
import css from './Panel.module.css'

type Props = PanelProps & { panel: 'skills' | 'connectors' | 'templates' }
type Dialog = { kind: 'install' | 'uninstall' | 'share' | 'template' | 'request' | 'detail'; row: LoginRecord; data?: LoginRecord }

/** Render server-authorized skill, connection and template resources with existing lifecycle operations. */
export function CapabilityPanel(props: Props) {
  const { panel, t, useResource, useStore, actions } = props
  const epoch = useStore(s => s.businessEpoch)
  const [revision, refresh] = useState(0)
  const [market, setMarket] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [name, setName] = useState('')
  const [model, setModel] = useState('')
  const [purpose, setPurpose] = useState('')
  const [scope, setScope] = useState('private')
  const [users, setUsers] = useState('')
  const [permission, setPermission] = useState('use')
  const [target, setTarget] = useState('')
  const [lifetime] = useState(() => new AbortController())
  const token = useRef(storedLogin(sessionStorage))
  const pending = useRef(false)
  useEffect(() => () => { lifetime.abort() }, [lifetime])
  const request = (path: string, body?: LoginRecord | FormData) => knowledgeRequest(path, body, lifetime.signal, token.current)
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/capability-${market ? 'market' : panel}?epoch=${epoch}&revision=${revision}`)
  const rows = remote.value ? knowledgeRows(remote.value.rows) : []
  const visible = rows.filter(row => (!market || row.kind === (panel === 'skills' ? 'skill' : 'plugin')) && `${knowledgeText(row.name)} ${knowledgeText(row.description ?? row.describe ?? '')}`.toLowerCase().includes(query.trim().toLowerCase()))
  const perform = async (work: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setNotice('')
    try { await work() } catch (error) { if (!lifetime.signal.aborted) setNotice(error instanceof Error ? error.message : t('capabilityError')) }
    finally { pending.current = false; if (!lifetime.signal.aborted) setBusy(false) }
  }
  const previewInstall = (row: LoginRecord) => perform(async () => {
    if (target && !/^[1-9]\d*$/.test(target)) throw new Error(t('capabilityTargetHint'))
    const data = loginRecord(await request('/skill.market/preview', { resource_id: row.resource_id, version: row.version, request_id: randomUUID(), scope: { type: 'private' }, ...target ? { target_id: Number(target) } : {} }))
    setDialog({ kind: 'install', row, data })
  })
  const inspect = (row: LoginRecord) => perform(async () => {
    const [detail, versions, dependencies] = await Promise.all([
      request(`/skill.skill/detail?id=${knowledgeText(row.id)}`), request(`/skill.skill/versions?id=${knowledgeText(row.id)}`), request(`/skill.skill/dependencies?id=${knowledgeText(row.id)}`),
    ])
    setDialog({ kind: 'detail', row: loginRecord(detail), data: { versions: knowledgeRows(versions), dependencies: loginRecord(dependencies) } })
  })
  const confirm = () => perform(async () => {
    if (!dialog) return
    const { kind, row, data } = dialog
    if (kind === 'install' || kind === 'uninstall') {
      if (!data || typeof data.preview_token !== 'string') throw new Error(t('capabilityPreviewExpired'))
      await request(kind === 'install' ? '/skill.market/confirm' : '/skill.skill/uninstall', { preview_token: data.preview_token })
      // Read back the authoritative list after the mutation, before reporting success.
      await request('/skill.skill/lists')
    } else if (kind === 'template') {
      const id = await applyEmployeeTemplate(knowledgeText(row.id), name, model, lifetime.signal, token.current)
      actions.refreshKnowledge(); actions.setDetail('employees', id); actions.setSection('employees', 'edit')
      setNotice(`${t('capabilityCreated')} · ${id}`)
    } else if (kind === 'request') {
      await request('/plugin.request/create', { plugin_ref: row.resource_id, version: row.version, purpose: purpose.trim(), request_id: randomUUID() })
      await request('/plugin.request/mine')
    } else if (kind === 'share') {
      const ids = users.split(/[\s,，]+/).filter(Boolean)
      if (scope === 'users' && (!ids.length || ids.some(id => !/^[1-9]\d*$/.test(id)))) throw new Error(t('capabilityUsersHint'))
      const result = loginRecord(await request('/skill.skill/share', { id: Number(row.id), scope, permission: scope === 'all' ? 'use' : permission, user_ids: scope === 'users' ? [...new Set(ids.map(Number))] : [] }))
      setNotice(t(result.status === 'pending_review' ? 'capabilityReviewPending' : 'capabilitySaved'))
    }
    setDialog(null); setMarket(false); refresh(v => v + 1)
    if (kind !== 'share' && kind !== 'template') setNotice(t('capabilitySaved'))
  })
  const models = remote.value?.models ? capabilityModels(loginRecord(remote.value.models)) : []
  return <section className={css.page} data-qzos-panel={panel}><div className={css.content}>
    <header className={css.heading}><div><h1>{t(panel)}</h1><p>{t(panel === 'connectors' ? 'capabilityConnectionsHint' : panel === 'templates' ? 'capabilityTemplatesHint' : 'capabilitySkillsHint')}</p></div></header>
    <div className={css.toolbar}><div className={css.actions}>
      <Button disabled={busy} onClick={() => { refresh(v => v + 1) }}>{t('parseRefresh')}</Button>
      {panel !== 'templates' && <Button disabled={busy} aria-pressed={market} onClick={() => { setMarket(v => !v); setDialog(null); setQuery('') }}>{t(market ? 'capabilityInstalled' : 'capabilityMarket')}</Button>}
      {panel === 'skills' && <label>{t('capabilityImport')}<input type="file" accept=".zip" disabled={busy} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
        void perform(async () => { const form = new FormData(); form.append('file', file); form.append('request_id', randomUUID()); if (target) form.append('target_id', target); const data = loginRecord(await request('/skill.market/importOffline', form)); setDialog({ kind: 'install', row: loginRecord(data.entry), data }) })
      }} /></label>}
    </div><Input value={query} aria-label={t('search')} placeholder={t('search')} onChange={(e) => { setQuery(e.target.value) }} /></div>
    {panel === 'skills' && <label>{t('capabilityTargetHint')}<Input value={target} disabled={busy} onChange={(e) => { setTarget(e.target.value) }} /></label>}
    {notice && <p role="status">{notice}</p>}
    {remote.value?.marketDisabled === true && <p role="status">{t('capabilityMarketDisabled')}</p>}
    {remote.status === 'failed' ? <p role="alert">{remote.failure?.message === 'MARKET_DISABLED' ? t('capabilityMarketDisabled') : remote.failure?.message}</p> : !remote.value ? <p role="status">{t('employeeLoading')}</p> : <div className={css.list}>{!visible.length && <p>{t('empty')}</p>}{visible.map(row => <article className={css.card} key={knowledgeText(row.id ?? row.resource_id)}>
      <div className={css.cardHeading}><h2>{knowledgeText(row.name)}</h2></div><p>{knowledgeText(row.description ?? row.describe ?? '')}</p>
      <span className={css.metadata}>{row.version !== undefined ? `${t('capabilityVersion')} ${knowledgeText(row.version)}` : knowledgeText(row.category ?? '')}{!market && panel === 'skills' ? ` · ${t(Number(row.status) === 1 ? 'capabilityEnabled' : 'capabilityDisabled')}` : ''}</span>
      {panel === 'connectors' && !market && <p>{knowledgeRows(row.actions).map(action => knowledgeText(action.name)).join(' · ')}</p>}
      <div className={css.cardActions}>
        {market ? panel === 'skills' ? <><Button disabled={busy} onClick={() => { void previewInstall(row) }}>{t('capabilityPreview')}</Button><Button disabled={busy} onClick={() => { void perform(async () => { const blob = await exportSkill(row, lifetime.signal, token.current); const url = URL.createObjectURL(blob); try { const a = document.createElement('a'); a.href = url; a.download = 'qzos-offline.zip'; a.click() } finally { URL.revokeObjectURL(url) } }) }}>{t('capabilityExport')}</Button></> : <Button disabled={busy} onClick={() => { setPurpose(''); setDialog({ kind: 'request', row }) }}>{t('capabilityRequest')}</Button>
          : panel === 'templates' ? <Button disabled={busy} onClick={() => { setName(knowledgeText(row.name)); setModel(''); setDialog({ kind: 'template', row }) }}>{t('capabilityApply')}</Button>
            : panel === 'skills' ? <><Button disabled={busy} onClick={() => { void inspect(row) }}>{t('detail')}</Button>{row.can_maintain === true && <>
              <Button disabled={busy || (row.taken_down === true && Number(row.status) !== 1)} onClick={() => { void perform(async () => { const state = Number(row.status) === 1 ? 0 : 1; await request(`/skill.skill/${state ? 'enable' : 'disable'}`, { id: Number(row.id) }); const result = loginRecord(await request(`/skill.skill/detail?id=${knowledgeText(row.id)}`)); if (Number(result.status) !== state) throw new Error(t('capabilityReadback')); refresh(v => v + 1) }) }}>{t(Number(row.status) === 1 ? 'capabilityDisable' : 'capabilityEnable')}</Button>
              <Button disabled={busy} onClick={() => { void perform(async () => { setDialog({ kind: 'uninstall', row, data: loginRecord(await request('/skill.skill/uninstallPreview', { id: Number(row.id), request_id: randomUUID() })) }) }) }}>{t('capabilityUninstall')}</Button></>}
            {row.can_share === true && <Button disabled={busy} onClick={() => { setScope('private'); setUsers(''); setPermission('use'); setDialog({ kind: 'share', row }) }}>{t('capabilityShare')}</Button>}</> : null}
      </div></article>)}</div>}
    {dialog && <section className={css.detail} aria-label={t('detail')}><h2>{knowledgeText(dialog.row.name)}</h2>
      {dialog.kind === 'template' && <><label>{t('capabilityName')}<Input value={name} disabled={busy} onChange={(e) => { setName(e.target.value) }} /></label><label>{t('capabilityPublicModel')}<select value={model} disabled={busy} onChange={(e) => { setModel(e.target.value) }}><option value="">—</option>{models.map(item => <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>)}</select></label></>}
      {dialog.kind === 'request' && <label>{t('capabilityPurpose')}<textarea value={purpose} disabled={busy} maxLength={1000} onChange={(e) => { setPurpose(e.target.value) }} /></label>}
      {dialog.kind === 'share' && <><label>{t('capabilityScope')}<select value={scope} disabled={busy} onChange={(e) => { setScope(e.target.value) }}>{(['private', 'users', 'all'] as const).map(value => <option key={value} value={value}>{t(value === 'private' ? 'capabilityPrivate' : value === 'users' ? 'capabilityUsers' : 'capabilityAll')}</option>)}</select></label>{scope === 'users' && <><label>{t('capabilityUsersHint')}<Input value={users} disabled={busy} onChange={(e) => { setUsers(e.target.value) }} /></label><select aria-label={t('capabilityPermission')} disabled={busy} value={permission} onChange={(e) => { setPermission(e.target.value) }}><option value="use">{t('capabilityUse')}</option><option value="maintain">{t('capabilityMaintain')}</option></select></>}</>}
      {(dialog.kind === 'install' || dialog.kind === 'uninstall') && <><p>{t(dialog.kind === 'install' ? 'capabilityInstallHint' : 'capabilityUninstallHint')}</p>{dialog.kind === 'install' ? <p>{t('capabilityVersion')} {knowledgeText(dialog.row.version)} · {knowledgeText(dialog.row.description ?? '')}</p> : <p>{t('capabilityDependencies')} {Object.entries(loginRecord(dialog.data?.dependencies)).filter(([key]) => key.endsWith('_count')).map(([key, value]) => `${t(key === 'employee_count' ? 'employees' : key === 'connection_count' ? 'connectors' : key === 'task_count' ? 'capabilityTasks' : 'capabilityRunning')}: ${knowledgeText(value)}`).join(' · ')}</p>}</>}
      {dialog.kind === 'detail' && <><p>{knowledgeText(dialog.row.description)}</p><p>{t('capabilityVersion')}: {knowledgeText(dialog.row.version)} · {t('capabilityDependencies')}: {Object.keys(loginRecord(dialog.data?.dependencies ?? {})).length} · {t('capabilityVersions')}: {Array.isArray(dialog.data?.versions) ? dialog.data.versions.length : 0}</p></>}
      <div className={css.actions}>{dialog.kind !== 'detail' && <Button variant="primary" disabled={busy || (dialog.kind === 'request' && purpose.trim().length < 6) || (dialog.kind === 'template' && (!name.trim() || !model))} onClick={() => { void confirm() }}>{t('capabilityConfirm')}</Button>}<Button disabled={busy} onClick={() => { setDialog(null) }}>{t('capabilityCancel')}</Button></div>
    </section>}
    {panel === 'connectors' && !market && remote.value && <section className={css.detail}><h2>{t('capabilityRequests')}</h2>{knowledgeRows(remote.value.requests).map(row => <p key={knowledgeText(row.id)}>{knowledgeText(row.plugin_ref ?? row.id)} · {knowledgeText(row.status)} · {knowledgeText(row.purpose ?? '')}</p>)}<h2>{t('capabilityCalls')}</h2>{knowledgeRows(remote.value.calls).map(row => <p key={knowledgeText(row.id)}>{knowledgeText(row.action_key ?? row.id)} · {knowledgeText(row.status ?? row.result_code ?? '')}</p>)}</section>}
  </div></section>
}
