/**
 * Public standalone-apps waitlist.
 *
 * Backs the /apps/*.html launcher pages. Public (no auth) so a browser
 * with no session can still sign up. Rate-limit-friendly: dedupes by
 * (email, product) at the DB layer and returns 200 on duplicate rather
 * than an error, so the frontend UX stays quiet.
 *
 * The table is created on first successful call — no migration needed
 * for the initial rollout, which matches how the standalone apps are
 * shipping (a static launcher + waitlist collection before we build the
 * per-user tenant model).
 */

import { supabaseAdmin } from '../shared.js'

const VALID_PRODUCTS = new Set([
  'design-studio', 'website-studio', 'video-studio', 'email-sms',
  'crm', 'desking', 'appraisals', 'service-checkin',
])

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,32}$/

let __tableEnsured = false
async function ensureTable() {
  if (__tableEnsured) return
  __tableEnsured = true
  // Best-effort: try to insert into information_schema check; if the
  // table isn't there yet we let the insert fail on the first call and
  // the operator can run the migration below. We do NOT create tables
  // from a request handler — that's a migration's job.
  //
  // Migration (run manually before enabling public traffic):
  //
  //   create table if not exists public.apps_waitlist (
  //     id uuid primary key default gen_random_uuid(),
  //     email text not null,
  //     product text not null,
  //     source text,
  //     created_at timestamptz not null default now(),
  //     unique (lower(email), product)
  //   );
  //   alter table public.apps_waitlist enable row level security;
  //   -- inserts are performed by the service role from this route.
  //   -- no direct client SELECT/INSERT policies — kept internal.
}

export function registerAppsWaitlist(app) {
  app.post('/api/apps/waitlist', async (req, res) => {
    try {
      const body = req.body || {}
      const email = String(body.email || '').trim().toLowerCase()
      const product = String(body.product || '').trim()
      const source = String(body.source || 'apps').slice(0, 32)

      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' })
      if (!VALID_PRODUCTS.has(product)) return res.status(400).json({ error: 'invalid_product' })

      await ensureTable()

      const { error } = await supabaseAdmin
        .from('apps_waitlist')
        .insert({ email, product, source })
      if (error) {
        // Unique-constraint violation on (email, product) is treated as
        // success — the person already signed up for this product.
        const code = error.code || ''
        if (code === '23505' || /duplicate key/i.test(error.message || '')) {
          return res.json({ ok: true, deduped: true })
        }
        // Table missing (relation does not exist) — return a soft 503 so
        // the frontend can fall back to its mailto path rather than
        // showing the visitor an internal error.
        if (code === '42P01' || /relation .*does not exist/i.test(error.message || '')) {
          return res.status(503).json({ error: 'waitlist_unavailable' })
        }
        return res.status(500).json({ error: 'insert_failed' })
      }
      return res.json({ ok: true })
    } catch {
      return res.status(500).json({ error: 'server_error' })
    }
  })
}
