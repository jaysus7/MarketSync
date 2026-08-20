import { supabaseAdmin } from './shared.js'
export { SYSTEM_ROLES, LEGACY_DEALER_ROLE_MAP, hasSystemRole } from './authorization-policy.js'
import { SYSTEM_ROLES, systemRoleForLegacyRole, hasSystemRole } from './authorization-policy.js'

export async function syncDealerRole(userId, dealershipId, legacyRole, assignedBy = null) {
  const roleId = systemRoleForLegacyRole(legacyRole)
  await supabaseAdmin.from('user_roles').delete().eq('user_id', userId).eq('dealership_id', dealershipId)
  const { error } = await supabaseAdmin.from('user_roles').insert({ user_id: userId, dealership_id: dealershipId, role_id: roleId, assigned_by: assignedBy })
  if (error) throw error
}

export function requireSystemRole(...roles) {
  return (req, res, next) => {
    if (!hasSystemRole(req, ...roles)) return res.status(403).json({ error: 'Platform access required' })
    next()
  }
}

// Resolves a permission at the platform scope or within the caller's dealership.
// It deliberately uses the server-only client: browser clients never read RBAC rows.
async function permissionLookup(req, permission) {
  if (hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)) return { allowed: true, error: null }
  const dealershipId = req.dealershipId
  if (!dealershipId) return { allowed: false, error: null }

  // Dealer Admins, Store Owners, and Platform Admins implicitly have all dealership permissions
  const role = req.profile?.role || req.user?.user_metadata?.role
  const accountRole = req.profile?.account_role
  const systemRole = req.profile?.system_role
  if (
    role === 'DEALER_ADMIN' || role === 'OWNER' ||
    accountRole === 'dealer_admin' || accountRole === 'dealer_owner' ||
    systemRole === 'platform_owner' || systemRole === 'platform_admin'
  ) {
    return { allowed: true, error: null }
  }
  // A solo/independent rep's "dealership" is a personal, one-person record with no
  // admin above them to grant permissions on their behalf — provisioning still signs
  // them up with a plain SALES_REP profile role and the 'salesperson' RBAC role
  // (which only grants inventory.view), so without this they could never sync their
  // own Facebook feeds or manage their own inventory. Mirrors the frontend's isSolo
  // check (role === 'SALES_REP' && dealership.is_personal).
  if (role === 'SALES_REP' && req.profile?.dealerships?.is_personal === true) {
    return { allowed: true, error: null }
  }
  // On a Facebook-only dealership or independent AutoPoster tier, every rep posts and
  // syncs their own assigned inventory to their Facebook profile. Scoped to inventory.view
  // and inventory.edit specifically so an AutoPoster rep can manage and sync feeds without
  // picking up unrelated admin-only capabilities (billing, HR, etc.).
  if (role === 'SALES_REP' && permission === 'inventory.edit' && req.profile?.dealerships?.fb_only === true) {
    return { allowed: true, error: null }
  }
  if (
    (permission === 'inventory.edit' || permission === 'inventory.view') &&
    (req.profile?.dealerships?.fb_only === true ||
     req.profile?.dealerships?.is_personal === true ||
     req.entitlements?.products?.includes('facebook') ||
     req.entitlements?.features?.includes('fb.inventory') ||
     req.profile?.package_id === 'autoposter-salesperson' ||
     req.profile?.package_id === 'autoposter-dealer')
  ) {
    return { allowed: true, error: null }
  }

  if (
    (permission === 'marketing.view' || permission === 'marketing.edit' || permission === 'social.studio' || permission === 'design.canvas' || permission === 'social.scheduler' || permission === 'lead.assign') &&
    (req.entitlements?.products?.some(p => ['design_studio', 'marketsync_social', 'marketsync_email', 'sales_marketing_suite', 'service_marketing_suite', 'complete_marketing_suite', 'marketsync_digital'].includes(p)) ||
     req.entitlements?.features?.some(f => ['design.canvas', 'design.templates', 'design.assets', 'social.scheduler', 'social.accounts', 'email.campaigns', 'email.automations', 'email.templates'].includes(f)) ||
     ['SALES_REP', 'MANAGER', 'MARKETING_MANAGER'].includes(role) ||
     ['sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite', 'marketsync-digital', 'design-studio', 'campaigns-email-sms', 'marketing-suite'].includes(req.profile?.package_id))
  ) {
    return { allowed: true, error: null }
  }

  if (
    (permission === 'site.manage' || permission === 'site.view' || permission === 'website.manage') &&
    (req.entitlements?.products?.some(p => ['marketsync_website', 'dealer_website', 'website', 'dealer_os', 'sales_marketing_suite', 'service_marketing_suite', 'complete_marketing_suite', 'marketsync_digital'].includes(p)) ||
     req.entitlements?.features?.some(f => ['os.website', 'website.builder', 'website.pages', 'website.domains', 'website.settings'].includes(f)) ||
     ['SALES_REP', 'MANAGER', 'MARKETING_MANAGER', 'SALES_MANAGER', 'GENERAL_MANAGER'].includes(role) ||
     ['dealer-website', 'website', 'dealer_website', 'dealer-os', 'dealeros_pro', 'dealeros_complete', 'complete-marketing-suite', 'marketsync-digital', 'sales-marketing-suite', 'service-marketing-suite', 'marketing-suite'].includes(req.profile?.package_id) ||
     req.profile?.dealerships?.is_personal === true ||
     req.profile?.dealerships?.products?.website === true ||
     req.profile?.dealerships?.products?.marketsync_website === true ||
     req.profile?.dealerships?.products?.dealer_website === true ||
     req.profile?.dealerships?.products?.dealer_os === true)
  ) {
    return { allowed: true, error: null }
  }

  // `user_roles` and `role_permissions` both reference `roles`, but do not
  // directly reference one another. Querying them as an embedded PostgREST
  // relationship therefore fails in Supabase's schema cache. Resolve through
  // role IDs explicitly, just as the access-context loader does.
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role_id')
    .eq('user_id', req.user?.id)
    .eq('dealership_id', dealershipId)
  if (roleError) return { allowed: false, error: roleError }

  const roleIds = (roleRows || []).map(row => row.role_id)
  if (roleIds.length === 0) return { allowed: false, error: null }

  const { data: grants, error } = await supabaseAdmin
    .from('role_permissions')
    .select('permission_id')
    .in('role_id', roleIds)
    .eq('permission_id', permission)
    .limit(1)
  return { allowed: !!grants?.length, error }
}

// Controller-level checks use this when the correct permission determines whether
// a caller can act on another team member's record (for example, CRM task routing).
// A lookup failure throws so callers fail closed instead of silently treating it as
// a valid denial or falling back to a legacy role check.
export async function hasPermission(req, permission) {
  const { allowed, error } = await permissionLookup(req, permission)
  if (error) throw error
  return allowed
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    const { allowed, error } = await permissionLookup(req, permission)
    if (error) return res.status(500).json({ error: 'Permission check failed' })
    if (!allowed) return res.status(403).json({ error: 'Insufficient permission' })
    next()
  }
}
