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
