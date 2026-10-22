/** Real HTTP + domain facility; only external business API and agent execution are controlled. */
import { Context } from '@deepseek-ai/cordis'
import { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { expect, it, vi } from 'vitest'
import * as Employees from '../src/index.ts'

it('persists bindings across reload, rechecks each turn, and refuses another account or logout', async () => {
  const ctx = new Context()
  const nativeFetch = fetch
  let owner = '1'
  let paused = false
  let rejected = false
  let searches = 0
  const agentState: Pick<Agent, 'session' | 'status' | 'cancel'> = {
    session: Session.create(SessionId('employee-test')), status: 'idle', cancel: vi.fn<Agent['cancel']>(),
  }
  const agent = agentState as Agent
  ctx.provide('agents', { get: (id: string) => id === agent.session.id ? agent : undefined } as never)
  ctx.provide('connection', { requestRejection: () => rejected ? 403 : undefined } as never)
  const input = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'synthetic question' }] })
  const step = () => agentEvents(ctx, agent).waterfall('agent/pre-step', { turn:1,step:1,messages:[input],signal:new AbortController().signal }, async () => ({ kind:'enter' as const,messages:[input] }))
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const address = url instanceof Request ? url.url : String(url)
    if (!address.startsWith('http://qzos.invalid')) return nativeFetch(url,init)
    const path = new URL(address).pathname
    let data: unknown
    if (path.endsWith('/user/info')) data = { id:owner }
    else if (path.endsWith('/kb.robot/detail')) data = { id:7,name:'Researcher',roles_prompt:'Role',kb_ids:[12],is_enable:1,work_state:paused?'paused':'ready' }
    else { searches++; data=[{ question:'source',answer:`evidence-${searches}` }] }
    return new Response(JSON.stringify({ code:1,data }))
  })
  try {
    await ctx.plugin(Storage)
    ctx.storage.backend.register('memory',new MemoryStorageBackend())
    ctx.provide('storageDomain',new DomainFacility(ctx,{ backend:'memory',routes:{} }))
    await ctx.plugin(WebServer,{ host:'127.0.0.1',port:0 })
    const config = { apiUrl:'http://qzos.invalid/api',requestTimeoutMs:1000 }
    let plugin = ctx.plugin(Employees,config); await plugin.await()
    const call = async (body: object) => nativeFetch(`${ctx.webServer.getOrigin()}/qzos/employees`,{ method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify(body) })
    rejected=true; expect((await call({ action:'logout' })).status).toBe(403); rejected=false
    expect((await call({ action:'bind',token:'synthetic',sessionId:agent.session.id,employeeId:'7' })).status).toBe(200)
    const first = await step()
    expect(JSON.stringify(first)).toContain('evidence-1')
    if (first.kind !== 'enter') throw new Error('Expected authorized employee input')
    expect(first.messages[0]?.source).toEqual({ kind: 'qzos-employee-context', form: 'snapshot' })
    expect(first.messages[1]).toBe(input)
    expect(JSON.stringify(await step())).toContain('evidence-2')
    paused=true; await expect(step()).rejects.toThrow('暂停'); paused=false
    await plugin.dispose(); plugin=ctx.plugin(Employees,config); await plugin.await()
    await expect(step()).rejects.toThrow('重新登录')
    await call({ action:'authorize',token:'synthetic' })
    expect(JSON.stringify(await step())).toContain('evidence-3')
    owner='2'; await call({ action:'authorize',token:'other' })
    await expect(step()).rejects.toThrow('所属')
    expect((await call({ action:'bind',token:'other',sessionId:agent.session.id,employeeId:'7' })).status).toBe(400)
    await call({ action:'logout' }); await expect(step()).rejects.toThrow('重新登录')
  } finally { await ctx.fiber.dispose(); vi.unstubAllGlobals() }
})
