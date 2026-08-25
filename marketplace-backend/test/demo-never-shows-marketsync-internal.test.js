import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')

// is_marketsync reflects the LOGGED-IN USER's own system role (a real platform
// owner/admin — see routes/profile.js's /auth/me: "Workspace identity comes from a
// server-managed system role, never a dealer name"), not which dealership is
// currently being viewed. A platform staffer previewing the dedicated demo
// dealership through the Demo Control Panel switcher still holds that role, so
// without an explicit guard, initDashModeForOwner() would yank them out of the demo
// they're trying to preview and force MarketSync's own real internal Pulse instead —
// live customer names, real monthly revenue, the real trial pipeline — onto a screen
// reachable from the public demo login. This must be a hard rule, not conditional on
// is_marketsync/dealership-name matching, which is what actually broke in practice.
test('initDashModeForOwner refuses to enter MarketSync owner mode while viewing the demo dealership', () => {
  const fnStart = dashboard.indexOf('function initDashModeForOwner')
  const fnBody = dashboard.slice(fnStart, dashboard.indexOf('\nfunction ', fnStart + 1))
  const guardIdx = fnBody.indexOf('if (window.__access?.isDemo) return;')
  const ownerAttrIdx = fnBody.indexOf("setAttribute('data-dash-owner', '1')")
  assert.ok(guardIdx > -1, 'initDashModeForOwner must bail out when the current access context is the demo dealership')
  assert.ok(ownerAttrIdx > -1, 'sanity: the owner-mode attribute this guard protects should still exist')
  assert.ok(guardIdx < ownerAttrIdx, 'the isDemo guard must run before data-dash-owner is ever set, not after')
})

test('the isDemo guard runs before the isOwner check so it cannot be short-circuited by a stale isOwner=false path', () => {
  const fnStart = dashboard.indexOf('function initDashModeForOwner')
  const fnBody = dashboard.slice(fnStart, dashboard.indexOf('\nfunction ', fnStart + 1))
  const guardIdx = fnBody.indexOf('if (window.__access?.isDemo) return;')
  const isOwnerCheckIdx = fnBody.indexOf('if (!isOwner) return;')
  assert.ok(guardIdx > -1 && isOwnerCheckIdx > -1 && guardIdx < isOwnerCheckIdx)
})
