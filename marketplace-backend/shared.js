import 'dotenv/config'
import ws from 'ws'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Resend SMTP — we send transactional email (password resets etc.) directly
// from this backend instead of going through Supabase Auth. Lower latency,
// better deliverability, no shared-tenant rate limits.
export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
// Render should set EMAIL_FROM once the domain is verified in Resend. The
// MarketSync address below is the intended branded default for all invite and
// transactional messages.
export const EMAIL_FROM = process.env.EMAIL_FROM || 'MarketSync <noreply@marketsync.com>'

// Central mailer. Every failure mode is made explicit and LOGGED (most call sites
// used to swallow errors, which is why a mis-configured key or an unverified
// sending domain looked like "no emails going through" with nothing in the logs).
// Returns { ok, error, id } — callers may ignore it, but the reason is always logged.
export async function sendEmail({ to, subject, html, from, replyTo, cc, bcc, tags } = {}) {
  if (!resend) { const error = 'RESEND_API_KEY not set — email is disabled'; console.error('[email]', error); return { ok: false, error } }
  if (!to || !subject) { const error = 'email requires `to` and `subject`'; console.error('[email]', error, { to, subject }); return { ok: false, error } }
  try {
    const payload = { from: from || EMAIL_FROM, to, subject, html: html || '' }
    if (replyTo) payload.replyTo = replyTo
    if (cc) payload.cc = cc
    if (bcc) payload.bcc = bcc
    if (tags) payload.tags = tags
    const r = await resend.emails.send(payload)
    if (r?.error) { console.error('[email] send failed:', r.error?.message || r.error, '→', to); return { ok: false, error: r.error?.message || String(r.error) } }
    return { ok: true, id: r?.data?.id || null }
  } catch (e) {
    console.error('[email] send threw:', e?.message || e, '→', to)
    return { ok: false, error: e?.message || String(e) }
  }
}

// Config snapshot for the owner's email diagnostic (no secrets returned).
export function emailHealth() {
  const m = /<([^>]+)>/.exec(EMAIL_FROM)
  const addr = (m ? m[1] : EMAIL_FROM).trim()
  return {
    configured: !!resend,
    key_present: !!process.env.RESEND_API_KEY,
    from: EMAIL_FROM,
    from_domain: addr.includes('@') ? addr.split('@')[1] : null,
  }
}

// Public frontend host used for password reset links, email verification, Stripe
// redirects, etc. This MUST be the static-site domain (marketsync.link) — NOT this
// backend's own URL.
//
// We intentionally do NOT fall back to API_URL anymore: on Render, API_URL holds
// the backend's own *.onrender.com URL, so using it produced reset links that
// pointed at this Express server — which doesn't serve the static HTML. That's
// what caused "Cannot GET /reset-password.html" and Chrome's "Dangerous site"
// warning (a password page + token on a generic *.onrender.com host trips Safe
// Browsing). Set FRONTEND_URL=https://marketsync.link on Render.
export const CANONICAL_FRONTEND = 'https://marketsync.link'
export const FRONTEND_URL = (process.env.FRONTEND_URL || CANONICAL_FRONTEND)
  .replace(/\/$/, '')  // strip trailing slash to avoid `//path` URLs

