import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

import {
  computeAccessContext, hasProductAccess, hasFeature, getDefaultRoute, PRODUCT_ROUTES, PRODUCTS,
} from '../access-policy.js'
import { FEATURES_BY_PRODUCT, PLAN_CATALOG, getPlan } from '../plan-catalog.js'
import { reconcileDealershipBillingStatus } from '../entitlements.js'
import { supabaseAdmin } from '../shared.js'

// Mock fixtures matching features catalog
const ALL_FEATURES = Object.entries(FEATURES_BY_PRODUCT).flatMap(([product_id, ids], pIdx) =>
  ids.map((id, fIdx) => ({ id, product_id, sort_order: pIdx * 100 + fIdx }))
)

const ALL_PLAN_FEATURES = Object.values(PLAN_CATALOG).flatMap(plan =>
  (plan.features || []).map(feature_id => ({ plan_id: plan.id, feature_id }))
)

function computeContextForSubs(subscriptions, overrides = {}) {
  return computeAccessContext({
    userId: 'test-user-1',
    dealershipId: 'test-dealer-1',
    roleIds: ['dealer_owner'],
    subscriptions,
    features: ALL_FEATURES,
    planFeatures: ALL_PLAN_FEATURES,
    ...overrides,
  })
}

// ── Tests A through J: Canonical Multi-Subscription Billing & Entitlement Isolation ────────

