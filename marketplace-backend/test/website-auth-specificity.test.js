import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAccessContext, hasProductAccess, hasFeature, can } from '../access-policy.js'
import { getPlan, productsForPlan } from '../plan-catalog.js'

const FEATURES = [
  { id: 'website.builder', product_id: 'marketsync_website', sort_order: 1 },
  { id: 'website.blog', product_id: 'marketsync_website', sort_order: 2 },
  { id: 'website.seo', product_id: 'marketsync_website', sort_order: 3 },
  { id: 'design.canvas', product_id: 'design_studio', sort_order: 1 },
  { id: 'social.scheduler', product_id: 'design_studio', sort_order: 2 },
  { id: 'fb.inventory', product_id: 'facebook', sort_order: 1 },
]

const ROLE_PERMISSIONS = [
  { role_id: 'dealer_owner', permission_id: 'site.manage' },
  { role_id: 'dealer_owner', permission_id: 'billing.manage' },
  { role_id: 'dealer_owner', permission_id: 'users.manage' },
  { role_id: 'salesperson', permission_id: 'lead.create' },
]

test('Fix 10: Website Auth Specificity — Owner role is NOT a substitute for purchasing the Website product', () => {
  // Scenario A: Owner of dealership with only Sales Marketing Suite (Design Studio + AutoPoster + Campaigns)
  const salesSuitePlan = getPlan('sales-marketing-suite')
  assert.ok(salesSuitePlan, 'sales-marketing-suite must exist')
  assert.ok(!productsForPlan('sales-marketing-suite').includes('marketsync_website'), 'Sales Marketing Suite does NOT include website')

  const salesSuiteCoverage = productsForPlan('sales-marketing-suite').map(p => ({
    subscription_id: 'sub_sales_suite',
    plan_id: 'sales-marketing-suite',
    product_id: p,
    status: 'active',
  }))

  const salesSuiteOwnerCtx = computeAccessContext({
    userId: 'owner-1',
    dealershipId: 'dealer-1',
    roleIds: ['dealer_owner'],
    rolePermissions: ROLE_PERMISSIONS,
    productCoverage: salesSuiteCoverage,
    features: FEATURES,
  })

  // The owner holds site.manage permission in RBAC...
  assert.ok(can(salesSuiteOwnerCtx, 'site.manage'), 'Owner has site.manage role permission')
  // ...BUT because the dealership lacks the marketsync_website product entitlement, product access evaluates to FALSE.
  assert.equal(hasProductAccess(salesSuiteOwnerCtx, 'marketsync_website'), false, 'Owner without website subscription has NO website product access')
})

test('Fix 10: MarketSync Digital includes Website product and enables website management for owners', () => {
  const digitalPlan = getPlan('marketsync-digital')
  assert.ok(digitalPlan, 'marketsync-digital must exist')
  assert.ok(productsForPlan('marketsync-digital').includes('marketsync_website'), 'MarketSync Digital includes website')

  const digitalCoverage = productsForPlan('marketsync-digital').map(p => ({
    subscription_id: 'sub_digital',
    plan_id: 'marketsync-digital',
    product_id: p,
    status: 'active',
  }))

  const digitalOwnerCtx = computeAccessContext({
    userId: 'owner-2',
    dealershipId: 'dealer-2',
    roleIds: ['dealer_owner'],
    rolePermissions: ROLE_PERMISSIONS,
    productCoverage: digitalCoverage,
    features: FEATURES,
  })

  assert.ok(can(digitalOwnerCtx, 'site.manage'), 'Owner has site.manage permission')
  assert.ok(hasProductAccess(digitalOwnerCtx, 'marketsync_website'), 'Digital owner HAS website product access')
})

test('Fix 10: Standalone Dealer Website subscriber has Website product access', () => {
  const webPlan = getPlan('dealer-website')
  assert.ok(webPlan, 'dealer-website plan must exist')
  assert.deepEqual(productsForPlan('dealer-website'), ['marketsync_website'])

  const webCoverage = [{
    subscription_id: 'sub_web_only',
    plan_id: 'dealer-website',
    product_id: 'marketsync_website',
    status: 'active',
  }]

  const webOwnerCtx = computeAccessContext({
    userId: 'owner-3',
    dealershipId: 'dealer-3',
    roleIds: ['dealer_owner'],
    rolePermissions: ROLE_PERMISSIONS,
    productCoverage: webCoverage,
    features: FEATURES,
  })

  assert.ok(hasProductAccess(webOwnerCtx, 'marketsync_website'), 'Dealer Website subscriber has website product access')
})

test('Fix 1: Salesperson without site.manage permission cannot manage website even if org owns website', () => {
  const webCoverage = [{
    subscription_id: 'sub_web_only',
    plan_id: 'dealer-website',
    product_id: 'marketsync_website',
    status: 'active',
  }]

  const repCtx = computeAccessContext({
    userId: 'rep-1',
    dealershipId: 'dealer-3',
    roleIds: ['salesperson'],
    rolePermissions: ROLE_PERMISSIONS,
    productCoverage: webCoverage,
    features: FEATURES,
  })

  assert.ok(hasProductAccess(repCtx, 'marketsync_website'), 'Org owns website')
  assert.equal(can(repCtx, 'site.manage'), false, 'Salesperson lacks site.manage permission')
})
