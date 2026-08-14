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
