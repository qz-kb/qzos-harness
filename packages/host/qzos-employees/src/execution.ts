/** Trusted Host receipts for the selected work-window route; no model routing overrides. */
import { setTimeout as delay } from 'node:timers/promises'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { employee, type BusinessConfig } from './business.ts'
import { installTools } from './tools.ts'
import { installKnowledgeTools } from './knowledge-tools.ts'

const metadata = z.object({
  userId: z.string(), employeeId: z.string(), turn: z.number().int(),
  question: z.string(), sources: z.array(z.record(z.string(), z.unknown())),
})
const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(), completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
})
const journal = metadata.extend({
  sessionId: z.string(), callId: z.string(), reply: z.string(), usage: usageSchema.nullable(), issued: z.boolean(),
  registration: z.object({
    call_id: z.string(), robot_id: z.number(), session_id: z.string(), turn_id: z.string(),
    provider: z.string(), model: z.string(), purpose: z.string(), question: z.string(),
    sources: z.array(z.record(z.string(), z.unknown())),
  }).optional(),
})
const spec = defineDomain({ name: 'qzos_execution', version: 1, tables: { turns: domainTable(metadata), receipts: domainTable(journal) } })
class ReceiptRefused extends Error {
  constructor(message: string | undefined, readonly code: string) { super(message) }
}
class RetrievalPending extends Error {}
class ReceiptTransportError extends Error {}
/** Immutable credential captured before one operation. */
export interface Credential { userId: string; token: string }
/** Normalize provider counters; absent or inconsistent totals stay unknown.
 * @param value - Last authoritative provider usage.
 * @returns Exact disjoint counters or null.
 */
export function receiptUsage(value?: TokenUsage): z.infer<typeof usageSchema> | null {
  if (!value) return null
  const prompt = value.inputTokens + (value.cacheReadTokens ?? 0) + (value.cacheWriteTokens ?? 0)
  const result = {
    prompt_tokens: prompt, completion_tokens: value.outputTokens, total_tokens: value.totalTokens ?? prompt + value.outputTokens,
  }
  return Object.values(result).every(n => Number.isSafeInteger(n) && n >= 0)
    && result.total_tokens === prompt + value.outputTokens ? result : null
}
/** Install the optional business execution adapter.
 * @param ctx - Host services.
 * @param config - Business endpoint.
 * @param secret - Host/server shared signing secret, never exposed to the browser or model.
 * @param credential - Current business login.
 * @param binding - Immutable session binding lookup.
 * @returns Step metadata, receipt recovery and per-agent tool attachment.
 */