// Separate origins for app authentication vs. untrusted dealer public sites
export const APP_ORIGIN = (process.env.APP_ORIGIN || process.env.FRONTEND_URL || 'https://marketsync.link').replace(/\/$/, '')
export const PUBLIC_SITE_ORIGIN = (process.env.PUBLIC_SITE_ORIGIN || 'https://sites.marketsync.link').replace(/\/$/, '')
export const SITE_DOMAIN_TARGET = (process.env.SITE_DOMAIN_TARGET || 'marketsync.link').replace(/^https?:\/\//, '').replace(/\/.*$/, '')

// Chrome Web Store listing — linked from the onboarding drip ("get the extension").
export const EXTENSION_URL = process.env.CHROME_EXTENSION_URL ||
  'https://chromewebstore.google.com/detail/marketsync/mfoaodaoipaalloccolophjhblgikada'

// This backend's own public URL — used for the drip unsubscribe link, which is
// served by routes on THIS server (the static frontend has no such route).
export const BACKEND_URL = (process.env.API_URL || process.env.RENDER_EXTERNAL_URL ||
  'https://vehicle-marketplace-s0e4.onrender.com').replace(/\/$/, '')

const missingEnvVars = [];
if (!process.env.SUPABASE_URL) missingEnvVars.push('SUPABASE_URL');
if (!process.env.SUPABASE_ANON_KEY) missingEnvVars.push('SUPABASE_ANON_KEY');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');

// Under `NODE_ENV=test` the process must be IMPORTABLE without live credentials: the
// test runner exercises pure helpers in modules that transitively import this file, and
// CI has no Supabase project. We substitute inert placeholders so the Supabase/Stripe
// clients construct (they never connect during unit tests). In every real environment a
// missing key is still fatal exactly as before.
const IS_TEST = process.env.NODE_ENV === 'test';
if (missingEnvVars.length > 0) {
  if (IS_TEST) {
    console.warn('[shared] Missing Supabase env under NODE_ENV=test — using inert placeholders:', missingEnvVars.join(', '));
  } else {
    console.error('❌ CRITICAL CONFIGURATION ERROR: Missing Render Environment Keys:');
    console.error(JSON.stringify(missingEnvVars, null, 2));
    process.exit(1);
  }
}

// Placeholders apply ONLY when the real value is absent (test/CI). Production always sets
// these, so the `||` fallbacks never trigger there and behavior is byte-for-byte identical.
const SB_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const SB_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || (IS_TEST ? 'sk_test_placeholder' : process.env.STRIPE_SECRET_KEY);

// Realistic browser headers. Many dealer sites (Performance Auto Group, etc.) sit
// behind Cloudflare / WAF rules that 403 any request whose User-Agent isn't a real
// browser. Sending a full Chrome header set clears the common "Bot Fight Mode" and
// managed-challenge rules that only inspect headers. Sites running a full JS
// challenge still need the Puppeteer fallback (fetchViaBrowser / fetchUrlsViaBrowser).
export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1'
}

// fetch() wrapper that sends browser-like headers plus a same-origin Referer/Origin.
// Caller headers in init.headers win (e.g. JSON Accept / Sec-Fetch overrides).
// Every request gets a hard 25s timeout unless the caller passes its own signal —
// one hanging dealer site must never stall the sync loop for everyone else.
export function browserFetch(url, init = {}) {
  let extra = {}
  try {
    const origin = new URL(url).origin
    extra = { Referer: origin + '/', Origin: origin }
  } catch {}
  return fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(25000),
    headers: { ...BROWSER_HEADERS, ...extra, ...(init.headers || {}) }
  })
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))
export const stripe = new Stripe(STRIPE_KEY)

export const supabase = createClient(SB_URL, SB_ANON_KEY, { realtime: { transport: ws } })
export const supabaseAdmin = createClient(SB_URL, SB_SERVICE_KEY, { realtime: { transport: ws } })

// ── MarketSync staff — the saas_admin / HQ workspace ──
// HQ is MarketSync's own back office, NOT a dealership. Staff are identified by a
// `saas_role` on their profile (or the owner email). Such an account needs no
// dealership_id and is exempt from the dealership billing gate. The legacy internal
// dealership names stay recognised so pre-existing owner logins keep HQ access.
export const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'massiejay@gmail.com').toLowerCase()
export const SAAS_ROLES = ['owner', 'sales', 'support', 'marketing', 'developer']
// Platform system roles (authoritative, from profiles.system_role) that open HQ.
export const PLATFORM_SYSTEM_ROLES = ['platform_owner', 'platform_admin']
export function isSaasStaff(profile, email) {
  if (profile && PLATFORM_SYSTEM_ROLES.includes(profile.system_role)) return true
  if (email && String(email).toLowerCase() === OWNER_EMAIL) return true
  if (profile && SAAS_ROLES.includes(profile.saas_role)) return true
  const dn = profile?.dealerships?.name
  return dn === 'MarketSync' || dn === 'JMS Automotive'
}
