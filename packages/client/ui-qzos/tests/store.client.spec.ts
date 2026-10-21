/** Ownership and cancellation in the browser-only QZOS demonstration. */
import { expect, it } from 'vitest'
import { createQzosStore } from '../src/client/store.ts'

it('keeps a conversation owner when selections change and retains its unsent draft', () => {
  const { store, actions } = createQzosStore().create()
  actions.setDraft('First question')
  actions.send()
  const id = store.getSnapshot().current!
  actions.setDraft('Unsent draft')
  actions.choose('employee', 'employee-writer')
  expect(store.getSnapshot().draft).toBe('Unsent draft')
  expect(store.getSnapshot().conversations[0]).toMatchObject({ id, employee: 'employee-assistant', status: 'stopped' })
  actions.settle(id)
  expect(store.getSnapshot().conversations[0]?.status).toBe('stopped')
  actions.send()
  expect(store.getSnapshot().conversations[0]?.employee).toBe('employee-writer')
  actions.open(id)
  actions.setDraft('Follow up')
  actions.stop(store.getSnapshot().conversations[0]!.id)
  actions.send()
  expect(store.getSnapshot().conversations[0]?.employee).toBe('employee-assistant')
})

it('allows a failed simulation to retry without running two demonstrations', () => {
  const { store, actions } = createQzosStore().create()
  actions.setFailNext(true)
  actions.setDraft('Fail once')
  actions.send()
  const failed = store.getSnapshot().current!
  actions.settle(failed)
  expect(store.getSnapshot().conversations[0]?.status).toBe('failed')
  actions.newConversation()
  actions.setDraft('Another question')
  actions.send()
  const other = store.getSnapshot().current!
  actions.retry(failed)
  expect(store.getSnapshot().conversations.filter(chat => chat.status === 'running')).toHaveLength(1)
  actions.stop(other)
  actions.retry(failed)
  actions.settle(failed)
  expect(store.getSnapshot().conversations.find(chat => chat.id === failed)?.status).toBe('done')
  expect(createQzosStore().create().store.getSnapshot().conversations).toHaveLength(1)
})
