// @vitest-environment jsdom
/** Menu images obey the source form's limits and respect read-only viewing. */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EmployeeMenuImages } from '../src/client/EmployeeMenuImages.tsx'
import type {} from '../src/client/index.ts'
import { zh, type QzosKey } from '../src/client/locales.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
const t: PropsLocale<'qzos'>['t'] = key => key in zh ? zh[key as QzosKey] : key
afterEach(cleanup)
it('adds valid images to the existing draft and keeps confirmation busy until reading finishes', async () => {
  const change = vi.fn(), busy = vi.fn()
  render(<EmployeeMenuImages images={['/existing.png']} onChange={change} onBusy={busy} disabled={false} t={t} />)
  fireEvent.change(screen.getByLabelText('上传图片'), { target: { files: [new File(['image'], 'new.png', { type: 'image/png' })] } })
  expect(busy).toHaveBeenCalledWith(true)
  await waitFor(() => { expect(change).toHaveBeenCalledWith(['/existing.png', expect.stringMatching(/^data:image\/png;base64,/)]) })
  expect(busy).toHaveBeenLastCalledWith(false)
})
it('rejects too many images and prevents edits in the view dialog', () => {
  const change = vi.fn()
  const view = render(<EmployeeMenuImages images={Array.from({ length: 8 }, (_, i) => `/${i}.png`)} onChange={change} onBusy={() => {}} disabled={false} t={t} />)
  fireEvent.change(screen.getByLabelText('上传图片'), { target: { files: Array.from({ length: 2 }, () => new File(['image'], 'new.png', { type: 'image/png' })) } })
  expect(screen.getByRole('alert')).toBeDefined()
  expect(change).not.toHaveBeenCalled()
  view.rerender(<EmployeeMenuImages images={['/existing.png']} onChange={change} onBusy={() => {}} disabled t={t} />)
  expect(screen.queryByLabelText('上传图片')).toBeNull()
  expect((screen.getByRole<HTMLButtonElement>('button')).disabled).toBe(true)
})
