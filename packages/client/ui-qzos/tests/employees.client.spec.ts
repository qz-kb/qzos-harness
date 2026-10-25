/** Native employee navigation keeps old work intact and captures drafts before asynchronous serialization. */
import { Context } from '@deepseek-ai/cordis'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { afterEach, expect, it, vi } from 'vitest'
import { installEmployeeMentions } from '../src/client/employees.ts'
import { loginApi, loginSessionKey } from '../src/client/login-client.ts'

const reply = (data: unknown) => new Response(JSON.stringify({ code: 1, data }))
afterEach(() => { vi.unstubAllGlobals() })
async function setup() {
  vi.stubGlobal('document', { baseURI: 'http://localhost/' })
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => key === loginSessionKey ? JSON.stringify({ api: loginApi, token: 'synthetic' }) : null })
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply({ id: 7, name: 'Researcher', is_enable: 1 }))
  vi.stubGlobal('fetch', fetcher)
  const ctx = new Context()
  let source: InputTriggerSource | undefined
  let draft = ''
  let occurrences: { source: string; ref: string; offset: number; length: number }[] = []
  const insertReference = vi.fn((reference: { source: string; ref: string; clipboardText: string }) => {
    draft = reference.clipboardText + ' Task'
    occurrences = [{ source: reference.source, ref: reference.ref, offset: 0, length: reference.clipboardText.length }]
    return true
  })
  const rename = vi.fn().mockResolvedValue({ ok: true })
  const create = vi.fn().mockResolvedValue('new-session')
  const openSession = vi.fn()
  const unregister = vi.fn()
  const list = { byId: { old: { id: 'old', retainedBy: { mainView: 1 }, blank: false }, 'new-session': { id: 'new-session', retainedBy: {}, blank: true } } }
  Object.defineProperties(ctx, {
    inputTriggers: { value: { registerSource: (value: InputTriggerSource) => { source = value; return unregister } } },
    sessions: { value: { list: { getSnapshot: () => list }, create,
      scope: () => ctx,
      using: async (_id: string, _options: object, operation: (ref: object) => Promise<void>) => {
        return operation({ ready: Promise.resolve(), binding: { session: { rename } } })
      },
    } },
    workspaces: { value: { list: { getSnapshot: () => ({ items: [{ workspaceId: 'workspace', sessionIds: ['old'] }] }) } } },
    uiWorkspace: { value: { openSession } },
    conversation: { value: { input: { for: () => ({
      state: { getSnapshot: () => ({ draft, occurrences, draftRev: 1 }) }, insertReference, notify: vi.fn(),
    }) } } },
  })
  let open: ReturnType<typeof installEmployeeMentions> | undefined
  const fiber = ctx.plugin((pluginCtx) => { open = installEmployeeMentions(pluginCtx, key => key) })
  await fiber.await()
  if (!open) throw new Error('Plugin did not register')
  return { fiber, open, create, openSession, insertReference, rename, unregister, fetcher,
    source: () => { if (!source) throw new Error('Source missing'); return source },
    reference: () => { const ref = occurrences[0]?.ref; if (!ref) throw new Error('Reference missing'); return ref },
    replaceDraft: () => { draft = 'A later edit' },
  }
}
it('always creates a fresh session, names it and inserts the employee without submitting or reusing the current session', async () => {
  const runtime = await setup()
  expect(await runtime.open('7')).toBeUndefined()
  expect(runtime.create).toHaveBeenCalledExactlyOnceWith({ workspaceId: 'workspace' })
  expect(runtime.rename).toHaveBeenCalledWith('@Researcher')
  expect(runtime.openSession).toHaveBeenCalledExactlyOnceWith('new-session')
  expect(runtime.insertReference).toHaveBeenCalledTimes(1)
  expect(JSON.parse(runtime.reference())).toMatchObject({ id: '7', sessionId: 'new-session', label: '@Researcher' })
  await runtime.fiber.dispose()
  expect(runtime.unregister).toHaveBeenCalledTimes(1)
})
it('captures the submitted task before the native editor clears it and excludes later edits', async () => {
  const runtime = await setup()
  await runtime.open('7')
  runtime.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
  const pending = runtime.source().codec?.serialize(runtime.reference(), new AbortController().signal)
  runtime.replaceDraft()
  expect(await pending).toBe('@Researcher')
  const body = runtime.fetcher.mock.calls[1]?.[1]?.body
  expect(typeof body).toBe('string')
  if (typeof body !== 'string') throw new Error('Missing body')
  expect(JSON.parse(body)).toMatchObject({ action: 'bind', employeeId: '7', sessionId: 'new-session' })
  await runtime.fiber.dispose()
})

it('opens an authorized shared employee without requiring it in the owned directory and rejects withdrawal', async () => {
  const runtime = await setup()
  try {
    expect(await runtime.open('7')).toBeUndefined()
    expect(runtime.fetcher.mock.calls[0]?.[0]).toContain('/kb.robot/detail?id=7')
    runtime.fetcher.mockResolvedValueOnce(Response.json({ code: 0, msg: '员工已下架或分享已取消。' }))
    expect(await runtime.open('7')).toBe('员工已下架或分享已取消。')
    expect(runtime.create).toHaveBeenCalledTimes(1)
    expect(runtime.insertReference).toHaveBeenCalledTimes(1)
  } finally { await runtime.fiber.dispose() }
})
