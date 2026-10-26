/** Backend catalog choices used by resource forms, independent of the DSH answer model. */
import { knowledgeRows, knowledgeText } from './knowledge-client.ts'
import type { LoginRecord } from './login-client.ts'
import type { PreviewValues } from './resource-schema.ts'

/** Select a ready backend default, falling back to the first ready configured model.
 * @param models - Authorized model catalog.
 * @returns Defaults for new resources; existing resource identities are never replaced.
 */
export function resourceModelDefaults(models: LoginRecord): PreviewValues {
  const pick = (key: string) => {
    const rows = Array.isArray(models[key]) ? knowledgeRows(models[key]).filter(row => row.is_ready !== false) : []
    return rows.find(row => Number(row.is_default) === 1) ?? rows[0]
  }
  const vector = pick('vectorModels'), ranking = pick('rankingModels')
  const chats = Array.isArray(models.chatModels) ? knowledgeRows(models.chatModels).filter(row =>
    row.is_ready !== false && Array.isArray(row.models) && knowledgeRows(row.models).some(child => child.is_ready !== false),
  ) : []
  const chat = chats.find(row => Number(row.is_default) === 1) ?? chats[0]
  const child = chat ? knowledgeRows(chat.models).find(row => row.is_ready !== false) : undefined
  return {
    embedding_model_id: vector ? knowledgeText(vector.id) : '',
    documents_model_id: chat && child ? `${knowledgeText(chat.id)}:${knowledgeText(child.id)}` : '',
    ranking_model: ranking ? knowledgeText(ranking.id) : '', ranking_status: ranking ? '1' : '0',
  }
}
