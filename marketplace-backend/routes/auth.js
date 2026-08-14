import { createClient } from '@supabase/supabase-js'
import { randomBytes, createHash } from 'crypto'
import { supabase, supabaseAdmin, resend, EMAIL_FROM, FRONTEND_URL } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { validatePassword, rateLimit, getClientIp, generateRecoveryCodes, hashRecoveryCode } from '../security.js'
import { maybeAlertSuspiciousLogin } from '../securityAlerts.js'
import { audit, AuditAction } from '../audit.js'
import { recordReferralSignup } from './affiliate.js'
import { syncDealerRole } from '../authorization.js'
import { ACCOUNT_TYPES, provisionPlan } from '../entitlements.js'
import { getPlan } from '../plan-catalog.js'
import { createMfaLoginChallenge, consumeMfaLoginChallenge, getMfaLoginChallenge } from '../mfa-login-challenges.js'
import { ensureStaffMember } from './people-identity.js'
import {
  beginPasskeyRegistration, finishPasskeyRegistration,
  beginPasskeyLogin, finishPasskeyLogin,
  listUserPasskeys, deletePasskey
} from '../passkeys.js'

function maskPhone(phone) {
  const value = String(phone || '')
  if (value.length < 5) return 'your phone'
  return `${value.slice(0, 2)}••• ••• ${value.slice(-4)}`
}

async function replaceMfaRecoveryCodes(userId) {
  const codes = generateRecoveryCodes(10)
  const rows = codes.map(code => ({ user_id: userId, code_hash: hashRecoveryCode(code) }))
  await supabaseAdmin.from('recovery_codes').delete().eq('user_id', userId)
  const { error } = await supabaseAdmin.from('recovery_codes').insert(rows)
  if (error) throw error
  return codes
}

// ──────────────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES — plain language, branded, with a clear call to action
// ──────────────────────────────────────────────────────────────────────────────

function buildResetEmailHtml({ resetUrl, ip }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:32px 32px 16px 32px;">
          <div style="font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">
            Market<span style="color:#6366f1;">Sync</span>
          </div>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px 0;">Reset your password</h1>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px 0;">
            We got a request to reset your MarketSync password. Click the button below to choose a new one. This link works once and expires in 15 minutes.
          </p>
          <p style="margin:0 0 32px 0;">
            <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Reset Password</a>
          </p>
          <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 8px 0;">
            Or paste this link into your browser:
          </p>
          <p style="font-size:12px;color:#475569;word-break:break-all;background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;margin:0 0 24px 0;font-family:ui-monospace,SFMono-Regular,monospace;">
            ${resetUrl}
          </p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 8px 0;">
            <strong>Didn't request this?</strong> Ignore this email — your password won't change unless you click the button above. The request came from IP ${ip || 'unknown'}.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;text-align:center;">
            MarketSync · Auto-post dealership inventory to Facebook Marketplace<br>
            <a href="https://marketsync.link/" style="color:#94a3b8;">marketsync.link</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function buildResetEmailText({ resetUrl, ip }) {
  return `Reset your MarketSync password

We got a request to reset your password. Open this link to choose a new one:

${resetUrl}

This link works once and expires in 15 minutes.

Didn't request this? Ignore this email — your password won't change unless you click the link. Request came from IP ${ip || 'unknown'}.

—
MarketSync
https://marketsync.link/`
}

// Deliver the account-verification email ourselves via Resend. Supabase's
// admin.createUser() sends nothing, and its built-in SMTP is rate-limited and
// unreliable — so we mint the link with generateLink and email it on-brand here.
async function sendVerificationEmail({ email, actionLink, name }) {
  if (!resend || !actionLink) return false
  const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const first = name ? esc(String(name).split(/\s+/)[0]) : 'there'
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: 'Confirm your MarketSync account',
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px 4px;color:#0f172a">
        <h2 style="font-size:20px;margin:0 0 12px">Welcome to MarketSync, ${first}!</h2>
        <p style="color:#334155;line-height:1.6;margin:0 0 18px">Confirm your email to activate your account and start your 30-day free trial.</p>
        <p style="margin:0 0 20px"><a href="${actionLink}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none">Verify my email →</a></p>
        <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0">Or paste this link into your browser:<br><a href="${actionLink}" style="color:#4f46e5;word-break:break-all">${actionLink}</a></p>
      </div>`,
    })
    return true
  } catch (e) { console.warn('[auth] verification email send failed:', e.message); return false }
}

import { registerAuthMfaPasskeyRoutes } from './submodules/auth-mfa-passkeys.js'


// ── Issuing a password reset ─────────────────────────────────────────────────
// Extracted so HR's admin-triggered reset (routes/people-dossier.js) uses the SAME
// one-shot hashed-token flow rather than a second reset path. A duplicate would be a
// second place to get token expiry, hashing or single-use wrong.
//
// Returns { sent, reason } — never throws, and never sets a password. The raw token is
// emailed and only its SHA-256 hash is stored, so a full database dump cannot be used
// to reset anybody.
export async function issuePasswordReset({ userId, email, req }) {
  if (!userId || !email) return { sent: false, reason: 'no login on file' }
  if (!resend) return { sent: false, reason: 'email is not configured on this deployment' }
  const normEmail = String(email).toLowerCase().trim()
  try {
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const ip = req ? getClientIp(req) : null

    const { error: insErr } = await supabaseAdmin.from('password_reset_tokens').insert({
      user_id: userId, email: normEmail, token_hash: tokenHash, expires_at: expiresAt, requested_ip: ip,
    })
    if (insErr) return { sent: false, reason: 'the reset token could not be stored' }

    const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${rawToken}`
    const { error: sendErr } = await resend.emails.send({
      from: EMAIL_FROM, to: normEmail, subject: 'Reset your MarketSync password',
      html: buildResetEmailHtml({ resetUrl, ip }), text: buildResetEmailText({ resetUrl, ip }),
      headers: {
        'List-Unsubscribe': `<mailto:unsubscribe@marketsync.link?subject=unsub-${userId}>`,
        'X-Entity-Ref-ID': tokenHash.slice(0, 16),
      },
    })
    if (sendErr) return { sent: false, reason: sendErr.message || 'the email provider refused it' }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: e?.message || 'unknown failure' }
  }
}

