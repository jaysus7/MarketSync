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
