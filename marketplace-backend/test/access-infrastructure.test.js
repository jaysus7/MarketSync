import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { backendRouteSource, frontendDashboardSource } from './helpers/split-source.js'

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('service role can read every table used to resolve entitlements', () => {
  const sql = source('migrations/2026-08-04-entitlement-service-role-grants.sql')
  for (const table of [
    'products', 'features', 'plans', 'plan_products', 'plan_features',
    'subscriptions', 'product_memberships', 'member_permission_overrides',
  ]) assert.match(sql, new RegExp(`public\\.${table}`))
  assert.match(sql, /to service_role/i)
  const statements = sql.replace(/^--.*$/gm, '')
  assert.doesNotMatch(statements, /to\s+(anon|authenticated)/i)
})

test('access service fails visibly when entitlement reads are denied', () => {
  const js = source('access.js')
  assert.match(js, /entitlement catalog unavailable/)
  assert.match(js, /caller entitlement rows unavailable/)
  assert.match(js, /trial_ends_at/)
})

test('MFA enrollment returns and stores the promoted aal2 session', () => {
  const auth = backendRouteSource('auth')
  const dashboard = frontendDashboardSource()
  assert.match(auth, /access_token: verifiedSession\?\.access_token/)
  assert.match(auth, /refresh_token: verifiedSession\?\.refresh_token/)
  assert.match(dashboard, /token = data\.access_token/)
  assert.match(dashboard, /localStorage\.setItem\('refresh_token', data\.refresh_token\)/)
})
