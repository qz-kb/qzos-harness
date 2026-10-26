/** QZOS form controls adapted to the existing DSH UI primitives. */
import { Fragment, useId, useState } from 'react'
import { Button, Input, IconPlusOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { resourceForms, type ResourceForm, type PreviewValues, type PreviewField } from './resource-schema.ts'
import { employeeCopyrightExample } from './resource-artwork.ts'
import { resourceCopy } from './resource-copy.ts'
import type { Example } from './catalog.ts'
import css from './Resources.module.css'

type FormProps = PropsLocale<'qzos'> & {
  form: ResourceForm
  draft: PreviewValues
  onChange: (key: string, value: string) => void
  knowledge: readonly Example[]
  options?: Record<string, { value: string; label: string; disabled?: boolean }[]>
  onCreateKnowledge?: (() => void) | undefined
  onRefreshKnowledge?: (() => void) | undefined
  knowledgeLoading?: boolean
  knowledgeError?: string | undefined
  editing?: boolean
  disabled?: boolean
  disabledFields?: readonly string[]
}

/** Render original QZOS field order, option sets and conditional fields. */
export function ResourceFields({
  form, draft, onChange, knowledge, editing, disabled, disabledFields, options,
  onCreateKnowledge, onRefreshKnowledge, knowledgeLoading, knowledgeError, t,
}: FormProps) {
  const prefix = useId()
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const fields: readonly PreviewField[] = resourceForms[form]
  return <div data-form={form} className={`${css.formFields} ${form === 'knowledgeSettings' || form === 'employeeCreate' ? css.topLabels : ''} ${form === 'fragment' ? css.fragmentFields : ''}`}>{fields.map((field) => {
    if (form === 'menu' && field.id === 'images') return null
    if (field.when && draft[field.when[0]] !== field.when[1]) return null
    if (field.unless && draft[field.unless[0]] === field.unless[1]) return null
    const id = `${prefix}-${field.id}`
    const value = draft[field.id] ?? field.initial
    const locked = disabled || disabledFields?.includes(field.id) || (editing && field.locked) || (form === 'employeeFlow' && field.id !== 'flow_status')
    const savedOnly = form.startsWith('employee') && ['model_id', 'context_num', 'search_empty_type', 'search_empty_text', 'support_file', 'icons', 'is_show_context', 'is_show_quote', 'is_show_feedback', 'related_issues_num', 'welcome_introducer', 'copyright'].includes(field.id)
    const group = form === 'employeeSearch' ? ({ search_mode: 'employeeRecallGroup', ranking_status: 'employeeRerankGroup', optimize_ask: 'employeeOptimizeGroup' } as const)[field.id as 'search_mode' | 'ranking_status' | 'optimize_ask'] : undefined
    return <Fragment key={field.id}>
      {group && <>{field.id === 'search_mode' && <p className={css.recallNotice}>{t('employeeRecallHint')}</p>}<h3 className={css.fieldGroup}>{t(group)}</h3></>}
      <div className={css.formRow}>
        <label htmlFor={id}>{field.required && field.id !== 'model_id' && <span className={css.required} aria-hidden="true">*</span>}{t(field.id === 'model_id' ? 'employeeBackendModel' : field.label)}{form.startsWith('knowledge') && ['embedding_model_id', 'documents_model_id'].includes(field.id) && <span aria-hidden="true" className={css.fieldHelp} title={t(field.id === 'embedding_model_id' ? 'knowledgeVectorHint' : 'knowledgeDocumentHint')}>?</span>}</label>
        <div className={css.formControl}>
          {field.id === 'external_enabled' || field.id === 'optimize_ask' ? <div className={css.switchRow}><button id={id} type="button" role="switch" aria-checked={value === '1'} disabled={locked} className={css.switchControl} onClick={() => { onChange(field.id, value === '1' ? '0' : '1') }} />{field.id === 'external_enabled' && <small>{t(resourceCopy.enabledExternalHint)}</small>}</div>
            : field.kind === 'textarea' ? <textarea id={id} placeholder={field.id === 'roles_prompt' ? t('employeeRolePlaceholder') : form.startsWith('knowledge') ? t('knowledgeIntroPlaceholder') : form === 'fragment' ? t(field.id === 'question' ? 'knowledgeDocumentPlaceholder' : 'knowledgeAnswerPlaceholder') : undefined} rows={form === 'menu' && field.id === 'content' ? 8 : form === 'fragment' ? 10 : form === 'knowledgeSettings' ? 5 : field.id === 'welcome_introducer' ? 8 : 3} value={value} maxLength={form === 'menu' ? 3000 : field.id === 'intro' && form.startsWith('employee') ? 200 : undefined} required={field.required} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} />
              : field.kind === 'select' ? <select id={id} required={field.id === 'model_id' ? false : field.required} value={value} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }}>{options?.[field.id] ? <><option value="">—</option>{value && !options[field.id]?.some(option => option.value === value) && <option value={value} disabled>{t('employeeModelUnavailable')}</option>}{options[field.id]?.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</> : field.options?.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>
                : field.kind === 'radio' ? <div className={css.radioGroup} role="group" aria-label={t(field.label)}>{field.options?.map(option => <label key={option.value}><input type="radio" name={id} checked={value === option.value} value={option.value} disabled={locked || (form === 'employeeFlow' && option.value === '1')} onChange={() =>{  onChange(field.id, option.value) }} />{t(option.label)}</label>)}</div>
                  : field.kind === 'knowledge' ? <div><details className={css.knowledgeSelect}><summary id={id} aria-label={t(field.label)}>{value.split(',').filter(Boolean).map(key => knowledge.find(item => item.id === key)?.title ?? key).join('、') || t('employeeChooseKnowledge')}</summary><div className={css.checkList}><Input aria-label={t('searchKnowledge')} placeholder={t('searchKnowledge')} disabled={locked || knowledgeLoading} value={knowledgeSearch} onChange={(event) => { setKnowledgeSearch(event.target.value) }} />{knowledge.filter(item => item.title.toLowerCase().includes(knowledgeSearch.toLowerCase())).map(item => <label key={item.id}><input type="checkbox" disabled={locked || knowledgeLoading} checked={value.split(',').includes(item.id)} onChange={(event) =>{ onChange(field.id, (event.target.checked ? [...value.split(',').filter(Boolean), item.id] : value.split(',').filter(key => key !== item.id)).join(',')) }} />{item.title}</label>)}</div></details><div className={css.knowledgeLinks}>{onCreateKnowledge && <Button type="button" disabled={locked} onClick={onCreateKnowledge}>{t(resourceCopy.newKnowledge)}</Button>}{onRefreshKnowledge && <Button type="button" disabled={knowledgeLoading} onClick={onRefreshKnowledge}>{t('employeeRefreshKnowledge')}</Button>}</div>{knowledgeLoading ? <small role="status">{t('catalogLoading')}</small> : knowledgeError ? <small role="alert">{knowledgeError}</small> : knowledge.length === 0 ? <small>{t('noKnowledgeToLink')}</small> : null}<small>{t(resourceCopy.selectKnowledgeHint)}</small></div>
                    : field.kind === 'range' ? <div className={css.range}><input id={id} type="range" min={field.min} max={field.max} step={field.step ?? 1} value={value} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} /><div className={css.numberStepper}><Button type="button" aria-label={`${t('employeeMoveDown')} · ${t(field.label)}`} disabled={locked || Number(value) <= (field.min ?? 0)} onClick={() => { onChange(field.id, String(Math.max(field.min ?? 0, Number((Number(value) - (field.step ?? 1)).toFixed(2))))) }}>−</Button><input type="number" aria-label={t(field.label)} min={field.min} max={field.max} step={field.step ?? 1} value={value} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} /><Button type="button" aria-label={`${t('employeeMoveUp')} · ${t(field.label)}`} disabled={locked || Number(value) >= (field.max ?? Infinity)} onClick={() => { onChange(field.id, String(Math.min(field.max ?? Infinity, Number((Number(value) + (field.step ?? 1)).toFixed(2))))) }}>+</Button></div></div>
                      : field.kind === 'image' ? <><label className={css.imagePicker} htmlFor={id}>{value ? <img src={value} alt="" /> : <IconPlusOutlineRegular size={24} />}<input id={id} type="file" accept="image/*" required={field.required && field.id !== 'model_id' && !value} disabled={locked} onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = () => { if (typeof reader.result === 'string') onChange(field.id, reader.result) }
                        reader.readAsDataURL(file)
                      }} /></label><small>{t(resourceCopy[form.startsWith('knowledge') ? 'coverSize' : 'avatarSize'])}</small></>
                        : <Input id={id} type={field.id === 'api_token' || field.id === 'password' ? 'password' : 'text'} value={value} placeholder={form === 'employeeCreate' ? t(field.id === 'name' ? 'employeeNamePlaceholder' : 'employeeIntroPlaceholder') : form === 'knowledgeCreate' && field.id === 'name' ? t('knowledgeNamePlaceholder') : undefined} required={field.required} maxLength={field.id === 'keyword' ? 20 : field.id === 'name' ? 100 : field.id === 'intro' ? 200 : undefined} disabled={locked} onChange={(event) =>{  onChange(field.id, event.target.value) }} />}
          {form.startsWith('employee') && ['temperature', 'ranking_status', 'ranking_score', 'ranking_model', 'optimize_ask', 'optimize_m_id'].includes(field.id) && <small>{t('employeeNextTurn')}</small>}
          {(form === 'menu' || (form === 'employeeBase' && field.id === 'intro')) && <small className={css.characterCount}>{value.length} / {field.id === 'keyword' ? 20 : field.id === 'content' ? 3000 : 200}</small>}
          {savedOnly && <small>{t(field.id === 'model_id' ? 'employeeWindowModel' : 'employeeSavedOnly')}</small>}
          {field.locked && !form.startsWith('knowledge') && <small>{t(editing ? resourceCopy.modelLocked : 'backendModelDefault')}</small>}
          {field.id === 'welcome_introducer' && <small>{t('employeeWelcomeHint')}</small>}
          {field.id === 'copyright' && <><small>{t('employeeCopyrightHint')}</small><details className={css.footerExample}><summary>{t('employeeShowExample')}</summary><img src={employeeCopyrightExample} alt={t('employeeShowExample')} /></details></>}
        </div>
      </div></Fragment>
  })}</div>
}
