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

test('AI configuration and knowledge base management use MFA and settings authority', () => {
  const ai = source('routes/ai.js')
  const guard = "requireAuth, requireMfa, requirePermission('settings.manage')"
  for (const endpoint of ["app.get('/ai/config'", "app.put('/ai/config'", "app.post('/ai/knowledge-upload'"]) {
    assert.ok(ai.includes(`${endpoint}, ${guard}`), `${endpoint} should use the settings security guard`)
  }
  assert.doesNotMatch(ai, /requireDealerAdmin/)
  assert.match(ai, /source: 'knowledge_upload'/)
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

test('delivery workflow requires finalization authority and MFA for completion', () => {
  const delivery = source('routes/delivery.js')
  assert.match(delivery, /app\.get\('\/delivery\/queue', requireAuth, requirePermission\('deal\.finalize'\)/)
  assert.match(delivery, /app\.post\('\/delivery\/:id\/checklist', requireAuth, requirePermission\('deal\.finalize'\)/)
  assert.match(delivery, /app\.post\('\/delivery\/:id\/deliver', requireAuth, requireMfa, requirePermission\('deal\.finalize'\)/)
  assert.doesNotMatch(delivery, /const isMgr/)
  assert.match(delivery, /deal\.delivered/)
})

test('service configuration uses the service RBAC permission', () => {
  const service = source('routes/service.js')
  const guard = "requireAuth, requirePermission('service.write_repair_order')"
  for (const endpoint of ["app.get('/service/config'", "app.put('/service/config'"]) {
    assert.ok(service.includes(`${endpoint}, ${guard}`), `${endpoint} should use the service configuration guard`)
  }
  assert.doesNotMatch(service, /const isMgr/)
  assert.match(service, /service\.configuration_updated/)
})

test('notifications use RBAC for management alerts and protect targeted alerts', () => {
  const notifications = source('routes/notifications.js')
  assert.doesNotMatch(notifications, /const isMgr/)
  assert.match(notifications, /hasPermission\(req, 'lead\.assign'\)/)
  const ownerFilter = 'target_user_id.is.null,target_user_id.eq.${req.user.id}'
  assert.match(notifications, new RegExp("app\\.post\\('\\/notifications\\/:id\\/read'[\\s\\S]{0,700}" + ownerFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(notifications, new RegExp("app\\.delete\\('\\/notifications\\/:id'[\\s\\S]{0,700}" + ownerFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('dashboard paid-feature and staff controls require MFA and RBAC', () => {
  const dashboard = source('routes/dashboard.js')
  assert.match(dashboard, /app\.put\('\/dealership\/features', requireAuth, requireMfa, requirePermission\('billing\.manage'\)/)
  assert.match(dashboard, /app\.get\('\/dealership\/team\/:userId\/stats', requireAuth, requireMfa, requirePermission\('users\.manage'\)/)
  assert.match(dashboard, /billing\.feature_flags_updated/)
})

test('dashboard reports use their corresponding RBAC permissions', () => {
  const dashboard = source('routes/dashboard.js')
  assert.match(dashboard, /app\.get\('\/dashboard\/inventory-mix', requireAuth, requirePermission\('inventory\.edit'\)/)
  assert.match(dashboard, /app\.get\('\/dashboard\/sales-analysis', requireAuth, requirePermission\('inventory\.edit'\)/)
  assert.match(dashboard, /app\.get\('\/dashboard\/sales-snapshot', requireAuth, requirePermission\('lead\.assign'\)/)
  assert.match(dashboard, /app\.get\('\/reports\/sold-deals', requireAuth, requireMfa, requirePermission\('customer\.export'\)/)
})

test('deal desk separates creation from approval and finalization authority', () => {
  const dashboard = source('routes/dashboard.js')
  assert.match(dashboard, /app\.get\('\/reports\/deal', requireAuth, requireMfa, requirePermission\('deal\.approve'\)/)
  assert.match(dashboard, /app\.post\('\/reports\/deal', requireAuth, requirePermission\('deal\.create'\)/)
  assert.match(dashboard, /app\.post\('\/reports\/deal\/status', requireAuth, requireMfa, requirePermission\('deal\.finalize'\)/)
  for (const endpoint of ["app.get('/deals/customers'", "app.get('/deals/customer'", "app.get('/deals/trades'", "app.get('/deals/vehicles'"]) {
    assert.ok(dashboard.includes(`${endpoint}, requireAuth, requirePermission('deal.create')`), `${endpoint} should require deal.create`)
  }
})

test('label-only staff administration requires MFA and user-management authority', () => {
  const dashboard = source('routes/dashboard.js')
  const guard = "requireAuth, requireMfa, requirePermission('users.manage')"
  for (const endpoint of ["app.post('/team/staff'", "app.delete('/team/staff/:id'"]) {
    assert.ok(dashboard.includes(`${endpoint}, ${guard}`), `${endpoint} should require the team-administration guard`)
  }
  assert.match(dashboard, /team\.staff_created/)
  assert.match(dashboard, /team\.staff_updated/)
})

test('accounting engine requires MFA and accounting permissions', () => {
  const accounting = source('routes/accounting-engine.js')
  const readGuard = "requireAuth, requireMfa, requirePermission('accounting.view')"
  for (const endpoint of ["app.get('/accounting/journal'", "app.get('/accounting/event-log'", "app.get('/accounting/trial-balance'", "app.get('/accounting/summary'", "app.get('/accounting/income-statement'", "app.get('/accounting/balance-sheet'", "app.get('/accounting/periods'", "app.get('/accounting/forecast'"]) {
    assert.ok(accounting.includes(`${endpoint}, ${readGuard}`), `${endpoint} should use the accounting read guard`)
  }
  const writeGuard = "requireAuth, requireMfa, requirePermission('accounting.edit')"
  for (const endpoint of ["app.post('/accounting/replay/:eventId'", "app.post('/accounting/periods/advance'"]) {
    assert.ok(accounting.includes(`${endpoint}, ${writeGuard}`), `${endpoint} should use the accounting write guard`)
  }
  assert.match(accounting, /accounting\.period_advanced/)
})

test('equity data and outreach require MFA and dedicated RBAC permissions', () => {
  const equity = source('routes/equity.js')
  assert.doesNotMatch(equity, /const isMgr/)
  const viewGuard = "requireAuth, requireMfa, requirePermission('equity.view')"
  for (const endpoint of ["app.get('/equity/leases'", "app.get('/equity/lease/by-contact/:contactId'", "app.get('/equity/worksheet/:id'", "app.get('/equity/radar'"]) {
    assert.ok(equity.includes(`${endpoint}, ${viewGuard}`), `${endpoint} should require equity.view`)
  }
  const manageGuard = "requireAuth, requireMfa, requirePermission('equity.manage')"
  for (const endpoint of ["app.put('/equity/lease/:id'", "app.post('/equity/pull-ahead/:id'"]) {
    assert.ok(equity.includes(`${endpoint}, ${manageGuard}`), `${endpoint} should require equity.manage`)
  }
  const sql = source('migrations/2026-07-29-rbac-api-key-permission.sql')
  assert.match(sql, /'equity\.view'/)
  assert.match(sql, /'equity\.manage'/)
})

test('sensitive AI financial and history routes require MFA and RBAC', () => {
  const ai = source('routes/ai.js')
  assert.match(ai, /app\.post\('\/accounting\/scan-receipt', requireAuth, requireMfa, requirePermission\('accounting\.edit'\)/)
  assert.match(ai, /app\.get\('\/ai\/assistant\/history', requireAuth, requireMfa, requirePermission\('lead\.assign'\)/)
})

test('appraisal visibility and inventory acquisition use RBAC', () => {
  const ai = source('routes/ai.js')
  assert.match(ai, /app\.put\('\/ai\/rep-appraisal-visibility', requireAuth, requireMfa, requirePermission\('users\.manage'\)/)
  for (const endpoint of ["app.post('/ai/appraisals/:id/acquire'", "app.post('/ai/appraisals/:id/take-possession'"]) {
    assert.ok(ai.includes(`${endpoint}, requireAuth, requirePermission('inventory.edit')`), `${endpoint} should require inventory.edit`)
  }
  assert.match(ai, /data\.created_by !== req\.user\.id/)
})

test('AI assistant uses lead-assignment authority for manager-only access and actions', () => {
  const ai = source('routes/ai.js')
  assert.match(ai, /const canManageLeads = await hasPermission\(req, 'lead\.assign'\)/)
  assert.doesNotMatch(ai, /isMgrRoleGate/)
  assert.match(ai, /app\.post\('\/ai\/assistant\/action', requireAuth, requireMfa, requirePermission\('lead\.create'\)/)
  assert.match(ai, /const isMgr = await hasPermission\(req, 'lead\.assign'\)/)
  assert.match(ai, /assistant\.appointment_booked/)
  assert.match(ai, /lead\.reassigned/)
})

test('dashboard management scope relies on lead-assignment permission', () => {
  const dashboard = source('routes/dashboard.js')
  assert.match(dashboard, /app\.get\('\/dealership\/charts', requireAuth, requirePermission\('lead\.assign'\)/)
  assert.equal(dashboard.split("hasPermission(req, 'lead.assign')").length - 1 >= 2, true)
})

test('team administration uses MFA and users.manage instead of legacy manager labels', () => {
  const profile = source('routes/profile.js')
  const guard = "requireAuth, requireMfa, requirePermission('users.manage')"
  for (const endpoint of [
    "app.get('/dealership/team'", "app.post('/admin/users/invite'",
    "app.post('/admin/users/:id/role'", "app.put('/admin/users/:id/profile'",
    "app.put('/admin/users/:id/password'", "app.put('/admin/users/:id/team'",
    "app.delete('/admin/users/:id'",
  ]) {
    assert.ok(profile.includes(`${endpoint}, ${guard}`), `${endpoint} should require MFA and user-management authority`)
  }
  assert.doesNotMatch(profile, /Math\.random\(\).*auto temp/)
  assert.match(profile, /randomBytes\(18\)\.toString\('base64url'\)/)
})

test('personal profile updates cannot alter dealership identity without settings authority', () => {
  const profile = source('routes/profile.js')
  assert.match(profile, /await hasPermission\(req, 'settings\.manage'\)/)
  assert.match(profile, /Insufficient permission to update dealership settings/)
  assert.match(profile, /AuditAction\.CONFIG_UPDATED/)
})
