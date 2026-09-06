#!/usr/bin/env node
// Regenerates marketplace-frontend/asset-manifest.json.
//
// Run this after bumping the ?v= cache-bust of any asset dashboard.html requests.
// asset-manifest.test.js fails when a file's contents changed but its ?v= did not,
// which is the failure mode this exists for: the deploy succeeds, the fix is on the
// server, and every returning browser keeps serving the cached old file.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..', 'marketplace-frontend')
const html = readFileSync(join(frontend, 'dashboard.html'), 'utf8')

const manifest = {}
for (const m of html.matchAll(/(?:src|href)="([^"?]+)\?v=([A-Za-z0-9_]+)"/g)) {
  const [, path, version] = m
  manifest[path] = {
    version,
    sha256: createHash('sha256').update(readFileSync(join(frontend, path))).digest('hex').slice(0, 16),
  }
}

writeFileSync(join(frontend, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`asset-manifest.json: ${Object.keys(manifest).length} assets`)
