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

test('CRM integration configuration and delivery queue require MFA and integration authority', () => {
  const integration = source('routes/integration-engine.js')
  const guard = "requireAuth, requireMfa, requirePermission('integrations.manage')"
  for (const endpoint of [
    "app.get('/integration/config'",
    "app.put('/integration/config'",
    "app.get('/integration/deliveries'",
    "app.get('/integration/queue'",
    "app.post('/integration/queue/:id/ack'",
    "app.post('/integration/deliveries/:id/retry'",
  ]) {
    assert.ok(integration.includes(`${endpoint}, ${guard}`), `${endpoint} should use the integration security guard`)
  }
  assert.match(integration, /integration\.crm_configuration_updated/)
  assert.match(integration, /integration\.delivery_retried/)
})

test('dealer-wide configuration requires MFA and settings authority', () => {
  const config = source('routes/config-engine.js')
  const guard = "requireAuth, requireMfa, requirePermission('settings.manage')"
  for (const endpoint of ["app.get('/config'", "app.get('/config/:key'", "app.put('/config/:key'", "app.delete('/config/:key'"]) {
    assert.ok(config.includes(`${endpoint}, ${guard}`), `${endpoint} should use the configuration security guard`)
  }
  assert.match(source('migrations/2026-07-29-rbac-api-key-permission.sql'), /'settings\.manage'/)
})

test('inventory access relies on inventory permissions and site uploads use site authority', () => {
  const inventory = source('routes/inventory.js')
  assert.doesNotMatch(inventory, /canManageInventory|INV_MANAGERS/)
  for (const endpoint of ["app.get('/inventory'", "app.get('/inventory/all'", "app.get('/inventory/:id'", "app.get('/inventory/:id/carfax'"]) {
    assert.ok(inventory.includes(`${endpoint}, requireAuth, requirePermission('inventory.view')`), `${endpoint} should require inventory.view`)
  }
  for (const endpoint of ["app.post('/dealership/photo-background'", "app.delete('/dealership/photo-background'", "app.post('/dealership/site-image'"]) {
    assert.ok(inventory.includes(`${endpoint}, requireAuth, requireMfa, requirePermission('site.manage')`), `${endpoint} should require secure site authority`)
  }
})

test('lead routing and CRM delivery use RBAC rather than legacy dealer roles', () => {
  const leads = source('routes/leads.js')
  assert.match(leads, /app\.put\('\/leads\/:id\/assign', requireAuth, requirePermission\('lead\.assign'\)/)
  assert.match(leads, /app\.get\('\/leads\/response-metrics', requireAuth, requirePermission\('lead\.assign'\)/)
  assert.match(leads, /app\.post\('\/leads\/import', requireAuth, requirePermission\('lead\.create'\), requirePermission\('lead\.assign'\)/)
  for (const endpoint of ["app.get('/leads/crm-email'", "app.put('/leads/crm-email'", "app.post('/leads/:id/resend'"]) {
    assert.ok(leads.includes(`${endpoint}, requireAuth, requireMfa, requirePermission('integrations.manage')`), `${endpoint} should use the integration security guard`)
  }
})

test('salespeople cannot acknowledge another representative\'s lead', () => {
  const leads = source('routes/leads.js')
  assert.match(leads, /app\.post\('\/leads\/:id\/answered', requireAuth, requirePermission\('customer\.view'\)/)
  assert.match(leads, /hasPermission\(req, 'lead\.assign'\)/)
  assert.match(leads, /contact\?\.assigned_rep !== req\.user\.id/)
})

test('bulk AI outreach requires MFA and lead-assignment authority', () => {
  const bulk = source('routes/bulk.js')
  const guard = "requireAuth, requireMfa, requirePermission('lead.assign')"
  for (const endpoint of ["app.post('/ai/bulk/plan'", "app.post('/ai/bulk/execute'"]) {
    assert.ok(bulk.includes(`${endpoint}, ${guard}`), `${endpoint} should use the bulk-outreach security guard`)
  }
  assert.doesNotMatch(bulk, /const isMgr/)
  assert.match(bulk, /communications\.bulk_outreach_sent/)
})
