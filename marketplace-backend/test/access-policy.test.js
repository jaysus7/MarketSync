import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeAccessContext, hasProductAccess, hasFeature, can,
  getDataScope, getDefaultRoute, getVisibleNavigation, PRODUCT_ROUTES,
} from '../access-policy.js'

// Minimal catalog fixture mirroring the seeded rows.
const FEATURES = [
  { id: 'fb.inventory', product_id: 'facebook', sort_order: 1 },
  { id: 'fb.leaderboard', product_id: 'facebook', sort_order: 2 },
  { id: 'ai.conversations', product_id: 'ai_dealer', sort_order: 2 },
  { id: 'os.dashboard', product_id: 'dealer_os', sort_order: 1 },
  { id: 'os.crm', product_id: 'dealer_os', sort_order: 2 },
  { id: 'os.accounting', product_id: 'dealer_os', sort_order: 5 },
]
const PLAN_FEATURES = [
  { plan_id: 'fb_solo', feature_id: 'fb.inventory' },
  { plan_id: 'fb_solo', feature_id: 'fb.leaderboard' },
  { plan_id: 'os_starter', feature_id: 'os.dashboard' },
  { plan_id: 'os_starter', feature_id: 'os.crm' },
  { plan_id: 'os_pro', feature_id: 'os.dashboard' },
  { plan_id: 'os_pro', feature_id: 'os.crm' },
  { plan_id: 'os_pro', feature_id: 'os.accounting' },
]
const ROLE_PERMS = {
  dealer_owner: ['users.manage', 'billing.manage', 'customer.view', 'customer.edit', 'accounting.view'],
  salesperson: ['customer.view', 'customer.edit', 'lead.create'],
}
function rolePerms(...roles) {
  return roles.flatMap(r => (ROLE_PERMS[r] || []).map(permission_id => ({ role_id: r, permission_id })))
}
function ctxFor(raw) {
  return computeAccessContext({ features: FEATURES, planFeatures: PLAN_FEATURES, ...raw })
}

// 1. dealer_os owner on os_pro sees the OS, its plan features, and lands on /dealer-os.
test('owner with dealer_os pro plan', () => {
  const ctx = ctxFor({
    userId: 'u1', dealershipId: 'd1', roleIds: ['dealer_owner'],
    rolePermissions: rolePerms('dealer_owner'),
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_pro', status: 'active' }],
  })
  assert.ok(hasProductAccess(ctx, 'dealer_os'))
  assert.ok(!hasProductAccess(ctx, 'facebook'))
  assert.ok(hasFeature(ctx, 'os.accounting'))
  assert.ok(can(ctx, 'billing.manage'))
  assert.equal(getDefaultRoute(ctx), PRODUCT_ROUTES.dealer_os)
  assert.equal(getDataScope(ctx), 'all')
})

// 2. THE CORE BUG: a Facebook-only account must NOT reach dealer_os or land on /dealer-os.
test('facebook-only account is confined to facebook', () => {
  const ctx = ctxFor({
    userId: 'u2', dealershipId: 'd2', roleIds: ['dealer_owner'],
    rolePermissions: rolePerms('dealer_owner'),
    subscriptions: [{ product_id: 'facebook', plan_id: 'fb_solo', status: 'active' }],
  })
  assert.ok(hasProductAccess(ctx, 'facebook'))
  assert.ok(!hasProductAccess(ctx, 'dealer_os'))
  assert.ok(hasFeature(ctx, 'fb.inventory'))
  assert.ok(!hasFeature(ctx, 'os.crm'))
  assert.equal(getDefaultRoute(ctx), PRODUCT_ROUTES.facebook)
})

// 3. Subscription-tier gating: starter plan does NOT unlock a pro-only feature.
test('plan tier gates features within a product', () => {
  const ctx = ctxFor({
    userId: 'u3', dealershipId: 'd3', roleIds: ['dealer_owner'],
    rolePermissions: rolePerms('dealer_owner'),
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_starter', status: 'active' }],
  })
  assert.ok(hasFeature(ctx, 'os.crm'))
  assert.ok(!hasFeature(ctx, 'os.accounting'), 'starter must not unlock accounting')
})

// 4. Product membership confines a rep even when the org has more products.
test('product membership restricts a member below org entitlements', () => {
  const ctx = ctxFor({
    userId: 'u4', dealershipId: 'd4', roleIds: ['salesperson'],
    rolePermissions: rolePerms('salesperson'),
    subscriptions: [
      { product_id: 'dealer_os', plan_id: 'os_pro', status: 'active' },
      { product_id: 'facebook', plan_id: 'fb_solo', status: 'active' },
    ],
    productMemberships: ['facebook'],
  })
  assert.ok(hasProductAccess(ctx, 'facebook'))
  assert.ok(!hasProductAccess(ctx, 'dealer_os'), 'membership excludes dealer_os')
  assert.ok(!hasFeature(ctx, 'os.crm'))
})

// 5. No memberships ⇒ member inherits all org products.
test('empty memberships inherit all org products', () => {
  const ctx = ctxFor({
    userId: 'u5', dealershipId: 'd5', roleIds: ['salesperson'],
    rolePermissions: rolePerms('salesperson'),
    subscriptions: [
      { product_id: 'dealer_os', plan_id: 'os_pro', status: 'active' },
      { product_id: 'facebook', plan_id: 'fb_solo', status: 'active' },
    ],
    productMemberships: [],
  })
  assert.ok(hasProductAccess(ctx, 'facebook'))
  assert.ok(hasProductAccess(ctx, 'dealer_os'))
})

