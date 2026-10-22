/** Candidate edits keep server identities and unknown deliveries intact. */
import { expect, it, vi } from 'vitest'
import { parseOperation, submitParse, reviewChanges, reviewFields } from '../src/client/knowledge-parse.ts'

const status = { kb_id: 2, fd_id: 9, job_key: 'candidate-one', status: 2, current_version: 1, candidate_version: 2, processing: { revision: 4, actions: ['review', 'retry', 'cancel'], stage: 'review' } }
it('uses candidate actions and integer revision even when parsing already succeeded', () => {
  const operation = parseOperation(status, 'review', { confirm: true, changes: [], confirm_issue_ids: [] })
  expect(operation.body).toMatchObject({ kb_id: 2, fd_id: 9, job_key: 'candidate-one', expected_revision: 4, confirm: true })
  expect(operation.body.request_id).toMatch(/^[a-z0-9-]{8,128}$/)
  expect(() => parseOperation({ ...status, processing: { ...status.processing, actions: [] } }, 'cancel')).toThrow()
  expect(() => parseOperation({ ...status, processing: { ...status.processing, revision: '4' } }, 'review')).toThrow()
})
it('preserves an identical request after delivery loss and rereads authoritative status', async () => {
  const operation = parseOperation(status, 'cancel')
  const call = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({ accepted: true }).mockResolvedValueOnce({ ...status, processing: { cancelled: true } })
  await expect(submitParse(call, operation)).rejects.toThrow('connection lost')
  const result = await submitParse(call, operation)
  expect(call.mock.calls[0]).toEqual(call.mock.calls[1])
  expect(call.mock.calls[2]).toEqual(['/kb.teach/parseStatus?kb_id=2&fd_id=9'])
  expect(result.processing).toEqual({ cancelled: true })
})
it('does not report completion when the readback fails', async () => {
  const call = vi.fn().mockResolvedValueOnce({ status: 2 }).mockRejectedValueOnce(new Error('readback unavailable'))
  await expect(submitParse(call, parseOperation(status, 'review', { confirm: true }))).rejects.toThrow('readback unavailable')
})
it('supports legacy retry without pretending it has candidate revision semantics', () => {
  expect(parseOperation({ kb_id: 2, fd_id: 9, can_retry: true }, 'retry').body).toEqual({ kb_id: 2, fd_id: 9 })
  expect(() => parseOperation({ kb_id: 2, fd_id: 9, can_retry: false }, 'retry')).toThrow()
})
it('emits only edited facts, retaining cell and chart coordinates and real corrections', () => {
  const fields = reviewFields({ elements: [
    { id: 'text', type: 'text', data: { text: 'Old policy' } },
    { id: 'table', type: 'table', data: { cells: [{ row: 2, col: 3, value: '17', display_text: '17 days' }] } },
    { id: 'chart', type: 'chart', data: { series: [{ name: 'Series', unit: 'days', points: [{ index: 0, value: '17', category: 'May' }] }] } },
  ] })
  expect(reviewChanges(fields, {}, [], {})).toEqual([])
  expect(reviewChanges(fields, { text: { text: 'New policy' }, 'table:2:3': { value: '23', display_text: '23 days' }, 'chart:0:0': { value: '23', category: 'June', unit: 'days' } }, [{ id: 'missing' }], { missing: 'Approved on day 23' })).toEqual([
    { element_id: 'text', text: 'New policy' },
    { element_id: 'table', row: 2, col: 3, value: '23', display_text: '23 days' },
    { element_id: 'chart', series: 0, index: 0, value: '23', category: 'June', unit: 'days' },
    { issue_id: 'missing', text: 'Approved on day 23' },
  ])
})
