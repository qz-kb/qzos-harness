/** Stage a validated unsigned Windows update for an operator-owned HTTPS server; never upload or publish. */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createDesktopArtifactPlan, type DesktopUploadPlanOptions } from './desktop-upload-plan.ts'
import { loadDesktopPackageEnvironment } from './desktop-package-environment.mjs'
import { windowsUnsignedUpdates } from './desktop-auto-update-environment.mjs'

async function fingerprint(path: string): Promise<{ size: number; sha512: string }> {
  const hash = createHash('sha512')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return { size: (await stat(path)).size, sha512: hash.digest('base64') }
}

/** Export into a new directory with feed metadata last and a local integrity inventory.
 * @param output New absolute directory owned by this export.
 * @param options File-owned public configuration and source artifacts.
 * @returns Feed URL and inventory; no network writes occur.
 */
export async function exportWindowsUpdate(output: string, options: DesktopUploadPlanOptions) {
  if (options.latest) throw new Error('desktop export: the complete update feed is required')
  if (!isAbsolute(output)) throw new Error('desktop export: output must be a new absolute directory')
  if (!windowsUnsignedUpdates(options.environment ?? {}, 'win32')) throw new Error('desktop export: unsigned Windows updates must be explicit')
  const plan = await createDesktopArtifactPlan('win-x64', options)
  await mkdir(output) // Refuse existing directories, including symlinks and live web roots.
  try {
    const files = []
    for (const artifact of plan.artifacts) {
      if (isAbsolute(artifact.key) || artifact.key.split(/[\\/]/u).some(part => part === '..' || part === '')) {
        throw new Error('desktop export: invalid artifact key')
      }
      const target = join(output, artifact.key)
      await mkdir(dirname(target), { recursive: true })
      if (artifact.contents === undefined) await copyFile(artifact.path, target)
      else await writeFile(target, artifact.contents)
      const digest = await fingerprint(target)
      if (artifact.contents === undefined && digest.sha512 !== (await fingerprint(artifact.path)).sha512) {
        throw new Error('desktop export: source changed during copy')
      }
      files.push({ key: artifact.key, ...digest, channelMetadata: artifact.channelMetadata })
    }
    // Revalidate the source hashes after copying, so a changed EXE cannot slip into the staged tree.
    await createDesktopArtifactPlan('win-x64', options)
    const inventory = { schema: 'qzos.windows-update-stage.v1', signing: 'unsigned',
      version: plan.version, feed: plan.publicUrl, commit: plan.commit, dirty: plan.dirty, files }
    await writeFile(join(output, 'qzos-update-stage.json'), JSON.stringify(inventory, null, 2) + '\n')
    return inventory
  } catch (error) {
    await rm(output, { recursive: true, force: true })
    throw error
  }
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) {
  const { values } = parseArgs({
    options: { output: { type: 'string' }, artifacts: { type: 'string' } }, allowPositionals: false,
  })
  if (!values.output) throw new Error('desktop export: --output is required')
  const environment = {
    ...loadDesktopPackageEnvironment('win32', process.env, undefined, { unsigned: true }), DSH_DESKTOP_UNSIGNED: '1',
  }
  const result = await exportWindowsUpdate(values.output, {
    environment, ...(values.artifacts === undefined ? {} : { artifactsRoot: values.artifacts }),
  })
  console.log(`Staged unsigned Windows ${result.version} for ${result.feed}; no files published`)
}
