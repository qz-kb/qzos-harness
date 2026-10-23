/** Candidate reads and revision-bound writes for the QZOS document service. */
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import { loginRecord, type LoginRecord } from './login-client.ts'
import { sourceLocation, type SourceLabels } from './knowledge-source.ts'
import { knowledgeRows, knowledgeText } from './knowledge-client.ts'

/** Candidate actions advertised by the server. */
export type ParseAction = 'review' | 'retry' | 'cancel' | 'continue' | 'replace' | 'correct'
/** Account-bound transport used for candidate writes and readback. */
export type ParseCall = (path: string, body?: LoginRecord | FormData) => Promise<unknown>
/** Immutable payload retained across an unknown delivery outcome. */
export interface ParseOperation { path: string; body: LoginRecord }
/** Editable facts paired with their uneditable source identity. */
export interface ReviewField { key: string; label: string; identity: LoginRecord; values: Record<string, string> }

/** Build an immutable operation from the displayed server revision and allowed actions.
 * @param status - Current server status, never inferred from a file's learned count.
 * @param action - Requested candidate action.
 * @param extra - Review changes or replacement object.
 * @returns Request retained unchanged when delivery has an unknown outcome.
 */
export function parseOperation(status: LoginRecord, action: ParseAction, extra: LoginRecord = {}): ParseOperation {
  const processing = status.processing ? loginRecord(status.processing) : null
  if (processing) {
    if (!Array.isArray(processing.actions) || !processing.actions.includes(action) || !Number.isInteger(processing.revision)) throw new Error('候选状态已改变，请刷新后重试')
  } else if (action !== 'retry' || status.can_retry !== true) throw new Error('当前资料不允许此操作')
  const endpoint = { review: 'parseReview', retry: 'parseRetry', cancel: 'parseCancel', continue: 'parseContinue', replace: 'parseReplace', correct: 'parseCorrect' }[action]
  if (action === 'correct' && (!Number.isInteger(status.current_version) || Number(status.current_version) < 1)) throw new Error('当前有效版本不可纠错')
  return { path: `/kb.teach/${endpoint}`, body: {
    ...extra, kb_id: Number(status.kb_id), fd_id: Number(status.fd_id),
    ...action === 'correct' ? { expected_version: status.current_version, request_id: randomUUID() } : processing ? { job_key: knowledgeText(status.job_key), expected_revision: processing.revision, request_id: randomUUID() } : {},
  } }
}

/** Read back the authoritative status after an accepted operation.
 * @param call - Account-bound transport.
 * @param operation - Frozen operation, reusable only with identical payload.
 * @returns Fresh status, not an optimistic receipt.
 */
export async function submitParse(call: ParseCall, operation: ParseOperation): Promise<LoginRecord> {
  await call(operation.path, operation.body)
  return loginRecord(await call(`/kb.teach/parseStatus?kb_id=${knowledgeText(operation.body.kb_id)}&fd_id=${knowledgeText(operation.body.fd_id)}`))
}

/** Project editable facts without allowing source locations or table topology to change.
 * @param result - Server review result.
 * @param labels - Localized source coordinate names.
 * @returns Text, cell and chart fact controls with immutable identities.
 */
export function reviewFields(result: LoginRecord, labels: SourceLabels): ReviewField[] {
  return knowledgeRows(result.elements).flatMap<ReviewField>((element) => {
    const id = knowledgeText(element.id)
    const data = loginRecord(element.data)
    const refs = Array.isArray(element.source_refs) ? knowledgeRows(element.source_refs) : []
    const label = sourceLocation({ source_refs: refs }, labels)
    if (element.type === 'text' || element.type === 'image_text') return [{ key: id, label, identity: { element_id: id }, values: { text: knowledgeText(data.text) } }]
    if (element.type === 'table') return knowledgeRows(data.cells).map(cell => ({
      key: `${id}:${knowledgeText(cell.row)}:${knowledgeText(cell.col)}`, label: `${cell.source_refs ? sourceLocation(cell, labels) : label} [${knowledgeText(cell.row)}, ${knowledgeText(cell.col)}]`,
      identity: { element_id: id, row: Number(cell.row), col: Number(cell.col) },
      values: { value: knowledgeText(cell.value), display_text: knowledgeText(cell.display_text) },
    }))
    if (element.type === 'chart') return knowledgeRows(data.series).flatMap((series, index) => knowledgeRows(series.points).map(point => ({
      key: `${id}:${index}:${knowledgeText(point.index)}`, label: `${label} / ${knowledgeText(series.name)} / ${knowledgeText(point.category)}`,
      identity: { element_id: id, series: index, index: Number(point.index) },
      values: { value: knowledgeText(point.value), category: knowledgeText(point.category), unit: knowledgeText(series.unit) },
    })))
    return []
  })
}

/** Emit only changed facts and explicit missing-content corrections.
 * @param fields - Original facts from the current review revision.
 * @param drafts - Locally edited values keyed by fact identity.
 * @param issues - Server issue list.
 * @param corrections - Missing content supplied by the reviewer.
 * @returns Contract-compatible changes; the server still validates resolved issues.
 */
export function reviewChanges(
  fields: ReviewField[], drafts: Record<string, Record<string, string>>,
  issues: LoginRecord[], corrections: Record<string, string>,
): LoginRecord[] {
  return [
    ...fields.filter(field => drafts[field.key] && Object.keys(field.values).some(key => drafts[field.key]?.[key] !== field.values[key]))
      .map(field => ({ ...field.identity, ...drafts[field.key] })),
    ...issues.filter(issue => corrections[knowledgeText(issue.id)]?.trim())
      .map(issue => ({ issue_id: knowledgeText(issue.id), text: corrections[knowledgeText(issue.id)] })),
  ]
}
