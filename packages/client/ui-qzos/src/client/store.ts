/** Browser-only catalog viewing state; native DSH owns all conversations and drafts. */
import { defineStore } from '@deepseek-ai/dsh-client-store'
import { catalogs, type Example, type Panel } from './catalog.ts'
import type { PreviewValues } from './resource-schema.ts'
import { documentExamples, fragmentExamples, memberExamples, dialogueExamples, type PreviewRow } from './resource-fixtures.ts'

interface CatalogState {
  businessUser: string | null
  businessEpoch: number
  knowledgeRevision: number
  knowledge: Example[]
  employees: Example[]
  resourceRows: Record<string, PreviewRow[]>
  sequence: number
  queries: Partial<Record<Panel, string>>
  filters: Partial<Record<Panel, string>>
  details: Partial<Record<Panel, string | null>>
  sections: Partial<Record<Panel, string | null>>
  previewState: 'normal' | 'loading' | 'error' | 'empty'
}

/** Create panel-local selections shared across navigation.
 * @returns A handle bound by the slot renderer.
 */
export function createQzosStore() {
  return defineStore({
    init: (): CatalogState => ({ businessUser: null, businessEpoch: 0, knowledgeRevision: 0, knowledge: catalogs.knowledge.map(item => ({ ...item })), employees: catalogs.employees.map(item => ({ ...item })), resourceRows: {}, sequence: 0, queries: {}, filters: {}, details: {}, sections: {}, previewState: 'normal' }),
    actions: {
      businessIdentity: (state, id: string | null) => {
        if (state.businessUser === id) return
        state.businessUser = id; state.businessEpoch++; state.knowledgeRevision++
        state.details.knowledge = null
      },
      refreshKnowledge: (state) => { state.knowledgeRevision++ },
      saveResource: (state, panel: 'knowledge' | 'employees', id: string | null, values: PreviewValues) => {
        const current = state[panel].find(item => item.id === id)
        if (current && (panel === 'employees' || current.scope === 'owned')) {
          current.title = values.name ?? current.title
          current.description = values.intro ?? current.description
          current.values = { ...values }
        } else if (id === null) {
          const resourceId = `${panel}-preview-${++state.sequence}`
          state[panel].unshift({ id: resourceId, title: values.name ?? '', description: values.intro ?? '', scope: panel === 'knowledge' ? 'owned' : 'private',
            category: panel === 'knowledge' ? '个人知识' : '数字员工', status: 'ready', metadata: panel === 'knowledge' ? '0 份资料' : '', content: '', values: { ...values } })
          state.filters[panel] = panel === 'knowledge' ? 'owned' : 'all'
          state.queries[panel] = ''
        }
      },
      deleteResource: (state, panel: 'knowledge' | 'employees', id: string) => {
        state[panel] = state[panel].filter(item => item.id !== id || (panel === 'knowledge' && item.scope !== 'owned'))
        if (state.details[panel] === id) state.details[panel] = null
      },
      transferKnowledge: (state, id: string, memberId: string) => {
        const knowledge = state.knowledge.find(item => item.id === id && item.scope === 'owned')
        const members = state.resourceRows[`${id}:members`] ?? []
        if (!knowledge || !members.some(member => member.id === memberId)) return
        knowledge.scope = 'shared'
        for (const member of members) {
          member.role = member.id === memberId ? 'owner' : 'member'
          member.power = member.id === memberId ? 'all' : 'manage'
        }
      },
      employeeStatus: (state, id: string, status: 'ready' | 'pending') => {
        const employee = state.employees.find(item => item.id === id)
        if (employee) employee.status = status
      },
      initializeRows: (state, key: string, kind: 'documents' | 'fragments' | 'members' | 'dialogues' | 'empty') => {
        if (state.resourceRows[key]) return
        const rows = kind === 'documents' ? documentExamples : kind === 'fragments' ? fragmentExamples : kind === 'members' ? memberExamples : kind === 'dialogues' ? dialogueExamples : []
        state.resourceRows[key] = (key.startsWith('employees-preview-') ? [] : key.startsWith('knowledge-preview-') ? kind === 'documents' || kind === 'members' ? rows.slice(0, 1) : [] : rows).map(row => ({ ...row }))
      },
      saveRow: (state, key: string, id: string | null, values: PreviewValues) => {
        const rows = state.resourceRows[key] ?? (state.resourceRows[key] = [])
        const row = rows.find(item => item.id === id)
        if (row) Object.assign(row, values)
        else rows.push({ ...values, id: `row-${++state.sequence}`, name: values.name ?? values.nickname ?? values.question ?? '' })
      },
      deleteRows: (state, key: string, ids: string[]) => {
        state.resourceRows[key] = (state.resourceRows[key] ?? []).filter(item => !ids.includes(item.id))
      },

      setQuery: (state, panel: Panel, value: string) => { state.queries[panel] = value },
      setFilter: (state, panel: Panel, value: string) => { state.filters[panel] = value },
      setDetail: (state, panel: Panel, value: string | null) => { state.details[panel] = value; state.sections[panel] = null },
      setSection: (state, panel: Panel, value: string) => { state.sections[panel] = value },
      setPreview: (state, value: CatalogState['previewState']) => { state.previewState = value },
    },
  })
}
