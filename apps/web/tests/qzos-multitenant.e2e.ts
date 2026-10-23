/** Dedicated Hosts use native credentials and persistence; QZOS identity stays deployment-owned. */
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { requireBuilt } from './support.ts'
import { launchWebScaffold, seedSession, type WebScaffold } from './scaffold.ts'

function rpc(endpoint: string, args: object): RequestInit {
  return { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({
    type:'client-request', rpcId:randomUUID(), method:endpoint, payload:{ args },
  }) }
}
async function remote(host: WebScaffold, endpoint: string, args: object) {
  const response = await host.hostFetch(`/api/${endpoint}`, rpc(endpoint,args))
  expect(response.status).toBe(200)
  return response.json()
}
async function cookie(host: WebScaffold) {
  const response = await fetch(host.authenticatedUrl,{ redirect:'manual' })
  expect(response.status).toBe(303)
  const value = response.headers.get('set-cookie')?.split(';')[0]
  if (!value) throw new Error('Native cookie exchange failed')
  return value
}
async function employee(host: WebScaffold, input: object) {
  return host.hostFetch('/qzos/employees',{ method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(input) })
}

it('rejects foreign Host credentials and QZOS accounts while keeping native histories separate', async () => {
  const root = await mkdtemp(join(tmpdir(),'qzos-multitenant-'))
  const tokens: string[] = [randomUUID(),randomUUID()]
  const searches: number[] = []
  let revoked = false
  const backend = createServer(async (req,res) => {
    const owner = tokens.indexOf(String(req.headers.token)) + 1
    res.setHeader('content-type','application/json')
    let result: object = { code:0,msg:'Synthetic access denied' }
    if (owner > 0 && req.url === '/api/user/info') result = { code:1,data:{ id:owner } }
    if (owner > 0 && req.url === `/api/kb.robot/detail?id=${100+owner}`) result = { code:1,data:{
      id:100+owner,name:`Employee ${owner}`,is_enable:1,roles_prompt:'Answer using authorized references.',kb_ids:[200+owner],
    } }
    if (owner > 0 && req.url === '/api/kb.teach/tests') {
      let body = ''
      for await (const chunk of req) body += String(chunk)
      if (JSON.parse(body).kb_id === 200+owner && !revoked) {
        searches.push(owner)
        result = { code:1,data:[{ question:'Private reference',answer:`owner-${owner}-knowledge` }] }
      }
    }
    res.end(JSON.stringify(result))
  })
  const hosts: WebScaffold[] = []
  try {
    backend.listen(0,'127.0.0.1'); await once(backend,'listening')
    const address = backend.address()
    if (!address || typeof address === 'string') throw new Error('Missing synthetic backend')
    for (const owner of ['1','2']) {
      const patch = join(root,`owner-${owner}.yml`)
      await writeFile(patch,`- id: qzos-employees\n  config:\n    apiUrl: http://127.0.0.1:${address.port}/api\n    requestTimeoutMs: 1000\n    ownerUserId: '${owner}'\n`)
      hosts.push(await launchWebScaffold({ extraOverlayPath:patch }))
    }
    const [a,b] = hosts as [WebScaffold,WebScaffold]
    expect(a.harnessHome).not.toBe(b.harnessHome)
    expect(a.persistenceRoot).not.toBe(b.persistenceRoot)
    const fixture = await readFile(new URL('../../../snapshots/web/seeded-history/session.v3.jsonl',import.meta.url),'utf8')
    await seedSession(a,fixture,'tenant-a-history')
    await seedSession(b,fixture,'tenant-b-history')
    await writeFile(join(a.workspaceCwd,'private.txt'),'tenant-a-file')
    await writeFile(join(b.workspaceCwd,'private.txt'),'tenant-b-file')
    for (const [own,other,index] of [[a,b,0],[b,a,1]] as const) {
      const ownId = index === 0 ? 'tenant-a-history' : 'tenant-b-history'
      const otherId = index === 0 ? 'tenant-b-history' : 'tenant-a-history'
      const ownCookie = await cookie(own)
      const listing = await remote(own,'session/list',{ _request:{} })
      expect(listing.result.ok).toBe(true)
      expect(listing.result.value.items.map((item: { sessionId:string }) => item.sessionId)).toContain(ownId)
      expect(JSON.stringify(listing)).not.toContain(otherId)
      const ownFile = await remote(own,'workspaceFiles/read',{ workspaceFileScopeId:ownId,path:'private.txt',range:{} })
      expect(ownFile.result).toMatchObject({ ok:true,value:{ text:index === 0 ? 'tenant-a-file' : 'tenant-b-file' } })
      const otherSession = await remote(own,'workspaceFiles/read',{ workspaceFileScopeId:otherId,path:'private.txt',range:{} })
      expect(otherSession.result.ok).toBe(false)
      expect((await employee(own,{ action:'authorize',token:tokens[index] })).status).toBe(200)
      const created = await remote(own,'session/create',{ request:{ cwd:own.workspaceCwd } })
      expect(created.result.ok).toBe(true)
      const sessionId = String(created.result.value.sessionId)
      expect((await employee(own,{ action:'bind',token:tokens[index],sessionId,employeeId:String(102-index) })).status).toBe(400)
      expect((await employee(own,{ action:'bind',token:tokens[index],sessionId,employeeId:String(101+index) })).status).toBe(200)
      const agent = own.ctx.agents.get(SessionId(sessionId))
      if (!agent) throw new Error('Native employee agent missing')
      const { agentEvents } = requireBuilt('@deepseek-ai/dsh-agent') as typeof import('@deepseek-ai/dsh-agent')
      const message = createUserMessage({ source:{ kind:'user' },content:[{ type:'text',text:'Read my knowledge' }] })
      const step = () => agentEvents(own.ctx,agent).waterfall('agent/pre-step',{
        turn:1,step:1,messages:[message],signal:new AbortController().signal,
      },async () => ({ kind:'enter' as const,messages:[message] }))
      const enriched = JSON.stringify(await step())
      expect(enriched).toContain(`owner-${index+1}-knowledge`)
      expect(enriched).not.toContain(`owner-${2-index}-knowledge`)
      revoked = true
      await expect(step()).rejects.toThrow('Synthetic access denied')
      revoked = false
      const switchAccount = await employee(own,{ action:'authorize',token:tokens[1-index] })
      expect(switchAccount.status).toBe(403)
      expect(await switchAccount.json()).toMatchObject({ code:'QZOS_HOST_ACCOUNT_MISMATCH' })
      for (const endpoint of ['session/list','session/prompt','workspaceFiles/read','terminal/create']) {
        const init = rpc(endpoint,{})
        const response = await fetch(`${other.baseUrl}/api/${endpoint}`,{ ...init,headers:{ ...init.headers,cookie:ownCookie } })
        expect(response.status).toBe(401)
      }
      expect((await fetch(`${other.baseUrl}/qzos/employees`,{ method:'POST',headers:{ cookie:ownCookie,'content-type':'application/json' },body:JSON.stringify({ action:'logout' }) })).status).toBe(401)
      const ws = new WebSocket(`${other.baseUrl.replace('http:','ws:')}/api/remote.mux`,{ headers:{ cookie:ownCookie } })
      const closed = new Promise<void>(resolve => ws.once('close',() => resolve()))
      const rejected = new Promise<number>((resolve,reject) => {
        ws.once('unexpected-response',(_request,response) => { response.resume(); resolve(response.statusCode ?? 0) })
        ws.once('open',() => { ws.close(); reject(new Error('Foreign cookie opened a stream')) })
        ws.on('error',reject)
      })
      try { expect(await rejected).toBe(401) } finally { ws.terminate(); await closed }
    }
    expect(searches).toEqual([1,2])
    // Separate data roots on the SAME OS account do not confine native absolute file reads.
    // This executable limitation prevents treating the HTTP checks as OS isolation evidence.
    const sameOsRead = await remote(b,'workspaceFiles/read',{
      workspaceFileScopeId:'tenant-b-history',path:join(a.workspaceCwd,'private.txt'),range:{},
    })
    expect(sameOsRead.result).toMatchObject({ ok:true,value:{ text:'tenant-a-file' } })
  } finally {
    const cleanup = await Promise.allSettled(hosts.reverse().map(host => host.close()))
    backend.closeAllConnections()
    await new Promise<void>((resolve,reject) => backend.close(error => error ? reject(error) : resolve()))
    await rm(root,{ recursive:true,force:true })
    for (const result of cleanup) if (result.status === 'rejected') throw result.reason
  }
})
