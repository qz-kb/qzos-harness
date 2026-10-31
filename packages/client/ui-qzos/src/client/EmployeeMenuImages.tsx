/** QZOS shortcut menu images stay in the draft until the employee is saved. */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconPlusOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './Resources.module.css'

type Props = PropsLocale<'qzos'> & { images: string[]; onChange: (images: string[]) => void; disabled: boolean; onBusy: (busy: boolean) => void }
/** Preview, add and remove the original menu's image attachments. */
export function EmployeeMenuImages({ images, onChange, disabled, onBusy, t }: Props) {
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  return <div className={css.menuImages}>
    <span>{t('knowledgeImages')}</span><div className={css.menuImageList}>
      {images.map((image, index) => <div key={`${index}:${image}`}><img src={image} alt={`${t('employeeMenuImages')} ${index + 1}`} /><Button disabled={disabled || loading} aria-label={`${t('delete')} ${index + 1}`} onClick={() => { onChange(images.filter((_, position) => index !== position)) }}>×</Button></div>)}
      {!disabled && images.length < 9 && <label className={css.imagePicker}><IconPlusOutlineRegular size={24} /><input type="file" aria-label={t('knowledgeImages')} accept="image/*" multiple disabled={loading} onChange={(event) => {
        const files = Array.from(event.target.files ?? []); event.target.value = ''; setError(false)
        if (files.length + images.length > 9 || files.some(file => !file.type.startsWith('image/'))) { setError(true); return }
        setLoading(true); onBusy(true)
        void Promise.all(files.map(file => new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result)
            else reject(new Error('Invalid image'))
          }
          reader.onerror = () => { reject(new Error(reader.error?.message ?? 'Image read failed')) }
          reader.readAsDataURL(file)
        }))).then((values) => { if (active.current) onChange([...images, ...values]) })
          .catch(() => { if (active.current) setError(true) })
          .finally(() => { if (active.current) { setLoading(false); onBusy(false) } })
      }} /></label>}
    </div><small>{t('employeeMenuImageHint')}</small>{error && <p role="alert">{t('knowledgeMediaInvalid')}</p>}
  </div>
}
