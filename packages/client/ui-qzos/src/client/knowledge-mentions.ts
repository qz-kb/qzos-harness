/** Knowledge-base mentions in ordinary work windows; the model resolves names through Host tools. */
import type { Context } from '@deepseek-ai/cordis'
import type { ReferenceInsert } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { knowledgePages, knowledgeText } from './knowledge-client.ts'
import { storedLogin } from './login-client.ts'
import type { QzosKey } from './locales.ts'

const sourceName = 'qzos-knowledge'
type Translate = (key: QzosKey) => string

/** Register the `@knowledge` source for ordinary work-window conversations.
 * The reference serializes to its visible `@name`; Host knowledge tools resolve
 * the name to authorized ids and perform the actual retrieval.
 * @param ctx - Browser plugin context.
 * @param t - Localized QZOS copy.
 */
export function installKnowledgeMentions(ctx: Context, t: Translate): void {
  const lifetime = new AbortController()
  ctx.effect(() => () => { lifetime.abort() }, 'qzos knowledge mentions')
  let bases: readonly { id: string; name: string }[] = []
  const decode = (ref: string): { id: string; name: string } => {
    const value: unknown = JSON.parse(ref)
    if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value)
      || typeof value.id !== 'string' || typeof value.name !== 'string') throw new Error(t('knowledge'))
    return { id: value.id, name: value.name }
  }
  const reference = (item: { id: string; name: string }): ReferenceInsert => ({
    source: sourceName, ref: JSON.stringify(item), label: `@${item.name}`,
    clipboardText: `@${item.name}`, appearance: 'session',
  })
  const source: InputTriggerSource = {
    trigger: '@', name: sourceName, order: -5, showGroupTitle: true,
    async candidates(_session, { query, quoted, signal }) {
      if (quoted || !storedLogin(sessionStorage)) return []
      const active = AbortSignal.any([lifetime.signal, signal])
      const [own, shared] = await Promise.all([
        knowledgePages('/kb.know/lists?type=1', active),
        knowledgePages('/kb.know/lists?type=0', active),
      ])
      const byId = new Map<string, { id: string; name: string }>()
      for (const row of [...own, ...shared]) {
        const id = knowledgeText(row.id)
        const name = knowledgeText(row.name)
        if (id && name) byId.set(id, { id, name })
      }
      bases = [...byId.values()]
      const needle = query.toLowerCase()
      return bases.filter(item => `${item.name} ${item.id}`.toLowerCase().includes(needle)).map(item => ({
        name: item.name, value: item.id, description: t('knowledgeReferenceHint'), section: t('knowledge'),
      }))
    },
    onPick({ candidate }) {
      const item = bases.find(base => base.id === candidate.value)
      return item ? { insert: reference(item) } : 'handled'
    },
    codec: {
      clipboardText(ref) {
        try { return `@${decode(ref).name}` } catch { return `@${t('knowledge')}` }
      },
      serialize(ref) {
        try { return Promise.resolve(`@${decode(ref).name}`) } catch (error) { return Promise.reject(error) }
      },
    },
  }
  ctx.effect(() => ctx.inputTriggers.registerSource(source), 'qzos knowledge input source')
}
