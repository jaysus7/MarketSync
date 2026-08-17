import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const settingsComponent = readFileSync(new URL('../../marketplace-frontend/components/dashboard-settings.html', import.meta.url), 'utf8')
const part20 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part20.js', import.meta.url), 'utf8')

test('Add-ons button opens the live-pricing plan modal, not the retired upgrades hub', () => {
  // openUpgradesHub() built its cards from a hardcoded PACKAGES_UI map (only
  // starter/growth/pro, stale fallback prices, a hardcoded $499 Facebook add-on)
  // that predates the full PLAN_CATALOG rebuild. openPlanUpgradeModal() already
  // reads live pricing from /billing/plans, so both entry points should use it.
  assert.match(dashboardHtml, /Add-ons<\/button>/)
  assert.doesNotMatch(dashboardHtml, /onclick="openUpgradesHub\(\)"/)
  assert.match(settingsComponent, /onclick="openPlanUpgradeModal\(\)"[^>]*>Add-ons<\/button>/)
})

test('the legacy openUpgradesHub pricing modal and its stale PACKAGES_UI catalog are removed', () => {
  assert.doesNotMatch(part20, /function openUpgradesHub/)
  assert.doesNotMatch(part20, /window\.openUpgradesHub/)
  assert.doesNotMatch(part20, /PACKAGES_UI/)
  assert.doesNotMatch(part20, /function startPackageCheckout/)
  assert.doesNotMatch(part20, /function startFacebookCheckout/)
})
