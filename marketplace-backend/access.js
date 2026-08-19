// Central access service (IO layer). Loads the raw entitlement/RBAC rows for the caller
// and resolves them via the pure policy in access-policy.js. This is the ONE place the
// server answers "what can this caller do?" — nav filtering, route guards, and API
// authorization all consume the same resolved context.
//
// It deliberately reads through supabaseAdmin (service role): RBAC + entitlement rows are
// server-only and must never be exposed to the browser. The context is computed here and
// only the safe, derived summary is ever sent to the client (see access-context.js route
// / /auth/me). The Supabase service-role key stays on the server.

import { supabaseAdmin } from './shared.js'
import {
  computeAccessContext, hasProductAccess, hasFeature, can,
  getDataScope, getDefaultRoute, getVisibleNavigation,
} from './access-policy.js'
import { isDemoDealershipId } from './routes/demo.js'
import { getShowcaseOverlay } from './plan-catalog.js'

export * from './access-policy.js'

// The catalog (products/features/plans/plan_features) is small and changes only on a
// deploy/migration, so cache it briefly rather than re-reading it on every request.
let _catalog = null
let _catalogAt = 0
const CATALOG_TTL_MS = 5 * 60 * 1000
export function bustCatalogCache() { _catalog = null; _catalogAt = 0 }

async function loadCatalog() {
  if (_catalog && Date.now() - _catalogAt < CATALOG_TTL_MS) return _catalog
  const [features, planFeatures, products] = await Promise.all([
    supabaseAdmin.from('features').select('id, product_id, name, feature_group, sort_order'),
    supabaseAdmin.from('plan_features').select('plan_id, feature_id'),
    supabaseAdmin.from('products').select('id, name, sort_order'),
  ])
  const failed = [
    ['features', features.error],
    ['plan_features', planFeatures.error],
    ['products', products.error],
  ].filter(([, error]) => error)
  if (failed.length) {
    const detail = failed.map(([table, error]) => `${table}: ${error.message}`).join('; ')
    console.error(`[access] entitlement catalog unavailable — ${detail}`)
    throw new Error('Entitlement catalog unavailable')
  }
  _catalog = {
    features: features.data || [],
    planFeatures: planFeatures.data || [],
    products: products.data || [],
  }
  _catalogAt = Date.now()
  return _catalog
}

// Resolve (and memoize on req) the caller's access context. Requires requireAuth to have
// run first (populates req.user / req.profile / req.dealershipId).
export async function getCurrentAccessContext(req) {
  if (req._accessContext) return req._accessContext

  const userId = req.user?.id || null
  const dealershipId = req.dealershipId || null
  const profile = req.profile || {}
  const dealer = profile.dealerships || {}

  const catalog = await loadCatalog()

  // Per-caller rows. Without a dealership (e.g. brand-new signup) only the catalog
  // matters; the membership/permission queries would return nothing anyway.
  let roleRows = [], overrides = [], subscriptions = [], memberships = []
  if (dealershipId && userId) {
    const [roleRes, subRes, memRes, ovrRes] = await Promise.all([
      supabaseAdmin.from('user_roles').select('role_id').eq('user_id', userId).eq('dealership_id', dealershipId),
      supabaseAdmin.from('subscriptions').select('product_id, plan_id, status, trial_ends_at').eq('dealership_id', dealershipId),
      supabaseAdmin.from('product_memberships').select('product_id').eq('user_id', userId).eq('dealership_id', dealershipId),
      supabaseAdmin.from('member_permission_overrides').select('permission_id, effect').eq('user_id', userId).eq('dealership_id', dealershipId),
    ])
    const failed = [
      ['user_roles', roleRes.error],
      ['subscriptions', subRes.error],
      ['product_memberships', memRes.error],
      ['member_permission_overrides', ovrRes.error],
    ].filter(([, error]) => error)
    if (failed.length) {
      const detail = failed.map(([table, error]) => `${table}: ${error.message}`).join('; ')
      console.error(`[access] caller entitlement rows unavailable — ${detail}`)
      throw new Error('Caller entitlement data unavailable')
    }
    roleRows = roleRes.data || []
    subscriptions = subRes.data || []
    memberships = (memRes.data || []).map(m => m.product_id)
    overrides = ovrRes.data || []
  }

  const roleIds = roleRows.map(r => r.role_id)
  let rolePermissions = []
  if (roleIds.length) {
    const { data } = await supabaseAdmin
      .from('role_permissions').select('role_id, permission_id').in('role_id', roleIds)
    rolePermissions = data || []
  }

  const isDemo = dealershipId ? await isDemoDealershipId(dealershipId) : false
  const showcaseOverlay = isDemo ? getShowcaseOverlay() : null

  const ctx = computeAccessContext({
    userId,
    dealershipId,
    systemRole: profile.system_role || null,
    accountType: dealer.account_type || null,
    legacyProducts: dealer.products || null,
    roleIds,
    rolePermissions,
    overrides,
    subscriptions,
    productMemberships: memberships,
    features: catalog.features,
    planFeatures: catalog.planFeatures,
    isDemo,
    showcaseOverlay,
  })

  req._accessContext = ctx
  return ctx
}

