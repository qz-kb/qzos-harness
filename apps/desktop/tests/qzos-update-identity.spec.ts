import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDesktopPackageEnvironment } from '../scripts/desktop-package-environment.mjs'
import { resolveDesktopPolicyEnvironment } from '../scripts/desktop-policy-environment.mjs'
import { expect, it } from 'vitest'
import { resolveDesktopAutoUpdateConfig } from '../scripts/desktop-auto-update-environment.mjs'
import { resolveDesktopAppId } from '../scripts/desktop-release-environment.mjs'
it('requires a product-owned update origin and application identity', () => {
  expect(() => resolveDesktopAutoUpdateConfig({ DSH_DESKTOP_AUTO_UPDATE_ENV: 'production' }, 'darwin', 'arm64')).toThrow(/DOWNLOAD_PROD_ORIGIN/)
  expect(() => resolveDesktopAutoUpdateConfig({ DSH_DESKTOP_AUTO_UPDATE_ENV: 'production', DOWNLOAD_PROD_ORIGIN: 'https://download.deepseek.com' }, 'darwin', 'arm64')).toThrow(/product-owned/)
  expect(() => resolveDesktopAppId({ DSH_DESKTOP_APP_ID: 'com.deepseek.harness' })).toThrow(/product-owned/)
  expect(resolveDesktopAppId({ DSH_DESKTOP_APP_ID: 'com.qzos.desktop' })).toBe('com.qzos.desktop')
})

it('loads a product-owned production origin from the machine preset', () => {
  const root = mkdtempSync(join(tmpdir(), 'qzos-desktop-preset-'))
  try {
    mkdirSync(join(root, 'presets'))
    writeFileSync(join(root, 'presets/production.env'), 'DSH_DESKTOP_APP_ID=com.qzos.desktop\nDSH_DESKTOP_AUTO_UPDATE_ENV=production\nDOWNLOAD_PROD_ORIGIN=https://updates.example.com\nDSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN=https://policy.example.com\n')
    const env = loadDesktopPackageEnvironment('darwin', { DSH_PACKAGING_PRESET: 'production', DSH_PACKAGING_CONFIG_DIR: root }, root, { unsigned: true })
    expect(env.DOWNLOAD_PROD_ORIGIN).toBe('https://updates.example.com')
    expect(resolveDesktopPolicyEnvironment(env).origin).toBe('https://policy.example.com')
    expect(() => resolveDesktopPolicyEnvironment({ ...env, DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN: 'https://download.deepseek.com' })).toThrow(/product-owned/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
