/** Shared catalog types; IDs address server resources, never synthetic samples. */
export type CatalogId = 'knowledge' | 'employees' | 'connectors' | 'skills' | 'templates'
export type Panel = CatalogId
export interface Example {
  id: string
  title: string
  description: string
  category: string
  status: 'ready' | 'pending' | 'error' | 'loading'
  content: string
  scope?: 'owned' | 'shared' | 'public' | 'private'
  metadata?: string
  values?: Record<string, string>
}
export const panels: readonly Panel[] = ['knowledge', 'employees', 'connectors', 'skills', 'templates']