// 6. Inactive subscription grants nothing.
test('past_due subscription does not grant access', () => {
  const ctx = ctxFor({
    userId: 'u6', dealershipId: 'd6', roleIds: ['dealer_owner'],
    rolePermissions: rolePerms('dealer_owner'),
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_pro', status: 'past_due' }],
  })
  assert.ok(!hasProductAccess(ctx, 'dealer_os'))
  assert.equal(getDefaultRoute(ctx), null)
})

// 7. Role permissions: a salesperson cannot manage billing/users.
test('role permissions confine a salesperson', () => {
  const ctx = ctxFor({
    userId: 'u7', dealershipId: 'd7', roleIds: ['salesperson'],
    rolePermissions: rolePerms('salesperson'),
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_pro', status: 'active' }],
  })
  assert.ok(can(ctx, 'customer.view'))
  assert.ok(!can(ctx, 'billing.manage'))
  assert.ok(!can(ctx, 'users.manage'))
  assert.equal(getDataScope(ctx), 'own')
})

// 8. Individual override: deny removes an otherwise-granted permission.
test('member override deny strips a permission', () => {
  const ctx = ctxFor({
    userId: 'u8', dealershipId: 'd8', roleIds: ['dealer_owner'],
    rolePermissions: rolePerms('dealer_owner'),
    overrides: [{ permission_id: 'accounting.view', effect: 'deny' }],
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_pro', status: 'active' }],
  })
  assert.ok(!can(ctx, 'accounting.view'), 'deny override wins over role grant')
  assert.ok(can(ctx, 'billing.manage'))
})

// 9. Individual override: grant adds a permission the role lacks.
test('member override grant adds a permission', () => {
  const ctx = ctxFor({
    userId: 'u9', dealershipId: 'd9', roleIds: ['salesperson'],
    rolePermissions: rolePerms('salesperson'),
    overrides: [{ permission_id: 'accounting.view', effect: 'grant' }],
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_pro', status: 'active' }],
  })
  assert.ok(can(ctx, 'accounting.view'))
})

// 10. Platform staff bypass product/plan/permission gates entirely.
test('platform staff have universal access', () => {
  const ctx = ctxFor({ userId: 'p1', dealershipId: 'd1', systemRole: 'platform_owner' })
  assert.ok(hasProductAccess(ctx, 'dealer_os'))
  assert.ok(hasProductAccess(ctx, 'facebook'))
  assert.ok(hasFeature(ctx, 'os.accounting'))
  assert.ok(can(ctx, 'anything.at.all'))
  assert.equal(getDataScope(ctx), 'all')
})

// 11. Legacy fallback: an org with no subscription rows keeps dealer_os (existing accounts).
test('no subscription rows fall back to legacy dealer_os', () => {
  const ctx = ctxFor({
    userId: 'u11', dealershipId: 'd11', roleIds: ['dealer_owner'],
    rolePermissions: rolePerms('dealer_owner'),
    subscriptions: [], legacyProducts: null,
  })
  assert.ok(hasProductAccess(ctx, 'dealer_os'))
  assert.ok(hasFeature(ctx, 'os.accounting'), 'legacy access ⇒ all product features')
  assert.equal(getDefaultRoute(ctx), PRODUCT_ROUTES.dealer_os)
})

// 12. Legacy fallback honors the specific legacy jsonb keys.
test('legacy facebook_solo maps to facebook product', () => {
  const ctx = ctxFor({
    userId: 'u12', dealershipId: 'd12', roleIds: ['salesperson'],
    rolePermissions: rolePerms('salesperson'),
    subscriptions: [], legacyProducts: { facebook_solo: true },
  })
  assert.ok(hasProductAccess(ctx, 'facebook'))
  assert.ok(!hasProductAccess(ctx, 'dealer_os'))
})

// 13. getVisibleNavigation returns accessible products with entitled features, OS first.
test('visible navigation filters to entitled features, highest product first', () => {
  const ctx = ctxFor({
    userId: 'u13', dealershipId: 'd13', roleIds: ['dealer_owner'],
    rolePermissions: rolePerms('dealer_owner'),
    subscriptions: [
      { product_id: 'dealer_os', plan_id: 'os_starter', status: 'active' },
      { product_id: 'facebook', plan_id: 'fb_solo', status: 'active' },
    ],
  })
  const nav = getVisibleNavigation(ctx, FEATURES)
  assert.equal(nav[0].product, 'dealer_os')
  assert.equal(nav[1].product, 'facebook')
  const osFeatures = nav[0].features.map(f => f.id)
  assert.deepEqual(osFeatures, ['os.dashboard', 'os.crm'])
  assert.ok(!osFeatures.includes('os.accounting'), 'starter excludes accounting from nav')
})

// 14. getVisibleNavigation hides a feature the caller lacks permission for.
test('visible navigation respects a feature→permission mapping', () => {
  const ctx = ctxFor({
    userId: 'u14', dealershipId: 'd14', roleIds: ['salesperson'],
    rolePermissions: rolePerms('salesperson'),
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_pro', status: 'active' }],
  })
  const nav = getVisibleNavigation(ctx, FEATURES, { 'os.accounting': 'accounting.view' })
  const osFeatures = nav.find(n => n.product === 'dealer_os').features.map(f => f.id)
  assert.ok(!osFeatures.includes('os.accounting'), 'no accounting.view ⇒ hidden even if entitled')
  assert.ok(osFeatures.includes('os.crm'))
})

// 15. A caller with no products at all has no route and empty nav.
test('no access yields null route and empty nav', () => {
  const ctx = ctxFor({
    userId: 'u15', dealershipId: 'd15', roleIds: ['read_only'],
    subscriptions: [{ product_id: 'dealer_os', plan_id: 'os_pro', status: 'cancelled' }],
  })
  assert.equal(getDefaultRoute(ctx), null)
  assert.deepEqual(getVisibleNavigation(ctx, FEATURES), [])
})
