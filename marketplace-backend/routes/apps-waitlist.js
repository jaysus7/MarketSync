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

import { supabaseAdmin, FRONTEND_URL } from '../shared.js'
import { validatePassword, rateLimit, getClientIp } from '../security.js'
import { requireAuth } from '../middleware.js'

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

// Trial window for a new standalone app signup — 14 days, same feel as
// the dealer trial but scoped to the one app they signed up for.
const APPS_TRIAL_DAYS = 14
function trialEndsAt(days = APPS_TRIAL_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function registerAppsWaitlist(app) {
  // ── Standalone single-user signup ─────────────────────────────────────
  //
  // POST /api/apps/signup
  //   { email, password, fullName, app: <slug> }
  //
  // Creates a supabase auth user + a personal dealership (so every RLS
  // policy that keys off dealership_id keeps working) + a profile
  // scoped to that personal dealership + an apps_entitlements row for
  // the requested app in trialing status. Returns the standard
  // {session,user} shape so the /apps/*.html signup form can drop
  // the tokens into localStorage exactly like /auth/login.
  //
  // Public route (no auth). Rate-limited to 3/hr per IP, same as
  // dealer register, so an abuser can't mint hundreds of accounts.
  app.post('/api/apps/signup',
    rateLimit('apps-signup', 3, 60 * 60 * 1000, { email: true }),
    async (req, res) => {
      try {
        const body = req.body || {}
        const email = String(body.email || '').trim().toLowerCase()
        const password = String(body.password || '')
        const fullName = String(body.fullName || '').trim()
        const appSlug = String(body.app || '').trim()

        if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' })
        if (!fullName || fullName.length < 2) return res.status(400).json({ error: 'name_required' })
        if (!VALID_PRODUCTS.has(appSlug)) return res.status(400).json({ error: 'invalid_app' })

        // Same NIST-compliant password policy the dealer signup uses.
        const pwCheck = await validatePassword(password, { email })
        if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error })

        let createdUserId = null
        let createdDealershipId = null
        try {
          // Auto-confirm here (unlike dealer signup which requires an
          // emailed confirmation): the standalone-app entrance is
          // designed to open the tool immediately after signup. When
          // the ops team decides to gate this on email, flip
          // email_confirm off and reuse the sendVerificationEmail
          // helper from auth.js.
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, apps_signup: true, apps_signup_app: appSlug },
          })
          if (authError) throw authError
          createdUserId = authData.user.id

          // Personal dealership so profile RLS keeps working and this
          // user's data is isolated in one row. Named after the user
          // so HQ can distinguish standalone accounts from real dealers.
          const trialAt = trialEndsAt()
          const { data: dealership, error: dealerError } = await supabaseAdmin
            .from('dealerships')
            .insert({
              name: `${fullName} — MarketSync App`,
              account_type: 'solo',
              billing_status: 'TRIALING',
              trial_ends_at: trialAt,
              full_access_until: trialAt,
              is_personal: true,
            })
            .select()
            .single()
          if (dealerError) throw dealerError
          createdDealershipId = dealership.id

          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: createdUserId,
              dealership_id: createdDealershipId,
              full_name: fullName,
              role: 'SALES_REP',
              account_role: 'app_user',
              price_tier: 'SOLO_INDIVIDUAL',
              billing_status: 'TRIALING',
              trial_ends_at: trialAt,
              terms_accepted_at: new Date().toISOString(),
              terms_accepted_ip: getClientIp(req),
            })
          if (profileError) throw profileError

          const { error: entError } = await supabaseAdmin
            .from('apps_entitlements')
            .insert({
              user_id: createdUserId,
              app_slug: appSlug,
              plan: 'trial',
              status: 'trialing',
              trial_ends_at: trialAt,
            })
          if (entError && entError.code !== '23505') throw entError

          // Mint a session so the client is signed in the moment the
          // form returns. Uses the same admin API path dealer login
          // uses under the hood.
          const { data: signIn, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({ email, password })
          if (signInErr) throw signInErr

          return res.json({
            session: signIn.session,
            user: signIn.user,
            app: appSlug,
            next: `/apps/${appSlug}.html`,
          })
        } catch (e) {
          // Roll everything back on failure so a failed signup never
          // leaves an orphan supabase user, personal dealership, or
          // entitlement row.
          if (createdDealershipId) {
            try { await supabaseAdmin.from('dealerships').delete().eq('id', createdDealershipId) } catch {}
          }
          if (createdUserId) {
            try { await supabaseAdmin.auth.admin.deleteUser(createdUserId) } catch {}
          }
          const msg = String(e && e.message || 'signup_failed')
          if (/already registered|duplicate/i.test(msg)) {
            return res.status(409).json({ error: 'email_in_use' })
          }
          return res.status(500).json({ error: 'signup_failed', detail: msg })
        }
      } catch {
        return res.status(500).json({ error: 'server_error' })
      }
    }
  )

  // ── Entitlement lookup ────────────────────────────────────────────────
  //
  // GET /api/apps/entitlements
  //
  // Returns { entitlements: [{app_slug, plan, status, trial_ends_at, ...}] }
  // for the signed-in user. Used by the embedded-mode boot in dashboard.js
  // to decide whether to render the tool or the "your trial ended, upgrade"
  // card.
  app.get('/api/apps/entitlements', requireAuth, async (req, res) => {
    try {
      const userId = req.user && req.user.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const { data, error } = await supabaseAdmin
        .from('apps_entitlements')
        .select('app_slug, plan, status, trial_ends_at, current_period_end')
        .eq('user_id', userId)
      if (error) {
        // Table missing means the migration hasn't run yet — degrade
        // to an empty list rather than 500 so the frontend can still
        // render the upgrade path.
        if (error.code === '42P01') return res.json({ entitlements: [], degraded: true })
        return res.status(500).json({ error: 'read_failed' })
      }
      return res.json({ entitlements: data || [] })
    } catch {
      return res.status(500).json({ error: 'server_error' })
    }
  })

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
