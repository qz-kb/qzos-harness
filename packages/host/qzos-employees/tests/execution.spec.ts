import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { expect, it, vi } from 'vitest'
import { execution, receiptUsage } from '../src/execution.ts'
import { pluginRequestId } from '../src/tools.ts'

it('preserves exact cached token counters and refuses inconsistent totals', () => {
  expect(receiptUsage({ inputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 5, outputTokens: 7, totalTokens: 42 }))
    .toEqual({ prompt_tokens: 35, completion_tokens: 7, total_tokens: 42 })
  expect(receiptUsage()).toBeNull()
  expect(receiptUsage({ inputTokens:10,outputTokens:7,totalTokens:10 })).toBeNull()
  expect(pluginRequestId('session','call')).toBe(pluginRequestId('session','call'))
  expect(pluginRequestId('session','call')).not.toBe(pluginRequestId('other','call'))
})

it('recovers an admitted begin with a lost response after restart without invoking the provider', async () => {
  const media = new MemoryMediaPool(), session = SessionId('begin-response-loss')
  const auth = { userId: '1', token: 'synthetic' }, registrations = new Map<string, string>()
  const completed: Record<string, unknown>[] = []
  let offline = true, providerCalls = 0, begins = 0
  const contexts: Context[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.includes('/kb.robot/detail')) return Response.json({ code: 1, data: { id: 7, is_enable: 1, kb_ids: [], work_state: 'ready' } })
    if (typeof init?.body !== 'string') throw new Error('Expected serialized receipt')
    const body = JSON.parse(init.body) as Record<string, unknown>
    if (url.endsWith('/begin')) {
      begins++
      const key = String(body.call_id), bytes = JSON.stringify(body)
      if (registrations.has(key)) expect(registrations.get(key)).toBe(bytes)
      registrations.set(key, bytes)
      if (offline) throw new Error('begin response lost')
    } else if (url.endsWith('/complete')) completed.push(body)
    else throw new Error('Recovery must not create an empty answer')
    return Response.json({ code: 1, data: {} })
  })
  const open = async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(Storage); ctx.storage.backend.register('memory', new MemoryStorageBackend(media))
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }))
    const bridge = await execution(ctx, { apiUrl: 'http://qzos.invalid/api', requestTimeoutMs: 1000 }, 's'.repeat(32), () => auth, () => ({ userId: '1', employeeId: '7' }))
    return { ctx, bridge }
  }
  try {
    const first = await open()
    await first.bridge.prepare(session, { userId: '1', employeeId: '7', turn: 1, question: 'synthetic', sources: [] })
    const provider = async function* (): AsyncIterable<StreamChunk> { providerCalls++; yield { type: 'text-delta', index: 0, text: 'must not run' } }
    await expect((async () => { for await (const _ of first.ctx.waterfall('llm/stream', { provider: 'selected', model: 'window', sessionId: session, messages: [] }, provider)) { /* consume */ } })()).rejects.toThrow('begin response lost')
    await first.ctx.fiber.dispose()
    const second = await open(); offline = false
    await second.bridge.recover(auth); await second.bridge.recover(auth)
    expect(begins).toBe(2); expect(registrations.size).toBe(1); expect(providerCalls).toBe(0)
    expect(completed).toHaveLength(1)
    expect(completed[0]).toMatchObject({ reply: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } })
  } finally { for (const ctx of contexts) await ctx.fiber.dispose(); vi.unstubAllGlobals() }
})

