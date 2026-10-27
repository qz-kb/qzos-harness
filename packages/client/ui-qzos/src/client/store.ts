/** Browser-only catalog viewing state; native DSH owns all conversations and drafts. */
import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { Panel } from './catalog.ts'

interface CatalogState {
  businessUser: string | null
  businessEpoch: number
  knowledgeRevision: number
  queries: Partial<Record<Panel, string>>
  filters: Partial<Record<Panel, string>>
  details: Partial<Record<Panel, string | null>>
  sections: Partial<Record<Panel, string | null>>
}

/** Create panel-local selections shared across navigation.
 * @returns A handle bound by the slot renderer.
 */
export function createQzosStore() {
  return defineStore({
    init: (): CatalogState => ({ businessUser: null, businessEpoch: 0, knowledgeRevision: 0, queries: {}, filters: {}, details: {}, sections: {} }),
    actions: {
      businessIdentity: (state, id: string | null) => {
        if (state.businessUser === id) return
        state.businessUser = id; state.businessEpoch++; state.knowledgeRevision++
        state.details.knowledge = null; state.details.employees = null
      },
      refreshKnowledge: (state) => { state.knowledgeRevision++ },
      setQuery: (state, panel: Panel, value: string) => { state.queries[panel] = value },
      setFilter: (state, panel: Panel, value: string) => { state.filters[panel] = value },
      setDetail: (state, panel: Panel, value: string | null) => { state.details[panel] = value; state.sections[panel] = null },
      setSection: (state, panel: Panel, value: string) => { state.sections[panel] = value },
    },
  })
}
