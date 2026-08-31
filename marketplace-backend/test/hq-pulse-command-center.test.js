// HQ Pulse — SaaS Command Center overview contract.
// Locks in the shape /saas/overview must return, and enforces rule #25:
// unavailable data becomes an explicit null (rendered as "Not connected"),
// never a fabricated zero.
//
// This suite reads the source file rather than booting the app so it stays
// runnable without SUPABASE_* env (same pattern as hq-owner-admin.test.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const src = () => readFile(new URL('../routes/saas-admin.js', import.meta.url), 'utf8')

test('/saas/overview exposes the command-center KPI fields', async () => {
  const s = await src()
  // Route still registered.
  assert.match(s, /app\.get\('\/saas\/overview'/)
  // New Slice 1 fields must appear in the response payload.
  for (const key of ['past_due', 'revenue_this_month', 'trials_expiring_5d', 'affiliate', 'health']) {
    assert.match(s, new RegExp('\\b' + key + '\\s*[:,]'), `overview payload missing "${key}"`)
  }
})

test('/saas/overview treats missing affiliate table as null, not fabricated zero', async () => {
  const s = await src()
  // Affiliate promise must swallow the failure to null so the UI can render
  // "Not connected". A silent `.catch(() => ({data: []}))` would be a fake zero.
  assert.match(s, /affiliate_commissions[\s\S]{0,400}data:\s*null/,
    'affiliate_commissions read must resolve to data:null on error')
  // And the response must set `affiliate = null` before any assignment when the
  // read did not succeed — the code initialises `let affiliate = null` up front.
  assert.match(s, /let\s+affiliate\s*=\s*null/,
    'affiliate must default to null so a missing table becomes "Not connected"')
})

test('/saas/overview derives platform health from observable HQ signals', async () => {
  const s = await src()
  assert.match(s, /health\s*=\s*\{\s*status:\s*pastDue\s*>\s*0\s*\?\s*'degraded'\s*:\s*'ok'/,
    'health.status must derive from past-due dealers, not a hard-coded value')
})

test('/saas/overview keeps permission gate (view_customers) — no HQ data leak', async () => {
  const s = await src()
  // The overview must remain behind the same gate as before. If this line is
  // removed, any authenticated user could read HQ-wide MRR / customer counts.
  assert.match(s,
    /app\.get\('\/saas\/overview',\s*requireAuth,[\s\S]{0,120}need\('view_customers'\)/,
    'view_customers permission gate must not be removed')
})

// ── Slice 2 endpoints: Affiliates, Product Usage, Platform Health ────────────
test('Slice 2+3 endpoints are registered and gated', async () => {
  const s = await src()
  const routes = ['/saas/affiliates', '/saas/product-usage', '/saas/platform-health', '/saas/billing-summary']
  for (const path of routes) {
    assert.match(s, new RegExp(`app\\.get\\('${path.replace(/\//g, '\\/')}'`),
      `route missing: ${path}`)
    assert.match(s, new RegExp(
      `app\\.get\\('${path.replace(/\//g, '\\/')}'[\\s\\S]{0,300}need\\('view_customers'\\)`),
      `${path} must gate on view_customers`)
  }
})

test('/saas/billing-summary marks stripe_connected=false when subscriptions unreadable', async () => {
  const s = await src()
  // Same rule as everywhere else: unreadable → "Not connected", never a fake 0.
  assert.match(s, /stripe_connected:\s*subs\s*!==\s*null/,
    'stripe_connected must be false when the subscriptions table cannot be read')
  assert.match(s, /subscriptions:\s*subs\s*===\s*null\s*\?\s*null/,
    'subscriptions field must be null (not empty counts) when unreadable')
})

// ── Slice 4: Trends, Expenses, Job-health signals ──────────────────────────
test('/saas/trends returns connected:false when hq_daily_snapshots is empty', async () => {
  const s = await src()
  assert.match(s, /app\.get\('\/saas\/trends'/, '/saas/trends must be registered')
  assert.match(s, /hq_daily_snapshots/, 'trends endpoint must read hq_daily_snapshots')
  assert.match(s, /!data\s*\|\|\s*data\.length\s*===\s*0[\s\S]{0,80}connected:\s*false/,
    'empty snapshot set must render as "not measured", never fake data points')
})

test('/cron/hq-snapshot is protected by the shared cron secret', async () => {
  const s = await src()
  assert.match(s, /app\.post\('\/cron\/hq-snapshot'/, 'hq-snapshot cron must be registered')
  // Same authenticator every /cron/* route already uses. Without the guard, the
  // cron endpoint would let any anonymous request write a snapshot row.
  assert.match(s, /\/cron\/hq-snapshot'[\s\S]{0,200}requestHasCronSecret\(req\)/,
    'hq-snapshot cron must check requestHasCronSecret before touching the DB')
})

test('HQ expense endpoints are registered and gate writes on manage_followups', async () => {
  const s = await src()
  for (const path of [
    /app\.get\('\/saas\/accounting\/expenses'/,
    /app\.post\('\/saas\/accounting\/expenses'/,
    /app\.patch\('\/saas\/accounting\/expenses\/:id'/,
    /app\.delete\('\/saas\/accounting\/expenses\/:id'/,
    /app\.patch\('\/saas\/accounting\/categories\/:key'/,
  ]) assert.match(s, path, `expense route missing: ${path}`)
  // All three write endpoints must gate on manage_followups so a viewer role
  // can read but cannot record, edit, or delete expenses.
  assert.match(s, /app\.post\('\/saas\/accounting\/expenses'[\s\S]{0,300}need\('manage_followups'\)/,
    'POST /saas/accounting/expenses must gate on manage_followups')
  assert.match(s, /app\.patch\('\/saas\/accounting\/expenses\/:id'[\s\S]{0,300}need\('manage_followups'\)/,
    'PATCH expense must gate on manage_followups')
  assert.match(s, /app\.delete\('\/saas\/accounting\/expenses\/:id'[\s\S]{0,300}need\('manage_followups'\)/,
    'DELETE expense must gate on manage_followups')
})

test('/saas/platform-health emits null (not 0) for job + webhook counts when tables are empty', async () => {
  const s = await src()
  assert.match(s, /failedJobs\s*=\s*null[\s\S]*jRes\.data\s*!==\s*null/,
    'failed_jobs_24h must be null until the hq_job_runs table has data')
  assert.match(s, /failedWebhooks\s*=\s*null[\s\S]*wRes\.data\s*!==\s*null/,
    'failed_webhooks_24h must be null until the hq_webhook_events table has data')
})

// ── Slice 5: Trials, health score, automation diagnostics, staff onboarding,
//    announcements, HQ Intelligence surface ─────────────────────────────────
test('/saas/customers/:id emits a health score with factors', async () => {
  const s = await src()
  assert.match(s, /const\s+healthScore\s*=/, 'health score must be computed on customer 360')
  assert.match(s, /factors:\s*\[/, 'health.factors array must accompany the score')
  // The formula must be the same one /saas/customers uses, or the number
  // shown on the drawer will disagree with the pipeline.
  for (const point of ['adoptionPoints', 'recencyPoints', 'billingPoints']) {
    assert.match(s, new RegExp('\\b' + point + '\\b'),
      `health formula missing "${point}" — customer 360 must reuse the pipeline formula`)
  }
})

test('/saas/trials returns explicit stages and honest conversion rate', async () => {
  const s = await src()
  assert.match(s, /app\.get\('\/saas\/trials'/, 'trials pipeline route must be registered')
  // Stages must not silently drop; missing an expected value would collapse
  // rows into a bucket that looked empty and healthy.
  for (const stage of ['new', 'onboarding', 'active', 'engaged', 'low_engagement', 'expiring', 'expired']) {
    assert.match(s, new RegExp(`'${stage}'`), `stage "${stage}" must be classified`)
  }
  // Conversion rate must fall to null when we can't compute — never a fake 0%.
  assert.match(s, /conversionRate\s*=\s*allNew30d\s*>\s*0\s*\?[\s\S]{0,80}:\s*null/,
    'conversion_rate_30d must be null when no accounts qualified')
})

test('/saas/automation/diagnostics gates on view_customers and reports runs_connected honestly', async () => {
  const s = await src()
  assert.match(s, /app\.get\('\/saas\/automation\/diagnostics'[\s\S]{0,200}need\('view_customers'\)/,
    'diagnostics must gate on view_customers')
  assert.match(s, /runs_connected:\s*runRows\s*!==\s*null/,
    'runs_connected must be false when the step-runs table is unreadable')
})

test('/saas/staff/onboarding is owner-only (both read + write)', async () => {
  const s = await src()
  for (const path of [/app\.get\('\/saas\/staff\/onboarding'/, /app\.patch\('\/saas\/staff\/:id\/onboarding'/]) {
    assert.match(s, path, `route missing: ${path}`)
  }
  // Both must go through the ownerOnly-style saasRoleOf check. A view_customers
  // gate would let any HQ staff view every teammate's checklist.
  const readMatch = s.match(/app\.get\('\/saas\/staff\/onboarding'[\s\S]{0,400}/)
  const writeMatch = s.match(/app\.patch\('\/saas\/staff\/:id\/onboarding'[\s\S]{0,400}/)
  assert.match(readMatch[0], /saasRoleOf\(req\)\s*!==\s*'owner'/,
    'staff onboarding read must be owner-only')
  assert.match(writeMatch[0], /saasRoleOf\(req\)\s*!==\s*'owner'/,
    'staff onboarding write must be owner-only')
})

test('/saas/announcements: read gated on view, write gated on manage_followups', async () => {
  const s = await src()
  assert.match(s, /app\.get\('\/saas\/announcements'[\s\S]{0,300}need\('view_customers'\)/,
    'GET /saas/announcements must gate on view_customers')
  assert.match(s, /app\.post\('\/saas\/announcements'[\s\S]{0,300}need\('manage_followups'\)/,
    'POST /saas/announcements must gate on manage_followups')
  assert.match(s, /app\.delete\('\/saas\/announcements\/:id'[\s\S]{0,300}need\('manage_followups'\)/,
    'DELETE /saas/announcements/:id must gate on manage_followups')
  // The audience whitelist must reject arbitrary values — otherwise a caller
  // could post a "staff" announcement while asking for customer audience.
  assert.match(s, /audience\s*=\s*b\.audience\s*===\s*'staff'\s*\?\s*'staff'\s*:\s*'customer'/,
    'audience must be forcibly normalised to staff|customer')
})

test('hq_announcements migration exists and restricts staff announcements to platform staff', async () => {
  const migSrc = await readFile(
    new URL('../../supabase/migrations/20260831181500_hq_announcements_and_onboarding.sql', import.meta.url),
    'utf8'
  )
  assert.match(migSrc, /create table if not exists public\.hq_announcements/)
  assert.match(migSrc, /alter table public\.hq_announcements enable row level security/)
  // The read policy must let customers see customer announcements but restrict
  // staff ones to platform_owner/platform_admin. Removing the audience check
  // would let any signed-in user read internal staff broadcasts.
  assert.match(migSrc, /audience\s*=\s*'customer'\s*or\s*exists[\s\S]{0,300}platform_owner['", ]+['", ]*platform_admin/,
    'hq_announcements SELECT policy must gate staff audience on platform role')
  assert.match(migSrc, /alter table public\.profiles[\s\S]{0,120}hq_onboarding jsonb/,
    'profiles.hq_onboarding jsonb column must be added')
})

test('HQ command-center migration exists with RLS and HQ-only policies', async () => {
  const migSrc = await readFile(
    new URL('../../supabase/migrations/20260831180000_hq_command_center_tables.sql', import.meta.url),
    'utf8'
  )
  for (const table of ['hq_daily_snapshots', 'hq_expense_categories', 'hq_vendor_expenses',
                       'hq_job_runs', 'hq_webhook_events']) {
    assert.match(migSrc, new RegExp(`create table if not exists public\\.${table}\\b`),
      `migration must create ${table}`)
    assert.match(migSrc, new RegExp(`alter table public\\.${table} enable row level security`),
      `RLS must be enabled on ${table}`)
  }
  // The policy loop must restrict SELECT to platform_owner/platform_admin. A
  // policy that used auth.role() = 'authenticated' would let any signed-in
  // dealer read HQ metrics.
  assert.match(migSrc, /system_role in \('platform_owner','platform_admin'\)/,
    'HQ tables must be readable only by platform_owner or platform_admin')
})

test('/saas/affiliates returns {connected:false} when the affiliates table is missing', async () => {
  const s = await src()
  // The endpoint must resolve to connected:false rather than empty arrays when
  // the affiliates table cannot be read — otherwise the UI would render "0
  // affiliates" as if the program were empty, which is a fabricated fact.
  assert.match(s, /if\s*\(!affRes\.data\)\s*return\s+res\.json\(\{\s*connected:\s*false/,
    'affiliates route must return connected:false on unreadable table')
})

test('/saas/product-usage returns {connected:false} when the events spine is unreadable', async () => {
  const s = await src()
  assert.match(s, /if\s*\(!evtRes\.data\)\s*return\s+res\.json\(\{\s*connected:\s*false/,
    'product-usage route must return connected:false on unreadable events')
})

test('/saas/platform-health leaves failed_integrations as null when the table is absent', async () => {
  const s = await src()
  // A null (rather than 0) makes the UI render "Not connected" for the
  // integrations signal, which is the honest state when we cannot read.
  // failedIntegrations is set to `null` up front and only overwritten with a
  // count when the read succeeded — so the response emits null for "unknown".
  assert.match(s, /failedIntegrations\s*=\s*integrationsConnected\s*\?[\s\S]*?:\s*null/,
    'failed_integrations must fall back to null when the table cannot be read')
})
