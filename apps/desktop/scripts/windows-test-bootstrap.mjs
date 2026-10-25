/** Packaged only in explicit unsigned Windows test builds; runs before production modules. */
import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configureUnsignedWindowsTestIdentity } from './installed-update-identity.mjs'

const metadata = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8'))
configureUnsignedWindowsTestIdentity(app, metadata, process.env)
await import('./lib/main.js')
