// Pure RBAC policy rules shared by request middleware and automated tests.

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

export function systemRoleForLegacyRole(legacyRole) {
  return LEGACY_DEALER_ROLE_MAP[legacyRole] || 'read_only'
}

export function hasSystemRole(req, ...roles) {
  return roles.includes(req?.profile?.system_role)
}