export function registerRoutes(app) {
  registerAuthMfaPasskeyRoutes(app)

  // ── 3. AUTH ENDPOINTS ──
  // 5 login attempts per IP per 15 minutes — slows credential stuffing without
  // hurting real users who fat-finger their password.
  app.post('/auth/login', rateLimit('login', 5, 15 * 60 * 1000, { email: true }), async (req, res) => {
    const { email, password } = req.body
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Don't leak whether the email exists — Supabase already does this but we double-check
      audit(req, AuditAction.USER_LOGIN_FAILED, { email })
      return res.status(401).json({ error: 'Invalid email or password.' })
    }
    // Require verified email before allowing the session through
    if (!data.user.email_confirmed_at) {
      return res.status(403).json({
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Please check your inbox and click the verification link before signing in.'
      })
    }

    // MFA gate — if the user has a verified Supabase TOTP or phone factor, retain
    // the aal1 session server-side and require one chosen factor before returning
    // a usable token. Passkeys/email OTP are first-factor sign-in methods, not aal2.
    try {
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
      })
      const { data: factors, error: factorError } = await userClient.auth.mfa.listFactors()
      if (factorError) throw factorError
      const verifiedFactors = [
        ...(factors?.totp || []).filter(f => f.status === 'verified').map(f => ({ id: f.id, factor_type: 'totp', friendly_name: f.friendly_name || 'Authenticator app' })),
        ...(factors?.phone || []).filter(f => f.status === 'verified').map(f => ({ id: f.id, factor_type: 'phone', friendly_name: f.friendly_name || 'Text message', phone: maskPhone(f.phone) })),
      ]
      
      const clientTrustedToken = req.headers['x-trusted-device'] || req.body?.trusted_device
      const isDeviceTrusted = clientTrustedToken && verifyTrustedDeviceToken(clientTrustedToken, data.user?.id)

      if (verifiedFactors.length && !isDeviceTrusted) {
        const preferred = verifiedFactors[0]
        return res.status(202).json({
          mfa_required: true,
          factor_id: preferred.id,
          factor_type: preferred.factor_type,
          factors: verifiedFactors,
          partial_token: createMfaLoginChallenge({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          }),
          message: 'Two-factor code required.'
        })
      }

      const currentIp = getClientIp(req)
      const currentUa = (req.headers['user-agent'] || '').slice(0, 500)

      supabaseAdmin.from('logins').insert({
        user_id: data.user.id,
        ip: currentIp,
        user_agent: currentUa
      }).then(async ({ error: logErr }) => {
        if (logErr) console.warn('Failed to log login event:', logErr.message)
        // Best-effort suspicious-login alert (never blocks login response)
        await maybeAlertSuspiciousLogin({
          supabaseAdmin,
          userId: data.user.id,
          userEmail: data.user.email,
          currentIp,
          currentUserAgent: currentUa
        })
      })

      audit(req, AuditAction.USER_LOGIN, { method: 'password', user_id: data.user.id })
      
      const freshTrustedToken = isDeviceTrusted ? createTrustedDeviceToken(data.user?.id) : null
      res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: data.user.id, email: data.user.email },
        ...(freshTrustedToken ? { trusted_device_token: freshTrustedToken } : {})
      })
    } catch (mfaErr) {
      // Failing open here would issue a full password session to an account that
      // may have MFA enabled. Make the user retry instead of weakening MFA when
      // Supabase's factor lookup is temporarily unavailable.
      console.warn('MFA status check failed (blocking login):', mfaErr.message)
      return res.status(503).json({
        error: 'MFA_STATUS_UNAVAILABLE',
        message: 'We could not verify your multi-factor sign-in status. Please try again shortly.'
      })
    }

    const currentIp = getClientIp(req)
    const currentUa = (req.headers['user-agent'] || '').slice(0, 500)

    supabaseAdmin.from('logins').insert({
      user_id: data.user.id,
      ip: currentIp,
      user_agent: currentUa
    }).then(async ({ error: logErr }) => {
      if (logErr) console.warn('Failed to log login event:', logErr.message)
      // Best-effort suspicious-login alert (never blocks login response)
      await maybeAlertSuspiciousLogin({
        supabaseAdmin,
        userId: data.user.id,
        userEmail: data.user.email,
        currentIp,
        currentUserAgent: currentUa
      })
    })

    audit(req, AuditAction.USER_LOGIN, { method: 'password', user_id: data.user.id })
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email }
    })
  })

  // 3 registrations per IP per hour — stops bot-driven sign-up abuse
  app.post('/auth/register', rateLimit('register', 3, 60 * 60 * 1000), async (req, res) => {
    const { accountRole, fullName, email, password, dealershipName, websiteUrl, feeds,
            newsletterConsent, termsAccepted, affiliateCode, product, plan } = req.body

    if (!email || !password || !fullName || !accountRole) {
      return res.status(400).json({ error: 'Missing required registration fields' })
    }
    // The chosen plan drives org type, owner role, trial and all entitlements. Never
    // create a dealer account without one: an unplanned account can log in but has no
    // reliable product/tier navigation.
    const chosenPlan = plan ? getPlan(plan) : null
    if (!plan) return res.status(400).json({ error: 'Please choose a plan before creating your account' })
    if (plan && !chosenPlan) return res.status(400).json({ error: `Unknown plan: ${plan}` })

    // Org type: from the plan when present, else the legacy accountRole heuristic.
    const isDealership = chosenPlan ? chosenPlan.org_type === 'dealership' : accountRole === 'dealer_admin'
    const accountType = chosenPlan?.org_type
      || (ACCOUNT_TYPES.includes(req.body.accountType) ? req.body.accountType : (isDealership ? 'dealership' : 'solo'))
    if (isDealership && !dealershipName) {
      return res.status(400).json({ error: 'Dealership name required for a dealership account' })
    }

    // 2026 password policy — NIST 800-63B compliant
    const pwCheck = await validatePassword(password, { email })
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error })

    let createdUserId = null
    let createdDealershipId = null
    let confirmActionLink = null

    try {
      // Create the unconfirmed user AND mint its confirmation link in one call.
      // (admin.createUser creates the user but sends NO email — the reason
      // confirmations never arrived. We email the link ourselves via Resend below.)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: { redirectTo: `${FRONTEND_URL}/login.html?verified=1` }
      })
      if (authError) throw authError
      createdUserId = authData.user.id
      confirmActionLink = authData.properties?.action_link || null

      // Email verification is a REAL gate — do NOT auto-confirm. The account stays
      // unconfirmed until the user clicks the link we email below (sendVerificationEmail);
      // until then login is blocked with 403 EMAIL_NOT_VERIFIED and the user can re-send
      // via /auth/resend-verification. NOTE: this requires working email delivery in
      // production (Resend sending domain verified) — otherwise users cannot verify.

      // 30-day free trial — NO credit card required at sign-up. The account gets full
      // access to the chosen plan for the trial window; when it ends, the middleware
      // billing gate returns 402 and the app shows the paywall popup to pick + pay.
      const TRIAL_DAYS = 30
      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

      // Newsletter consent (CASL/GDPR/CAN-SPAM): only record if explicitly opted in.
      // Stamp the timestamp + IP so we have audit trail of when consent was given.
      const newsletter = newsletterConsent === true
        ? { newsletter_consent_at: new Date().toISOString(), newsletter_consent_ip: getClientIp(req) }
        : {}

      // Terms & Privacy acceptance — required at sign-up. Stamp when + from where so
      // we have a defensible record that this user agreed to the legal terms.
      const terms = termsAccepted === true
        ? { terms_accepted_at: new Date().toISOString(), terms_accepted_ip: getClientIp(req) }
        : {}

      if (isDealership) {
        const { data: dealership, error: dealerError } = await supabaseAdmin
          .from('dealerships')
          .insert({
            name: dealershipName,
            website_url: websiteUrl || null,
            account_type: accountType,
            billing_status: 'TRIALING',
            trial_ends_at: trialEndsAt,
            // Everything unlocked for the 30-day trial; drops to paid-only after.
            full_access_until: trialEndsAt,
            ai_boost_active: true,
            inv_intel_active: true,
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
            role: 'DEALER_ADMIN',
            account_role: accountRole,
            price_tier: 'DEALER',
            ...newsletter,
            ...terms
          })
        if (profileError) throw profileError

        if (Array.isArray(feeds) && feeds.length > 0) {
          const feedRows = feeds
            .filter(f => f && f.url)
            .map(f => ({
              dealership_id: createdDealershipId,
              user_id: createdUserId,
              feed_url: f.url,
              feed_type: f.type || 'all'
            }))
          if (feedRows.length > 0) {
            const { error: feedError } = await supabaseAdmin.from('inventory_feeds').insert(feedRows)
            if (feedError) throw feedError
          }
        }
      } else {
        const { data: personalDealership, error: personalErr } = await supabaseAdmin
          .from('dealerships')
          .insert({
            name: `${fullName} — Personal`,
            website_url: null,
            account_type: accountType,
            billing_status: null,
            is_personal: true,
            // Same 30-day everything-unlocked onboarding.
            full_access_until: trialEndsAt,
            ai_boost_active: true,
            inv_intel_active: true,
          })
          .select()
          .single()
        if (personalErr) throw personalErr
        createdDealershipId = personalDealership.id

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: createdUserId,
            dealership_id: createdDealershipId,
            full_name: fullName,
            role: 'SALES_REP',
            account_role: accountRole,
            price_tier: 'SOLO_INDIVIDUAL',
            billing_status: 'TRIALING',
            trial_ends_at: trialEndsAt,
            ...newsletter,
            ...terms
          })
        if (profileError) throw profileError
      }

      // Grant the registrant the OWNER role in RBAC (user_roles). Without this the new
      // owner has no role row and every RLS permission check fails — they would be locked
      // out of their own workspace. This runs inside the try so a failure rolls the whole
      // registration back (see catch), matching the team-invite flow.
      await syncDealerRole(createdUserId, createdDealershipId, chosenPlan?.owner_role || (isDealership ? 'DEALER_ADMIN' : 'OWNER'), createdUserId)

      // A dealership owner is also its first employee. This is part of registration success,
      // not a lazy repair: People, Academy and My Day must agree on the first login immediately.
      if (isDealership) {
        const employment = await ensureStaffMember(createdDealershipId, createdUserId, {
          name: fullName, email, role: 'DEALER_ADMIN', startDate: new Date().toISOString().slice(0, 10),
          createdBy: createdUserId, status: 'active',
        })
        if (employment.error) throw new Error(`Could not create the owner employment record: ${employment.error}`)
      }

      // Grant the chosen plan as a 30-day FREE TRIAL — no card. This is part of the
      // registration success condition. If it fails, throw so the outer catch removes
      // the incomplete user/dealership instead of creating a login with no tier.
      await provisionPlan({ dealershipId: createdDealershipId, planId: chosenPlan.id, status: 'trialing', trialEndsAt })

      // Affiliate attribution — if they arrived via a ?ref link, stamp the dealership
      // and open a referral for the affiliate (best-effort; never blocks signup).
      if (affiliateCode) { try { await recordReferralSignup({ code: affiliateCode, dealershipId: createdDealershipId, email, name: dealershipName || fullName }) } catch {} }

      // Deliver the confirmation email now that the account is fully set up.
      const emailed = await sendVerificationEmail({ email, actionLink: confirmActionLink, name: fullName })
      res.json({
        success: true,
        user_id: createdUserId,
        verification_required: true,
        email_sent: emailed,
        // No checkout at sign-up — the 30-day trial is already active (no card). The
        // client signs in and goes straight to the dashboard; payment happens later via
        // the paywall popup when the trial ends.
        requires_checkout: false,
        trial_days: TRIAL_DAYS,
        plan: chosenPlan?.id || null,
        message: emailed
          ? 'Account created. Check your email and click the verification link to activate your account.'
          : 'Account created. If you don\'t receive a verification email shortly, use “Resend verification”.'
      })
    } catch (err) {
      // Keep enough server-side context to diagnose a failed signup without
      // putting registration details (email, password, or name) in the logs.
      console.warn('[register] failed', { code: err?.code || null, message: err?.message || 'Registration failed' })
      if (createdDealershipId) {
        await supabaseAdmin.from('dealerships').delete().eq('id', createdDealershipId)
      }
      if (createdUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId)
      }
      // Never let public sign-up attach a dealership to an account it does not own.
      // A logged-in owner can add another workspace through the authenticated flow;
      // this anonymous endpoint may only create a brand-new account.
      const message = err?.message || 'Registration failed'
      const emailAlreadyRegistered = /already registered|already exists|user.*exists/i.test(message)
      res.status(emailAlreadyRegistered ? 409 : 400).json({
        error: emailAlreadyRegistered
          ? 'An account already exists for this email. Sign in, or use a different email for this dealership owner.'
          : message,
        code: emailAlreadyRegistered ? 'EMAIL_ALREADY_REGISTERED' : undefined
      })
    }
  })

  // Resend the verification email — rate-limited to stop abuse
  app.post('/auth/resend-verification', rateLimit('resend-verify', 3, 60 * 60 * 1000), async (req, res) => {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email required' })
    try {
      // Prefer our own delivery: mint a link and send it via Resend (reliable,
      // on-brand). A magic link confirms the email and signs the user in on click.
      // Fall back to Supabase's built-in resend only if Resend isn't configured.
      let sent = false
      if (resend) {
        const { data: link } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: `${FRONTEND_URL}/dashboard.html` }
        })
        sent = await sendVerificationEmail({ email, actionLink: link?.properties?.action_link, name: null })
      }
      if (!sent) {
        await supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: `${FRONTEND_URL}/login.html?verified=1` }
        })
      }
    } catch (e) {
      console.warn('resend verification failed:', e.message)
    }
    // Always return success so we don't leak whether the email exists
    res.json({ success: true, message: 'If an account exists for that email and is not yet verified, a new link has been sent.' })
  })

  app.post('/auth/logout', requireAuth, async (req, res) => {
    audit(req, AuditAction.USER_LOGOUT)
    await supabase.auth.signOut()
    res.json({ success: true })
  })

  // MFA and Passkey endpoints extracted to routes/submodules/auth-mfa-passkeys.js


  // Exchange a refresh token for a fresh session — powers "keep me signed in".
  app.post('/auth/refresh', rateLimit('token-refresh', 60, 15 * 60 * 1000), async (req, res) => {
    const refresh_token = req.body?.refresh_token
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' })
    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token })
      if (error || !data?.session) return res.status(401).json({ error: 'Session expired. Please sign in again.' })
      res.json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: data.user?.id, email: data.user?.email },
      })
    } catch (err) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' })
    }
  })

  app.post('/support', rateLimit('support', 5, 60 * 60 * 1000, { email: true }), async (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 120)
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254)
    const subject = String(req.body?.subject || '').trim().slice(0, 200) || null
    const message = String(req.body?.message || '').trim().slice(0, 5000)
    if (!name || !email || !message) return res.status(400).json({ error: 'name, email, and message are required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email address is required' })

    const { error } = await supabaseAdmin
      .from('support_requests')
      .insert({ name, email, subject, message })
    if (error) {
      console.error('Support insert failed:', error.message)
      return res.status(500).json({ error: 'Could not submit your request. Please try again.' })
    }
    console.log('📩 Support request:', { name, email, subject })
    res.json({ success: true })
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // PASSWORD RESET (custom flow — bypasses Supabase Auth's built-in email)
  // ──────────────────────────────────────────────────────────────────────────────
  // Why: Supabase's reset email goes through a shared low-priority sender that
  // caused 10+ minute delays + 4/hour rate limits. We generate our own token,
  // store a hash of it in `password_reset_tokens`, and email the link via Resend
  // (using the marketsync.link domain with proper DKIM/SPF/DMARC). Delivers in
  // seconds, rate-limited by us, single-use, 15-minute expiry, leaks nothing.

  // Constant-time response — always returns success whether the email exists or not,
  // to prevent attackers from probing "is account X registered here?".
  app.post('/auth/forgot-password', rateLimit('forgot', 5, 60 * 60 * 1000), async (req, res) => {
    const { email } = req.body || {}
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' })
    }

    const normEmail = email.toLowerCase().trim()
    const responseMessage = 'If an account exists for that email, we sent a reset link.'

    try {
      // Look up the user in Supabase. We don't expose whether they exist.
      const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const user = (usersList?.users || []).find(u => (u.email || '').toLowerCase() === normEmail)

      if (user && resend) {
        // Generate a 256-bit secure random token; store ONLY its SHA-256 hash.
        // The raw token is sent in the email and never persisted. Even a full
        // DB dump can't be used to reset passwords.
        const rawToken = randomBytes(32).toString('hex')   // 64-char hex string
        const tokenHash = createHash('sha256').update(rawToken).digest('hex')
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()  // 15 minutes

        // Insert token row. used_at stays null until consumed; we one-shot it.
        const { error: insErr } = await supabaseAdmin
          .from('password_reset_tokens')
          .insert({
            user_id: user.id,
            email: normEmail,
            token_hash: tokenHash,
            expires_at: expiresAt,
            requested_ip: getClientIp(req)
          })

        if (!insErr) {
          const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${rawToken}`
          const html = buildResetEmailHtml({ resetUrl, ip: getClientIp(req) })
          const plain = buildResetEmailText({ resetUrl, ip: getClientIp(req) })

          const { error: sendErr } = await resend.emails.send({
            from: EMAIL_FROM,
            to: normEmail,
            subject: 'Reset your MarketSync password',
            html,
            text: plain,
            // Anti-spam headers — required by Gmail/Outlook bulk-sender policies.
            headers: {
              'List-Unsubscribe': `<mailto:unsubscribe@marketsync.link?subject=unsub-${user.id}>`,
              'X-Entity-Ref-ID': tokenHash.slice(0, 16)  // helps Resend track this send
            }
          })

          if (sendErr) {
            console.error('Resend send failed:', sendErr.message)
          } else {
            console.log(`[forgot-password] reset email sent to ${normEmail}`)
          }
        } else {
          console.error('Token insert failed:', insErr.message)
        }
      } else if (!resend) {
        console.warn('[forgot-password] RESEND_API_KEY not set — email not sent')
      }
    } catch (e) {
      // Swallow — never leak account-existence via error responses
      console.warn('[forgot-password] threw:', e.message)
    }

    res.json({ success: true, message: responseMessage })
  })

  app.post('/auth/reset-password', rateLimit('reset', 5, 60 * 60 * 1000), async (req, res) => {
    const { token, password } = req.body || {}
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Reset token required' })
    if (!password) return res.status(400).json({ error: 'New password required' })

    // Hash the supplied token and look up the row — never compare raw tokens.
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const { data: row, error: lookupErr } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('id, user_id, email, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (lookupErr) return res.status(500).json({ error: 'Could not verify token' })
    if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
    if (row.used_at) return res.status(400).json({ error: 'This reset link has already been used.' })
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired. Request a new one.' })
    }

    // Validate the new password against same policy as registration (length, HIBP, etc.)
    const pwCheck = await validatePassword(password, { email: row.email })
    if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.error })

    // Update password via Supabase admin API
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password })
    if (updateErr) return res.status(500).json({ error: 'Could not update password. Try again.' })

    // Mark token used (idempotency + audit trail)
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString(), used_ip: getClientIp(req) })
      .eq('id', row.id)

    // Security best practice: invalidate ALL other sessions so an attacker who
    // had a token before the reset can't keep using it.
    try {
      await supabaseAdmin.auth.admin.signOut(row.user_id, 'others')
    } catch (e) {
      console.warn('Sign-out others failed (non-fatal):', e.message)
    }

    // Audit-log the reset event
    try {
      await supabaseAdmin.from('logins').insert({
        user_id: row.user_id,
        ip: getClientIp(req),
        user_agent: (req.headers['user-agent'] || '').slice(0, 500),
        event: 'password_reset'
      })
    } catch {}

    console.log(`[reset-password] password reset for ${row.email}`)
    res.json({ success: true })
  })
}
