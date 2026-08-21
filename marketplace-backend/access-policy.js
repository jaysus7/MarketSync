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

export const PRODUCTS = Object.freeze([
  'facebook',
  'ai_dealer',
  'dealer_os',
  'design_studio',
  'marketsync_social',
  'marketsync_video',
  'marketsync_email',
  'marketsync_website',
  'marketsync_seo',
  'marketsync_identity',
])

// When a caller can reach more than one product, this decides which one their default
// landing route opens into. dealer_os (the full OS) wins over the point products so an
// owner never lands on a sub-product screen.
export const PRODUCT_PRIORITY = Object.freeze({
  dealer_os: 9,
  ai_dealer: 4,
  marketsync_website: 3,
  marketsync_seo: 3,
  marketsync_identity: 3,
  marketsync_video: 2,
  marketsync_email: 2,
  marketsync_social: 2,
  design_studio: 2,
  facebook: 1,
})

export const PRODUCT_ROUTES = Object.freeze({
  facebook: '/facebook',
  ai_dealer: '/ai-dealer',
  dealer_os: '/dealer-os',
  design_studio: '/design-studio',
  marketsync_social: '/social',
  marketsync_video: '/video',
  marketsync_email: '/email-marketing',
  marketsync_website: '/website',
  marketsync_seo: '/seo',
  marketsync_identity: '/identity-verify',
})

// Legacy dealerships.products jsonb keys → normalized product ids. Used only as a
// fallback for orgs that have no rows in the new subscriptions table yet (pre-backfill).
export const LEGACY_PRODUCT_KEY_MAP = Object.freeze({
  facebook_solo: 'facebook',
  facebook_dealer: 'facebook',
  facebook: 'facebook',
  ai_chatbot: 'ai_dealer',
  ai_dealer: 'ai_dealer',
  dealer_os: 'dealer_os',
  design_studio: 'design_studio',
  marketsync_social: 'marketsync_social',
  social: 'marketsync_social',
  marketsync_video: 'marketsync_video',
  video: 'marketsync_video',
  marketsync_email: 'marketsync_email',
  email: 'marketsync_email',
  marketsync_website: 'marketsync_website',
  website: 'marketsync_website',
  marketsync_seo: 'marketsync_seo',
  seo: 'marketsync_seo',
  marketsync_identity: 'marketsync_identity',
  identity_verify: 'marketsync_identity',
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
  // A subscription grants access while active or trialing — but a TRIALING sub whose
  // trial_ends_at has passed no longer counts (the 39-day free trial has lapsed; the app
  // shows the paywall). If cancel_at_period_end is set, access remains until current_period_end.
  const now = raw.now ? new Date(raw.now).getTime() : Date.now()
  const isItemLive = (item) => {
    if (!SUBSCRIPTION_ACTIVE_STATUSES.includes(item.status)) return false
    if (item.status === 'trialing' && item.trial_ends_at && new Date(item.trial_ends_at).getTime() < now) return false
    if (item.cancel_at_period_end && item.current_period_end && new Date(item.current_period_end).getTime() < now) return false
    return true
  }

  let orgProducts
  let activeItems = []
  if (Array.isArray(raw.productCoverage) && raw.productCoverage.length > 0) {
    activeItems = raw.productCoverage.filter(isItemLive)
    orgProducts = new Set(activeItems.map(c => c.product_id))
  } else {
    activeItems = (raw.subscriptions || []).filter(isItemLive)
    const orgHasSubs = (raw.subscriptions || []).length > 0
    if (orgHasSubs) {
      orgProducts = new Set(activeItems.map(s => s.product_id))
    } else {
      // Pre-backfill path: derive org products from the legacy jsonb ONLY. An org with no
      // subscriptions AND no legacy product flags gets ZERO products (paywall) — there is
      // no automatic dealer_os grant (matches profile.js resolveProducts). Legacy orgs must
      // be backfilled with a subscription or explicit legacy flags before launch.
      const legacy = (raw.legacyProducts && typeof raw.legacyProducts === 'object') ? raw.legacyProducts : {}
      orgProducts = new Set(
        Object.keys(legacy).filter(k => legacy[k]).map(k => LEGACY_PRODUCT_KEY_MAP[k]).filter(Boolean)
      )
    }
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
  // If multiple live coverage rows exist for the SAME product (e.g. from different plans),
  // entitled features for that product are the UNION of all feature grants across all live plans.
  const plansByProduct = {}
  const planByProduct = {}
  for (const s of activeItems) {
    if (s.plan_id && s.product_id) {
      if (!plansByProduct[s.product_id]) plansByProduct[s.product_id] = new Set()
      plansByProduct[s.product_id].add(s.plan_id)
      if (!planByProduct[s.product_id]) planByProduct[s.product_id] = s.plan_id
    }
  }
  const planFeatures = raw.planFeatures || []
  const featureCatalog = raw.features || []
  const featureProduct = {}
  for (const f of featureCatalog) featureProduct[f.id] = f.product_id

  const isDemo = !!raw.isDemo
  const entitledFeatures = new Set()
  for (const product of userProducts) {
    const productPlans = plansByProduct[product]
    if (productPlans && productPlans.size > 0) {
      for (const planId of productPlans) {
        for (const pf of planFeatures) {
          if (pf.plan_id === planId) entitledFeatures.add(pf.feature_id)
        }
      }
    } else {
      // Product access without a plan row (legacy fallback / platform staff) ⇒ all of the
      // product's features are entitled. Tier gating only applies once a plan is assigned.
      for (const f of featureCatalog) if (f.product_id === product) entitledFeatures.add(f.id)
    }
  }

  // ── Layer 2b: Dedicated Demo Entitlement Overlay ──
  // For a dedicated demo dealership, effective entitlements = canonical entitlements UNION
  // all showcaseable products and features from the catalog overlay. Does NOT alter
  // subscriptions table or real plan billing state.
  if (isDemo && raw.showcaseOverlay) {
    const overlayProducts = Array.isArray(raw.showcaseOverlay.products) ? raw.showcaseOverlay.products : []
    const overlayFeatures = Array.isArray(raw.showcaseOverlay.features) ? raw.showcaseOverlay.features : []
    for (const p of overlayProducts) {
      orgProducts.add(p)
      userProducts.add(p)
    }
    for (const f of overlayFeatures) {
      entitledFeatures.add(f)
    }
  }

  // ── Layers 3 + 4: role permissions with individual overrides applied last ──
  const permissions = new Set()
  if (isPlatformStaff) {
    permissions.add('*')
  } else {
    for (const rp of (raw.rolePermissions || [])) {
      if (!rp.role_id || roleIds.includes(rp.role_id)) {
        permissions.add(rp.permission_id)
      }
    }
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
    isDemo,
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
