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
