/** Public links, iframe snippets and downloadable QR posters reuse the existing visitor application. */
import { useEffect, useState } from 'react'
import QRCode from 'qrcode/lib/browser.js'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { loginApi } from './login-client.ts'
import { publicationEmbed, publicationUrl } from './publication-client.ts'
import css from './Resources.module.css'

/** Preview an artifact for an already-created public publication. */
export function EmployeePublication({ t, publicId, type, name, poster, onClose }: PropsLocale<'qzos'> & { publicId: string; type: number; name: string; poster: boolean; onClose: () => void }) {
  const url = publicationUrl(loginApi, publicId, type)
  const [instance] = useState(randomUUID)
  const embed = publicationEmbed(url, instance)
  const [png, setPng] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!poster) return
    let live = true
    const canvas = document.createElement('canvas')
    const qr = document.createElement('canvas')
    void QRCode.toCanvas(qr, url, { width: 320, margin: 4, errorCorrectionLevel: 'M' }).then(() => {
      canvas.width = 480; canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.fillStyle = '#f3f6fa'; ctx.fillRect(0, 0, 480, 600)
      ctx.fillStyle = '#172b4d'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(name, 240, 65, 420); ctx.drawImage(qr, 80, 100)
      ctx.font = '18px sans-serif'; ctx.fillText(t('publicationScan'), 240, 470, 420)
      ctx.font = '12px sans-serif'; ctx.fillText(url, 240, 525, 440)
      if (live) setPng(canvas.toDataURL('image/png'))
    }).catch(() => { if (live) setNotice(t('errorHint')) })
    return () => { live = false }
  }, [name, poster, t, url])
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(t('publicationCopied')) }
    catch { setNotice(t('errorHint')) }
  }
  return <Modal open onClose={onClose} title={t('publicationArtifacts')} closeLabel={t('loginClose')} className={css.dialog as string} footer={<Button onClick={onClose}>{t('loginClose')}</Button>}>
    <p>{t('publicationScope')}</p>
    <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
    <Button onClick={() => { void copy(url) }}>{t('publicationCopyLink')}</Button>
    {type === 2 && <><textarea className={css.textArea} aria-label={t('publicationEmbed')} readOnly rows={5} value={embed} /><Button onClick={() => { void copy(embed) }}>{t('publicationEmbed')}</Button></>}
    {poster && (png ? <><img src={png} alt={t('publicationScan')} width={240} height={300} /><a href={png} download="qzos-employee.png">{t('publicationDownload')}</a></> : <p>{t('employeeLoading')}</p>)}
    {notice && <p role="status">{notice}</p>}
  </Modal>
}
