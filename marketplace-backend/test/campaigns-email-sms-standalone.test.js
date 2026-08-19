import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PLAN_CATALOG, FEATURES_BY_PRODUCT } from '../plan-catalog.js'
import { computeAccessContext, hasFeature } from '../access-policy.js'

const dealerAutomationJs = readFileSync(new URL('../routes/dealer-automation.js', import.meta.url), 'utf8')
const dashboardPart2Js = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')

test('campaigns-email-sms plan is configured to grant marketsync_email product and standalone features', () => {
  const plan = PLAN_CATALOG['campaigns-email-sms']
  assert.ok(plan, 'campaigns-email-sms plan must exist')
  assert.equal(plan.product_primary, 'marketsync_email')
  assert.deepEqual(plan.products, ['marketsync_email'])
  assert.equal(plan.monthly, 129)
  assert.deepEqual(plan.features, FEATURES_BY_PRODUCT.marketsync_email)
  assert.ok(plan.features.includes('email.campaigns'))
  assert.ok(plan.features.includes('email.templates'))
  assert.ok(plan.features.includes('email.audiences'))
  assert.ok(plan.features.includes('email.automations'))
  assert.ok(!plan.features.includes('os.marketing'), 'standalone email plan must not require os.marketing')
  assert.ok(!plan.features.includes('os.email_marketing'), 'standalone email plan must not require os.email_marketing')
})

test('access context for campaigns-email-sms subscriber grants email features without DealerOS features', () => {
  const ctx = computeAccessContext({
    userId: 'user-1',
    dealershipId: 'dealer-1',
    subscriptions: [{ product_id: 'marketsync_email', plan_id: 'campaigns-email-sms', status: 'active' }],
    features: [
      { id: 'email.campaigns', product_id: 'marketsync_email' },
      { id: 'email.templates', product_id: 'marketsync_email' },
      { id: 'email.audiences', product_id: 'marketsync_email' },
      { id: 'email.automations', product_id: 'marketsync_email' },
      { id: 'os.marketing', product_id: 'dealer_os' },
      { id: 'os.email_marketing', product_id: 'dealer_os' },
    ],
    planFeatures: [
      { plan_id: 'campaigns-email-sms', feature_id: 'email.campaigns' },
      { plan_id: 'campaigns-email-sms', feature_id: 'email.templates' },
      { plan_id: 'campaigns-email-sms', feature_id: 'email.audiences' },
      { plan_id: 'campaigns-email-sms', feature_id: 'email.automations' },
    ],
  })

  assert.deepEqual(ctx.products, ['marketsync_email'])
  assert.ok(hasFeature(ctx, 'email.campaigns'))
  assert.ok(hasFeature(ctx, 'email.templates'))
  assert.ok(hasFeature(ctx, 'email.audiences'))
  assert.ok(hasFeature(ctx, 'email.automations'))
  assert.ok(!hasFeature(ctx, 'os.email_marketing'), 'standalone subscriber does not hold os.email_marketing')
  assert.ok(!hasFeature(ctx, 'os.marketing'), 'standalone subscriber does not hold os.marketing')
})

test('backend dealer-automation routes use requireAnyFeature with standalone email entitlements', () => {
  assert.match(dealerAutomationJs, /requireAnyFeature\('email\.campaigns'/)
  assert.match(dealerAutomationJs, /'email\.templates'/)
  assert.match(dealerAutomationJs, /'email\.audiences'/)
  assert.match(dealerAutomationJs, /'email\.automations'/)
  assert.match(dealerAutomationJs, /'os\.email_marketing'/)
})

test('frontend PAGE_ANY_FEATURE includes standalone email entitlements for email-marketing page', () => {
  assert.match(dashboardPart2Js, /'email-marketing':\s*\[[^\]]*'email\.campaigns'/)
  assert.match(dashboardPart2Js, /'email-marketing':\s*\[[^\]]*'email\.templates'/)
  assert.match(dashboardPart2Js, /'email-marketing':\s*\[[^\]]*'email\.audiences'/)
  assert.match(dashboardPart2Js, /'email-marketing':\s*\[[^\]]*'email\.automations'/)
})
