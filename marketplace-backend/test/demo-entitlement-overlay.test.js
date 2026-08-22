import test from 'node:test'
import assert from 'node:assert/strict'
import { getShowcaseOverlay, PLAN_CATALOG } from '../plan-catalog.js'
import { computeAccessContext } from '../access-policy.js'

test('Demo entitlement overlay derives products and features from PLAN_CATALOG', () => {
  const overlay = getShowcaseOverlay()
  assert.ok(Array.isArray(overlay.products), 'products must be an array')
  assert.ok(Array.isArray(overlay.features), 'features must be an array')

  // Must include major showcaseable products
  const expectedProducts = ['facebook', 'ai_dealer', 'marketsync_video', 'marketsync_website', 'marketsync_social', 'marketsync_email', 'marketsync_seo', 'design_studio', 'dealer_os']
  for (const p of expectedProducts) {
    assert.ok(overlay.products.includes(p), `Showcase overlay missing product ${p}`)
  }

  // Must include major features
  const expectedFeatures = ['website.builder', 'seo.overview', 'ai.overview', 'email.campaigns', 'video.library', 'design.canvas']
  for (const f of expectedFeatures) {
    assert.ok(overlay.features.includes(f), `Showcase overlay missing feature ${f}`)
  }
})

test('computeAccessContext applies demo entitlement overlay when isDemo is true', () => {
  const overlay = getShowcaseOverlay()
  const rawDemo = {
    userId: 'user-demo-123',
    dealershipId: 'dealership-demo-456',
    systemRole: 'dealer_admin',
    roleIds: ['dealer_admin'],
    rolePermissions: [{ role_id: 'dealer_admin', permission_id: 'os.read' }],
    subscriptions: [], // No paid subscriptions in DB!
    features: [],
    planFeatures: [],
    isDemo: true,
    showcaseOverlay: overlay,
  }

  const ctx = computeAccessContext(rawDemo)
  assert.equal(ctx.isDemo, true, 'ctx.isDemo must be true for demo account')
  assert.ok(ctx.products.includes('marketsync_website'), 'Demo context must grant marketsync_website')
  assert.ok(ctx.products.includes('ai_dealer'), 'Demo context must grant ai_dealer')
  assert.ok(ctx.products.includes('marketsync_seo'), 'Demo context must grant marketsync_seo')
  assert.ok(ctx.features.includes('website.builder'), 'Demo context must grant website.builder')
  assert.ok(ctx.features.includes('seo.overview'), 'Demo context must grant seo.overview')
  assert.ok(ctx.features.includes('ai.overview'), 'Demo context must grant ai.overview')

  // Verify honest billing state: planByProduct remains empty because no subscriptions table rows were mutated
  assert.deepEqual(ctx.planByProduct, {}, 'DB subscriptions state must remain honest')
})

test('Non-demo accounts do NOT receive demo entitlement overlay', () => {
  const rawNormal = {
    userId: 'user-normal-123',
    dealershipId: 'dealership-normal-456',
    systemRole: 'dealer_admin',
    roleIds: ['dealer_admin'],
    rolePermissions: [{ role_id: 'dealer_admin', permission_id: 'os.read' }],
    subscriptions: [], // No paid subscriptions
    features: [],
    planFeatures: [],
    isDemo: false,
    showcaseOverlay: getShowcaseOverlay(),
  }

  const ctx = computeAccessContext(rawNormal)
  assert.equal(ctx.isDemo, false, 'ctx.isDemo must be false for normal account')
  assert.equal(ctx.products.length, 0, 'Normal account with no subscriptions gets no products')
  assert.equal(ctx.features.length, 0, 'Normal account with no subscriptions gets no features')
})
