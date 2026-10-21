/** Ephemeral demo state shared by the QZOS panels; never persisted to a Host. */
import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { Panel } from './catalog.ts'

export interface DemoConversation {
  id: string
  prompt: string
  employee: string
  knowledge: string
  status: 'running' | 'done' | 'stopped' | 'failed'
}
interface DemoState {
  sequence: number
  draft: string
  employee: string
  knowledge: string
  current: string | null
  conversations: DemoConversation[]
  queries: Partial<Record<Panel, string>>
  filters: Partial<Record<Panel, boolean>>
  details: Partial<Record<Panel, string | null>>
  previewState: 'normal' | 'loading' | 'error' | 'empty'
  failNext: boolean
}

/** Create one shared, browser-memory-only presentation store.
 * @returns A handle bound by the slot renderer.
 */
export function createQzosStore() {
  return defineStore({
    init: (): DemoState => ({
      sequence: 0, draft: '', employee: 'employee-assistant', knowledge: 'kb-team', current: null,
      conversations: [{ id: 'demo-weekly', prompt: '整理团队一周工作总结', employee: 'employee-writer', knowledge: 'kb-team', status: 'done' }],
      queries: {}, filters: {}, details: {}, previewState: 'normal', failNext: false,
    }),
    actions: {
      setDraft: (state, value: string) => { state.draft = value },
      setQuery: (state, panel: Panel, value: string) => { state.queries[panel] = value },
      setFilter: (state, panel: Panel, value: boolean) => { state.filters[panel] = value },
      setDetail: (state, panel: Panel, value: string | null) => { state.details[panel] = value },
      setPreview: (state, value: DemoState['previewState']) => { state.previewState = value },
      setFailNext: (state, value: boolean) => { state.failNext = value },
      choose: (state, kind: 'employee' | 'knowledge', id: string) => {
        state[kind] = id
        state.current = null
        for (const chat of state.conversations) if (chat.status === 'running') chat.status = 'stopped'
      },
      newConversation: (state) => {
        state.current = null
        for (const chat of state.conversations) if (chat.status === 'running') chat.status = 'stopped'
      },
      open: (state, id: string) => { state.current = id },
      send: (state) => {
        const prompt = state.draft.trim()
        if (!prompt || state.conversations.some(chat => chat.status === 'running')) return
        const previous = state.conversations.find(chat => chat.id === state.current)
        const id = `demo-${++state.sequence}`
        state.conversations.unshift({ id, prompt, employee: previous?.employee ?? state.employee, knowledge: previous?.knowledge ?? state.knowledge, status: 'running' })
        state.current = id
        state.draft = ''
      },
      settle: (state, id: string) => {
        const chat = state.conversations.find(item => item.id === id)
        if (chat?.status !== 'running') return
        chat.status = state.failNext ? 'failed' : 'done'
        state.failNext = false
      },
      stop: (state, id: string) => {
        const chat = state.conversations.find(item => item.id === id)
        if (chat?.status === 'running') chat.status = 'stopped'
      },
      retry: (state, id: string) => {
        if (state.conversations.some(item => item.status === 'running')) return
        const chat = state.conversations.find(item => item.id === id)
        if (chat?.status === 'failed' || chat?.status === 'stopped') chat.status = 'running'
      },
    },
  })
}
