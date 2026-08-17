import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')

test('feeds-panel/catalog-panel show for solo Facebook reps too, not just accounts inside a dealership', () => {
  // canManageFeeds = isAdmin || isSolo already grants a solo account full
  // feed-management rights (Add Feed, Sync Now), but the panels housing those
  // controls were gated on inDealership alone, which is false for a solo/personal
  // account by definition (isSolo = SALES_REP && (isPersonal || !inDealership)).
  // That made the isSolo branch of canManageFeeds unreachable in the UI: a solo
  // Facebook rep's Inventory page was just empty — no feeds panel, no catalog, no
  // sync button.
  const block = part2.match(/if \(inDealership \|\| isSolo\) \{[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(block, 'the feeds/catalog panel visibility block must include isSolo')
  assert.match(block, /getElementById\('feeds-panel'\)\?\.classList\.remove\('hidden'\)/)
  assert.match(block, /getElementById\('catalog-panel'\)\?\.classList\.remove\('hidden'\)/)
  assert.doesNotMatch(part2, /if \(inDealership\) \{\s*\n\s*document\.getElementById\('feeds-panel'\)/, 'must not still gate on inDealership alone')
})
