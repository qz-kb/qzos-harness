/** Table layout shared only by the reproduced QZOS resource views. */
import { useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PreviewRow } from './resource-fixtures.ts'
import type { ResourceText } from './resource-copy.ts'
import css from './Resources.module.css'

export type ResourceTableProps = {
  loading?: boolean
  paginate?: boolean
  rows: readonly PreviewRow[]
  columns: readonly (readonly [string, ResourceText])[]
  r: (key: ResourceText) => string
  cell?: (row: PreviewRow, key: string) => ReactNode
  onOpen?: (row: PreviewRow) => void
  actions?: (row: PreviewRow) => readonly { label: ResourceText; run: () => void; disabled?: boolean }[]
  selection?: readonly string[]
  onSelection?: (ids: string[]) => void
}
/** Render the source page's columns and per-row commands without business transport. */
export function ResourceTable({
  rows, columns, r, cell, onOpen, actions, selection, onSelection, paginate = false, loading = false,
}: ResourceTableProps) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, paginate ? Math.ceil(rows.length / 15) : 1)
  const current = Math.min(page, pages)
  const visible = paginate ? rows.slice((current - 1) * 15, current * 15) : rows
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
  {!loading && <div className={css.pagination}><span>{r('total')} {rows.length}</span><Button disabled={current === 1} onClick={() => { setPage(current - 1) }}>{r('previous')}</Button><span>{current} / {pages}</span><Button disabled={current === pages} onClick={() => { setPage(current + 1) }}>{r('next')}</Button></div>}</>
}
