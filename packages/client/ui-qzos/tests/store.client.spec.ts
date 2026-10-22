/** Catalog navigation preserves each panel's own filters without carrying removed chat state. */
import { expect, it } from 'vitest'
import { createQzosStore } from '../src/client/store.ts'

it('keeps scope and search per catalog and resets the detail section for a different resource', () => {
  const { store, actions } = createQzosStore().create()
  actions.setQuery('knowledge', '团队')
  actions.setFilter('knowledge', 'shared')
  actions.setFilter('employees', 'private')
  actions.setDetail('knowledge', 'kb-team')
  actions.setSection('knowledge', 'teamData')
  actions.setDetail('knowledge', 'kb-product')
  expect(store.getSnapshot()).toMatchObject({ queries: { knowledge: '团队' }, filters: { knowledge: 'shared', employees: 'private' } })
  expect(store.getSnapshot().sections.knowledge).toBeNull()
  expect(createQzosStore().create().store.getSnapshot().queries).toEqual({})
})
