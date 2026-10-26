/** Import controls follow the backend's supported methods and file extensions. */
import { loginRecord, type LoginRecord } from './login-client.ts'

/** Resolve the selected import method without advertising unsupported file types.
 * @param capabilities - Current authenticated import capability response.
 * @param type - Selected QZOS import card.
 * @returns Method number, selectable extensions and server readiness.
 */
export function knowledgeImportOptions(capabilities: LoginRecord, type: string) {
  const method = type === 'qaSplit' ? 2 : type === 'qaImport' ? 3 : type === 'webImport' ? 4 : 1
  const name = method === 1 ? 'document' : method === 2 ? 'qa_split' : method === 3 ? 'csv' : 'web_page'
  const option = loginRecord(loginRecord(capabilities.methods ?? {})[String(method)] ?? {})
  const raw = loginRecord(loginRecord(capabilities.file_contracts ?? {})[name] ?? {}).selectable_extensions
  const extensions = Array.isArray(raw) ? raw.filter((ext): ext is string => typeof ext === 'string' && /^\.[a-z0-9]+$/i.test(ext)) : []
  const available = method === 1 ? option.mode === 'server' && extensions.length > 0
    : method === 4 ? option.mode === 'browser' || option.mode === 'server'
      : option.supports_server_preview === true && extensions.length > 0
  return { method, extensions, available, mode: option.mode === 'server' || option.mode === 'browser' ? option.mode : 'unavailable' }
}

/** Validate the whole selection before replacing the user's existing import draft.
 * @param files - Files from a picker or drop event.
 * @param extensions - Allowed extensions from the server.
 * @param version - Whether this is a replacement version of one document.
 * @returns Whether the selection can enter the import form.
 */
export function acceptsKnowledgeFiles(files: readonly File[], extensions: readonly string[], version: boolean): boolean {
  return files.length > 0 && files.length <= (version ? 1 : 50)
    && files.every(file => extensions.some(ext => file.name.toLowerCase().endsWith(ext)))
}
