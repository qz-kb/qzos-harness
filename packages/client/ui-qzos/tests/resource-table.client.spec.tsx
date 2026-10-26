// @vitest-environment jsdom
/** Pagination preserves selections outside the visible page. */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ResourceTable } from '../src/client/ResourceTable.tsx'
afterEach(cleanup)
it('selects only the current page and retains prior selections', () => {
  const rows = Array.from({ length: 16 }, (_, index) => ({ id: String(index + 1), name: `fragment-${index + 1}` }))
  const change = vi.fn()
  const view = render(<ResourceTable paginate rows={rows} columns={[[ 'name', 'name' ]]} r={key => key} selection={['1']} onSelection={change} />)
  fireEvent.click(screen.getByRole('button', { name: 'next' }))
  expect(screen.queryByRole('cell', { name: 'fragment-1' })).toBeNull()
  expect(screen.getByRole('cell', { name: 'fragment-16' })).toBeDefined()
  fireEvent.click(screen.getByRole('checkbox', { name: 'all' }))
  expect(change).toHaveBeenCalledWith(['1', '16'])
  view.rerender(<ResourceTable paginate rows={rows.slice(0, 1)} columns={[[ 'name', 'name' ]]} r={key => key} />)
  expect(screen.getByRole('cell', { name: 'fragment-1' })).toBeDefined()
  expect((screen.getByRole('button', { name: 'next' }) as HTMLButtonElement).disabled).toBe(true)
})
