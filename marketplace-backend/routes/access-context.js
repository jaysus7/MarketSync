import { requireAuth } from '../middleware.js'
import { getCurrentAccessContext, getDefaultRoute, getVisibleNavigation } from '../access.js'
import { supabaseAdmin } from '../shared.js'

// The frontend's single source of truth for what the signed-in caller may see and do.
// Returns ONLY the derived, safe summary — never raw RBAC/entitlement rows, never the
// service-role key. The client uses this to pick the landing route, render the nav
// (desktop + mobile), and disable actions. Enforcement still happens server-side on every
// request (route guards + RLS): this endpoint is for UX, not security.
export function registerAccessContext(app) {
  app.get('/access/context', requireAuth, async (req, res) => {
    try {
      const ctx = await getCurrentAccessContext(req)
      const { data: catalog } = await supabaseAdmin
        .from('features').select('id, product_id, name, feature_group, sort_order')
      res.json({
        userId: ctx.userId,
        dealershipId: ctx.dealershipId,
        accountType: ctx.accountType,
        isPlatformStaff: ctx.isPlatformStaff,
        products: ctx.products,
        features: ctx.features,
        permissions: ctx.permissions,
        dataScope: ctx.dataScope,
        defaultRoute: getDefaultRoute(ctx),
        navigation: getVisibleNavigation(ctx, catalog || []),
      })
    } catch (err) {
      res.status(500).json({ error: 'Failed to resolve access context' })
    }
  })
}
