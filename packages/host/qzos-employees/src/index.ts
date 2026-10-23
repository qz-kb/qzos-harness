/** Private QZOS employee bindings and authorization on native DSH pre-step extension points. */
import type { IncomingMessage } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import schema from '@deepseek-ai/schemastery'
import { z } from 'zod'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { userId, employee, context, type BusinessConfig } from './business.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Logged employee knowledge input, hidden by native Chat context presentation. */
    'qzos-employee-context': { kind: 'qzos-employee-context'; form: 'snapshot' }
  }
}

/** Explicit QZOS endpoint and optional deployment-owned account assignment. */
export interface Config extends BusinessConfig {
  /** Backend user ID assigned to a dedicated Host; never supplied by the browser. */
  ownerUserId?: string
  /** Serve private UI through the authenticated enterprise gateway. Requires ownerUserId. */
  managedGateway?: boolean
}
/** Plugin configuration; the composition owns endpoint and timeout choices. */
export const Config: schema<Config> = schema.object({
  apiUrl: schema.string().required(), requestTimeoutMs: schema.natural().min(1).required(),
  ownerUserId: schema.string(), managedGateway: schema.boolean(),
})
/** Services used by this host-only plugin. */
export const inject = ['webServer', 'connection', 'agents', 'storageDomain']
const bindingSchema = z.object({ userId: z.string(), employeeId: z.string(), apiUrl: z.string() })
const spec = defineDomain({ name: 'qzos_employees', version: 1, tables: { bindings: domainTable(bindingSchema) } })
const ownerSpec = defineDomain({ name: 'qzos_host_owner', version: 1, tables: {
  assignment: domainTable(z.object({ userId: z.string(), apiUrl: z.string() })),
} })
class AccountMismatch extends Error {
  constructor() { super('此工作空间属于其他 QZOS 账号，请打开你自己的工作空间') }
}
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('authorize'), token: z.string().min(1) }),
  z.object({ action: z.literal('logout') }),
  z.object({ action: z.literal('bind'), token: z.string().min(1), sessionId: z.string().min(1), employeeId: z.string().regex(/^[1-9]\d*$/) }),
])
interface Connection { requestRejection(request: { headers: IncomingMessage['headers'] }): 401 | 403 | undefined }

