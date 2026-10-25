/** Configure only a qualification package's identity before the production main entry loads. */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Keep test application data and journals outside the replaceable installation tree.
 * @param {{ getPath(name: string): string, setPath(name: string, path: string): void }} app Electron path API before readiness.
 * @param {{ id: string, versions: readonly string[] }} run Embedded qualification identity and version pair.
 * @param {{ version?: string, dshDesktopAppId?: string }} metadata Installed package metadata.
 * @param {NodeJS.ProcessEnv} environment Main-process environment modified before production imports.
 * @returns {{ root: string, userData: string, harnessHome: string, journals: string }} Shared paths for both versions.
 */
export function configureInstalledUpdateIdentity(app, run, metadata, environment) {
  if (!/^[a-f0-9]{24}$/u.test(run.id) || run.versions.length !== 2
    || metadata.dshDesktopAppId !== `com.deepseek.dsh.qualification.q${run.id}`
    || !run.versions.includes(metadata.version)) {
    throw new Error('installed update: qualification package identity does not match its bootstrap')
  }
  const root = join(app.getPath('appData'), 'dsh-update-qualification', run.id)
  const paths = { root, userData: join(root, 'user-data'), harnessHome: join(root, 'dsh-home'), journals: join(root, 'journals') }
  for (const directory of [paths.userData, paths.harnessHome, paths.journals]) mkdirSync(directory, { recursive: true })
  app.setPath('userData', paths.userData)
  app.setPath('sessionData', paths.userData)
  environment.DSH_HOME = paths.harnessHome
  environment.DSH_DESKTOP_UPDATE_JOURNAL_DIR = paths.journals
  return paths
}

/**
 * Isolate self-hosted unsigned test packages on every launch, including installer restarts.
 * @param {{ getPath(name: string): string, setPath(name: string, path: string): void }} app Electron paths before main loads.
 * @param {{ name?: string, qzosDesktopTestReleaseId?: string, qzosWindowsUpdateTrust?: string }} metadata Installed test metadata.
 * @param {NodeJS.ProcessEnv} environment Environment inherited by the Host and installer.
 * @returns {{ root: string, userData: string, harnessHome: string, agentsHome: string, journals: string }} Stable batch-owned paths.
 */
export function configureUnsignedWindowsTestIdentity(app, metadata, environment) {
  const id = metadata.qzosDesktopTestReleaseId
  if (unsignedWindowsTestProtocol(metadata) === undefined || typeof id !== 'string') {
    throw new Error('installed update: invalid unsigned test package identity')
  }
  const root = join(app.getPath('appData'), 'qzos-desktop-test', id)
  const paths = { root, userData: join(root, 'user-data'), harnessHome: join(root, 'dsh-home'),
    agentsHome: join(root, 'agents-home'), journals: join(root, 'journals') }
  for (const directory of [paths.userData, paths.harnessHome, paths.agentsHome, paths.journals]) mkdirSync(directory, { recursive: true })
  app.setPath('userData', paths.userData)
  app.setPath('sessionData', paths.userData)
  environment.DSH_HOME = paths.harnessHome
  environment.DSH_AGENTS_HOME = paths.agentsHome
  environment.DSH_DESKTOP_UPDATE_JOURNAL_DIR = paths.journals
  return paths
}

/**
 * Read the batch protocol without allowing a test package to claim the installed DSH handler.
 * @param {unknown} metadata Installed manifest.
 * @returns {string | undefined} Test protocol, or undefined for an ordinary package.
 */
export function unsignedWindowsTestProtocol(metadata) {
  if (typeof metadata !== 'object' || metadata === null || !('qzosDesktopTestReleaseId' in metadata)) return undefined
  const id = metadata.qzosDesktopTestReleaseId
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/u.test(id)
    || !('name' in metadata) || metadata.name !== `qzos-desktop-test-${id}`
    || !('qzosWindowsUpdateTrust' in metadata) || metadata.qzosWindowsUpdateTrust !== 'unsigned-https') {
    throw new Error('installed update: invalid unsigned test package identity')
  }
  return `qzos-test-${id}`
}
