import { expect, it, vi, afterEach } from 'vitest'
import { readProductUpdates, visibleReleases, qzosSurface, qzosVersionedUrl } from '../src/client/product-updates.ts'
afterEach(() => vi.unstubAllGlobals())
const reply = () => ({ schema: 'qzos.product-updates.v1', server_version: '2.13.0', compatibility: { status: 'compatible', message: '' }, releases: [
  { version: '2.13.0', date: '2026-10-24', components: { web: '2.13.0' }, changes: [
    { kind: 'fix', text: '<script>plain text</script>', surfaces: ['web'] },
    { kind: 'feature', text: 'admin only', surfaces: ['admin'] },
  ] },
] })
it('filters one authored history without treating server and client versions as equal', () => {
  const data = readProductUpdates(reply())
  expect(visibleReleases(data.releases, 'web')[0]?.changes).toHaveLength(1)
  expect(visibleReleases(data.releases, 'all')[0]?.changes).toHaveLength(2)
  expect(visibleReleases(data.releases, 'desktop')).toEqual([])
  expect(visibleReleases(data.releases, 'web')[0]?.changes[0]?.text).toBe('<script>plain text</script>')
})
it('rejects malformed wire data and preserves explicit unknown compatibility', () => {
  expect(() => readProductUpdates({})).toThrow()
  const data = reply(); data.releases[0]!.changes[0]!.kind = 'install'
  expect(() => readProductUpdates(data)).toThrow()
  const unknown = reply(); unknown.compatibility.status = 'unknown'
  expect(readProductUpdates(unknown).compatibility.status).toBe('unknown')
})
it('declares desktop only for the existing native carrier, without invoking updates', () => {
  expect(qzosSurface()).toBe('web')
  vi.stubGlobal('dshDesktop', { protocolVersion: 1 })
  expect(qzosSurface()).toBe('desktop')
})

it('preserves business queries without requiring new cross-origin headers', () => {
  const url = new URL(qzosVersionedUrl('https://business.invalid/api/kb.know/lists?type=0'))
  expect(url.searchParams.get('type')).toBe('0')
  expect(url.searchParams.get('qzos_version')).toBe('2.13.0')
  expect(url.searchParams.get('qzos_surface')).toBe('web')
  expect(url.username).toBe('')
})
