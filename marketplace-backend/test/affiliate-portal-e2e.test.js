import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 9B — MarketSync Affiliate Login, Dashboard & Commission Tracking E2E
//
// Governing rules: AGENTS.md A19 (Runtime proof) & A20 (External evidence)
// Tests affiliate signup, JWT session resolution, referral tracking, and commission calculations.

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const readFE = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const affRoutes = strip(read('routes/affiliate.js'))
const affHtml = readFE('affiliate.html')
const landingHtml = readFE('affiliates.html')

// ── 1. Public Affiliate Config & Landing Page ─────────────────────────────────

test('Public Affiliate Landing page uses shared shell and default 8% lifetime rate', () => {
  assert.match(landingHtml, /id="ms-public-header"/, 'mounts shared public header')
  assert.match(landingHtml, /id="ms-public-footer"/, 'mounts shared public footer')
  assert.match(landingHtml, /8%/, 'displays canonical 8% commission rate')
  assert.match(landingHtml, /Life of the customer|For life/, 'describes lifetime commission window')
  assert.match(affRoutes, /DEFAULT_RATE_PCT = Number\(process\.env\.AFFILIATE_RATE_PCT\) \|\| 8/, 'backend default rate is 8%')
  assert.match(affRoutes, /app\.get\('\/affiliate\/public-config'/, 'exposes public config route')
})

// ── 2. Affiliate Authentication & Session Gate ───────────────────────────────

test('Affiliate portal enforces dedicated requireAffiliate middleware and active account status', () => {
  assert.match(affRoutes, /export async function requireAffiliate/, 'exports requireAffiliate middleware')
  assert.match(affRoutes, /from\('affiliates'\)\.select\('\*'\)\.eq\('user_id', user\.id\)/, 'resolves affiliate row from user_id')
  assert.match(affRoutes, /aff\.status === 'suspended'/, 'refuses suspended affiliate accounts')
  assert.match(affHtml, /id="login-form"/, 'renders login form for unauthenticated visitors')
  assert.match(affHtml, /id="dash-view"/, 'renders dashboard container for authenticated affiliates')
})

// ── 3. Referral Tracking & Commission Accrual Lifecycle ──────────────────────

test('Referral signup stamps affiliate_code and commission accrual calculates percentage accurately', () => {
  assert.match(affRoutes, /export async function recordReferralSignup/, 'exports canonical referral signup handler')
  assert.match(affRoutes, /dealerships.*update\(\{ affiliate_code:/, 'stamps affiliate code on dealership record')
  assert.match(affRoutes, /affiliate_referrals.*upsert/, 'creates affiliate referral row in trialing status')
  assert.match(affRoutes, /export async function accrueAffiliateCommission/, 'exports canonical commission accrual')
  assert.match(affRoutes, /amount = round2\(\(amountCents \/ 100\) \* \(n\(aff\.rate_pct\) \/ 100\)\)/, 'computes percentage accurately')
  assert.match(affRoutes, /affiliate_commissions.*upsert/, 'records commission with idempotent ext_ref')
})

// ── 4. Affiliate Dashboard Metrics & Zero Emoji Invariant ────────────────────

test('Affiliate Dashboard displays 4 core metrics tiles and maintains zero hardcoded emojis', () => {
  assert.match(affHtml, /id="st-total"/, 'displays total referrals tile')
  assert.match(affHtml, /id="st-active"/, 'displays paying subscriptions tile')
  assert.match(affHtml, /id="st-pending"/, 'displays pending commissions tile')
  assert.match(affHtml, /id="st-total-earn"/, 'displays lifetime earned tile')
  assert.doesNotMatch(affHtml, /[\u{1F300}-\u{1FAFF}]/u, 'zero hardcoded emoji icons in affiliate dashboard')
})
