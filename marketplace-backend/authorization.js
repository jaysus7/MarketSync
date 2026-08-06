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
  const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('role_permissions!inner(permission_id)')
      .eq('user_id', req.user?.id)
      .eq('dealership_id', dealershipId)
      .eq('role_permissions.permission_id', permission)
      .limit(1)
  return { allowed: !!data?.length, error }
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
