/** QZOS form controls adapted to the existing DSH UI primitives. */
import { useId } from 'react'
import { Input, IconPlusOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { resourceForms, type ResourceForm, type PreviewValues, type PreviewField } from './resource-schema.ts'
import { resourceCopy } from './resource-copy.ts'
import type { Example } from './catalog.ts'
import css from './Resources.module.css'

type FormProps = PropsLocale<'qzos'> & {
  form: ResourceForm
  draft: PreviewValues
  onChange: (key: string, value: string) => void
  knowledge: readonly Example[]
  options?: Record<string, { value: string; label: string; disabled?: boolean }[]>
  editing?: boolean
  disabled?: boolean
  disabledFields?: readonly string[]
}

/** Render original QZOS field order, option sets and conditional fields. */
export function ResourceFields({ form, draft, onChange, knowledge, editing, disabled, disabledFields, options, t }: FormProps) {
  const prefix = useId()
  const fields: readonly PreviewField[] = resourceForms[form]
  return <div className={`${css.formFields} ${form === 'knowledgeSettings' ? css.topLabels : ''}`}>{fields.map((field) => {
    if (field.when && draft[field.when[0]] !== field.when[1]) return null
    if (field.unless && draft[field.unless[0]] === field.unless[1]) return null
    const id = `${prefix}-${field.id}`
    const value = draft[field.id] ?? field.initial
    const locked = disabled || disabledFields?.includes(field.id) || (editing && field.locked) || (form === 'employeeFlow' && field.id !== 'flow_status')
    const savedOnly = form.startsWith('employee') && ['model_id', 'temperature', 'context_num', 'ranking_status', 'ranking_score', 'ranking_model', 'optimize_ask', 'optimize_m_id', 'search_empty_type', 'search_empty_text', 'support_file', 'icons', 'is_show_context', 'is_show_quote', 'is_show_feedback', 'related_issues_num', 'welcome_introducer', 'copyright'].includes(field.id)
    return <div className={css.formRow} key={field.id}>
      <label htmlFor={id}>{field.required && <span className={css.required} aria-hidden="true">*</span>}{t(field.label)}</label>
      <div className={css.formControl}>
        {field.kind === 'textarea' ? <textarea id={id} rows={field.id === 'welcome_introducer' ? 8 : 4} value={value} required={field.required} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} />
          : field.kind === 'select' ? <select id={id} value={value} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }}>{options?.[field.id] ? <><option value="">—</option>{options[field.id]?.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</> : field.options?.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>
            : field.kind === 'radio' ? <div className={css.radioGroup} role="group" aria-label={t(field.label)}>{field.options?.map(option => <label key={option.value}><input type="radio" name={id} checked={value === option.value} value={option.value} disabled={locked || (form === 'employeeFlow' && option.value === '1')} onChange={() =>{  onChange(field.id, option.value) }} />{t(option.label)}</label>)}</div>
              : field.kind === 'knowledge' ? <div className={css.checkList} id={id}>{knowledge.map(item => <label key={item.id}><input type="checkbox" disabled={locked} checked={value.split(',').includes(item.id)} onChange={(event) =>{  onChange(field.id, (event.target.checked ? [...value.split(',').filter(Boolean), item.id] : value.split(',').filter(key => key !== item.id)).join(',')) }} />{item.title}</label>)}<small>{t(resourceCopy.selectKnowledgeHint)}</small></div>
                : field.kind === 'range' ? <div className={css.range}><input id={id} type="range" min={field.min} max={field.max} step={field.step ?? 1} value={value} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} /><input type="number" aria-label={t(field.label)} min={field.min} max={field.max} step={field.step ?? 1} value={value} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} /></div>
                  : field.kind === 'image' ? <><label className={css.imagePicker} htmlFor={id}>{value ? <img src={value} alt="" /> : <IconPlusOutlineRegular size={24} />}<input id={id} type="file" accept="image/*" disabled={locked} onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => { if (typeof reader.result === 'string') onChange(field.id, reader.result) }
                    reader.readAsDataURL(file)
                  }} /></label><small>{t(resourceCopy[form.startsWith('knowledge') ? 'coverSize' : 'avatarSize'])}</small></>
                    : <Input id={id} type={field.id === 'api_token' || field.id === 'password' ? 'password' : 'text'} value={value} required={field.required} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} />}
        {savedOnly && <small>{t(field.id === 'model_id' ? 'employeeWindowModel' : 'employeeSavedOnly')}</small>}
        {field.locked && <small>{t(resourceCopy.modelLocked)}</small>}
      </div>
    </div>
  })}</div>
}
