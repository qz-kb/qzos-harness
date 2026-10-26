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
it('offers knowledge creation with no libraries and keeps the conversation model out of the form', () => {
  const create = vi.fn()
  render(<ResourceFields form="employeeCreate" draft={{ name: '员工草稿', roles_prompt: '职责草稿' }} knowledge={[]} onChange={() => {}} onCreateKnowledge={create} t={t} />)
  expect(screen.getByText('还没有可关联的知识库，可以先新建一个。')).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: '新增知识库' }))
  expect(create).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('combobox', { name: '对话模型' })).toBeNull()
  expect((screen.getByRole('textbox', { name: '名称' }) as HTMLInputElement).value).toBe('员工草稿')
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
  fireEvent.change(screen.getByRole('textbox', { name: '搜索知识库' }), { target: { value: '产品' } })
  expect(screen.queryByRole('checkbox', { name: '制度' })).toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: '产品' }))
  expect(change).toHaveBeenCalledWith('kb_ids', '1,2')
})
