// Central access-model policy — PURE functions, no IO. Shared by the request-time
// access service (access.js) and by automated tests, exactly like authorization-policy.js
// backs authorization.js.
//
// The effective access of a caller is the AND of four independent layers:
//   1. Product access      — does the org subscribe to the product AND does this member
//                            have that product (product_memberships; empty ⇒ all org products)
//   2. Subscription tier   — does the org's plan for that product entitle the feature
//                            (plan_features); a product with no subscription row falls back
//                            to legacy dealerships.products (full product) for compatibility
//   3. Role permissions    — RBAC role_permissions for the caller's user_roles
//   4. Individual overrides — member_permission_overrides grant/deny, applied last
//
// None of these is "menu hiding": every layer is also enforced in RLS + API guards.

export const PRODUCTS = Object.freeze(['facebook', 'ai_dealer', 'dealer_os'])

// When a caller can reach more than one product, this decides which one their default
// landing route opens into. dealer_os (the full OS) wins over the point products so an
// owner never lands on the Facebook-only screen — the bug this whole model fixes.
export const PRODUCT_PRIORITY = Object.freeze({ dealer_os: 3, ai_dealer: 2, facebook: 1 })

export const PRODUCT_ROUTES = Object.freeze({
  facebook: '/facebook',
  ai_dealer: '/ai-dealer',
  dealer_os: '/dealer-os',
})

// Legacy dealerships.products jsonb keys → normalized product ids. Used only as a
// fallback for orgs that have no rows in the new subscriptions table yet (pre-backfill).
export const LEGACY_PRODUCT_KEY_MAP = Object.freeze({
  facebook_solo: 'facebook',
  facebook_dealer: 'facebook',
  ai_chatbot: 'ai_dealer',
  dealer_os: 'dealer_os',
})

// Record-level data scope per RBAC role. 'all' = every record in the dealership,
// 'own' = only records owned/assigned to the caller. Managers and back-office roles
// see everything in their department; individual contributors see their own book.
const DATA_SCOPE_BY_ROLE = Object.freeze({
  platform_owner: 'all', platform_admin: 'all',
  dealer_owner: 'all', dealer_group_owner: 'all', general_manager: 'all',
  sales_manager: 'all', fni_manager: 'all', service_manager: 'all', accounting: 'all',
  salesperson: 'own', bdc: 'own', technician: 'own', read_only: 'own',
})
const SUBSCRIPTION_ACTIVE_STATUSES = Object.freeze(['trialing', 'active'])

function scopeRank(scope) { return scope === 'all' ? 2 : scope === 'assigned' ? 1 : 0 }

