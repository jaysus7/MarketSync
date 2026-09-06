import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// A stale cache-bust is the most expensive silent failure this frontend has: the deploy
// succeeds, the fix is on the server, and every returning browser keeps serving the
// cached old file. It has now shipped a broken Design Studio to staging twice — most
// recently with eight changed files still carrying the previous release's ?v=.
//
// Version strings pinned inside individual tests do not catch this; they only break on
// the bumps that DID happen. So the manifest records the content hash each ?v= was
// issued for. Change a file without bumping it and this fails, naming the file.
//
// To fix a failure here: bump the asset's ?v= in dashboard.html, then run
//   node scripts/update-asset-manifest.mjs
const FRONTEND = new URL('../../marketplace-frontend/', import.meta.url)
const html = readFileSync(new URL('dashboard.html', FRONTEND), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('asset-manifest.json', FRONTEND), 'utf8'))

const requested = [...html.matchAll(/(?:src|href)="([^"?]+)\?v=([A-Za-z0-9_]+)"/g)]
  .map(([, path, version]) => ({ path, version }))

test('every cache-busted asset is recorded in the manifest', () => {
  assert.ok(requested.length > 40, `sanity: expected the dashboard to request many assets, got ${requested.length}`)
  for (const { path } of requested) {
    assert.ok(manifest[path], `${path} is requested with a ?v= but missing from asset-manifest.json — run node scripts/update-asset-manifest.mjs`)
  }
  for (const path of Object.keys(manifest)) {
    assert.ok(requested.some((r) => r.path === path),
      `${path} is in the manifest but no longer requested by dashboard.html — run node scripts/update-asset-manifest.mjs`)
  }
})

test('no asset changed without its cache version being bumped', () => {
  const stale = []
  for (const { path, version } of requested) {
    const entry = manifest[path]
    if (!entry) continue
    const sha = createHash('sha256')
      .update(readFileSync(new URL(path, FRONTEND)))
      .digest('hex')
      .slice(0, 16)
    if (entry.version !== version) {
      stale.push(`${path}: dashboard.html asks for ?v=${version}, manifest recorded ${entry.version}`)
    } else if (entry.sha256 !== sha) {
      stale.push(`${path}: contents changed but ?v=${version} did not — returning browsers will keep the cached old file`)
    }
  }
  assert.deepEqual(stale, [],
    `bump the ?v= in dashboard.html and re-run node scripts/update-asset-manifest.mjs:\n  ${stale.join('\n  ')}`)
})
