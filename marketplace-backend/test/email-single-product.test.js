import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computeAccessContext } from '../access-policy.js'
import { PLAN_CATALOG } from '../plan-catalog.js'

const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const marketingWs = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')

test('Email single product (marketsync_email) has correct canonical catalog and features', () => {
  const plan = PLAN_CATALOG['campaigns-email-sms']
  assert.ok(plan, 'campaigns-email-sms must exist in plan catalog')
  assert.equal(plan.product_primary, 'marketsync_email')
  assert.equal(plan.monthly, 129)

  // Validate access policy for standalone email user
  const access = computeAccessContext({
    roles: [{ id: 'salesperson', permissions: ['marketing.view', 'marketing.edit', 'customer.view'] }],
    subscriptions: [{ product_id: 'marketsync_email', plan_id: 'campaigns-email-sms', status: 'active' }],
    productMemberships: ['marketsync_email'],
    planProducts: [{ plan_id: 'campaigns-email-sms', product_id: 'marketsync_email' }],
    planFeatures: [
      { plan_id: 'campaigns-email-sms', feature_id: 'email.campaigns' },
      { plan_id: 'campaigns-email-sms', feature_id: 'email.templates' },
      { plan_id: 'campaigns-email-sms', feature_id: 'email.automations' },
    ],
    features: [
      { id: 'email.campaigns', product_id: 'marketsync_email' },
      { id: 'email.templates', product_id: 'marketsync_email' },
      { id: 'email.automations', product_id: 'marketsync_email' },
    ]
  })

  assert.ok(access.products.includes('marketsync_email'), 'marketsync_email must be in user products')
  assert.ok(access.features.includes('email.automations'), 'email.automations must be in entitled features')
  assert.ok(access.features.includes('email.campaigns'), 'email.campaigns must be in entitled features')
})

test('Frontend dashboard includes automation-builder and marketing-overview in marketsync_email PRODUCT_PAGES', () => {
  assert.match(dashboardJs, /marketsync_email:\s*\[\s*'marketing-overview',\s*'automation-builder',\s*'email-marketing'\s*\]/)
  assert.match(dashboardJs, /marketsync_email:\s*'marketing-overview'/)
})

test('Marketing workspace tabOrder dynamically gates automations tab without broken override', () => {
  assert.match(marketingWs, /get tabOrder\(\)/)
  assert.match(marketingWs, /email\.automations/)
  // Verify that automations method is not overridden with email-sms
  assert.doesNotMatch(marketingWs, /automations\(body,\s*d\)\s*\{\s*this\['email-sms'\]/)
})
