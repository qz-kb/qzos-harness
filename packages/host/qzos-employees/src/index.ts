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
import { userId, employee, contextDetails, type BusinessConfig } from './business.ts'
import { execution } from './execution.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Logged employee knowledge input, hidden by native Chat context presentation. */
    'qzos-employee-context': { kind: 'qzos-employee-context'; form: 'snapshot' }
  }
}

/** Explicit local QZOS endpoint configuration. */
export type Config = BusinessConfig & {
  /** Opt-in trusted receipts and employee capability tools; false keeps retrieval-only behavior. */
  execution?: false | {
    /** Environment-variable name holding the shared Host/server signing secret. */
    secretEnv: string
  }
}
/** Plugin configuration; the composition owns endpoint and timeout choices. */
export const Config: schema<Config> = schema.object({
  apiUrl: schema.string().required(), requestTimeoutMs: schema.natural().min(1).required(),
  execution: schema.union([schema.const(false), schema.object({ secretEnv: schema.string().required() })]).default(false),
})
/** Services used by this host-only plugin. */
export const inject = ['webServer', 'connection', 'agents', 'storageDomain']
const bindingSchema = z.object({ userId: z.string(), employeeId: z.string(), apiUrl: z.string() })
const spec = defineDomain({ name: 'qzos_employees', version: 1, tables: { bindings: domainTable(bindingSchema) } })
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
  const domain = await ctx.storageDomain.open(spec)
  const bindings = domain.table('bindings')
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
  ctx.effect(() => () => { revoke(); lifetime.abort(); return domain.close() }, 'QZOS employee lifetime')
  const adapter = config.execution ? await execution(ctx, config, process.env[config.execution.secretEnv] ?? '', () => active, id => bindings.get(id)) : undefined
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
        if (input.action === 'authorize') { activate(owner, input.token); if (active) await adapter?.recover(active); return }
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
        adapter?.attach(agent)
      })
      if (input.action === 'bind') pending.set(input.sessionId, operation)
      mutation = operation.catch(() => { /* The individual request reports its failure; the queue remains usable. */ })
      try { await operation } finally {
        if (input.action === 'bind' && pending.get(input.sessionId) === operation) pending.delete(input.sessionId)
      }
      res.end(JSON.stringify({ ok: true }))
    } catch (error) {
      res.statusCode = 400
      res.end(JSON.stringify({ ok: false, message: error instanceof z.ZodError ? 'Invalid employee request' : error instanceof Error ? error.message : 'Employee request failed' }))
    }
  } }), 'QZOS employee authenticated route')
  // Native forks inherit the same immutable owner/employee binding, including nested forks.
  ctx.on('agent/created', async ({ agent }) => {
    const parent = agent.session.header.parentSession
    if (!parent) { adapter?.attach(agent); return }
    await pending.get(parent)
    const inherited = bindings.get(parent)
    if (inherited && !bindings.get(agent.session.id)) await bindings.put(agent.session.id, inherited)
    adapter?.attach(agent)
  })
  ctx.on('agent/pre-step', async ({ agent, signal, turn }, next) => {
    await pending.get(agent.session.id)
    const binding = bindings.get(agent.session.id)
    if (!binding) {
      if (agent.session.header.parentSession && bindings.get(agent.session.header.parentSession)) throw new Error('员工会话分叉尚未支持，请从员工入口新建会话')
      return next()
    }
    adapter?.attach(agent)
    const credential = active
    if (!credential || binding.apiUrl !== config.apiUrl || credential.userId !== binding.userId) throw new Error('请使用该员工会话所属的 QZOS 账号重新登录')
    const owner = await userId(config, credential.token, signal)
    if (owner !== binding.userId) throw new Error('员工会话账号不匹配')
    const decision = await next()
    if (decision.kind === 'reject') return decision
    const question = decision.messages.filter(message => message.source.kind === 'user')
      .flatMap(message => message.content.flatMap(part => part.type === 'text' ? [part.text] : [])).join('\n')
    const details = question.trim() ? await contextDetails(config, credential.token, binding.employeeId, question, signal) : undefined
    if (!details) await employee(config, credential.token, binding.employeeId, signal)
    if (active !== credential) throw new Error('QZOS 登录已变化，请重新发送')
    await adapter?.prepare(agent.session.id, {
      userId: binding.userId, employeeId: binding.employeeId, turn, question, sources: details?.sources ?? [],
    })
    const text = details?.text
    return text ? { ...decision, messages: [createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'qzos-employee-context', form: 'snapshot' } }), ...decision.messages] } : decision
  }, { prepend: true })
}
