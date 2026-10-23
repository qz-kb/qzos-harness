/** Source citations retain exact server coordinates and mark absent locations. */
import { expect, it } from 'vitest'
import { sourceCitation, sourceLocation } from '../src/client/knowledge-source.ts'
const labels = { page: '页码', slide: '幻灯片', sheet: '工作表', cells: '单元格', paragraph: '段落', missing: '未提供精确位置' }
it('renders PDF, slides and spreadsheet ranges without inventing positions', () => {
  expect(sourceLocation({ source_refs: [{ page: 3 }, { page: 3 }, { slide: 2 }, { sheet: '预算', cell_range: 'B2:C9' }] }, labels)).toBe('页码 3 / 幻灯片 2 / 工作表 预算 · 单元格 B2:C9')
  expect(sourceCitation({ fd_id: 8, version: 2, uuid: 'fragment-1', file: { name: '政策.pdf' }, parse_location: { source_refs: [{ page: 3 }] } }, labels)).toBe('政策.pdf · #8 · v2 · 页码 3 · fragment-1')
  expect(sourceCitation({ file: { name: 'legacy' } }, labels)).toBe('legacy · 未提供精确位置')
})