test('Test A: Buy Website only -> marketsync_website active, Website accessible, SEO locked', () => {
  const subs = [
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(hasProductAccess(ctx, 'marketsync_website'), 'Should have access to Website')
  assert.ok(hasFeature(ctx, 'website.builder'), 'Should have website.builder feature')
  assert.ok(!hasProductAccess(ctx, 'marketsync_seo'), 'Should NOT have access to SEO')
  assert.ok(!hasFeature(ctx, 'seo.overview'), 'Should NOT have seo.overview feature')
  assert.equal(getDefaultRoute(ctx), PRODUCT_ROUTES.marketsync_website)
})

test('Test B: Buy SEO only -> marketsync_seo active, SEO accessible, Website locked', () => {
  const subs = [
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(hasProductAccess(ctx, 'marketsync_seo'), 'Should have access to SEO')
  assert.ok(hasFeature(ctx, 'seo.overview'), 'Should have seo.overview feature')
  assert.ok(!hasProductAccess(ctx, 'marketsync_website'), 'Should NOT have access to Website')
  assert.ok(!hasFeature(ctx, 'website.builder'), 'Should NOT have website.builder feature')
  assert.equal(getDefaultRoute(ctx), PRODUCT_ROUTES.marketsync_seo)
})

test('Test C: Buy Website then SEO -> both active, union of products', () => {
  const subs = [
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'active' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(hasProductAccess(ctx, 'marketsync_website'), 'Should have access to Website')
  assert.ok(hasProductAccess(ctx, 'marketsync_seo'), 'Should have access to SEO')
  assert.ok(hasFeature(ctx, 'website.builder'), 'Should have website.builder feature')
  assert.ok(hasFeature(ctx, 'seo.overview'), 'Should have seo.overview feature')
  assert.deepEqual(new Set(ctx.products), new Set(['marketsync_website', 'marketsync_seo']))
})

test('Test D: Cancel SEO -> Website remains active, SEO locked', () => {
  const subs = [
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'active' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'cancelled' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(hasProductAccess(ctx, 'marketsync_website'), 'Website must remain active')
  assert.ok(hasFeature(ctx, 'website.builder'), 'website.builder must remain active')
  assert.ok(!hasProductAccess(ctx, 'marketsync_seo'), 'SEO must be revoked')
  assert.ok(!hasFeature(ctx, 'seo.overview'), 'seo.overview must be revoked')
  assert.deepEqual(ctx.products, ['marketsync_website'])
})

test('Test E: Cancel Website -> SEO remains active, Website locked', () => {
  const subs = [
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'cancelled' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(!hasProductAccess(ctx, 'marketsync_website'), 'Website must be revoked')
  assert.ok(!hasFeature(ctx, 'website.builder'), 'website.builder must be revoked')
  assert.ok(hasProductAccess(ctx, 'marketsync_seo'), 'SEO must remain active')
  assert.ok(hasFeature(ctx, 'seo.overview'), 'seo.overview must remain active')
  assert.deepEqual(ctx.products, ['marketsync_seo'])
})

test('Test F: Website past_due, SEO active -> SEO accessible, Website inaccessible', () => {
  const subs = [
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'past_due' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(!hasProductAccess(ctx, 'marketsync_website'), 'past_due Website cannot be accessed')
  assert.ok(hasProductAccess(ctx, 'marketsync_seo'), 'active SEO is accessible')
  assert.deepEqual(ctx.products, ['marketsync_seo'])
})

test('Test G: All subscriptions cancelled -> access context is empty', () => {
  const subs = [
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'cancelled' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'cancelled' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.deepEqual(ctx.products, [])
  assert.deepEqual(ctx.features, [])
  assert.equal(getDefaultRoute(ctx), null)
})

test('Test H: Buy AI ChatBot + Website + SEO -> all 3 active in union', () => {
  const subs = [
    { product_id: 'ai_dealer', plan_id: 'ai-chatbot', status: 'active' },
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'active' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(hasProductAccess(ctx, 'ai_dealer'))
  assert.ok(hasProductAccess(ctx, 'marketsync_website'))
  assert.ok(hasProductAccess(ctx, 'marketsync_seo'))
  assert.ok(hasFeature(ctx, 'ai.conversations'))
  assert.ok(hasFeature(ctx, 'website.builder'))
  assert.ok(hasFeature(ctx, 'seo.overview'))
  assert.equal(getDefaultRoute(ctx), PRODUCT_ROUTES.ai_dealer, 'AI Dealer has higher route priority than Website/SEO')
})

test('Test I: Buy Complete Marketing Suite + Website + SEO -> full bundle union', () => {
  const suitePlan = getPlan('complete-marketing-suite')
  const subs = [
    ...suitePlan.products.map(p => ({ product_id: p, plan_id: 'complete-marketing-suite', status: 'active' })),
    { product_id: 'marketsync_website', plan_id: 'dealer-website', status: 'active' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(hasProductAccess(ctx, 'design_studio'))
  assert.ok(hasProductAccess(ctx, 'marketsync_social'))
  assert.ok(hasProductAccess(ctx, 'marketsync_video'))
  assert.ok(hasProductAccess(ctx, 'marketsync_email'))
  assert.ok(hasProductAccess(ctx, 'marketsync_website'))
  assert.ok(hasProductAccess(ctx, 'marketsync_seo'))
})

test('Test J: DealerOS pro downgrade to starter -> separate SEO subscription unaffected', () => {
  const subs = [
    { product_id: 'dealer_os', plan_id: 'os_starter', status: 'active' },
    { product_id: 'marketsync_seo', plan_id: 'marketsync-seo', status: 'active' },
  ]
  const ctx = computeContextForSubs(subs)

  assert.ok(hasProductAccess(ctx, 'dealer_os'))
  assert.ok(hasProductAccess(ctx, 'marketsync_seo'))
  assert.ok(hasFeature(ctx, 'os.crm'))
  assert.ok(!hasFeature(ctx, 'os.accounting'), 'starter DealerOS does not have accounting')
  assert.ok(hasFeature(ctx, 'seo.overview'), 'SEO overview remains active')
  assert.equal(getDefaultRoute(ctx), PRODUCT_ROUTES.dealer_os)
})

// ── Default Routing & Product Isolation for all 9 canonical products ────────

test('All canonical products resolve correct default routes and access', () => {
  for (const product of PRODUCTS) {
    const singleSubCtx = computeContextForSubs([
      { product_id: product, plan_id: `plan_${product}`, status: 'active' },
    ])
    assert.ok(hasProductAccess(singleSubCtx, product), `Must have product access to ${product}`)
    assert.equal(getDefaultRoute(singleSubCtx), PRODUCT_ROUTES[product], `Default route for ${product} must match PRODUCT_ROUTES`)
  }
})

// ── Billing Status Reconciliation Permutations ─────────────────────────────

test('reconcileDealershipBillingStatus: active + cancelled -> ACTIVE', async () => {
  let updatedStatus = null
  supabaseAdmin.from = (table) => {
    if (table === 'subscriptions') {
      return {
        select: () => ({
          eq: () => Promise.resolve({
            data: [
              { product_id: 'marketsync_website', status: 'active' },
              { product_id: 'marketsync_seo', status: 'cancelled' },
            ],
            error: null,
          }),
        }),
      }
    }
    if (table === 'dealerships') {
      return {
        update: (payload) => ({
          eq: () => {
            updatedStatus = payload.billing_status
            return Promise.resolve({ error: null })
          },
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { is_personal: false }, error: null }),
          }),
        }),
      }
    }
    return {}
  }

  const result = await reconcileDealershipBillingStatus('dealer-123')
  assert.equal(result, 'ACTIVE')
  assert.equal(updatedStatus, 'ACTIVE')
})

test('reconcileDealershipBillingStatus: past_due + cancelled -> PAST_DUE', async () => {
  let updatedStatus = null
  supabaseAdmin.from = (table) => {
    if (table === 'subscriptions') {
      return {
        select: () => ({
          eq: () => Promise.resolve({
            data: [
              { product_id: 'marketsync_website', status: 'past_due' },
              { product_id: 'marketsync_seo', status: 'cancelled' },
            ],
            error: null,
          }),
        }),
      }
    }
    if (table === 'dealerships') {
      return {
        update: (payload) => ({
          eq: () => {
            updatedStatus = payload.billing_status
            return Promise.resolve({ error: null })
          },
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { is_personal: false }, error: null }),
          }),
        }),
      }
    }
    return {}
  }

  const result = await reconcileDealershipBillingStatus('dealer-123')
  assert.equal(result, 'PAST_DUE')
  assert.equal(updatedStatus, 'PAST_DUE')
})

test('reconcileDealershipBillingStatus: all cancelled -> INACTIVE', async () => {
  let updatedStatus = null
  supabaseAdmin.from = (table) => {
    if (table === 'subscriptions') {
      return {
        select: () => ({
          eq: () => Promise.resolve({
            data: [
              { product_id: 'marketsync_website', status: 'cancelled' },
              { product_id: 'marketsync_seo', status: 'cancelled' },
            ],
            error: null,
          }),
        }),
      }
    }
    if (table === 'dealerships') {
      return {
        update: (payload) => ({
          eq: () => {
            updatedStatus = payload.billing_status
            return Promise.resolve({ error: null })
          },
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { is_personal: false }, error: null }),
          }),
        }),
      }
    }
    return {}
  }

  const result = await reconcileDealershipBillingStatus('dealer-123')
  assert.equal(result, 'INACTIVE')
  assert.equal(updatedStatus, 'INACTIVE')
})
