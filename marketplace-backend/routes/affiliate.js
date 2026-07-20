/**
 * Affiliate program. Affiliates refer dealerships to MarketSync and earn a recurring
 * commission on the subscription revenue those dealers generate. Affiliates have their
 * OWN signup, login, and portal (affiliate.html) — they're not dealership staff, so
 * they authenticate against the `affiliates` table via `requireAffiliate` (no profile
 * / dealership required).
 *
 * Defaults (per-affiliate, editable): 25% of the referred dealer's subscription for
 * the first 12 months. Commission accrues when the dealer actually PAYS — the billing
 * webhook calls accrueAffiliateCommission() on each successful payment.
 *
 * Attribution: a referral link carries ?ref=<code>. On dealer signup the code is
 * stamped on the dealership (dealerships.affiliate_code) and an affiliate_referrals
 * row is created; payments then map back to the affiliate through that code.
 */
import { randomBytes } from 'crypto'
import { supabase, supabaseAdmin, FRONTEND_URL } from '../shared.js'
import { rateLimit, validatePassword } from '../security.js'

// Program defaults (a new affiliate inherits these; the owner can tune per-affiliate).
const DEFAULT_RATE_PCT = Number(process.env.AFFILIATE_RATE_PCT) || 25
const DEFAULT_RATE_MONTHS = Number(process.env.AFFILIATE_RATE_MONTHS) || 12
const DEFAULT_BOUNTY = Number(process.env.AFFILIATE_BOUNTY) || 0
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100

function genCode() { return randomBytes(5).toString('hex').slice(0, 8).toUpperCase() }
async function uniqueCode() {
  for (let i = 0; i < 6; i++) {
    const c = genCode()
    const { data } = await supabaseAdmin.from('affiliates').select('id').eq('code', c).maybeSingle()
    if (!data) return c
  }
  return genCode() + randomBytes(2).toString('hex').toUpperCase()
}

// Auth for the affiliate portal: validate the Supabase JWT and resolve the affiliate.
export async function requireAffiliate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'AUTH_EXPIRED — please sign in again' })
    const { data: aff } = await supabaseAdmin.from('affiliates').select('*').eq('user_id', user.id).maybeSingle()
    if (!aff) return res.status(403).json({ error: 'Not an affiliate account.' })
    if (aff.status === 'suspended') return res.status(403).json({ error: 'This affiliate account is suspended.' })
    req.affiliate = aff
    next()
  } catch (e) { res.status(401).json({ error: 'Auth failed' }) }
}

// Map a paying dealership back to its referring affiliate + referral, honouring the
// rate window. Called from the billing webhook. Idempotent on extRef.
export async function accrueAffiliateCommission({ dealershipId, amountCents, currency, extRef }) {
  try {
    if (!dealershipId || !amountCents) return
    const { data: dlr } = await supabaseAdmin.from('dealerships').select('affiliate_code').eq('id', dealershipId).maybeSingle()
    const code = dlr?.affiliate_code
    if (!code) return
    const { data: aff } = await supabaseAdmin.from('affiliates').select('*').eq('code', code).maybeSingle()
    if (!aff || aff.status !== 'active') return
    const { data: ref } = await supabaseAdmin.from('affiliate_referrals').select('*').eq('dealership_id', dealershipId).maybeSingle()
    // Enforce the rate window (e.g. 12 months from the first payment / referral).
    const start = ref?.first_paid_at || ref?.converted_at || ref?.created_at || new Date().toISOString()
    if (aff.rate_months > 0) {
      const cutoff = new Date(new Date(start).getTime())
      cutoff.setMonth(cutoff.getMonth() + aff.rate_months)
      if (Date.now() > cutoff.getTime()) return   // outside the earning window
    }
    const amount = round2((amountCents / 100) * (n(aff.rate_pct) / 100))
    if (amount <= 0) return
    await supabaseAdmin.from('affiliate_commissions').upsert({
      affiliate_id: aff.id, referral_id: ref?.id || null, dealership_id: dealershipId,
      amount, currency: (currency || 'usd').toLowerCase(), source: 'subscription', status: 'pending', ext_ref: extRef || null,
    }, { onConflict: 'ext_ref' })
    // Mark the referral active + stamp first payment.
    if (ref && (!ref.first_paid_at || ref.status !== 'active')) {
      await supabaseAdmin.from('affiliate_referrals').update({ status: 'active', first_paid_at: ref.first_paid_at || new Date().toISOString() }).eq('id', ref.id)
    }
  } catch (e) { console.warn('[affiliate] accrue failed:', e.message) }
}

// Record a referral at dealer signup (called from auth register).
export async function recordReferralSignup({ code, dealershipId, email, name }) {
  try {
    if (!code) return
    const { data: aff } = await supabaseAdmin.from('affiliates').select('id, status').eq('code', String(code).toUpperCase()).maybeSingle()
    if (!aff || aff.status !== 'active') return
    await supabaseAdmin.from('dealerships').update({ affiliate_code: String(code).toUpperCase() }).eq('id', dealershipId)
    await supabaseAdmin.from('affiliate_referrals').upsert({
      affiliate_id: aff.id, dealership_id: dealershipId, referred_email: email || null, referred_name: name || null, status: 'trialing', converted_at: null,
    }, { onConflict: 'dealership_id' })
  } catch (e) { console.warn('[affiliate] referral signup failed:', e.message) }
}

