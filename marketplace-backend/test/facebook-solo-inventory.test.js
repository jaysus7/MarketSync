import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')

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

test('applyProductNav only auto-navigates to the product home page once per load, not on every call', () => {
  // applyProductNav() runs twice per load for a restricted-product account: once
  // at boot (dashboard-part2.js) and again once loadAIBoostSection()'s /ai/config
  // fetch resolves (which can cold-start-lag on Render's free tier). Both calls
  // compute the same "home" page. Before this fix, switchPage(home) fired
  // unconditionally on every call — so if the user had already navigated to e.g.
  // Inventory in that window, the second call silently yanked them back to the
  // product's home page (Leaderboard for Facebook Solo/Dealer) with no warning,
  // which is exactly what "inventory doesn't show" looked like from the outside.
  assert.match(dashboardJs, /let __productNavHomeApplied = false;/,
    'a module-level guard must track whether the home redirect already fired')

  const fnBody = dashboardJs.match(/function applyProductNav\(products\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fnBody, 'applyProductNav must exist')
  assert.match(fnBody, /!__productNavHomeApplied/, 'the redirect must be gated on the one-shot flag')
  assert.match(fnBody, /__productNavHomeApplied = true/, 'the flag must be set once the redirect fires')
  assert.doesNotMatch(fnBody, /if \(typeof switchPage === 'function'\) switchPage\(home\);/,
    'switchPage(home) must not fire unconditionally any more')
})
