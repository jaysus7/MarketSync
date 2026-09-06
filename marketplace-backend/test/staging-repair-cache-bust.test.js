import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RELEASE_VERSION, assetVersion } from './helpers/asset-versions.js'

const loader = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')

// This file used to pin five literal version strings, which meant every legitimate
// release bump broke it — and, worse, that pinning felt like coverage while eight
// changed files shipped to staging still carrying the previous release's version.
// A stale ?v= is invisible: the deploy succeeds, the fix is on the server, and every
// returning browser keeps serving the cached old file. What matters is not which tag
// is current but that everything in a release moves together, which is what this
// asserts now. asset-manifest.test.js is what catches a changed file that was never
// bumped at all.
test('every asset in the Design Studio release rides one cache version', () => {
  for (const asset of [
    'css/marketsync-theme.css',
    'dashboard.js',
    'js/modules/dashboard-part2.js',
    'js/modules/dashboard-part5.js',
    'js/modules/dashboard-part18.js',
    'js/modules/demo-control-panel.js',
    'js/modules/marketing-workspace.js',
    'js/modules/people-workspace.js',
  ]) {
    assert.equal(assetVersion(asset), RELEASE_VERSION,
      `${asset} is not on the current release cache version`)
  }
})

test('the lazily-loaded Studio shell is bumped with the chain that loads it', () => {
  // The script list is defined ONCE in msLoadDesignStudioShell() and shared by every
  // consumer, so the version appears once instead of being copied per caller. That is
  // a stronger guarantee than counting copies: a stale consumer is no longer possible,
  // because there is only one list to bump.
  const refs = loader.match(new RegExp(`js/modules/studio/studio-shell\\.js\\?v=${RELEASE_VERSION}`, 'g')) || []
  assert.equal(refs.length, 1, `studio-shell.js must be requested once, at ${RELEASE_VERSION}`)
  assert.match(loader, /function msLoadDesignStudioShell/)
  assert.ok((loader.match(/msLoadDesignStudioShell\(\)/g) || []).length >= 2,
    'both in-dashboard consumers must go through the canonical loader')
})
