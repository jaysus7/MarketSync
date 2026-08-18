import test from 'node:test'
import assert from 'node:assert/strict'
import { LEGACY_DEALER_ROLE_MAP, SYSTEM_ROLES, hasSystemRole, systemRoleForLegacyRole } from '../authorization-policy.js'
import { readFileSync } from 'node:fs'

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

test('permission lookup traverses RBAC through role IDs rather than a nonexistent direct relationship', () => {
  const source = readFileSync(new URL('../authorization.js', import.meta.url), 'utf8')
  assert.match(source, /\.from\('user_roles'\)[\s\S]*?\.select\('role_id'\)/)
  assert.match(source, /\.from\('role_permissions'\)[\s\S]*?\.in\('role_id', roleIds\)/)
  assert.doesNotMatch(source, /role_permissions!inner/)
})

test('a solo/independent rep on a personal dealership implicitly has all dealership permissions', () => {
  // A solo Facebook rep's "dealership" is a personal, one-person record with no
  // admin above them — provisioning still signs them up with a plain SALES_REP
  // profile role and the 'salesperson' RBAC role, which the DB only ever grants
  // inventory.view (never inventory.edit). Without this bypass they could never
  // sync their own feeds or manage their own inventory: Sync Now / Add Feed would
  // permanently 403 "Insufficient permission" for the one person who should have
  // full authority over their own store. Mirrors the frontend's isSolo check
  // (role === 'SALES_REP' && dealership.is_personal).
  const source = readFileSync(new URL('../authorization.js', import.meta.url), 'utf8')
  const fn = source.match(/async function permissionLookup\(req, permission\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'permissionLookup must exist')
  assert.match(fn, /role === 'SALES_REP' && req\.profile\?\.dealerships\?\.is_personal === true/)
})