it('does not retain a rejected admission or call a provider after journal persistence fails', async () => {
  const ctx = new Context(), media = new MemoryMediaPool(), session = SessionId('begin-refused')
  const auth = { userId: '1', token: 'synthetic' }
  let begins = 0, providerCalls = 0
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.includes('/kb.robot/detail')) return Response.json({ code: 1, data: { id: 7, is_enable: 1, kb_ids: [], work_state: 'ready' } })
    expect(url.endsWith('/begin')).toBe(true); begins++
    return Response.json({ code: 0, msg: 'DSH 接入请求未完成：DSH_QUOTA_INSUFFICIENT', data: { error_code: 'DSH_QUOTA_INSUFFICIENT' } })
  })
  try {
    await ctx.plugin(Storage); ctx.storage.backend.register('memory', new MemoryStorageBackend(media))
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }))
    const bridge = await execution(ctx, { apiUrl: 'http://qzos.invalid/api', requestTimeoutMs: 1000 }, 's'.repeat(32), () => auth, () => ({ userId: '1', employeeId: '7' }))
    await bridge.prepare(session, { userId: '1', employeeId: '7', turn: 1, question: 'synthetic', sources: [] })
    const provider = async function* (): AsyncIterable<StreamChunk> { providerCalls++; yield { type: 'text-delta', index: 0, text: 'must not run' } }
    const run = async () => { for await (const _ of ctx.waterfall('llm/stream', { provider: 'selected', model: 'window', sessionId: session, messages: [] }, provider)) { /* consume */ } }
    media.failNextWrites = 1
    await expect(run()).rejects.toThrow('injected write failure'); expect(begins).toBe(0)
    await expect(run()).rejects.toThrow('DSH_QUOTA_INSUFFICIENT')
    await bridge.recover(auth); expect(begins).toBe(1); expect(providerCalls).toBe(0)
  } finally { await ctx.fiber.dispose(); vi.unstubAllGlobals() }
})
it('journals received usage, retries only settlement, and isolates recovery by account', async () => {
  const ctx = new Context()
  const session=SessionId('receipt-test'); let auth={ userId:'1',token:'test-token' }
  const calls: { action:string; data:Record<string,unknown> }[]=[]
  let failReceipt=true; let providerCalls=0
  vi.stubGlobal('fetch',async(url:string,init?:RequestInit)=>{
    if(url.includes('/kb.robot/detail'))return Response.json({ code:1,data:{ id:7,is_enable:1,kb_ids:[],work_state:'ready' } })
    const action=url.split('/').at(-1)!; const data=JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string,unknown>
    calls.push({ action,data })
    if(action==='complete' && failReceipt)throw new Error('synthetic offline')
    return Response.json({ code:1,data:{ state:'received' } })
  })
  try {
    await ctx.plugin(Storage);ctx.storage.backend.register('memory',new MemoryStorageBackend())
    ctx.provide('storageDomain',new DomainFacility(ctx,{ backend:'memory',routes:{} }))
    const bridge=await execution(ctx,{ apiUrl:'http://qzos.invalid/api',requestTimeoutMs:1000 },'s'.repeat(32),()=>auth,id=>id===session?{ userId:'1',employeeId:'7' }:undefined)
    await bridge.prepare(session,{ userId:'1',employeeId:'7',turn:1,question:'question',sources:[] })
    await bridge.prepare(session,{ userId:'1',employeeId:'7',turn:1,question:'',sources:[] })
    const options:GenerateOptions={ provider:'selected',model:'window',sessionId:session,messages:[] }
    const provider=async function*():AsyncIterable<StreamChunk>{providerCalls++;yield { type:'text-delta',index:0,text:'answer' };yield { type:'usage',usage:{ inputTokens:12,outputTokens:8,totalTokens:20 } }}
    const consume=async()=>{for await(const _chunk of ctx.waterfall('llm/stream',options,provider)){/* consume */}}
    await expect(consume()).rejects.toThrow('offline')
    expect(calls.find(c=>c.action==='begin')?.data).toMatchObject({ provider:'selected',model:'window',question:'question' })
    auth={ userId:'2',token:'other' };failReceipt=false;await bridge.recover(auth)
    expect(calls.filter(c=>c.action==='complete')).toHaveLength(1)
    auth={ userId:'1',token:'test-token' };await bridge.recover(auth)
    const completed=calls.filter(c=>c.action==='complete')
    expect(completed).toHaveLength(2);expect(completed[0]?.data).toEqual(completed[1]?.data)
    expect(completed[1]?.data).toMatchObject({ reply:'answer',usage:{ total_tokens:20 } })
    expect(providerCalls).toBe(1)
    await bridge.recover(auth);expect(calls.filter(c=>c.action==='complete')).toHaveLength(2)
  } finally { await ctx.fiber.dispose();vi.unstubAllGlobals() }
})

it('recovers retrieval transport loss with the same identity, but never retries a refusal or cancellation', async () => {
  const ctx = new Context(), auth = { userId: '1', token: 'synthetic' }, session = SessionId('retrieve-response-loss')
  const bodies: string[] = []
  let mode = 'once'
  const controller = new AbortController()
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    if (typeof init?.body !== 'string') throw new Error('Expected retrieval body')
    bodies.push(init.body)
    if (mode === 'cancel') { controller.abort(); throw new TypeError('fetch failed') }
    if (mode === 'always' || (mode === 'once' && bodies.length === 1)) throw new TypeError('fetch failed')
    if (mode.startsWith('DSH_')) return Response.json({ code: 0, msg: 'refused', data: { error_code: mode } })
    return Response.json({ code: 1, data: [{ kb_id: 9 }] })
  })
  try {
    await ctx.plugin(Storage); ctx.storage.backend.register('memory', new MemoryStorageBackend())
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }))
    const bridge = await execution(ctx, { apiUrl: 'http://qzos.invalid/api', requestTimeoutMs: 1000 }, 's'.repeat(32), () => auth, () => ({ userId: '1', employeeId: '7' }))
    const retrieve = (turn = 1) => bridge.retrieve(auth, session, '7', turn, 'question', controller.signal)
    await expect(retrieve()).resolves.toEqual([{ kb_id: 9 }])
    expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0])
    const original = bodies[0]
    bodies.length = 0; mode = 'always'
    await expect(retrieve()).rejects.toThrow('知识检索连接中断')
    expect(bodies).toHaveLength(2); expect(bodies[1]).toBe(bodies[0])
    for (const code of ['DSH_RETRIEVAL_USAGE_UNKNOWN', 'DSH_EMPLOYEE_UNAVAILABLE', 'DSH_QUOTA_INSUFFICIENT']) {
      bodies.length = 0; mode = code
      await expect(retrieve()).rejects.toThrow('refused'); expect(bodies).toHaveLength(1)
    }
    bodies.length = 0; mode = 'success'
    await retrieve(2); expect(bodies[0]).not.toBe(original)
    const next = JSON.parse(bodies[0]!) as { turn_id: string }; expect(next.turn_id).toBe('2')
    bodies.length = 0; mode = 'cancel'
    await expect(retrieve()).rejects.toThrow(); expect(bodies).toHaveLength(1)
  } finally { await ctx.fiber.dispose(); vi.unstubAllGlobals() }
})

