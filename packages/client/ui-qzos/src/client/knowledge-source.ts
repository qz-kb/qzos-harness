/** Readable source coordinates from the server's verified parse location. */
import { loginRecord, type LoginRecord } from './login-client.ts'
import { knowledgeRows, knowledgeText } from './knowledge-client.ts'

/** Localized names supplied by the owning view. */
export interface SourceLabels { page: string; slide: string; sheet: string; cells: string; paragraph: string; missing: string }

/** Format only explicit source coordinates; never infer a page from result order.
 * @param location - Verified parse location or one review source reference.
 * @param labels - Localized coordinate names.
 * @returns Human-readable coordinates, or an explicit missing-location label.
 */
export function sourceLocation(location: LoginRecord, labels: SourceLabels): string {
  const refs = Array.isArray(location.source_refs) ? knowledgeRows(location.source_refs) : [location]
  const coordinates: [string, string][] = [
    ['page', labels.page], ['slide', labels.slide], ['sheet', labels.sheet], ['cell_range', labels.cells], ['paragraph', labels.paragraph],
  ]
  return [...new Set(refs.map(ref => coordinates.map(([key, label]) => { const value = knowledgeText(ref[key]); return value ? `${label} ${value}` : '' }).filter(Boolean).join(' · ')).filter(Boolean))].join(' / ') || labels.missing
}

/** Format an authorized search hit without rendering raw retrieval JSON.
 * @param hit - Search result returned by QZOS.
 * @param labels - Localized coordinate names.
 * @returns File identity, version, fragment identity and explicit coordinates.
 */
export function sourceCitation(hit: LoginRecord, labels: SourceLabels): string {
  const file = loginRecord(hit.file ?? {})
  return [knowledgeText(file.name), hit.fd_id ? `#${knowledgeText(hit.fd_id)}` : '', hit.version ? `v${knowledgeText(hit.version)}` : '',
    sourceLocation(loginRecord(hit.parse_location ?? {}), labels), knowledgeText(hit.uuid)].filter(Boolean).join(' · ')
}
