import { supabase, supabaseAdmin, isSaasStaff } from './shared.js'
import { SYSTEM_ROLES, hasSystemRole } from './authorization.js'
import { createClient } from '@supabase/supabase-js'
import { mfaStepUpSatisfied } from './mfa-assurance.js'
import { hasRecentPasskeyStepUp } from './passkeys.js'

// A Supabase client scoped to the CALLER'S JWT. Queries run as the `authenticated`
// Postgres role with auth.uid() set, so RLS (authz.has_permission(dealership_id, …))
// enforces tenant isolation AND permission on every row — defence in depth beyond the
// app-layer .eq('dealership_id', …) filters.
//
// Use req.supabase for ALL dealer-facing data access. Reserve supabaseAdmin (service
// role, which BYPASSES RLS) strictly for: Supabase Auth administration, platform
// administration, verified webhook processing, cron jobs / background workers, audit &
// security-event writes, and maintenance operations.
function requestScopedClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ── AUTH MIDDLEWARE ──
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'AUTH_EXPIRED — please sign in again' })

    // Do not embed `dealerships(*)` here. The schema has more than one
    // profiles↔dealerships relationship (for example, a dealership owner), so
    // PostgREST rejects the unqualified embed as ambiguous. That used to turn a
    // perfectly valid fresh login into `Profile not found` / 401.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) return res.status(401).json({ error: 'Profile not found' })
    if (profile.dealership_id) {
      const { data: dealership, error: dealershipError } = await supabaseAdmin
        .from('dealerships')
        .select('*')
        .eq('id', profile.dealership_id)
        .maybeSingle()
      if (dealershipError) {
        console.warn('[auth] dealership lookup failed:', dealershipError.message)
      }
      // Preserve the existing request shape for downstream billing and role code.
      profile.dealerships = dealership || null
    } else {
      profile.dealerships = null
    }
    // Retain deactivated team members for audit/history, but never allow their
    // existing or newly issued sessions to reach the application.
    if (profile.active === false) return res.status(403).json({ error: 'ACCOUNT_DEACTIVATED' })

    // MarketSync HQ staff (the saas_admin workspace) have no dealership and no
    // subscription of their own — they operate the platform. Skip the dealership
    // billing gate entirely for them.
    if (!req.path.startsWith('/billing') && !isSaasStaff(profile, user.email)) {
      const isPersonal = profile.dealerships?.is_personal === true
      const useProfileBilling = !profile.dealership_id || isPersonal
      const status = useProfileBilling
        ? profile.billing_status
        : profile.dealerships?.billing_status
      const trialEndsAt = useProfileBilling
        ? profile.trial_ends_at
        : profile.dealerships?.trial_ends_at

      let blocked = null
      if (status === 'TRIALING') {
        // Self-managed trial — no card required upfront. Block once it expires.
        if (!trialEndsAt || new Date(trialEndsAt) < new Date()) blocked = 'TRIAL_EXPIRED'
      } else if (status === 'INACTIVE' || status === 'PAST_DUE') {
        blocked = 'SUBSCRIPTION_REQUIRED'
      }

      // Group coverage: if this dealership belongs to a group that bills centrally
      // (billing_mode='group') and the group's billing is active, the dealer is
      // covered even without its own subscription. A group can also leave billing
      // per-dealer, in which case each store pays on its own (default).
      if (blocked && profile.dealership_id && profile.dealerships?.group_id) {
        const { data: grp } = await supabaseAdmin
          .from('dealer_groups')
          .select('billing_mode, billing_status')
          .eq('id', profile.dealerships.group_id)
          .maybeSingle()
        if (grp?.billing_mode === 'group' && (grp.billing_status === 'ACTIVE' || grp.billing_status === 'TRIALING')) {
          blocked = null
        }
      }

      if (blocked) return res.status(402).json({ error: blocked })
    }

    req.user = user
    req.profile = profile
    req.dealershipId = profile.dealership_id
    // RLS-enforcing client bound to this caller's token (see requestScopedClient).
    req.supabase = requestScopedClient(token)

    next()
  } catch (err) {
    return res.status(500).json({ error: 'Internal server authorization error' })
  }
}

// Re-check Supabase's authenticated assurance level for high-risk operations.
// A normal password/passkey/email-OTP session is aal1; a verified Supabase MFA
// factor (TOTP or phone) promotes that specific session to aal2.
//
export async function requireMfa(req, res, next) {
  // A recent biometric passkey step-up (Touch ID / Face ID / Windows Hello /
  // fingerprint), verified via /auth/passkey/stepup/*, satisfies the gate without
  // a TOTP code. Runs after requireAuth, so req.user is populated.
  if (hasRecentPasskeyStepUp(req.user?.id)) return next()
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })
  try {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    // Eased policy: only accounts that actually have MFA enrolled are asked to
    // step up. Users without a verified factor pass through instead of being
    // locked out of the whole app. (Still 503s, never bypasses, if the level
    // can't be verified — see the catch below.)
    if (!(await mfaStepUpSatisfied(client, token))) {
      return res.status(403).json({ error: 'MFA_REQUIRED', message: 'Complete multi-factor authentication to continue.' })
    }
    next()
  } catch {
    return res.status(503).json({ error: 'MFA verification temporarily unavailable.' })
  }
}
