import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FEATURES_BY_PRODUCT, PLAN_CATALOG } from '../plan-catalog.js'
import { frontendDashboardSource } from './helpers/split-source.js'

// dashboard.js was split into js/modules/dashboard-part*.js — read the whole unit.
const readDashboard = async () => frontendDashboardSource()

test('dashboard Pro fallback mirrors the current DealerOS Pro catalogue', async () => {
  const source = await readDashboard()
  const block = source.match(/const DEALER_OS_PLAN_FEATURES = \{[\s\S]*?\n\};/)?.[0] || ''
  const pro = block.match(/pro:\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] || ''

  assert.ok(pro, 'could not locate the dashboard Pro fallback')
  for (const featureId of PLAN_CATALOG['dealer-os-pro'].features) {
    assert.match(pro, new RegExp(`['\"]${featureId.replaceAll('.', '\\.') }['\"]`),
      `dashboard Pro fallback missing ${featureId}`)
  }
})

test('every dashboard page entitlement references a canonical feature', async () => {
  const source = await readDashboard()
  const block = source.match(/const PAGE_FEATURE = \{[\s\S]*?\n\};/)?.[0] || ''
  const knownFeatures = new Set(Object.values(FEATURES_BY_PRODUCT).flat())
  const referenced = [...block.matchAll(/['\"]((?:os|fb|ai)\.[a-z_]+)['\"]/g)].map(match => match[1])

  assert.ok(referenced.length > 0, 'could not locate dashboard page entitlements')
  for (const featureId of referenced) {
    assert.ok(knownFeatures.has(featureId), `dashboard references unknown feature ${featureId}`)
  }
})

// Phase 1 dissolved the "Administration" department into People / Executive /
// Settings (employees do not navigate an "Administration" concept). The tenancy
// rule it guarded is unchanged and asserted here against the workspace registry:
// dealer user management uses the dealership-scoped `sales-team` page, never the
// platform-wide `owner-users` console, which stays reserved for MarketSync HQ.
test('DealerOS user management stays dealership-scoped, never platform-wide', async () => {
  const registry = await readFile(new URL('../../marketplace-frontend/js/modules/workspace-registry.js', import.meta.url), 'utf8')
  const people = registry.match(/people:\s*\{[\s\S]*?\n  \},/)?.[0] || ''

  assert.ok(people, 'could not locate the People workspace')
  assert.match(people, /page:\s*['"]sales-team['"]/, 'People must manage users via the dealership-scoped page')
  // Stronger than before: no dealer-facing workspace anywhere may expose owner-users.
  assert.doesNotMatch(registry, /page:\s*['"]owner-users['"]/, 'owner-users must not appear in any DealerOS workspace')
  // The switchPage redirect that sends a dealer admin from a stale owner-users
  // bookmark to their own team page must remain.
  assert.match(await readDashboard(), /pageId === ['"]owner-users['"] && !marketsyncOwnerMode\(\)/)
})

test('dashboard resolves product gates before any role landing page is selected', async () => {
  const source = await readDashboard()
  const gate = source.indexOf('applyProductNav(legacyProductsFromAccess(window.__access) || profileContext?.products)')
  const landing = source.indexOf("const bootRoute = typeof msRouteFromHash")
  const reveal = source.indexOf("document.body.classList.remove('ms-app-booting')")

  assert.ok(gate >= 0, 'product gate initialization is missing')
  assert.ok(landing > gate, 'a role/default page must not load before product gates')
  assert.ok(reveal > landing, 'page content must stay hidden until final routing is settled')
})

// A demo dealership is entitled to EVERY product (the showcase overlay), so its access
// context always includes dealer_os. legacyProductsFromAccess() must honor the selected
// demo product (window.__demoActiveProduct) BEFORE the dealer_os short-circuit — otherwise
// every demo package falls back to the full DealerOS sidebar and the Demo Control Center's
// per-product view (and the matching single-product-customer view) silently breaks.
test('legacyProductsFromAccess narrows to the selected demo product before the dealer_os fallback', async () => {
  const source = await readDashboard()
  const fn = source.match(/function legacyProductsFromAccess\(access\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'legacyProductsFromAccess must exist')

  const demoBranch = fn.indexOf('window.__demoActiveProduct')
  const dealerOsFallback = fn.indexOf("access.products.includes('dealer_os')")
  assert.ok(demoBranch >= 0, 'must consult window.__demoActiveProduct')
  assert.ok(dealerOsFallback >= 0, 'the dealer_os fallback must still exist')
  assert.ok(demoBranch < dealerOsFallback,
    'the demo product must be resolved BEFORE the dealer_os short-circuit, or narrowing is overridden')

  // The demo product ids map to the same legacy nav keys applyProductNav understands.
  assert.match(fn, /video:\s*\{ marketsync_video: true \}/)
  assert.match(fn, /website:\s*\{ marketsync_website: true \}/)
})
