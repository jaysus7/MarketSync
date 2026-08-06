import test from 'node:test'
import assert from 'node:assert/strict'
import { LEGACY_DEALER_ROLE_MAP, SYSTEM_ROLES, hasSystemRole, systemRoleForLegacyRole } from '../authorization-policy.js'

test('maps legacy dealer roles to their least-privilege RBAC role', () => {
  assert.equal(systemRoleForLegacyRole('OWNER'), 'dealer_owner')
  assert.equal(systemRoleForLegacyRole('SALES_REP'), 'salesperson')
  assert.equal(systemRoleForLegacyRole('ACCOUNTING'), 'accounting')
  assert.equal(LEGACY_DEALER_ROLE_MAP.FNI, 'fni_manager')
})

test('unknown legacy roles fall back to read only', () => {
  assert.equal(systemRoleForLegacyRole('SUPER_ADMIN'), 'read_only')
  assert.equal(systemRoleForLegacyRole(null), 'read_only')
})

test('system role checks only accept the assigned platform role', () => {
  const owner = { profile: { system_role: SYSTEM_ROLES.PLATFORM_OWNER } }
  const dealer = { profile: { system_role: SYSTEM_ROLES.DEALER_USER } }
  assert.equal(hasSystemRole(owner, SYSTEM_ROLES.PLATFORM_OWNER), true)
  assert.equal(hasSystemRole(dealer, SYSTEM_ROLES.PLATFORM_OWNER), false)
  assert.equal(hasSystemRole(null, SYSTEM_ROLES.PLATFORM_OWNER), false)
})
