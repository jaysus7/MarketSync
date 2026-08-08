import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { FEATURES_BY_PRODUCT, PLAN_CATALOG } from '../plan-catalog.js'
import { frontendDashboardSource } from './helpers/split-source.js'

// dashboard.js was split into js/modules/dashboard-part*.js — read the whole unit.
const readDashboard = async () => frontendDashboardSource()

test('dashboard Pro fallback mirrors the complete canonical Pro catalogue', async () => {
  const source = await readDashboard()
  const block = source.match(/const DEALER_OS_PLAN_FEATURES = \{[\s\S]*?\n\};/)?.[0] || ''
  const pro = block.match(/pro:\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] || ''

  assert.ok(pro, 'could not locate the dashboard Pro fallback')
  for (const featureId of PLAN_CATALOG.os_pro.features) {
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

test('DealerOS Administration uses dealership-scoped user management', async () => {
  const source = await readDashboard()
  const administration = source.match(/administration:\s*\{[\s\S]*?\n  \},\n\};/)?.[0] || ''

  assert.ok(administration, 'could not locate the Administration department')
  assert.match(administration, /page:\s*['"]sales-team['"]/)
  assert.doesNotMatch(administration, /page:\s*['"]owner-users['"]/)
  assert.match(source, /pageId === ['"]owner-users['"] && !marketsyncOwnerMode\(\)/)
})
