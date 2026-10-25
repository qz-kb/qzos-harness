/** Configure per-run Electron data and journal paths before production imports. */
export function configureInstalledUpdateIdentity(
  app: { getPath(name: string): string; setPath(name: string, path: string): void },
  run: { id: string; versions: readonly string[] },
  metadata: { version?: string; dshDesktopAppId?: string },
  environment: NodeJS.ProcessEnv,
): { root: string; userData: string; harnessHome: string; journals: string }

/** Isolate unsigned self-hosted test packages before importing the production main entry. */
export function configureUnsignedWindowsTestIdentity(
  app: { getPath(name: string): string; setPath(name: string, path: string): void },
  metadata: { name?: string; qzosDesktopTestReleaseId?: string; qzosWindowsUpdateTrust?: string },
  environment: NodeJS.ProcessEnv,
): { root: string; userData: string; harnessHome: string; agentsHome: string; journals: string }

/** Resolve an unsigned test package's private protocol; ordinary packages return undefined. */
export function unsignedWindowsTestProtocol(metadata: unknown): string | undefined
