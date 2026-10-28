/** QZOS client identity is independent from the upstream DSH runtime version. */
export const qzosClientVersion = '2.14.0'
/** QZOS API protocol version; a Host may inject a newer value at startup. */
export const qzosApiVersion = (globalThis as typeof globalThis & { __QZOS_API_VERSION__?: string }).__QZOS_API_VERSION__ ?? '4.8.0'
/** Detect the carrier without invoking or replacing its update controls.
 * @returns Current QZOS presentation surface.
 */
export function qzosSurface(): 'desktop' | 'web' {
  const carrier = (globalThis as typeof globalThis & { dshDesktop?: { protocolVersion?: number } }).dshDesktop
  return carrier?.protocolVersion === 1 ? 'desktop' : 'web'
}
/** Keep identity compatible with historical CORS header allowlists.
 * @param address - Absolute business endpoint with its existing query.
 * @returns URL carrying public protocol metadata, never credentials.
 */
export function qzosVersionedUrl(address: string): string {
  const url = new URL(address)
  url.searchParams.set('qzos_surface', qzosSurface())
  url.searchParams.set('qzos_version', qzosClientVersion)
  return url.href
}
/** A product release entry, rendered only as text. */
export interface ProductRelease {
  version: string
  date: string
  components: Record<string, string>
  changes: { kind: 'feature' | 'improvement' | 'fix' | 'notice'; text: string; surfaces: string[] }[]
}
/** Data returned by the authenticated Server read, without privileged update actions. */
export interface ProductUpdates {
  available_version?: string | null
  update_check?: string
  server_version: string | null
  compatibility: { status: string; message: string }
  releases: ProductRelease[]
}
/** Validate the business HTTP reply before rendering release history.
 * @param value - Untrusted API data.
 * @returns Bounded update information.
 */
export function readProductUpdates(value: unknown): ProductUpdates {
  const record = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid product updates')
    return v as Record<string, unknown>
  }
  const text = (v: unknown): string => { if (typeof v !== 'string' || v.length > 6000) throw new Error('Invalid product update text'); return v }
  const data = record(value), compatibility = record(data.compatibility)
  if (data.schema !== 'qzos.product-updates.v1' || !Array.isArray(data.releases) || data.releases.length > 100) throw new Error('Invalid product updates')
  return {
    available_version: data.available_version == null ? null : text(data.available_version),
    update_check: data.update_check == null ? 'not_checked' : text(data.update_check),
    server_version: data.server_version === null ? null : text(data.server_version),
    compatibility: { status: text(compatibility.status), message: text(compatibility.message) },
    releases: data.releases.map((v) => {
      const r = record(v)
      if (!Array.isArray(r.changes) || r.changes.length > 100) throw new Error('Invalid release changes')
      return { version: text(r.version), date: text(r.date),
        components: Object.fromEntries(Object.entries(record(r.components)).map(([k, v]) => [k, text(v)])),
        changes: r.changes.map((v) => { const c = record(v); if (!['feature', 'improvement', 'fix', 'notice'].includes(String(c.kind)) || !Array.isArray(c.surfaces) || !c.surfaces.every(s => ['admin', 'desktop', 'web'].includes(s))) throw new Error('Invalid release change'); return { kind: c.kind as ProductRelease['changes'][number]['kind'], text: text(c.text), surfaces: c.surfaces.map(text) } }) }
    }),
  }
}
/** Keep all component versions visible while filtering changes for this client.
 * @param releases - Validated release history.
 * @param surface - Current surface or all.
 * @returns Releases with matching changes.
 */
export function visibleReleases(releases: ProductRelease[], surface: string): ProductRelease[] {
  return releases.map(r => ({ ...r, changes: r.changes.filter(c => surface === 'all' || c.surfaces.includes(surface)) })).filter(r => r.changes.length > 0)
}