async function affiliateSummary(aff) {
  const [{ data: refs }, { data: comms }] = await Promise.all([
    supabaseAdmin.from('affiliate_referrals').select('*').eq('affiliate_id', aff.id).order('created_at', { ascending: false }),
    supabaseAdmin.from('affiliate_commissions').select('*').eq('affiliate_id', aff.id),
  ])
  const referrals = refs || []
  const commissions = comms || []
  const sum = (pred) => round2(commissions.filter(pred).reduce((s, c) => s + Number(c.amount), 0))
  return {
    code: aff.code,
    link: `${FRONTEND_URL}/register.html?ref=${aff.code}`,
    rate_pct: aff.rate_pct, rate_months: aff.rate_months, bounty: aff.bounty,
    payout_email: aff.payout_email || aff.email,
    counts: {
      total: referrals.length,
      active: referrals.filter(r => r.status === 'active').length,
      trialing: referrals.filter(r => r.status === 'trialing' || r.status === 'signed_up').length,
    },
    earnings: { pending: sum(c => c.status === 'pending'), approved: sum(c => c.status === 'approved'), paid: sum(c => c.status === 'paid'), total: sum(() => true) },
  }
}

export function registerAffiliate(app) {
  // Public: the commission structure for the marketing page.
  app.get('/affiliate/public-config', (req, res) => {
    res.json({ ok: true, rate_pct: DEFAULT_RATE_PCT, rate_months: DEFAULT_RATE_MONTHS, bounty: DEFAULT_BOUNTY })
  })

  // Public: affiliate signup → creates an auth user + affiliate row, returns a session.
  app.post('/affiliate/signup', rateLimit('affsignup', 5, 60 * 60 * 1000), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const name = String(req.body?.name || '').trim().slice(0, 120)
    if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' })
    const pw = await validatePassword(password, { email })
    if (!pw.ok) return res.status(400).json({ error: pw.error || 'Weak password.' })
    const { data: existing } = await supabaseAdmin.from('affiliates').select('id').eq('email', email).maybeSingle()
    if (existing) return res.status(409).json({ error: 'An affiliate account already exists for that email.' })
    // Create (or reuse) the auth user.
    let userId = null
    const created = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { affiliate: true, name } })
    if (created.error) {
      // Email already registered as a dealer — allow them to also be an affiliate by signing in.
      const signIn = await supabase.auth.signInWithPassword({ email, password })
      if (signIn.error || !signIn.data?.user) return res.status(400).json({ error: created.error.message || 'Could not create the account.' })
      userId = signIn.data.user.id
    } else { userId = created.data.user.id }
    const code = await uniqueCode()
    const { data: aff, error } = await supabaseAdmin.from('affiliates').insert({
      user_id: userId, email, name, code, status: 'active', payout_email: email,
      rate_pct: DEFAULT_RATE_PCT, rate_months: DEFAULT_RATE_MONTHS, bounty: DEFAULT_BOUNTY, approved_at: new Date().toISOString(),
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    const { data: sess } = await supabase.auth.signInWithPassword({ email, password })
    res.json({ ok: true, access_token: sess?.session?.access_token, refresh_token: sess?.session?.refresh_token, user: sess?.user, affiliate: { code: aff.code } })
  })

  // Affiliate login.
  app.post('/affiliate/login', rateLimit('afflogin', 8, 15 * 60 * 1000), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid email or password.' })
    const { data: aff } = await supabaseAdmin.from('affiliates').select('id, status').eq('user_id', data.user.id).maybeSingle()
    if (!aff) return res.status(403).json({ error: 'No affiliate account for this login.' })
    if (aff.status === 'suspended') return res.status(403).json({ error: 'This affiliate account is suspended.' })
    res.json({ ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token, user: data.user })
  })

  app.get('/affiliate/me', requireAffiliate, async (req, res) => {
    res.json({ ok: true, name: req.affiliate.name, email: req.affiliate.email, status: req.affiliate.status, ...(await affiliateSummary(req.affiliate)) })
  })

  app.get('/affiliate/referrals', requireAffiliate, async (req, res) => {
    const { data } = await supabaseAdmin.from('affiliate_referrals').select('*').eq('affiliate_id', req.affiliate.id).order('created_at', { ascending: false })
    res.json({ ok: true, referrals: (data || []).map(r => ({ id: r.id, name: r.referred_name, email: r.referred_email, status: r.status, created_at: r.created_at, first_paid_at: r.first_paid_at })) })
  })

  app.get('/affiliate/commissions', requireAffiliate, async (req, res) => {
    const { data } = await supabaseAdmin.from('affiliate_commissions').select('*').eq('affiliate_id', req.affiliate.id).order('created_at', { ascending: false }).limit(500)
    res.json({ ok: true, commissions: (data || []).map(c => ({ amount: Number(c.amount), currency: c.currency, source: c.source, status: c.status, period: c.period, created_at: c.created_at })) })
  })

  app.put('/affiliate/payout', requireAffiliate, async (req, res) => {
    const payout = String(req.body?.payout_email || '').trim().toLowerCase()
    if (payout && !/.+@.+\..+/.test(payout)) return res.status(400).json({ error: 'Enter a valid payout email.' })
    await supabaseAdmin.from('affiliates').update({ payout_email: payout || req.affiliate.email }).eq('id', req.affiliate.id)
    res.json({ ok: true })
  })
}
