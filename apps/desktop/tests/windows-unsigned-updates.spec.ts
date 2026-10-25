import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'
import { windowsUnsignedUpdates } from '../scripts/desktop-auto-update-environment.mjs'
import { createDesktopArtifactPlan, createDesktopUploadPlan } from '../scripts/desktop-upload-plan.ts'
import { exportWindowsUpdate } from '../scripts/export-windows-update.ts'

const env = {
  DSH_DESKTOP_APP_ID: 'com.qzos.desktop', DSH_DESKTOP_UNSIGNED: '1', DSH_DESKTOP_WINDOWS_UNSIGNED_UPDATES: '1',
  DSH_DESKTOP_AUTO_UPDATE_ENV: 'test', DOWNLOAD_TEST_ORIGIN: 'https://updates.example.com',
  DOWNLOAD_TEST_RELEASE_ID: '0123456789abcdef0123456789abcdef',
  DSH_DESKTOP_MANDATORY_UPDATE_TEST_ORIGIN: 'https://policy.example.com',
  DSH_DESKTOP_MANDATORY_UPDATE_CONFIG: '{"allowedAuthOrigins":["https://login.example.com"]}',
}
const prefix = 'qzos-desktop/unsigned/0123456789abcdef0123456789abcdef'
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

it('enables only the explicit unsigned Windows feed without signing credentials', () => {
  const config = createElectronBuilderConfig(env, 'win32', 'x64')
  expect(config.win.forceCodeSigning).toBe(false)
  expect(config.win.verifyUpdateCodeSignature).toBe(false)
  expect(config.win.signtoolOptions.publisherName).toBeUndefined()
  expect(config.extraMetadata.qzosWindowsUpdateTrust).toBe('unsigned-https')
  expect(config.extraMetadata.name).toBe(`qzos-desktop-test-${env.DOWNLOAD_TEST_RELEASE_ID}`)
  expect(config.extraMetadata.main).toBe('windows-test-bootstrap.mjs')
  expect(config.extraMetadata.qzosDesktopTestReleaseId).toBe(env.DOWNLOAD_TEST_RELEASE_ID)
  expect(config.protocols).toEqual([{ name: 'QZOS update test', schemes: [`qzos-test-${env.DOWNLOAD_TEST_RELEASE_ID}`] }])
  expect(config.publish).toEqual([{ provider: 'generic', url: `https://updates.example.com/${prefix}/feeds/win-x64/`, channel: 'nightly' }])
  expect(config.artifactName).toContain('-unsigned.')
  expect(() => windowsUnsignedUpdates(env, 'darwin')).toThrow(/Windows/)
  expect(() => windowsUnsignedUpdates({ ...env, DSH_DESKTOP_UNSIGNED: '0' }, 'win32')).toThrow(/unsigned Windows/)
  expect(() => createElectronBuilderConfig({ ...env, DOWNLOAD_TEST_ORIGIN: 'http://unsafe.example.com' }, 'win32', 'x64')).toThrow(/HTTPS/)
  const local = createElectronBuilderConfig({ ...env, DSH_DESKTOP_WINDOWS_UNSIGNED_UPDATES: '0' }, 'win32', 'x64')
  expect(local.publish).toBeNull()
  expect(local.extraMetadata.main).toBeUndefined()
  expect(local.win.verifyUpdateCodeSignature).toBe(true)
  expect(windowsUnsignedUpdates({}, 'darwin')).toBe(false)
})

it('keeps production launches out of the test-data bootstrap', () => {
  const config = createElectronBuilderConfig({ ...env, DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
    DOWNLOAD_PROD_ORIGIN: 'https://updates.example.com',
    DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN: 'https://policy.example.com',
    DSH_DESKTOP_MANDATORY_UPDATE_CONFIG: '{}' }, 'win32', 'x64')
  expect(config.extraMetadata.main).toBeUndefined()
  expect(config.extraMetadata.name).toBeUndefined()
  expect(config.extraMetadata.qzosDesktopTestReleaseId).toBeUndefined()
  expect(config.protocols).toEqual([{ name: 'DeepSeek Harness', schemes: ['dsh'] }])
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'qzos-windows-update-')); roots.push(root)
  const appRoot = join(root, 'app'), artifactsRoot = join(root, 'artifacts')
  await mkdir(appRoot); await mkdir(artifactsRoot)
  for (const path of [root, appRoot]) await writeFile(join(path, 'package.json'), '{"version":"1.2.3"}')
  const name = 'deepseek-harness-1.2.3-win-x64-unsigned.exe'
  const bytes = 'synthetic NSIS bytes; not an installable binary'
  await writeFile(join(artifactsRoot, name), bytes)
  await writeFile(join(artifactsRoot, name + '.blockmap'), 'synthetic blockmap')
  const record = { schemaVersion: 1, target: 'win-x64', version: '1.2.3', environment: 'test', channel: 'nightly',
    signing: 'unsigned', appId: 'com.qzos.desktop', publicUrl: `https://updates.example.com/${prefix}/feeds/win-x64/` }
  await writeFile(join(artifactsRoot, 'win-x64-release.json'), JSON.stringify(record))
  await writeFile(join(artifactsRoot, 'nightly.yml'), JSON.stringify({ version: '1.2.3', path: name,
    files: [{ url: name, size: Buffer.byteLength(bytes), sha512: createHash('sha512').update(bytes).digest('base64') }] }))
  return { root, name, record, environment: env, repositoryRoot: root, appRoot, artifactsRoot }
}

it('exports verified bytes and metadata without COS credentials or network writes', async () => {
  const f = await fixture()
  const output = join(f.root, 'staged')
  await expect(createDesktopUploadPlan('win-x64', f)).rejects.toThrow(/self-hosted export/ )
  await expect(exportWindowsUpdate(output, { ...f, latest: true })).rejects.toThrow(/complete update feed/)
  const result = await exportWindowsUpdate(output, f)
  expect(result.signing).toBe('unsigned')
  expect(result.files.at(-1)?.channelMetadata).toBe(true)
  expect(await readFile(join(output, prefix, 'bin/win-x64', f.name), 'utf8')).toContain('synthetic NSIS')
  expect(await readFile(join(output, prefix, 'feeds/win-x64/nightly.yml'), 'utf8'))
    .toContain(`https://updates.example.com/${prefix}/bin/win-x64/${f.name}`)
  await expect(exportWindowsUpdate(output, f)).rejects.toThrow()
  await writeFile(join(f.artifactsRoot, f.name), 'tampered')
  await expect(exportWindowsUpdate(join(f.root, 'rejected'), f)).rejects.toThrow(/size|SHA-512/)
})

it('rejects stale signed records, foreign app identities and unsigned artifacts in a signed destination', async () => {
  const f = await fixture(), path = join(f.artifactsRoot, 'win-x64-release.json')
  for (const patch of [{ signing: 'signed' }, { appId: 'com.example.other' }]) {
    await writeFile(path, JSON.stringify({ ...f.record, ...patch }))
    await expect(createDesktopArtifactPlan('win-x64', f)).rejects.toThrow(/signing mode or application identity/)
  }
  await writeFile(path, JSON.stringify(f.record))
  await expect(createDesktopArtifactPlan('win-x64', { ...f, environment: { ...env,
    DSH_DESKTOP_UNSIGNED: '0', DSH_DESKTOP_WINDOWS_UNSIGNED_UPDATES: '0' } })).rejects.toThrow(/signing mode/)
})
