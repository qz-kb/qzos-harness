import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
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
