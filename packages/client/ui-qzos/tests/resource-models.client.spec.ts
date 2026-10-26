/** Defaults follow backend readiness; conversation models stay outside employee creation. */
import { expect, it } from 'vitest'
import { resourceModelDefaults } from '../src/client/resource-models.ts'
import { employeeDraft, employeePayload } from '../src/client/employee-client.ts'
it('selects ready backend defaults for vectors, reranking and document processing', () => {
  expect(resourceModelDefaults({
    vectorModels: [{ id: 1, is_default: 1, is_ready: false }, { id: 2 }, { id: 3, is_default: 1 }],
    rankingModels: [{ id: 4 }, { id: 5, is_default: 1 }],
    chatModels: [{ id: 6, is_default: 1, models: [{ id: 61, is_ready: false }] }, { id: 7, models: [{ id: 71 }] }],
  })).toEqual({ embedding_model_id: '3', documents_model_id: '7:71', ranking_model: '5', ranking_status: '1' })
  expect(resourceModelDefaults({})).toEqual({ embedding_model_id: '', documents_model_id: '', ranking_model: '', ranking_status: '0' })
})
it('saves a window-only employee and preserves explicit visitor configuration on later edits', () => {
  const original = { id: 1, kb_ids: [], menus: [], flow_config: {}, model_id: 0, model_sub_id: 0 }
  expect(employeePayload(original, employeeDraft(original), [])).toMatchObject({ use_work_window_model: 1, model_id: 0, model_sub_id: 0 })
  const configured = { ...original, model_id: 12, model_sub_id: 13 }
  expect(employeePayload(configured, employeeDraft(configured), [])).toMatchObject({ model_id: 12, model_sub_id: 13 })
})