export async function execution(
  ctx: Context, config: BusinessConfig, secret: string, credential: () => Credential | undefined,
  binding: (session: string) => { userId: string; employeeId: string } | undefined,
) {
  if (secret.length < 32) throw new Error('QZOS DSH bridge secret is unavailable')
  const domain = await ctx.storageDomain.open(spec)
  const turns = domain.table('turns'); const receipts = domain.table('receipts')
  const lifetime = new AbortController()
  const attached = new WeakSet<Agent>()
  const flights = new Map<string, Promise<void>>()
  ctx.effect(() => () => { lifetime.abort(); return domain.close() }, 'QZOS execution journal')
  const signed = async (auth: Credential, action: string, data: object, signal: AbortSignal): Promise<unknown> => {
    const body = JSON.stringify(data); const time = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', secret).update(`${time}\n${action}\n${createHash('sha256').update(auth.token).digest('hex')}\n${body}`).digest('hex')
    let response: Response; let raw: unknown
    try {
      response = await fetch(`${config.apiUrl}/kb.dsh/${action}`, { method: 'POST', redirect: 'error', body,
        headers: { token: auth.token, terminal: '4', version: '4.8.0', 'Content-Type': 'application/json', 'X-Qzos-Dsh-Time': time, 'X-Qzos-Dsh-Signature': signature },
        signal: AbortSignal.any([signal, AbortSignal.timeout(config.requestTimeoutMs)]),
      })
      raw = await response.json()
    } catch (cause) {
      if (action !== 'retrieve') throw cause
      throw new ReceiptTransportError(cause instanceof Error ? cause.message : 'QZOS receipt unavailable', { cause })
    }
    const result = z.object({ code: z.number(), msg: z.string().optional(), data: z.unknown() }).parse(raw)
    if (result.code !== 1) {
      const refusal = z.object({ error_code: z.string() }).safeParse(result.data)
      const rejected = [
        'DSH_REQUEST_INVALID', 'DSH_CHAT_NOT_LICENSED', 'DSH_ACCOUNT_UNAVAILABLE', 'DSH_EMPLOYEE_UNAVAILABLE',
        'DSH_WINDOW_MODEL_UNMAPPED', 'DSH_QUOTA_INSUFFICIENT', 'DSH_REQUEST_CONFLICT',
      ]
      if (refusal.success && rejected.includes(refusal.data.error_code)) throw new ReceiptRefused(result.msg, refusal.data.error_code)
      if (action === 'retrieve' && refusal.success && refusal.data.error_code === 'DSH_RETRIEVAL_PENDING') throw new RetrievalPending(result.msg)
      throw new Error(result.msg ?? 'QZOS receipt unavailable')
    }
    if (!response.ok) throw new Error('QZOS receipt unavailable')
    return result.data
  }
  const drain = async (auth: Credential) => {
    const previous = flights.get(auth.userId)
    if (previous) await previous
    const task = (async () => {
      for (const [key, item] of receipts.entries()) {
        if (item.userId !== auth.userId || item.issued) continue
        if (item.registration) {
          // The provider was never entered. Replay admission with the same identity,
          // then close it with exact zero usage; do not create an empty answer.
          try { await signed(auth, 'begin', item.registration, lifetime.signal) }
          catch (error) {
            // These refusals occur only after the server has ruled out an existing admission.
            if (!(error instanceof ReceiptRefused) || ![
              'DSH_CHAT_NOT_LICENSED', 'DSH_ACCOUNT_UNAVAILABLE', 'DSH_EMPLOYEE_UNAVAILABLE',
              'DSH_WINDOW_MODEL_UNMAPPED', 'DSH_QUOTA_INSUFFICIENT',
            ].includes(error.code)) throw error
            await receipts.delete(key)
            continue
          }
          await signed(auth, 'complete', { call_id: item.callId, reply: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }, lifetime.signal)
          await receipts.delete(key)
          continue
        }
        await signed(auth, 'complete', { call_id: item.callId, reply: item.reply, usage: item.usage }, lifetime.signal)
        await signed(auth, 'finish', { session_id: item.sessionId, turn_id: String(item.turn) }, lifetime.signal)
        await receipts.delete(key)
      }
    })()
    flights.set(auth.userId, task)
    try { await task } finally { flights.delete(auth.userId) }
  }
  // A crashed request has no trustworthy usage. Recover its identity, never replay its model call.
  for (const [key, item] of receipts.entries()) if (item.issued) await receipts.put(key, { ...item, issued: false })
  const retrieveRequest = async (auth: Credential, input: object, signal: AbortSignal): Promise<unknown> => {
    const active = AbortSignal.any([signal, lifetime.signal])
    let transportRecovered = false
    for (;;) {
      active.throwIfAborted()
      try { return await signed(auth, 'retrieve', input, active) }
      catch (error) {
        active.throwIfAborted()
        if (error instanceof RetrievalPending) {
          // Keep the current turn and identity while the server's original request finishes.
          await delay(Math.min(1000, config.requestTimeoutMs), undefined, { signal: active })
          continue
        }
        if (!(error instanceof ReceiptTransportError)) throw error
        if (transportRecovered) throw new Error('知识检索连接中断，自动恢复未成功，请稍后重新提问；本次已发生的用量保留核对。')
        transportRecovered = true
      }
    }
  }
  const search = async (auth: Credential, session: SessionId, question: string, signal: AbortSignal): Promise<unknown> => {
    await drain(auth)
    const bound = binding(session)
    if (!bound) throw new Error('请先打开该员工会话')
    const turn = turns.get(session)?.turn
    if (turn === undefined) throw new Error('当前消息尚未准备检索，请重新发送')
    return retrieveRequest(auth, {
      call_id: randomUUID(), robot_id: Number(bound.employeeId), session_id: session, turn_id: String(turn), question,
    }, signal)
  }
  const searchKnowledge = async (auth: Credential, session: SessionId, knowledgeIds: readonly number[], question: string, signal: AbortSignal): Promise<unknown> => {
    await drain(auth)
    const turn = turns.get(session)?.turn ?? 0
    return retrieveRequest(auth, {
      call_id: randomUUID(), session_id: session, turn_id: String(turn), question, knowledge_ids: knowledgeIds,
    }, signal)
  }
  const attach = (agent: Agent) => {
    if (attached.has(agent)) return
    if (!binding(agent.session.id)) {
      installKnowledgeTools(agent, config, credential, (auth, knowledgeIds, question, signal) => (
        searchKnowledge(auth, agent.session.id, knowledgeIds, question, signal)
      ))
      attached.add(agent)
      return
    }
    installTools(agent, config, credential, binding, signed,
      (auth, question, signal) => search(auth, agent.session.id, question, signal))
    attached.add(agent)
  }
  ctx.on('llm/stream', async function* (options, next) {
    const session = options.sessionId
    const bound = session && binding(session)
    if (!session || !bound) { yield* next(); return }
    const auth = credential(); const turn = turns.get(session)
    if (!auth || auth.userId !== bound.userId || !turn || turn.userId !== auth.userId) throw new Error('请先使用员工会话所属账号重新登录并发送消息')
    await drain(auth)
    await employee(config, auth.token, bound.employeeId, options.signal ?? lifetime.signal)
    if (credential() !== auth) throw new Error('QZOS 登录已变化')
    const callId = randomUUID()
    const registration = { call_id: callId, robot_id: Number(bound.employeeId), session_id: session, turn_id: String(turn.turn), provider: options.provider, model: options.model, purpose: options.purpose ?? '', question: turn.question, sources: turn.sources }
    let item: z.infer<typeof journal> = { ...turn, sessionId: session, callId, reply: '', usage: null, issued: true, registration }
    await receipts.put(callId, item)
    try { await signed(auth, 'begin', registration, options.signal ?? lifetime.signal) }
    catch (error) {
      if (error instanceof ReceiptRefused) await receipts.delete(callId)
      else await receipts.put(callId, { ...item, issued: false })
      throw error
    }
    item = { ...item, registration: undefined }
    await receipts.put(callId, item)
    let usage: TokenUsage | undefined
    try {
      for await (const chunk of next()) {
        if (chunk.type === 'text-delta') item = { ...item, reply: item.reply + chunk.text }
        if (chunk.type === 'usage') usage = chunk.usage
        yield chunk
      }
    } finally {
      item = { ...item, usage: receiptUsage(usage), issued: false }
      await receipts.put(callId, item)
      // Agent cancellation does not discard already received usage. Only plugin unload ends this write.
      await drain(auth)
    }
  })
  ctx.on('agent/turn-stopping', async ({ agent }) => { const auth = credential(); if (auth && binding(agent.session.id)?.userId === auth.userId) await drain(auth) })
  return {
    attach, recover: drain,
    async retrieve(auth: Credential, session: SessionId, employeeId: string, turn: number, question: string, signal: AbortSignal) {
      await drain(auth)
      const hash = createHash('sha256').update(JSON.stringify([auth.userId, session, employeeId, turn, question])).digest('hex')
      const callId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
      const input = { call_id: callId, robot_id: Number(employeeId), session_id: session, turn_id: String(turn), question }
      return retrieveRequest(auth, input, signal)
    },
    search,
    searchKnowledge,
    async prepare(session: SessionId, value: z.infer<typeof metadata>) {
      const previous = turns.get(session)
      // Tool continuation carries no new user message; retain the turn's original evidence.
      if (previous?.turn === value.turn && previous.userId === value.userId
        && previous.employeeId === value.employeeId && !value.question.trim()) return
      await turns.put(session, value)
    },
  }
}
