// @vitest-environment jsdom
/** Creation controls preserve QZOS field order and expose the missing-knowledge path. */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ResourceFields } from '../src/client/ResourceForms.tsx'
import type {} from '../src/client/index.ts'
import { zh, type QzosKey } from '../src/client/locales.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
const t: PropsLocale<'qzos'>['t'] = key => key in zh ? zh[key as QzosKey] : key
afterEach(cleanup)
it('offers knowledge creation with no libraries and labels the backend model separately from the DSH work-window model', () => {
  const create = vi.fn()
  render(<ResourceFields form="employeeCreate" draft={{ name: '员工草稿', roles_prompt: '职责草稿' }} knowledge={[]} onChange={() => {}} onCreateKnowledge={create} t={t} />)
  expect(screen.getByText('还没有可关联的知识库，可以先新建一个。')).toBeDefined()
  fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: '新增知识库' }))
  expect(create).toHaveBeenCalledTimes(1)
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '后台对话模型' })).toBeDefined()
  expect(screen.getByText(zh.employeeWindowModel)).toBeDefined()
  fireEvent.click(screen.getByText('选择可使用的知识库，也可稍后配置'))
  expect((screen.getByRole<HTMLInputElement>('textbox', { name: '名称' })).value).toBe('员工草稿')
  expect(screen.getAllByRole('textbox').map(input => input.getAttribute('placeholder'))).toMatchInlineSnapshot(`
    [
      "例如：制度问答专员",
      "查制度，附出处",
      "说明负责的工作，以及找不到依据时如何回答。",
      "搜索知识库",
    ]
  `)
})
it('filters authorized libraries and retains selection when searching', () => {
  const change = vi.fn()
  const knowledge = ['制度', '产品'].map((title, i) => ({ id: String(i + 1), title, description: '', category: '', content: '', status: 'ready' as const, scope: 'owned' as const }))
  render(<ResourceFields form="employeeCreate" draft={{ kb_ids: '1' }} knowledge={knowledge} onChange={change} t={t} />)
  fireEvent.click(screen.getByText('制度', { selector: 'summary' }))
  fireEvent.change(screen.getByRole<HTMLInputElement>('textbox', { name: '搜索知识库' }), { target: { value: '产品' } })
  expect(screen.queryByRole('checkbox', { name: '制度' })).toBeNull()
  fireEvent.click(screen.getByRole<HTMLInputElement>('checkbox', { name: '产品' }))
  expect(change).toHaveBeenCalledWith('kb_ids', '1,2')
})
it('allows configured models at creation and keeps only the existing vector model locked in settings', () => {
  const change = vi.fn()
  const options = { embedding_model_id: [{ value: '1', label: '默认向量' }, { value: '2', label: '其他向量' }], documents_model_id: [{ value: '3:31', label: '默认文件模型' }, { value: '4:41', label: '其他文件模型' }, { value: '5:51', label: '不可用模型', disabled: true }] }
  const draft = { embedding_model_id: '1', documents_model_id: '3:31' }
  const view = render(<ResourceFields form="knowledgeCreate" draft={draft} options={options} knowledge={[]} onChange={change} t={t} />)
  expect((screen.getByRole<HTMLSelectElement>('combobox', { name: '向量模型' })).disabled).toBe(false)
  fireEvent.change(screen.getByRole<HTMLSelectElement>('combobox', { name: '文件处理模型' }), { target: { value: '4:41' } })
  expect(change).toHaveBeenCalledWith('documents_model_id', '4:41')
  expect((screen.getByRole<HTMLOptionElement>('option', { name: '不可用模型' })).disabled).toBe(true)
  view.rerender(<ResourceFields form="knowledgeSettings" draft={draft} options={options} knowledge={[]} onChange={change} t={t} editing />)
  expect((screen.getByRole<HTMLSelectElement>('combobox', { name: '向量模型' })).disabled).toBe(true)
  expect((screen.getByRole<HTMLSelectElement>('combobox', { name: '文件处理模型' })).disabled).toBe(false)
  fireEvent.click(screen.getByRole('switch', { name: '允许对外数字员工使用' }))
  expect(change).toHaveBeenCalledWith('external_enabled', '1')
})

it('blocks linking and nested creation when the account cannot manage the dependency', () => {
  render(<ResourceFields form="employeeBase" draft={{ kb_ids: '1' }} knowledge={[{ id: '1', title: '制度', category: '', content: '', description: '', status: 'ready' }]} onChange={() => {}} onCreateKnowledge={() => {}} disabledFields={['kb_ids']} t={t} />)
  fireEvent.click(screen.getByText('制度', { selector: 'summary' }))
  expect((screen.getByRole<HTMLInputElement>('checkbox', { name: '制度' })).disabled).toBe(true)
  expect((screen.getByRole<HTMLButtonElement>('button', { name: '新增知识库' })).disabled).toBe(true)
})
