/** Table layout shared only by the reproduced QZOS resource views. */
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PreviewRow } from './resource-fixtures.ts'
import type { ResourceText } from './resource-copy.ts'
import css from './Resources.module.css'

export type ResourceTableProps = {
  rows: readonly PreviewRow[]
  columns: readonly (readonly [string, ResourceText])[]
  r: (key: ResourceText) => string
  cell?: (row: PreviewRow, key: string) => string
  onOpen?: (row: PreviewRow) => void
  actions?: (row: PreviewRow) => readonly { label: ResourceText; run: () => void; disabled?: boolean }[]
  selection?: readonly string[]
  onSelection?: (ids: string[]) => void
}
/** Render the source page's columns and per-row commands without business transport. */
export function ResourceTable({ rows, columns, r, cell, onOpen, actions, selection, onSelection }: ResourceTableProps) {
  return <><div className={css.tableWrap}><table className={css.table}><thead><tr>
    {onSelection && <th><input type="checkbox" aria-label={r('all')} checked={rows.length > 0 && selection?.length === rows.length} onChange={(event) =>{  onSelection(event.target.checked ? rows.map(row => row.id) : []) }} /></th>}
    {columns.map(([key, label]) => <th key={key}>{r(label)}</th>)}{actions && <th>{r('operations')}</th>}
  </tr></thead><tbody>{rows.map(row => <tr key={row.id}>
    {onSelection && <td><input type="checkbox" aria-label={`${r('selected')} · ${row.name}`} checked={selection?.includes(row.id) ?? false} onChange={(event) =>{  onSelection(event.target.checked ? [...selection ?? [], row.id] : (selection ?? []).filter(id => id !== row.id)) }} /></td>}
    {columns.map(([key], index) => <td key={key}>{index === 0 && onOpen ? <button type="button" className={css.link} onClick={() =>{  onOpen(row) }}>{cell?.(row, key) ?? row[key] ?? '—'}</button> : cell?.(row, key) ?? row[key] ?? '—'}{key === 'name' && row.status === 'processing' && <div className={css.fileProgress}><span>{r('processing')}</span><progress aria-label={`${r('processing')} · ${row.name}`} /></div>}</td>)}
    {actions && <td><div className={css.rowActions}>
      {actions(row).map(action => <Button key={action.label} disabled={action.disabled} onClick={action.run}>{r(action.label)}</Button>)}
    </div></td>}
  </tr>)}</tbody></table>{rows.length === 0 && <p className={css.empty}>{r('empty')}</p>}</div>
  <div className={css.pagination}><span>{r('total')} {rows.length}</span><Button disabled>{r('previous')}</Button><span>1</span><Button disabled>{r('next')}</Button></div></>
}
