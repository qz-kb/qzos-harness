/** Non-disruptive product update notice and persistent release-history entry. */
import { useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createQzosStore } from './store.ts'
import { loginApi } from './login-client.ts'
import { readProductUpdates, qzosClientVersion, qzosSurface, visibleReleases } from './product-updates.ts'
import css from './ProductUpdates.module.css'

type Props = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'qzos'> & PropsStore<ReturnType<typeof createQzosStore>>
/** Owns account-scoped update history; never reloads a page or installs a package. */
export function ProductUpdates(props: Props) {
  const user = props.useStore(s => s.businessUser)
  const epoch = props.useStore(s => s.businessEpoch)
  return user ? <History key={`${user}:${epoch}`} {...props} account={user} epoch={epoch} /> : null
}
function History({ t, useResource, account, epoch, wide }: Props & { account: string; epoch: number }) {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const [revision, setRevision] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const surface = qzosSurface()
  const remote = useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/product-updates?epoch=${epoch}&revision=${revision}`)
  let data, invalid = false
  try { if (remote.value) data = readProductUpdates(remote.value) } catch (error) { invalid = error instanceof Error }
  const current = data?.releases.find(r => r.components[surface] === qzosClientVersion)
  const seenKey = `qzos.updates.seen:${loginApi}:${account}:${surface}`
  let seen = dismissed
  try { seen ??= localStorage.getItem(seenKey) } catch (error) { /* Blocked storage only affects this optional notice. */ void error }
  const acknowledge = () => {
    if (!current) return
    setDismissed(current.version)
    try { localStorage.setItem(seenKey, current.version) }
    catch (error) { /* Keep the in-memory dismissal. */ void error }
  }
  return <>
    <div className={css.entry}>
      <Button title={t('updatesTitle')} aria-label={t('updatesTitle')} onClick={() => { setOpen(true) }}>{wide ? t('updatesTitle') : '↻'}{current && seen !== current.version && <span className={css.dot} aria-label={t('updatesNew')} />}</Button>
    </div>
    <Modal open={open} onClose={() => { setOpen(false); acknowledge() }} title={t('updatesTitle')} closeLabel={t('loginClose')} className={css.dialog as string} contentClassName={css.content as string} footer={<Button variant="primary" onClick={() => { setOpen(false); acknowledge() }}>{t('updatesUnderstood')}</Button>}>
      <p>{t('updatesClient')} {qzosClientVersion} · {t('updatesServer')} {data?.server_version ?? t('updatesUnknown')}</p>
      {data && data.compatibility.status !== 'compatible' && <p role="status">{data.compatibility.message}</p>}
      <div className={css.filters}><Button variant={all ? 'ghost' : 'outline'} aria-pressed={!all} onClick={() => { setAll(false) }}>{t('updatesThisSurface')}</Button><Button variant={all ? 'outline' : 'ghost'} aria-pressed={all} onClick={() => { setAll(true) }}>{t('updatesAll')}</Button><Button onClick={() => { setRevision(v => v + 1) }}>{t('parseRefresh')}</Button></div>
      {(remote.status === 'failed' || invalid) && <p role="alert">{t('updatesUnavailable')}</p>}
      {!remote.value && remote.status !== 'failed' && <p role="status">{t('loading')}</p>}
      {data?.update_check === 'unavailable' && <p role="status">{t('updatesCheckUnavailable')}</p>}
      {data && visibleReleases(data.releases, all ? 'all' : surface).length === 0 && <p>{t('updatesEmpty')}</p>}
      {data && visibleReleases(data.releases, all ? 'all' : surface).map(release => <section key={release.version} className={css.release}>
        <header><strong>{release.version}</strong>{release.components[surface] === qzosClientVersion && <span className={css.current}>{t('updatesCurrent')}</span>}{release.version === data.available_version && <span className={css.current}>{t('updatesAvailable')}</span>}<time>{release.date}</time></header>
        <ul>{release.changes.map((change, index) => <li key={index}><span className={css.tag} data-kind={change.kind}>{t(({ feature: 'updatesFeature', improvement: 'updatesImprovement', fix: 'updatesFix', notice: 'updatesNotice' } as const)[change.kind])}</span><span>{change.text}</span></li>)}</ul>
      </section>)}
    </Modal>
  </>
}
