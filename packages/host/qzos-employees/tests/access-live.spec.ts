/** Opt-in: real local QZOS synthetic fixture, same bound agent before and after revocation. */
import { open, readFile, unlink } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import { expect, it, vi } from 'vitest'
import { z } from 'zod'
import { request } from '../src/business.ts'
import * as Employees from '../src/index.ts'

const fixtureDirectory = process.env.QZOS_LIVE_ACCESS_DIR
it.skipIf(!fixtureDirectory)('rechecks real reference and membership revocation in the same bound agent', async () => {
  if (!fixtureDirectory) throw new Error('Synthetic fixture directory required')
  const fixture = z.object({ kb_id: z.number().int().positive(), employee: z.number().int().positive(), rule: z.number().int().positive(), body: z.record(z.string(), z.unknown()), url: z.string().regex(/^\/api\/kb\.file_gateway\/download\?object_id=[a-f0-9]{64}$/) }).parse(JSON.parse(await readFile(`${fixtureDirectory}/access-state.json`, 'utf8')))
  if (!Number.isSafeInteger(fixture.kb_id) || fixture.kb_id <= 0) throw new Error('Synthetic KB required')
  const config = { apiUrl: 'http://127.0.0.1:3082/api', requestTimeoutMs: 60000 }
  const signal = new AbortController().signal
  const login = async (path: string) => {
    const account = z.object({ email: z.string(), password: z.string() }).parse(JSON.parse(await readFile(path, 'utf8')))
    const data = await request(config, '', '/login/account', signal, { ...account, scene: 2, terminal: 4 })
    if (typeof data !== 'object' || data === null || !('token' in data) || typeof data.token !== 'string') throw new Error('Synthetic login failed')
    return data.token
  }
  const owner = await login(`${fixtureDirectory}/../account.json`)
  const member = await login(`${fixtureDirectory}/member-account.json`)
  const edit = (allow_mask: number, deny_mask: number) => request(config, owner, '/kb.documentAcl/edit', signal, { ...fixture.body, id: fixture.rule, allow_mask, deny_mask })
  const memberInfo = z.object({ sn: z.union([z.string(), z.number()]) }).parse(JSON.parse(await readFile(`${fixtureDirectory}/member.json`, 'utf8')))
  const lockPath = `${fixtureDirectory}/host-live.lock`
  const lock = await open(lockPath, 'wx', 0o600)
  const restore = async () => {
    await request(config, owner, '/kb.know/teamAdd', signal, { kb_id: fixture.kb_id, users: { [memberInfo.sn]: 3 } })
    await edit(7, 0)
  }
  const ctx = new Context()
  const agentState: Pick<Agent, 'session' | 'status' | 'cancel'> = {
    session: Session.create(SessionId('qzos-access-live')), status: 'idle', cancel: vi.fn<Agent['cancel']>(),
  }
  const agent = agentState as Agent
  ctx.provide('agents', { get: (id: string) => id === agent.session.id ? agent : undefined } as never)
  ctx.provide('connection', { requestRejection: () => undefined } as never)
  const input = createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'monthly review day' }] })
  let turn = 0
  const step = async () => {
    const result = await agentEvents(ctx, agent).waterfall('agent/pre-step', { turn: ++turn, step: 1, messages: [input], signal }, async () => ({ kind: 'enter' as const, messages: [input] }))
    if (result.kind !== 'enter') throw new Error('Expected authorized agent input')
    return JSON.stringify(result.messages[0])
  }
  const download = () => fetch(`${config.apiUrl}${fixture.url.slice(4)}`, { headers: { token: member }, redirect: 'error' })
  try {
    await restore()
    const rows = z.array(z.object({ id: z.number().int(), sn: z.union([z.string(), z.number()]) })).parse(await request(config, owner, `/kb.know/teamLists?kb_id=${fixture.kb_id}`, signal))
    const team = rows.find(row => String(row.sn) === String(memberInfo.sn))
    if (!team) throw new Error('Missing synthetic member')
    await request(config, owner, '/kb.know/teamEdit', signal, { id: team.id, power: 3 })
    await ctx.plugin(Storage)
    ctx.storage.backend.register('memory', new MemoryStorageBackend())
    ctx.provide('storageDomain', new DomainFacility(ctx, { backend: 'memory', routes: {} }))
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await ctx.plugin(Employees, config)
    const bound = await fetch(`${ctx.webServer.getOrigin()}/qzos/employees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bind', token: member, sessionId: agent.session.id, employeeId: String(fixture.employee) }) })
    expect(bound.status).toBe(200)
    expect(await step()).toContain('CORRECTION919')
    expect(Buffer.from(await (await download()).arrayBuffer())).toEqual(await readFile(`${fixtureDirectory}/correction.pdf`))
    await edit(1, 6)
    expect(await step()).not.toContain('CORRECTION919')
    expect(await (await download()).json()).toMatchObject({ code: 0 })
    await edit(7, 0)
    expect(await step()).toContain('CORRECTION919')
    await request(config, owner, '/kb.know/teamEdit', signal, { id: team.id, power: 1 })
    await request(config, owner, '/kb.know/teamDel', signal, { id: team.id })
    await edit(0, 31)
    await expect(request(config, member, '/kb.know/teamAdd', signal, { kb_id: fixture.kb_id, users: { [memberInfo.sn]: 3 } })).rejects.toThrow('不是团队成员')
    await expect(step()).rejects.toThrow(/知识关联已失效|不具备任何权限/)
    expect(await (await download()).json()).toMatchObject({ code: 0 })
  } finally {
    try { await ctx.fiber.dispose(); await restore() }
    finally { await lock.close(); await unlink(lockPath) }
  }
}, 180000)
