/** Validate the assembled application, including native Office conversion outside ASAR. */
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { resolveDesktopAutoUpdateConfig, windowsUnsignedUpdates } from './desktop-auto-update-environment.mjs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { desktopArtifactOutput, resolveDesktopBuildTarget, resolveDesktopTargetBuildPaths } from './desktop-build-paths.mjs'
import { readDesktopRuntime, verifyDesktopRuntime } from '../src/runtime-tree.ts'
import { verifyWindowsCode } from './windows-runtime-signature.mjs'
import { smokePreparedRuntime } from './smoke-prepared-runtime.ts'
import { resolveDesktopPackageTarget } from './package-target.ts'

const paths = resolveDesktopTargetBuildPaths()
const { values } = parseArgs({ options: { unsigned: { type: 'boolean', default: false }, 'skip-notarization': { type: 'boolean', default: false } }, allowPositionals: false })
const target = resolveDesktopBuildTarget()
const windows = target === 'win-x64'
const artifacts = desktopArtifactOutput(paths, { unsigned: values.unsigned, skipNotarization: values['skip-notarization'] }).directory
const application = windows ? join(artifacts, 'win-unpacked')
  : join(artifacts, target === 'mac-arm64' ? 'mac-arm64' : 'mac', 'DeepSeek Harness.app', 'Contents')
const resources = join(application, windows ? 'resources' : 'Resources')
const executable = windows ? join(application, 'QZOS.exe') : join(application, 'MacOS', 'DeepSeek Harness')
const descriptor = await verifyDesktopRuntime(paths.dsh, readDesktopRuntime(paths.dsh).release.version,
  resolveDesktopPackageTarget(target))
if (windows && !values.unsigned) await verifyWindowsCode(application)
await smokePreparedRuntime(join(resources, 'app.asar', 'dsh'), executable, join(resources, 'runtime'), descriptor)

if (windows && windowsUnsignedUpdates(process.env, 'win32')) {
  const value = load(readFileSync(join(resources, 'app-update.yml'), 'utf8')) as Record<string, unknown>
  const expected = resolveDesktopAutoUpdateConfig(process.env, 'win32', 'x64')
  if (value?.provider !== 'generic' || value.url !== expected.publicUrl || value.channel !== expected.channel
    || value.publisherName != null) throw new Error('Unsigned Windows package has an invalid update feed or publisher requirement')
}
