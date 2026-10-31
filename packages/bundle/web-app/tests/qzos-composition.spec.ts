/** Private composition uses shipped bundle layers and preserves deployment overrides. */
import { fileURLToPath } from 'node:url'
import { applyEntryPatches } from '@deepseek-ai/cordis-plugin-include'
import { bundlePatchPaths, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { expect, it } from 'vitest'
import manifest from '../package.json' with { type: 'json' }

it('loads private rows once and lets deployment configure the same Host row', () => {
  const paths = bundlePatchPaths(fileURLToPath(new URL('..', import.meta.url)), manifest.dsh.bundle)
  const privatePaths = paths.filter(path => path.endsWith('/qzos.patch.yml'))
  expect(privatePaths).toHaveLength(1)
  expect(paths.at(-1)).toBe(privatePaths[0])
  expect(manifest.files).toContain('qzos.patch.yml')
  const load = (path: string) => loadOverlayPatches('qzos-composition', path)
  const upstreamRows = paths.filter(path => !privatePaths.includes(path))
    .flatMap(load).flatMap(patch => patch.insert ?? [])
  expect(upstreamRows.some(row => row.id === 'ui-qzos' || row.id === 'qzos-employees')).toBe(false)
  expect(upstreamRows.some(row => row.id === 'ui-chat')).toBe(true)
  const fail = (message: string) => { throw new Error(message) }
  const rows = applyEntryPatches([], privatePaths.flatMap(load), fail)
  expect(rows.map(row => row.id)).toEqual(['ui-qzos', 'qzos-employees'])
  const deployed = applyEntryPatches(rows, [{
    id: 'qzos-employees', config: {
      apiUrl: 'http://business.invalid/api', ownerUserId: '42', managedGateway: true,
      execution: { secretEnv: 'QZOS_TEST_BRIDGE_SECRET' },
    },
  }], fail)
  expect(deployed.filter(row => row.id === 'qzos-employees')).toHaveLength(1)
  expect(deployed.find(row => row.id === 'qzos-employees')?.config).toMatchObject({
    apiUrl: 'http://business.invalid/api', ownerUserId: '42', managedGateway: true,
    execution: { secretEnv: 'QZOS_TEST_BRIDGE_SECRET' },
  })
})
