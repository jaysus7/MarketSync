import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PLAN_CATALOG, PLAN_IDS } from '../plan-catalog.js'

const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const billing = readFileSync(new URL('../routes/billing.js', import.meta.url), 'utf8')

test('every product key a plan can list has a real display label — the old ternary collapsed anything that was not dealer_os/ai_dealer to the literal string "Facebook"', () => {
  // A bundle like DealerOS Complete lists design_studio, facebook, marketsync_social,
  // marketsync_email, marketsync_video, marketsync_website, ai_dealer — the old
  // `x === 'dealer_os' ? ... : x === 'ai_dealer' ? ... : 'Facebook'` ternary rendered
  // that as "Facebook + Facebook + Facebook + Facebook + Facebook + Facebook".
  const allProductKeys = new Set(Object.values(PLAN_CATALOG).flatMap(p => p.products))
  const labelsBlock = dashboardJs.match(/const MS_PRODUCT_LABELS = \{[\s\S]*?\};/)?.[0] || ''
  assert.ok(labelsBlock, 'MS_PRODUCT_LABELS must exist')
  for (const key of allProductKeys) {
    assert.match(labelsBlock, new RegExp(`\\b${key}:`), `MS_PRODUCT_LABELS is missing a label for product "${key}"`)
  }
  assert.doesNotMatch(dashboardJs, /x === 'dealer_os' \? 'Dealer OS' : x === 'ai_dealer' \? 'AI Dealer' : 'Facebook'/,
    'the old collapse-everything-to-Facebook ternary must be gone')
})

test('msPlanProductLine dedupes products before mapping, so a plan can never repeat the same label', () => {
  const fn = dashboardJs.match(/function msPlanProductLine\(p\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'msPlanProductLine must exist')
  assert.match(fn, /new Set\(p\.products\)/)
})

test('grandfathered plans are flagged and excluded from new-purchase surfaces unless the account is on one', () => {
  // The 10 original plans (fb_solo, fb_dealership, ai_standard, the 4 bare
  // marketsync_* ids, os_starter, os_growth, os_pro) are kept only so existing
  // subscribers keep their exact entitlements — the current, real, publicly-sold
  // catalog is the 14 plans added later (design-studio onward). Mixing both into
  // one list produced near-duplicate pairs like "Dealer OS Pro" and "DealerOS Pro"
  // at the identical $2,499 price.
  const legacyIds = ['fb_solo', 'fb_dealership', 'ai_standard', 'marketsync_video', 'marketsync_website', 'marketsync_social', 'marketsync_email', 'os_starter', 'os_growth', 'os_pro']
  for (const id of legacyIds) assert.equal(PLAN_CATALOG[id]?.legacyPlan, true, `${id} must be flagged legacyPlan`)
  const currentCatalogIds = PLAN_IDS.filter(id => !legacyIds.includes(id))
  for (const id of currentCatalogIds) assert.notEqual(PLAN_CATALOG[id]?.legacyPlan, true, `${id} must not be flagged legacyPlan`)

  assert.match(billing, /legacyPlan: !!p\.legacyPlan,/, '/billing/plans must expose the flag')

  const upgradeFn = dashboardJs.match(/async function openPlanUpgradeModal\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(upgradeFn, /!p\.legacyPlan \|\| current\.includes\(p\.id\)/)
  const paywallFn = dashboardJs.match(/async function openPaywallModal\(reason\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(paywallFn, /\.filter\(p => !p\.legacyPlan\)/)
})

test('the upgrade modal splits Plans (bundles) from Add-ons (standalone products), greying out an add-on already covered by the current plan', () => {
  const fn = dashboardJs.match(/async function openPlanUpgradeModal\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'openPlanUpgradeModal must exist')
  assert.match(fn, /const bundles = visible\.filter\(p => p\.products\.length > 1\);/)
  assert.match(fn, /const addons = visible\.filter\(p => p\.products\.length === 1\);/)
  assert.match(fn, /currentProducts\.has\(p\.products\[0\]\)/,
    'an add-on must be marked included when its one product is already covered by a currently-held plan')
  assert.match(fn, /Add-ons/)
  // The old "only offer plans costing at least as much as the current max" filter
  // must not gate the add-ons list — that is exactly what was hiding every
  // standalone add-on the moment the account held any paid bundle.
  const addonsSection = fn.split('const addons =')[1] || ''
  assert.doesNotMatch(addonsSection.split('const modal')[0], /monthly >= currentMax/)
})
