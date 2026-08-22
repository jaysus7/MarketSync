import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const feedsRoute = readFileSync(new URL('../routes/feeds.js', import.meta.url), 'utf8')

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

test('__fbOnly is read from /auth/me\'s dealership.fb_only immediately, not only from the later /ai/config fetch', () => {
  // fb_only is a plain column on `dealerships` and rides along on every /auth/me
  // response's `dealership` field. Before this fix, __fbOnly was only ever set
  // inside loadAIBoostSection()'s /ai/config fetch — a separate, independently
  // slow round-trip that can lag well behind boot on a cold-started backend. Until
  // that fetch resolved, a Facebook-only account rendered with the full DealerOS
  // chrome (generic nav, Insights widgets it has no data for) — reading the flag
  // straight off the profile response closes that window.
  const boot = part2.match(/profileContext = await res\.json\(\);[\s\S]*?applyProductNav\(/)?.[0] || ''
  assert.ok(boot, 'the boot sequence from profileContext load through the first applyProductNav call must exist')
  assert.match(boot, /__fbOnly = !!profileContext\?\.dealership\?\.fb_only;/,
    '__fbOnly must be set from profileContext.dealership.fb_only before the first applyProductNav() call')
})

test('mobile "Menu" overflow button hides for a restricted tier whose whole page set already fits the quick row', () => {
  // Facebook Solo's restrictedNavPages() is just [Inventory, Leaderboard] — both
  // already render directly in the 4-slot quick row, so the "Menu" sheet used to
  // pop up and show those exact same two buttons again (plus Upgrade, which the
  // header's own button already covers) — dead weight with nothing new in it.
  const fnBody = dashboardJs.match(/function applyMobileQuickRow\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fnBody, 'applyMobileQuickRow must exist')
  assert.match(fnBody, /showMoreBtn = restricted\.length > pages\.length;/,
    'the Menu button must only stay visible when the restricted page set overflows the 4-slot row')
  assert.match(fnBody, /more\?\.classList\.toggle\('hidden', !showMoreBtn\);/,
    'the Menu button visibility must follow showMoreBtn, not be forced visible unconditionally')
})

test('Sync Now is gated the same as Add Feed — a dealer rep sees the panel but not the controls', () => {
  // canManageFeeds = isAdmin || isSolo was already documented as covering "Add Feed,
  // Sync Now" (see the comment above the feeds/catalog panel-visibility block), but
  // sync-now-btn never actually carried [data-admin-only], so a plain dealer rep
  // (SALES_REP inside a real, non-personal dealership) could see and click Sync Now
  // and just get a 403 "Insufficient permission" back from the server. Dealer Admin,
  // Group Admin, and a solo/independent rep should keep it working.
  const btn = dashboardHtml.match(/<button id="sync-now-btn"[^>]*>/)?.[0] || ''
  assert.ok(btn, 'sync-now-btn must exist')
  assert.match(btn, /data-admin-only/, 'Sync Now must be gated by the same admin-only rule as Add Feed')
})

test('isAdmin includes DEALER_GROUP, so a Group Admin gets the same feed-management and settings access as a Dealer Admin', () => {
  assert.match(part2, /const isAdmin = role === 'DEALER_ADMIN' \|\| role === 'OWNER' \|\| role === 'MANAGER' \|\| role === 'DEALER_GROUP';/)
})

test('a Facebook dealer rep keeps Sync Now even without canManageFeeds — every rep posts and syncs their own inventory there', () => {
  // Unlike a full DealerOS store (centralized inventory, sync stays admin-gated),
  // a Facebook dealer rep manages their own assigned inventory on their own
  // Facebook profile, so Sync Now must stay reachable for them specifically —
  // Add Feed (connecting a new data source) stays admin-only everywhere, Facebook
  // included, so this exception is scoped to just the one button.
  const block = part2.match(/if \(!canManageFeeds\) \{[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(block, 'the canManageFeeds gating block must exist')
  assert.match(block, /isFacebookOnlyWorkspace/)
  assert.match(block, /if \(fbOnlyForSync && el\.id === 'sync-now-btn'\) return;/,
    'sync-now-btn must be exempted from the admin-only hide when the account is Facebook-only')
})

test('POST /inventory-feeds lets a Group Admin manage feeds too, matching the frontend isAdmin check', () => {
  // The frontend's isAdmin (and therefore canManageFeeds, which governs whether
  // add-feed-form even renders) already includes DEALER_GROUP — this backend guard
  // is the enforcement side and must recognize the same role, or a Group Admin
  // would see the Add Feed form and then get a 403 the moment they used it.
  const matches = [...feedsRoute.matchAll(/const canManage = req\.profile\.role === 'DEALER_ADMIN'[\s\S]*?is_personal === true/g)]
  assert.ok(matches.length >= 1, 'the canManage check must exist')
  for (const [block] of matches) assert.match(block, /req\.profile\.role === 'DEALER_GROUP'/)
})