export async function getEffectiveEntitlements(req) {
  const ctx = await getCurrentAccessContext(req)
  return {
    products: ctx.products,
    features: ctx.features,
    permissions: ctx.permissions,
    isDemo: !!ctx.isDemo,
    isPlatformStaff: !!ctx.isPlatformStaff,
  }
}

// ── Express guards (backend authorization layer) ──
// Enforce product/feature entitlement on API routes. These sit ALONGSIDE requirePermission
// (RBAC) and RLS — product/feature answers "is this product sold to this org & member?",
// requirePermission answers "may this role do it?", RLS enforces both again at the row.
// requireAuth must run before either guard.
export function requireProduct(productId) {
  return async (req, res, next) => {
    try {
      if (await hasProductAccessReq(req, productId)) return next()
      return res.status(403).json({ error: 'PRODUCT_ACCESS_REQUIRED', product: productId })
    } catch { return res.status(500).json({ error: 'Access check failed' }) }
  }
}
export function requireFeature(featureId) {
  return async (req, res, next) => {
    try {
      if (await hasFeatureReq(req, featureId)) return next()
      return res.status(403).json({ error: 'FEATURE_ACCESS_REQUIRED', feature: featureId })
    } catch { return res.status(500).json({ error: 'Access check failed' }) }
  }
}
export function requireAnyFeature(...featureIds) {
  return async (req, res, next) => {
    try {
      const ctx = await getCurrentAccessContext(req)
      for (const featureId of featureIds) {
        if (hasFeature(ctx, featureId)) return next()
      }
      return res.status(403).json({ error: 'FEATURE_ACCESS_REQUIRED', feature: featureIds[0] })
    } catch { return res.status(500).json({ error: 'Access check failed' }) }
  }
}

// Convenience wrappers that resolve the context first, so callers can `await hasFeatureReq(req, 'os.crm')`
// without threading the context manually.
export async function hasProductAccessReq(req, productId) { return hasProductAccess(await getCurrentAccessContext(req), productId) }
export async function hasFeatureReq(req, featureId) { return hasFeature(await getCurrentAccessContext(req), featureId) }
export async function canReq(req, permission) { return can(await getCurrentAccessContext(req), permission) }
export async function getDataScopeReq(req, resource) { return getDataScope(await getCurrentAccessContext(req), resource) }
export async function getDefaultRouteReq(req) { return getDefaultRoute(await getCurrentAccessContext(req)) }
export async function getVisibleNavigationReq(req, permissionForFeature) {
  const ctx = await getCurrentAccessContext(req)
  const catalog = await loadCatalog()
  return getVisibleNavigation(ctx, catalog.features, permissionForFeature)
}
