import { supabaseAdmin } from './shared.js'

export const SYSTEM_ROLES = Object.freeze({
  PLATFORM_OWNER: 'platform_owner',
  PLATFORM_ADMIN: 'platform_admin',
  DEALER_USER: 'dealer_user',
})

export const LEGACY_DEALER_ROLE_MAP = Object.freeze({
  OWNER: 'dealer_owner', DEALER_ADMIN: 'dealer_owner', DEALER_GROUP: 'dealer_group_owner',
  MANAGER: 'general_manager', SALES_REP: 'salesperson', BDC: 'bdc',
  FNI: 'fni_manager', SERVICE: 'service_manager', ACCOUNTING: 'accounting',
})

export async function syncDealerRole(userId, dealershipId, legacyRole, assignedBy = null) {
  const roleId = LEGACY_DEALER_ROLE_MAP[legacyRole] || 'read_only'
  await supabaseAdmin.from('user_roles').delete().eq('user_id', userId).eq('dealership_id', dealershipId)
  const { error } = await supabaseAdmin.from('user_roles').insert({ user_id: userId, dealership_id: dealershipId, role_id: roleId, assigned_by: assignedBy })
  if (error) throw error
}

export function hasSystemRole(req, ...roles) {
  return roles.includes(req?.profile?.system_role)
}

export function requireSystemRole(...roles) {
  return (req, res, next) => {
    if (!hasSystemRole(req, ...roles)) return res.status(403).json({ error: 'Platform access required' })
    next()
  }
}

// Resolves a permission at the platform scope or within the caller's dealership.
// It deliberately uses the server-only client: browser clients never read RBAC rows.
export function requirePermission(permission) {
  return async (req, res, next) => {
    if (hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER)) return next()
    const dealershipId = req.dealershipId
    if (!dealershipId) return res.status(403).json({ error: 'Dealership context required' })
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('role_permissions!inner(permission_id)')
      .eq('user_id', req.user.id)
      .eq('dealership_id', dealershipId)
      .eq('role_permissions.permission_id', permission)
      .limit(1)
    if (error) return res.status(500).json({ error: 'Permission check failed' })
    if (!data?.length) return res.status(403).json({ error: 'Insufficient permission' })
    next()
  }
}
