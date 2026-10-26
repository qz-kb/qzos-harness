/** Keep native catalog resources subscribed only for the current signed-in account. */
import type { PanelProps } from './Panel.tsx'

type RetentionProps = Pick<PanelProps, 'useStore' | 'useResource'>
/** The shell owns catalog lifetime across navigation; account changes release both sources. */
export function CatalogRetention(props: RetentionProps) {
  const user = props.useStore(state => state.businessUser)
  const epoch = props.useStore(state => state.businessEpoch)
  return user ? <CatalogSources key={epoch} {...props} /> : null
}
function CatalogSources({ useStore, useResource }: RetentionProps) {
  const epoch = useStore(state => state.businessEpoch)
  const revision = useStore(state => state.knowledgeRevision)
  useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/list?epoch=${epoch}&revision=${revision}`)
  useResource<'qzos-knowledge'>(`dsh-resource://qzos-knowledge/employees?epoch=${epoch}&revision=${revision}`)
  return null
}