it('clears only confirmed unadmitted registrations and leaves ambiguous recovery available', async () => {
  const ctx = new Context(), auth = { userId: '1', token: 'synthetic' }, session = SessionId('unadmitted')
  let mode = 'offline', providerCalls = 0, retrievals = 0
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.includes('/kb.robot/detail')) return Response.json({ code: 1, data: { id: 7, is_enable: 1, kb_ids: [], work_state: 'ready' } })
    if (url.endsWith('/retrieve')) { retrievals++; return Response.json({ code: 1, data: [] }) }
    expect(url.endsWith('/begin')).toBe(true)
    if (mode === 'offline') throw new Error('not admitted')
    return Response.json({ code: 0, msg: mode, data: { error_code: mode } })
  })
  try {
    await ctx.plugin(Storage); ctx.storage.backend.register('memory', new MemoryStorageBackend())
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }))
    const bridge = await execution(ctx, { apiUrl: 'http://qzos.invalid/api', requestTimeoutMs: 1000 }, 's'.repeat(32), () => auth, () => ({ userId: '1', employeeId: '7' }))
    await bridge.prepare(session, { userId: '1', employeeId: '7', turn: 1, question: 'question', sources: [] })
    const provider = async function* (): AsyncIterable<StreamChunk> { providerCalls++; yield { type: 'text-delta', index: 0, text: 'must not run' } }
    await expect((async () => { for await (const _ of ctx.waterfall('llm/stream', { provider: 'selected', model: 'window', sessionId: session, messages: [] }, provider)) { /* consume */ } })()).rejects.toThrow('not admitted')
    for (const error of ['offline', 'DSH_REQUEST_CONFLICT', 'DSH_REQUEST_INVALID']) {
      mode = error
      await expect(bridge.recover(auth)).rejects.toThrow()
    }
    mode = 'DSH_EMPLOYEE_UNAVAILABLE'
    await expect(bridge.retrieve(auth, session, '8', 2, 'other employee', new AbortController().signal)).resolves.toEqual([])
    await bridge.recover(auth)
    expect(providerCalls).toBe(0); expect(retrievals).toBe(1)
  } finally { await ctx.fiber.dispose(); vi.unstubAllGlobals() }
})

it('continues pending retrieval in the same turn and cancels pending polling', async () => {
  const ctx = new Context(), auth = { userId: '1', token: 'synthetic' }, bodies: string[] = []
  let pending = true
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    bodies.push(String(init?.body))
    return Response.json(pending ? { code: 0, msg: 'pending', data: { error_code: 'DSH_RETRIEVAL_PENDING' } } : { code: 1, data: ['original result'] })
  })
  try {
    await ctx.plugin(Storage); ctx.storage.backend.register('memory', new MemoryStorageBackend())
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }))
    const bridge = await execution(ctx, { apiUrl: 'http://qzos.invalid/api', requestTimeoutMs: 10 }, 's'.repeat(32), () => auth, () => undefined)
    const active = new AbortController()
    const result = bridge.retrieve(auth, SessionId('pending'), '7', 1, 'question', active.signal)
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(1))
    pending = false
    await expect(result).resolves.toEqual(['original result'])
    expect(new Set(bodies).size).toBe(1)
    pending = true; bodies.length = 0
    const cancelled = bridge.retrieve(auth, SessionId('pending'), '7', 2, 'question', active.signal)
    const rejection = expect(cancelled).rejects.toThrow()
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0))
    active.abort(); await rejection
    const count = bodies.length
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(bodies.length).toBe(count)
  } finally { await ctx.fiber.dispose(); vi.unstubAllGlobals() }
})
