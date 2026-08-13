import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAN_CATALOG, PLAN_IDS, getPlan, planForStripePrice, stripePriceForPlan,
  productsForPlan, featuresForPlan,
} from '../plan-catalog.js'

test('the sold plans exist with correct prices', () => {
  assert.deepEqual(PLAN_IDS, ['fb_solo', 'fb_dealership', 'ai_standard', 'os_starter', 'os_growth', 'os_pro'])
  assert.equal(PLAN_CATALOG.fb_solo.monthly, 79)
  assert.equal(PLAN_CATALOG.fb_dealership.monthly, 499)
  assert.equal(PLAN_CATALOG.ai_standard.monthly, 499)
  assert.equal(PLAN_CATALOG.os_starter.monthly, 999)
  assert.equal(PLAN_CATALOG.os_growth.monthly, 1799)
  assert.equal(PLAN_CATALOG.os_pro.monthly, 2499)
})

test('AI Dealer is a standalone product plan', () => {
  assert.deepEqual(PLAN_CATALOG.ai_standard.products, ['ai_dealer'])
  assert.ok(featuresForPlan('ai_standard').includes('ai.conversations'))
  assert.equal(PLAN_CATALOG.ai_standard.legacy.ai_chatbot_active, true)
})

test('org type + owner role come from the plan', () => {
  assert.equal(PLAN_CATALOG.fb_solo.org_type, 'solo')
  assert.equal(PLAN_CATALOG.fb_solo.owner_role, 'OWNER')
  assert.equal(PLAN_CATALOG.fb_dealership.org_type, 'dealership')
  assert.equal(PLAN_CATALOG.os_pro.org_type, 'dealership')
})

test('Dealer OS Pro is the bundle: grants all three products', () => {
  assert.deepEqual(productsForPlan('os_pro'), ['dealer_os', 'facebook', 'ai_dealer'])
  // point plans grant only their own product
  assert.deepEqual(productsForPlan('fb_solo'), ['facebook'])
  assert.deepEqual(productsForPlan('os_starter'), ['dealer_os'])
})

test('Pro features include Facebook + AI features (the bundle unlock)', () => {
  const pro = featuresForPlan('os_pro')
  assert.ok(pro.includes('os.service'), 'Pro includes the top OS feature')
  assert.ok(pro.includes('fb.inventory'), 'Pro unlocks Facebook')
  assert.ok(pro.includes('ai.conversations'), 'Pro unlocks AI Dealer')
  // Starter/Growth stay Dealer-OS-only
  assert.ok(!featuresForPlan('os_starter').includes('fb.inventory'))
  assert.ok(!featuresForPlan('os_growth').includes('ai.conversations'))
})

test('feature tiers are strictly nested: starter ⊆ growth ⊆ pro (within OS)', () => {
  const starter = new Set(featuresForPlan('os_starter'))
  const growth = new Set(featuresForPlan('os_growth'))
  const pro = new Set(featuresForPlan('os_pro'))
  for (const f of starter) assert.ok(growth.has(f), `growth missing starter feature ${f}`)
  for (const f of growth) assert.ok(pro.has(f), `pro missing growth feature ${f}`)
})

test('Stripe price → plan mapping is env-driven and reversible', () => {
  const env = {
    STRIPE_PRICE_FB_SOLO_USD: 'price_fbsolo_usd',
    STRIPE_PKG_PRO_CAD: 'price_pro_cad',
    STRIPE_PKG_PRO_USD: 'price_pro_usd',
  }
  assert.equal(planForStripePrice('price_fbsolo_usd', env), 'fb_solo')
  assert.equal(planForStripePrice('price_pro_cad', env), 'os_pro')
  assert.equal(planForStripePrice('price_pro_usd', env), 'os_pro')
  assert.equal(planForStripePrice('price_unknown', env), null)
  assert.equal(planForStripePrice(null, env), null)
})

test('stripePriceForPlan selects by currency with fallback', () => {
  const env = { STRIPE_PKG_PRO_CAD: 'cad_id', STRIPE_PKG_PRO_USD: 'usd_id' }
  assert.equal(stripePriceForPlan('os_pro', 'cad', env), 'cad_id')
  assert.equal(stripePriceForPlan('os_pro', 'usd', env), 'usd_id')
  // only one configured → falls back to it
  assert.equal(stripePriceForPlan('os_pro', 'cad', { STRIPE_PKG_PRO_USD: 'usd_id' }), 'usd_id')
  assert.equal(stripePriceForPlan('os_pro', 'usd', {}), null)
  assert.equal(stripePriceForPlan('nope', 'usd', env), null)
})

test('legacy Render Stripe variable names still map to their sold plans', () => {
  const env = {
    STRIPE_SOLO_PRICE_ID_CAD: 'price_legacy_solo_cad',
    STRIPE_DEALER_PRICE_ID_USD: 'price_legacy_dealer_usd',
    STRIPE_AI_CHATBOT_PRICE_ID_CAD: 'price_legacy_ai_cad',
  }
  assert.equal(stripePriceForPlan('fb_solo', 'cad', env), 'price_legacy_solo_cad')
  assert.equal(stripePriceForPlan('fb_dealership', 'usd', env), 'price_legacy_dealer_usd')
  assert.equal(stripePriceForPlan('ai_standard', 'cad', env), 'price_legacy_ai_cad')
  assert.equal(planForStripePrice('price_legacy_solo_cad', env), 'fb_solo')
  assert.equal(planForStripePrice('price_legacy_dealer_usd', env), 'fb_dealership')
  assert.equal(planForStripePrice('price_legacy_ai_cad', env), 'ai_standard')
})

test('legacy flags reflect the plan (Pro sets pro + AI + chatbot, solo sets fb_only)', () => {
  assert.equal(PLAN_CATALOG.os_pro.legacy.plan, 'pro')
  assert.equal(PLAN_CATALOG.os_pro.legacy.ai_boost_active, true)
  assert.equal(PLAN_CATALOG.os_pro.legacy.ai_chatbot_active, true)
  assert.equal(PLAN_CATALOG.fb_solo.legacy.fb_only, true)
  assert.equal(PLAN_CATALOG.os_starter.legacy.plan, 'starter')
  assert.equal(PLAN_CATALOG.os_starter.legacy.ai_boost_active, false)
})

test('getPlan returns null for unknown ids', () => {
  assert.equal(getPlan('os_enterprise'), null) // grandfathered, not in the sold catalog
  assert.equal(getPlan('nope'), null)
  assert.ok(getPlan('os_pro'))
})