// Build the resolved access context from raw rows (see access.js loader for the shape).
// The result is a plain, serializable snapshot; the helpers below operate on it so the
// same logic runs identically in middleware and in tests.
export function computeAccessContext(raw = {}) {
  const isPlatformStaff = raw.systemRole === 'platform_owner' || raw.systemRole === 'platform_admin'
  const roleIds = Array.isArray(raw.roleIds) ? [...new Set(raw.roleIds)] : []

  // ── Layer 1: product access ──
  const activeSubs = (raw.subscriptions || []).filter(s => SUBSCRIPTION_ACTIVE_STATUSES.includes(s.status))
  const orgHasSubs = (raw.subscriptions || []).length > 0
  let orgProducts
  if (orgHasSubs) {
    orgProducts = new Set(activeSubs.map(s => s.product_id))
  } else {
    // Pre-backfill fallback: derive org products from the legacy jsonb (empty ⇒ dealer_os,
    // matching profile.js resolveProducts so existing accounts keep their access).
    const legacy = raw.legacyProducts && Object.keys(raw.legacyProducts).some(k => raw.legacyProducts[k])
      ? raw.legacyProducts : { dealer_os: true }
    orgProducts = new Set(
      Object.keys(legacy).filter(k => legacy[k]).map(k => LEGACY_PRODUCT_KEY_MAP[k]).filter(Boolean)
    )
  }
  // Platform staff can reach every product regardless of org subscriptions.
  if (isPlatformStaff) PRODUCTS.forEach(p => orgProducts.add(p))

  const memberships = raw.productMemberships || []
  const userProducts = new Set(
    (memberships.length > 0 && !isPlatformStaff)
      ? memberships.filter(p => orgProducts.has(p))   // member restricted to their assigned products
      : [...orgProducts]                              // no explicit memberships ⇒ all org products
  )

  // ── Layer 2: subscription tier → entitled features per product ──
  const planByProduct = {}
  for (const s of activeSubs) if (s.plan_id) planByProduct[s.product_id] = s.plan_id
  const planFeatures = raw.planFeatures || []
  const featureCatalog = raw.features || []
  const featureProduct = {}
  for (const f of featureCatalog) featureProduct[f.id] = f.product_id

  const entitledFeatures = new Set()
  for (const product of userProducts) {
    const planId = planByProduct[product]
    if (planId) {
      for (const pf of planFeatures) if (pf.plan_id === planId) entitledFeatures.add(pf.feature_id)
    } else {
      // Product access without a plan row (legacy fallback / platform staff) ⇒ all of the
      // product's features are entitled. Tier gating only applies once a plan is assigned.
      for (const f of featureCatalog) if (f.product_id === product) entitledFeatures.add(f.id)
    }
  }

  // ── Layers 3 + 4: role permissions with individual overrides applied last ──
  const permissions = new Set()
  if (isPlatformStaff) {
    permissions.add('*')
  } else {
    for (const rp of (raw.rolePermissions || [])) permissions.add(rp.permission_id)
    for (const o of (raw.overrides || [])) {
      if (o.effect === 'grant') permissions.add(o.permission_id)
      else if (o.effect === 'deny') permissions.delete(o.permission_id)
    }
  }

  // Data scope = the broadest scope across the caller's roles.
  let dataScope = 'own'
  for (const r of roleIds) {
    const s = DATA_SCOPE_BY_ROLE[r] || 'own'
    if (scopeRank(s) > scopeRank(dataScope)) dataScope = s
  }
  if (isPlatformStaff) dataScope = 'all'

  return Object.freeze({
    userId: raw.userId || null,
    dealershipId: raw.dealershipId || null,
    accountType: raw.accountType || null,
    isPlatformStaff,
    roleIds,
    products: [...userProducts],
    orgProducts: [...orgProducts],
    planByProduct,
    features: [...entitledFeatures],
    featureProduct,
    permissions: [...permissions],
    dataScope,
  })
}

export function hasProductAccess(ctx, productId) {
  if (!ctx) return false
  return ctx.isPlatformStaff || ctx.products.includes(productId)
}

// A feature is reachable only if the caller has BOTH product access to its product AND
// the org's plan entitles it (Layers 1 ∧ 2).
export function hasFeature(ctx, featureId) {
  if (!ctx) return false
  const product = ctx.featureProduct[featureId]
  if (!product) return false
  return hasProductAccess(ctx, product) && ctx.features.includes(featureId)
}

export function can(ctx, permission) {
  if (!ctx) return false
  return ctx.permissions.includes('*') || ctx.permissions.includes(permission)
}

// Record-level scope for a resource. resource is accepted for future per-resource
// refinement; today scope is role-derived and uniform across resources.
export function getDataScope(ctx, _resource) {
  return ctx?.dataScope || 'own'
}

// The route a caller's session should open into — the highest-priority product they can
// actually reach, never a hardcoded default. No accessible product ⇒ null (caller lands
// on a "no active products" screen instead of a product they can't use).
export function getDefaultRoute(ctx) {
  if (!ctx || ctx.products.length === 0) return null
  const primary = [...ctx.products].sort(
    (a, b) => (PRODUCT_PRIORITY[b] || 0) - (PRODUCT_PRIORITY[a] || 0)
  )[0]
  return PRODUCT_ROUTES[primary] || null
}

// The nav the caller may see: each accessible product with its entitled features, in
// catalog order. featureCatalog is the same rows fed to computeAccessContext (kept on the
// context via featureProduct, but order/labels come from the catalog passed here).
// permissionForFeature optionally maps a feature id → a required permission; when a
// mapping exists the feature is hidden unless can() also passes (Layer 3). This is the
// single source both desktop and mobile nav render from (Phase 4).
export function getVisibleNavigation(ctx, featureCatalog = [], permissionForFeature = {}) {
  if (!ctx) return []
  const byProduct = {}
  for (const f of featureCatalog) {
    if (!hasFeature(ctx, f.id)) continue
    const requiredPerm = permissionForFeature[f.id]
    if (requiredPerm && !can(ctx, requiredPerm)) continue
    ;(byProduct[f.product_id] ||= []).push(f)
  }
  return ctx.products
    .filter(p => byProduct[p]?.length)
    .sort((a, b) => (PRODUCT_PRIORITY[b] || 0) - (PRODUCT_PRIORITY[a] || 0))
    .map(product => ({
      product,
      route: PRODUCT_ROUTES[product] || null,
      features: byProduct[product].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    }))
}
