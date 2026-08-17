import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getPlan } from '../plan-catalog.js'

const source = readFileSync(new URL('../routes/demo-control.js', import.meta.url), 'utf8')

test('every Product Switcher package id is a real, resolvable plan', () => {
  const match = source.match(/const DEMO_PACKAGES = \[([\s\S]*?)\]/)
  assert.ok(match, 'DEMO_PACKAGES array should exist')
  const ids = [...match[1].matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1])
  // autoposter-dealer was dropped — one Facebook AutoPoster entry is enough now that
  // the Role Switcher's Independent/Dealer Admin split already covers rep vs dealer.
  assert.equal(ids.length, 14, 'the demo catalog should offer 14 SKUs (15 minus the redundant autoposter-dealer)')
  assert.ok(!ids.includes('autoposter-dealer'), 'autoposter-dealer is redundant with the Role Switcher and must not be offered')
  for (const id of ids) assert.ok(getPlan(id), `DEMO_PACKAGES references an unknown plan: ${id}`)
})

test('every Role Switcher entry maps to a real role_id and a valid profiles.role/account_role pairing', () => {
  const match = source.match(/const DEMO_ROLES = \{([\s\S]*?)\n\}/)
  assert.ok(match, 'DEMO_ROLES map should exist')
  const entries = [...match[1].matchAll(/roleId: '([a-z_]+)'.*?profileRole: '(DEALER_ADMIN|SALES_REP|DEALER_GROUP)', accountRole: '(dealer_admin|sales_rep)'/g)]
  assert.equal(entries.length, 4, 'exactly the 4 requested demo roles should be present: group admin, dealer admin, sales role, independent')
  // profiles.role is ONLY ever DEALER_ADMIN, SALES_REP, or DEALER_GROUP in real data
  // (verified against staging) — dealer_owner is the role real accounts pair with the
  // implicit "all permissions" bypass in authorization.js, so only dealer_owner may
  // pair with DEALER_ADMIN/DEALER_GROUP here.
  for (const [, roleId, profileRole] of entries) {
    if (profileRole === 'DEALER_ADMIN' || profileRole === 'DEALER_GROUP') {
      assert.equal(roleId, 'dealer_owner', `${roleId} should not get the implicit admin-permission bypass`)
    }
  }
})

test('demo control endpoints are tenant-gated only — no admin-role check stacked on top', () => {
  // Stacking isDealerAdmin/isPlatformOwner on top of the tenant check would lock the
  // demo operator out after switching to a non-admin role (profiles.role becomes
  // SALES_REP), since they could no longer pass that check to switch back or reset.
  const guard = source.match(/async function requireDemoAccount[\s\S]*?\n\}/)?.[0] || ''
  assert.match(guard, /ownDedicatedDemoAccount\(req\)/)
  assert.doesNotMatch(guard, /isDealerAdmin|isPlatformOwner|hasSystemRole/)
  for (const endpoint of [
    "app.get('/demo/control'",
    "app.put('/demo/control/package'",
    "app.put('/demo/control/role'",
    "app.put('/demo/control/presentation'",
    "app.post('/demo/control/reset'",
  ]) {
    assert.ok(source.includes(`${endpoint}, requireAuth, requireDemoAccount`), `${endpoint} should require auth + the tenant-only demo guard`)
  }
})

test('package switch goes through the real entitlement engine, not a demo-only shortcut', () => {
  const route = source.match(/app\.put\('\/demo\/control\/package'[\s\S]*?\n {2}\}\)/)?.[0] || ''
  assert.match(route, /if \(!DEMO_PACKAGES\.includes\(packageId\)\)/)
  assert.match(route, /provisionPlan\(\{ dealershipId: req\.dealershipId, planId: packageId, status: 'active' \}\)/)
  assert.match(route, /audit\(req, 'demo\.control_package_switched'/)
})

test('role switch writes user_roles directly (delete + insert) and updates profiles.role/account_role', () => {
  const route = source.match(/app\.put\('\/demo\/control\/role'[\s\S]*?\n {2}\}\)/)?.[0] || ''
  assert.match(route, /if \(!role\) return res\.status\(400\)/)
  assert.match(route, /from\('user_roles'\)\.delete\(\)\.eq\('user_id', req\.user\.id\)\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(route, /from\('user_roles'\)\.insert\(\{/)
  assert.match(route, /from\('profiles'\)\s*\n?\s*\.update\(\{ role: role\.profileRole, account_role: role\.accountRole, group_id: role\.groupId \|\| null \}\)/)
})

test('the Facebook-only "independent" role also narrows the plan, not just the label', () => {
  const match = source.match(/const DEMO_ROLES = \{([\s\S]*?)\n\}/)
  assert.match(match[1], /independent: \{[^}]*packageId: 'autoposter-salesperson'/)
  const route = source.match(/app\.put\('\/demo\/control\/role'[\s\S]*?\n {2}\}\)/)?.[0] || ''
  assert.match(route, /if \(role\.packageId\)/)
  assert.match(route, /provisionPlan\(\{ dealershipId: req\.dealershipId, planId: role\.packageId, status: 'active' \}\)/)
})

test('reset reuses the same wipe+reseed as /demo/reset and restores default control state', () => {
  const route = source.match(/app\.post\('\/demo\/control\/reset'[\s\S]*?\n {2}\}\)/)?.[0] || ''
  assert.match(route, /wipeAcademyDemoData\(supabaseAdmin, req\.dealershipId\)/)
  assert.match(route, /seedAccount\(\{ dealership: req\._demoDealership, ownerId: req\.user\.id, force: true \}\)/)
  assert.match(route, /setConfig\(req\.dealershipId, CONTROL_KEY, DEFAULT_STATE, req\)/)
})

test('demo control state is server-side (dealer_config), never trusts a client-supplied dealership id', () => {
  assert.doesNotMatch(source, /req\.body\.dealershipId|req\.query\.dealershipId/)
  assert.match(source, /getConfig\(req\.dealershipId, CONTROL_KEY/)
})
