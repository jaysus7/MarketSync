import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('sensitive financial and customer-data routes require MFA plus a permission', () => {
  const checks = [
    ['routes/credit.js', "requireAuth, requireMfa, requirePermission('credit_application.manage')"],
    ['routes/commissions.js', "requireAuth, requireMfa, requirePermission('accounting.edit')"],
    ['routes/expenses.js', "requireAuth, requireMfa, requirePermission('accounting.edit')"],
    ['routes/reports.js', "requireAuth, requireMfa, requirePermission('accounting.view')"],
    ['routes/deposits.js', "requireAuth, requireMfa, requirePermission('integrations.manage')"],
    ['routes/plaid.js', "requireAuth, requireMfa, requirePermission('accounting.view')"],
    ['routes/square.js', "requireAuth, requireMfa, requirePermission('integrations.manage')"],
    ['routes/public-api.js', "requireAuth, requireMfa, requirePermission('api_keys.manage')"],
  ]
  for (const [path, guard] of checks) assert.match(source(path), new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('follow-up automation management requires MFA and lead assignment authority', () => {
  const automation = source('routes/automation.js')
  assert.match(automation, /app\.put\('\/automation\/campaigns\/:id', requireAuth, requireMfa, requirePermission\('lead\.assign'\)/)
  assert.match(automation, /app\.put\('\/automation\/settings', requireAuth, requireMfa, requirePermission\('lead\.assign'\)/)
  assert.match(automation, /app\.post\('\/automation\/event', requireAuth, requireMfa, requirePermission\('lead\.assign'\)/)
})

test('integration management permission is seeded for dealer owners and general managers', () => {
  const sql = source('migrations/2026-07-29-rbac-api-key-permission.sql')
  assert.match(sql, /'integrations\.manage'/)
  assert.match(sql, /'dealer_group_owner','dealer_owner','general_manager'/)
})