/** Mount authenticated routes and native step enrichment; unload revokes in-memory credentials.
 * @param ctx - Host composition.
 * @param config - Selected backend.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const url = new URL(config.apiUrl)
  if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid QZOS API URL')
  if (config.ownerUserId !== undefined && !/^[1-9]\d*$/.test(config.ownerUserId)) throw new Error('Invalid QZOS Host owner')
  if (config.managedGateway) {
    if (!config.ownerUserId) throw new Error('Managed QZOS Host requires an owner')
    ctx.on('webserver/index-inject', (table) => {
      table.push({ kind: 'global', name: '__QZOS_MANAGED_ACCOUNT__', value: config.ownerUserId })
    })
  }
  const ownerDomain = await ctx.storageDomain.open(ownerSpec)
  ctx.effect(() => () => ownerDomain.close(), 'QZOS Host assignment lifetime')
  const assignment = ownerDomain.table('assignment')
  const storedOwner = assignment.get('owner')
  if (storedOwner && (storedOwner.userId !== config.ownerUserId || storedOwner.apiUrl !== config.apiUrl)) {
    throw new Error('QZOS Host assignment differs from stored owner; use a separate Host data directory')
  }
  const domain = await ctx.storageDomain.open(spec)
  ctx.effect(() => () => domain.close(), 'QZOS employee bindings lifetime')
  const bindings = domain.table('bindings')
  if (config.ownerUserId !== undefined) {
    for (const [, binding] of bindings.entries()) {
      if (binding.userId !== config.ownerUserId || binding.apiUrl !== config.apiUrl) {
        throw new Error('QZOS Host contains bindings for another account; migration is required')
      }
    }
    if (!storedOwner) await assignment.put('owner', { userId: config.ownerUserId, apiUrl: config.apiUrl })
  }
  let active: { userId: string; token: string } | undefined
  let mutation = Promise.resolve()
  const pending = new Map<string, Promise<void>>()
  const revoke = () => {
    const previous = active
    active = undefined
    if (!previous) return
    for (const [id, binding] of bindings.entries()) {
      if (binding.userId === previous.userId) ctx.agents.get(id as SessionId)?.cancel({ kind: 'user' })
    }
  }
  const activate = (owner: string, token: string) => {
    if (active?.userId === owner && active.token === token) return
    revoke(); active = { userId: owner, token }
  }
  const lifetime = new AbortController()
  ctx.effect(() => () => { revoke(); lifetime.abort() }, 'QZOS employee lifetime')
  const connection = Reflect.get(ctx, 'connection') as Connection
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/qzos/employees', handler: async (req, res) => {
    const rejection = connection.requestRejection(req)
    if (rejection) { res.statusCode = rejection; res.end(); return }
    if (req.method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) { res.statusCode = 405; res.end(); return }
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store')
    try {
      const chunks: Buffer[] = []; let bytes = 0
      for await (const chunk of req) {
        const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        bytes += value.length
        if (bytes > 65536) throw new Error('Request too large')
        chunks.push(value)
      }
      const input = inputSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      // One serialized owner covers account changes and binding commits, including concurrent tabs.
      const operation = mutation.then(async () => {
        if (input.action === 'logout') { revoke(); return }
        const owner = await userId(config, input.token, lifetime.signal)
        if (config.ownerUserId !== undefined && owner !== config.ownerUserId) throw new AccountMismatch()
        if (input.action === 'authorize') { activate(owner, input.token); return }
        const sessionId = input.sessionId as SessionId
        const agent = ctx.agents.get(sessionId)
        if (!agent) throw new Error('请先打开该员工会话')
        const existing = bindings.get(sessionId)
        if (existing && (existing.userId !== owner || existing.employeeId !== input.employeeId || existing.apiUrl !== config.apiUrl)) throw new Error('会话已绑定其他员工或账号，请新建会话')
        if (!existing && (agent.status !== 'idle' || agent.session.requestHeader() || agent.session.header.isSeeded)) throw new Error('只能绑定新的空白会话')
        await employee(config, input.token, input.employeeId, lifetime.signal)
        if (!existing && (agent.status !== 'idle' || agent.session.requestHeader())) throw new Error('会话已经开始，请重新新建员工会话')
        if (!existing) await bindings.put(sessionId, { userId: owner, employeeId: input.employeeId, apiUrl: config.apiUrl })
        activate(owner, input.token)
      })
      if (input.action === 'bind') pending.set(input.sessionId, operation)
      mutation = operation.catch(() => { /* The individual request reports its failure; the queue remains usable. */ })
      try { await operation } finally {
        if (input.action === 'bind' && pending.get(input.sessionId) === operation) pending.delete(input.sessionId)
      }
      res.end(JSON.stringify({ ok: true }))
    } catch (error) {
      res.statusCode = error instanceof AccountMismatch ? 403 : 400
      res.end(JSON.stringify({ ok: false, ...(error instanceof AccountMismatch ? { code: 'QZOS_HOST_ACCOUNT_MISMATCH' } : {}), message: error instanceof z.ZodError ? 'Invalid employee request' : error instanceof Error ? error.message : 'Employee request failed' }))
    }
  } }), 'QZOS employee authenticated route')
  // Native forks inherit the same immutable owner/employee binding, including nested forks.
  ctx.on('agent/created', async ({ agent }) => {
    const parent = agent.session.header.parentSession
    if (!parent) return
    await pending.get(parent)
    const inherited = bindings.get(parent)
    if (inherited && !bindings.get(agent.session.id)) await bindings.put(agent.session.id, inherited)
  })
  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    await pending.get(agent.session.id)
    const binding = bindings.get(agent.session.id)
    if (!binding) {
      if (agent.session.header.parentSession && bindings.get(agent.session.header.parentSession)) throw new Error('员工会话分叉尚未支持，请从员工入口新建会话')
      return next()
    }
    const credential = active
    if (!credential || binding.apiUrl !== config.apiUrl || credential.userId !== binding.userId) throw new Error('请使用该员工会话所属的 QZOS 账号重新登录')
    const owner = await userId(config, credential.token, signal)
    if (owner !== binding.userId) throw new Error('员工会话账号不匹配')
    const decision = await next()
    if (decision.kind === 'reject') return decision
    const question = decision.messages.filter(message => message.source.kind === 'user')
      .flatMap(message => message.content.flatMap(part => part.type === 'text' ? [part.text] : [])).join('\n')
    const text = question.trim() ? await context(config, credential.token, binding.employeeId, question, signal) : undefined
    if (!text) await employee(config, credential.token, binding.employeeId, signal)
    if (active !== credential) throw new Error('QZOS 登录已变化，请重新发送')
    return text ? { ...decision, messages: [createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'qzos-employee-context', form: 'snapshot' } }), ...decision.messages] } : decision
  }, { prepend: true })
}
