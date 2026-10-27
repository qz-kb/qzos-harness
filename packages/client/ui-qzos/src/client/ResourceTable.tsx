/** Table layout shared only by the reproduced QZOS resource views. */
import { useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PreviewRow } from './resource-fixtures.ts'
import type { ResourceText } from './resource-copy.ts'
import css from './Resources.module.css'

export type ResourceTableProps = {
  loading?: boolean
  paginate?: boolean
  page?: number
  total?: number
  pageSize?: number
  onPage?: (page: number) => void
  rows: readonly PreviewRow[]
  columns: readonly (readonly [string, ResourceText])[]
  r: (key: ResourceText) => string
  cell?: (row: PreviewRow, key: string) => ReactNode
  onOpen?: (row: PreviewRow) => void
  actions?: (row: PreviewRow) => readonly { label: ResourceText; run: () => void; disabled?: boolean }[]
  selection?: readonly string[]
  onSelection?: (ids: string[]) => void
}
/** Render the source page's columns and per-row commands, with local or server-owned paging.
 * @param props.page - Server page when `onPage` is supplied.
 * @param props.total - Server total; defaults to the visible rows.
 * @param props.onPage - Switches to controlled server paging.
 */
export function ResourceTable({
  rows, columns, r, cell, onOpen, actions, selection, onSelection, paginate = false, loading = false,
  page, total, pageSize = 15, onPage,
}: ResourceTableProps) {
  const [localPage, setLocalPage] = useState(1)
  const rowTotal = total ?? rows.length
  const pages = Math.max(1, paginate ? Math.ceil(rowTotal / pageSize) : 1)
  const current = Math.min(onPage ? page ?? 1 : localPage, pages)
  const visible = onPage || !paginate ? rows : rows.slice((current - 1) * pageSize, current * pageSize)
  const go = (next: number) => {
    const target = Math.min(pages, Math.max(1, next))
    if (onPage) onPage(target)
    else setLocalPage(target)
  }
  return <><div className={css.tableWrap} aria-busy={loading}><table className={css.table}><thead><tr>
    {onSelection && <th><input type="checkbox" aria-label={r('all')} checked={visible.length > 0 && visible.every(row => selection?.includes(row.id))} onChange={(event) =>{  onSelection(event.target.checked ? [...new Set([...(selection ?? []), ...visible.map(row => row.id)])] : (selection ?? []).filter(id => !visible.some(row => row.id === id))) }} /></th>}
    {columns.map(([key, label]) => <th key={key}>{r(label)}</th>)}{actions && <th>{r('operations')}</th>}
  </tr></thead><tbody>{visible.map(row => <tr key={row.id}>
    {onSelection && <td><input type="checkbox" aria-label={`${r('selected')} · ${row.name}`} checked={selection?.includes(row.id) ?? false} onChange={(event) =>{  onSelection(event.target.checked ? [...selection ?? [], row.id] : (selection ?? []).filter(id => id !== row.id)) }} /></td>}
    {columns.map(([key], index) => <td key={key}>{index === 0 && onOpen ? <button type="button" className={css.link} onClick={() =>{  onOpen(row) }}>{cell?.(row, key) ?? row[key] ?? '—'}</button> : cell?.(row, key) ?? row[key] ?? '—'}{key === 'name' && row.parseState && <small className={css.fileProgress}>{row.parseState}</small>}{key === 'name' && row.status === 'processing' && <div className={css.fileProgress}><span>{r('processing')}</span><progress aria-label={`${r('processing')} · ${row.name}`} /></div>}</td>)}
    {actions && <td><div className={css.rowActions}>
      {actions(row).map(action => <Button key={action.label} disabled={action.disabled} onClick={action.run}>{r(action.label)}</Button>)}
    </div></td>}
  </tr>)}</tbody></table>{loading ? <div className={css.tableSkeleton} role="status" /> : rows.length === 0 && <p className={css.empty}>{r('empty')}</p>}</div>
  {!loading && <div className={css.pagination}><span>{r('total')} {rowTotal}</span><Button disabled={current === 1} onClick={() => { go(current - 1) }}>{r('previous')}</Button><span>{current} / {pages}</span><Button disabled={current === pages} onClick={() => { go(current + 1) }}>{r('next')}</Button></div>}</>
}
