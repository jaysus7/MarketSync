import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const dashboard = read('../marketplace-frontend/dashboard.js')
const part2 = read('../marketplace-frontend/js/modules/dashboard-part2.js')
const part10 = read('../marketplace-frontend/js/modules/dashboard-part10.js')
const part11 = read('../marketplace-frontend/js/modules/dashboard-part11.js')
const profile = read('routes/profile.js')
const admin = read('routes/saas-admin.js')
const sequences = read('routes/saas-sequences.js')
const seed = read('scripts/seed-jms.js')
const migration = read('migrations/2026-08-25-marketsync-internal-owner-comms.sql')

test('sales@marketsync.link is provisioned as an explicit platform owner', () => {
  assert.match(migration, /lower\(u\.email\) = 'sales@marketsync\.link'/)
  assert.match(migration, /system_role = 'platform_owner'/)
  assert.match(migration, /saas_role = 'owner'/)
  assert.match(seed, /system_role: 'platform_owner'/)
  assert.match(seed, /saas_role: 'owner'/)
  assert.doesNotMatch(seed, /MarketSync!Demo2026/)
  assert.match(seed, /SEED_JMS_PASSWORD is required/)
})

test('internal workspace routing is server-authored and never inferred from a dealership name', () => {
  assert.match(profile, /workspace = 'saas_admin'/)
  assert.match(dashboard, /profileContext\?\.workspace === 'saas_admin'/)
  assert.match(dashboard, /function initDashModeForOwner\(\)[\s\S]*profileContext\?\.workspace === 'saas_admin'/)
  assert.doesNotMatch(dashboard.match(/function initDashModeForOwner\(\)[\s\S]*?\n\}/)?.[0] || '', /JMS Automotive|dealership\?\.name/)
})

test('MarketSync Internal has one focused operating navigation', () => {
  // The HQ information architecture was frozen (see the comment above SAAS_DEPARTMENTS):
  // HOME · CUSTOMERS · REVENUE · FINANCE · PEOPLE · MARKETING · AI WORKFORCE · PLATFORM ·
  // SETTINGS. Route slugs were deliberately preserved so backend contracts did not move —
  // only the grouping and labels changed — so the destinations are still what is asserted.
  const hq = part2.match(/const SAAS_DEPARTMENTS = \{[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(hq, 'the HQ department registry must exist')
  for (const label of ['Home', 'Customers', 'Revenue', 'Finance', 'People',
                       'Marketing', 'AI Workforce', 'Platform', 'Settings']) {
    assert.match(hq, new RegExp(`label: '${label}'`), `HQ nav must carry the ${label} group`)
  }
  assert.match(hq, /marketing:[\s\S]*?saas-automation/)
  assert.match(hq, /people:[\s\S]*?saas-employees/)
  // "HQ must have no dead navigation" — the static placeholder pages stay unlisted.
  for (const dead of ['saas-products', 'saas-roles', 'saas-flags', 'saas-all-users']) {
    assert.ok(!new RegExp(`page: '${dead}'`).test(hq), `${dead} is a placeholder and must not be navigable`)
  }
})

test('People directory exposes editable contact, department, status and role data to the owner', () => {
  assert.match(admin, /app\.get\('\/saas\/employees'/)
  assert.match(admin, /app\.patch\('\/saas\/employees\/:id'/)
  for (const field of ['full_name', 'phone', 'business_email', 'department', 'active', 'saas_role', 'system_role']) {
    assert.ok(admin.includes(field), `missing ${field}`)
  }
  assert.match(part11, /title: 'People'/)
  assert.match(part11, /saasEditPerson/)
  assert.match(part11, /saasSavePerson/)
})

test('internal communications supports real email, SMS, templates, campaigns and delivery evidence', () => {
  assert.match(migration, /channel in \('email', 'sms'\)/)
  assert.match(migration, /type in \('email', 'sms', 'task'\)/)
  assert.match(migration, /create table if not exists public\.saas_message_deliveries/)
  assert.match(sequences, /sendDealerSms/)
  assert.match(sequences, /sms_consent_at/)
  assert.match(sequences, /recordDelivery/)
  assert.match(sequences, /skipped_count/)
  assert.match(part10, /Email, SMS &amp; Automations/)
  assert.match(part10, /option value="sms"/)
  assert.match(part10, /automationTemplateChannelToggle/)
  assert.match(part10, /automationCampaignChannelToggle/)
})

