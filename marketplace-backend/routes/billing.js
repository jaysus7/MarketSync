import express from 'express'
import { rateLimit } from '../security.js'
import { stripe, supabaseAdmin, FRONTEND_URL } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { requestHasCronSecret } from '../cron-auth.js'
import {
  sendTrialStarted,
  sendTrialExpiring,
  sendTrialExpired,
  sendPaymentConfirmed,
  sendPaymentFailed,
} from './billing-emails.js'
import { createNotification } from '../notifications.js'
import { handleDepositCheckout } from './deposits.js'
import { accrueAffiliateCommission } from './affiliate.js'
import { postMarketsyncRevenue } from './accounting.js'
import { syncSubscriptionFromStripe, cancelSubscriptionCoverage } from '../entitlements.js'
import { getPlan, stripePriceForPlan, PLAN_CATALOG, PLAN_IDS } from '../plan-catalog.js'
import { blockDemoStripeAction } from './demo.js'

// Inventory Intelligence price ID — accept the canonical name OR the
// STRIPE_INVENTORY_INTELLIGANCE name used in the current Render environment,
// so billing works regardless of which one is set.
const INV_INTEL_PRICE_ID = process.env.STRIPE_INV_INTEL_PRICE_ID || process.env.STRIPE_INVENTORY_INTELLIGANCE || ''

// Map a Stripe price ID to the add-on key used everywhere else
function addonKeyForPrice(priceId) {
  if (priceId === process.env.STRIPE_AI_BOOST_PRICE_ID)    return 'ai_boost'
  if (priceId === process.env.STRIPE_VIN_STICKER_PRICE_ID) return 'vin_sticker'
  if (priceId === process.env.STRIPE_AI_VISION_PRICE_ID)   return 'ai_vision'
  if (priceId === process.env.STRIPE_AI_CHATBOT_PRICE_ID)  return 'ai_chatbot'
  if (INV_INTEL_PRICE_ID && priceId === INV_INTEL_PRICE_ID) return 'inv_intel'
  return null
}

// Return the Supabase column(s) to toggle for a given add-on key
function colsForAddon(key, active) {
  // For the two sellable add-ons we also set the *_paid flag from Stripe truth, so
  // the 30-day full-access expiry sweep can drop granted access without touching a
  // real paid subscription.
  if (key === 'ai_boost')    return { ai_boost_active: active, ai_boost_paid: active }
  if (key === 'vin_sticker') return { vin_sticker_active: active }
  if (key === 'ai_vision')   return { ai_vision_active: active }
  if (key === 'ai_chatbot')  return { ai_chatbot_active: active, ai_chatbot_paid: active }
  if (key === 'inv_intel')   return { inv_intel_active: active, inv_intel_paid: active }
  return {}
}

// Derive which add-ons are in a subscription's item list
function addonsInSub(sub) {
  return (sub.items?.data || [])
    .map(item => addonKeyForPrice(item.price.id))
    .filter(Boolean)
}

// ── Bundled packages (Starter / Growth / Pro) ────────────────────────────────
// Sold to smaller dealers at $999 / $1,499 / $1,999 a month, in the buyer's own
// currency (CAD in Canada, USD in the US). Each package has one Stripe price per
// currency; a package flips a fixed set of entitlements via the same webhook the
// à-la-carte add-ons use. Facebook posting stays its own product and is comped at
// the Pro tier. Prices are the display amounts (same headline number per currency).
const PACKAGES = {
  starter: { label: 'Starter', amount: 999,  priceCad: process.env.STRIPE_PKG_STARTER_CAD || '', priceUsd: process.env.STRIPE_PKG_STARTER_USD || '' },
  growth:  { label: 'Growth',  amount: 1499, priceCad: process.env.STRIPE_PKG_GROWTH_CAD  || '', priceUsd: process.env.STRIPE_PKG_GROWTH_USD  || '' },
  pro:     { label: 'Pro',     amount: 1999, priceCad: process.env.STRIPE_PKG_PRO_CAD     || '', priceUsd: process.env.STRIPE_PKG_PRO_USD     || '' },
}
function packageKeyForPrice(priceId) {
  for (const [key, p] of Object.entries(PACKAGES)) {
    if (priceId && (priceId === p.priceCad || priceId === p.priceUsd)) return key
  }
  return null
}
function packageInSub(sub) {
  for (const item of (sub.items?.data || [])) {
    const k = packageKeyForPrice(item.price.id)
    if (k) return k
  }
  return null
}

// A personal/solo workspace may manage only its own profile billing. A dealership
// subscription is a company-level commitment and requires the explicit RBAC grant.
function requireBillingManage(req, res, next) {
  const isPersonal = req.profile?.dealerships?.is_personal === true || !req.dealershipId
  if (isPersonal) return next()
  return requirePermission('billing.manage')(req, res, next)
}
// Entitlement columns for a package. Growth & Pro unlock the AI Boost and
// Inventory Intelligence bundles (which cascade to Vision/docs/VIN/appraisals);
// `plan` gates the Pro-only layer (equity mining + executive dashboard). When a
// subscription ends we clear everything so downgrades are deterministic.
function colsForPackage(pkg, active) {
  if (!active) return { plan: null, ai_boost_active: false, ai_boost_paid: false, inv_intel_active: false, inv_intel_paid: false }
  const ai = pkg === 'growth' || pkg === 'pro'
  return {
    plan: pkg,
    ai_boost_active: ai, ai_boost_paid: ai,
    inv_intel_active: ai, inv_intel_paid: ai,
    vin_sticker_active: ai, ai_vision_active: ai,
  }
}

// Fetch the dealership record for a Stripe customer (for email lookups)
async function dealerForCustomer(customerId) {
  const { data } = await supabaseAdmin
    .from('dealerships')
    .select('id, name, ai_manager_email')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data
}

// ── HQ checkout funnel (Phase 2) ──
// Best-effort: log each acquisition Checkout Session we start; the webhook flips it
// to 'completed'. Never let a logging error affect the customer's checkout.
async function recordCheckoutStart({ sessionId, dealershipId, kind, planKey, currency }) {
  try {
    await supabaseAdmin.from('saas_checkout_sessions').insert({
      stripe_session_id: sessionId, dealership_id: dealershipId || null,
      kind, plan_key: planKey || null, currency: currency || null,
    })
  } catch (e) { console.error('[funnel] record start failed:', e?.message || e) }
}
async function markCheckoutComplete(sessionId) {
  if (!sessionId) return
  try {
    await supabaseAdmin.from('saas_checkout_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('stripe_session_id', sessionId)
  } catch (e) { console.error('[funnel] mark complete failed:', e?.message || e) }
}

export function registerRoutes(app) {

  // ── Stripe Webhook ─────────────────────────────────────────────────────────
  app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature']
    let event
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    try {
      switch (event.type) {

        case 'checkout.session.completed': {
          const session = event.data.object
          const meta = session.metadata || {}
          markCheckoutComplete(session.id)   // HQ funnel: this cart converted

          // Online deposit (Stripe Connect destination charge) — not a subscription.
          if (meta.kind === 'deposit') { await handleDepositCheckout(session); break }

          // Central dealer-group subscription — covers every store in the group.
          if (meta.group_id) {
            const sub = await stripe.subscriptions.retrieve(session.subscription)
            const isActive = sub.status === 'active' || sub.status === 'trialing'
            await supabaseAdmin.from('dealer_groups').update({
              billing_mode: 'group',
              billing_status: isActive ? (sub.status === 'trialing' ? 'TRIALING' : 'ACTIVE') : 'INACTIVE',
              stripe_customer_id: session.customer || null,
              subscription_id: session.subscription || null,
            }).eq('id', meta.group_id)
            break
          }

          if (!meta.dealership_id) break

          const sub = await stripe.subscriptions.retrieve(session.subscription)
          const addons = addonsInSub(sub)
          const pkg = packageInSub(sub)

          // Activate the package (if any) then each à-la-carte add-on.
          const updates = {}
          if (pkg) Object.assign(updates, colsForPackage(pkg, true))
          for (const key of addons) Object.assign(updates, colsForAddon(key, true))
          if (session.customer) updates.stripe_customer_id = session.customer
          if (Object.keys(updates).length) {
            await supabaseAdmin.from('dealerships').update(updates).eq('id', meta.dealership_id)
          }

          // Reconcile the normalized subscriptions table from the Stripe sub's plan
          // prices (server-side price→plan mapping). Best-effort — legacy add-on flags
          // above are unaffected if a price isn't in the plan catalog.
          try { await syncSubscriptionFromStripe(meta.dealership_id, sub) } catch (e) { console.error('[stripe] sub sync failed:', e?.message || e) }

          // Trial-started email
          const { data: dealer } = await supabaseAdmin
            .from('dealerships')
            .select('name, ai_manager_email')
            .eq('id', meta.dealership_id)
            .maybeSingle()

          if (dealer?.ai_manager_email && addons.length) {
            await sendTrialStarted({
              to: dealer.ai_manager_email,
              dealerName: dealer.name,
              addons,
            }).catch(() => {})
          }
          await createNotification({
            dealershipId: meta.dealership_id,
            type: 'billing',
            title: `Trial started — ${addons.map(a => a === 'ai_boost' ? 'AI Boost' : a === 'vin_sticker' ? 'VIN & Brochure' : 'AI Vision').join(', ')}`,
            body: '30-day free trial is now active. No charge until the trial ends.',
            linkPage: 'settings',
          })
          break
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object
          const isActive = sub.status === 'active' || sub.status === 'trialing'
          // Group subscription lifecycle (tagged on the subscription metadata).
          if (sub.metadata?.group_id) {
            await supabaseAdmin.from('dealer_groups').update({
              billing_status: isActive ? (sub.status === 'trialing' ? 'TRIALING' : 'ACTIVE') : 'INACTIVE',
            }).eq('id', sub.metadata.group_id)
            break
          }
          const addons = addonsInSub(sub)
          const pkg = packageInSub(sub)
          const updates = {}
          if (pkg) Object.assign(updates, colsForPackage(pkg, isActive))
          for (const key of addons) Object.assign(updates, colsForAddon(key, isActive))
          if (Object.keys(updates).length) {
            await supabaseAdmin.from('dealerships').update(updates).eq('stripe_customer_id', sub.customer)
          }
          // Reconcile normalized subscriptions (status change: active/past_due/etc.).
          try {
            const dealer = await dealerForCustomer(sub.customer)
            if (dealer?.id) await syncSubscriptionFromStripe(dealer.id, sub)
          } catch (e) { console.error('[stripe] sub sync failed:', e?.message || e) }
          break
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object
          if (sub.metadata?.group_id) {
            await supabaseAdmin.from('dealer_groups').update({ billing_status: 'INACTIVE' }).eq('id', sub.metadata.group_id)
            break
          }
          const addons = addonsInSub(sub)
          const pkg = packageInSub(sub)
          const updates = {}
          if (pkg) Object.assign(updates, colsForPackage(pkg, false))
          for (const key of addons) Object.assign(updates, colsForAddon(key, false))
          if (Object.keys(updates).length) {
            await supabaseAdmin.from('dealerships').update(updates).eq('stripe_customer_id', sub.customer)
          }
          // Reconcile normalized subscriptions → status 'cancelled'.
          try {
            const d = await dealerForCustomer(sub.customer)
            if (d?.id) {
              await cancelSubscriptionCoverage({ dealershipId: d.id, subscriptionId: sub.id })
            }
          } catch (e) { console.error('[stripe] sub cancel failed:', e?.message || e) }

          // Trial expired email (no payment collected = trial_end cancellation)
          if (sub.cancellation_details?.reason === 'cancellation_requested' || sub.cancel_at_period_end) break
          const dealer = await dealerForCustomer(sub.customer)
          if (dealer?.ai_manager_email && addons.length) {
            await sendTrialExpired({ to: dealer.ai_manager_email, dealerName: dealer.name, addons }).catch(() => {})
          }
          if (dealer?.id) {
            await createNotification({
              dealershipId: dealer.id,
              type: 'billing',
              title: 'Trial ended — add-ons deactivated',
              body: 'Add a payment method in billing settings to re-activate.',
              linkPage: 'settings',
            })
          }
          break
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object
          if (!invoice.subscription || !invoice.customer) break
          // Skip the very first invoice on a trial (amount_paid = 0)
          if (invoice.amount_paid === 0) break

          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          const addons = addonsInSub(sub)
          if (!addons.length) break

          // Re-activate in case they had lapsed
          const updates = {}
          for (const key of addons) Object.assign(updates, colsForAddon(key, true))
          await supabaseAdmin.from('dealerships').update(updates).eq('stripe_customer_id', invoice.customer)

          // Payment confirmation email
          const dealer = await dealerForCustomer(invoice.customer)
          if (dealer?.ai_manager_email) {
            const charge = invoice.charge
              ? await stripe.charges.retrieve(invoice.charge).catch(() => null)
              : null
            const last4 = charge?.payment_method_details?.card?.last4
            const periodEnd = sub.current_period_end
            const nextDate = periodEnd
              ? new Date(periodEnd * 1000).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
              : null
            const subtotal = addons.reduce((s, a) => s + (a === 'ai_boost' ? 129 : a === 'inv_intel' ? 299 : a === 'vin_sticker' ? 79 : 49), 0)
            await sendPaymentConfirmed({
              to: dealer.ai_manager_email,
              dealerName: dealer.name,
              addons,
              amountTotal: subtotal,
              last4,
              nextBillingDate: nextDate,
            }).catch(() => {})
          }
          if (dealer?.id) {
            const subtotal = addons.reduce((s, a) => s + (a === 'ai_boost' ? 129 : a === 'inv_intel' ? 299 : a === 'vin_sticker' ? 79 : 49), 0)
            await createNotification({
              dealershipId: dealer.id,
              type: 'billing',
              title: `Payment confirmed — $${subtotal} CAD`,
              body: `${addons.map(a => a === 'ai_boost' ? 'AI Boost' : a === 'vin_sticker' ? 'VIN & Brochure' : 'AI Vision').join(', ')} subscription renewed.`,
              linkPage: 'settings',
            })
          }
          // Affiliate: accrue the referring affiliate's commission on this payment
          // (idempotent on the invoice id; no-op when the dealer wasn't referred).
          if (dealer?.id) await accrueAffiliateCommission({ dealershipId: dealer.id, amountCents: invoice.amount_paid, currency: invoice.currency, extRef: invoice.id })
          // MarketSync financials: post this subscription payment as SaaS revenue to
          // MarketSync's own ledger (idempotent on the invoice id).
          await postMarketsyncRevenue({ amountCents: invoice.amount_paid, currency: invoice.currency, ref: invoice.id, description: `Subscription — ${dealer?.name || invoice.customer}` })
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object
          if (!invoice.subscription || !invoice.customer) break

          const sub = await stripe.subscriptions.retrieve(invoice.subscription)
          const addons = addonsInSub(sub)
          if (!addons.length) break

          // Deactivate after final failure (Stripe marks past_due → unpaid → canceled)
          if (invoice.next_payment_attempt === null) {
            const updates = {}
            for (const key of addons) Object.assign(updates, colsForAddon(key, false))
            await supabaseAdmin.from('dealerships').update(updates).eq('stripe_customer_id', invoice.customer)
          }

          const dealer = await dealerForCustomer(invoice.customer)
          if (dealer?.ai_manager_email) {
            const charge = invoice.charge
              ? await stripe.charges.retrieve(invoice.charge).catch(() => null)
              : null
            const last4 = charge?.payment_method_details?.card?.last4
            const retryTs = invoice.next_payment_attempt
            const retryDate = retryTs
              ? new Date(retryTs * 1000).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
              : null
            const subtotal = addons.reduce((s, a) => s + (a === 'ai_boost' ? 129 : a === 'inv_intel' ? 299 : a === 'vin_sticker' ? 79 : 49), 0)
            await sendPaymentFailed({
              to: dealer.ai_manager_email,
              dealerName: dealer.name,
              amountTotal: subtotal,
              last4,
              retryDate,
            }).catch(() => {})
          }
          break
        }
      }
    } catch (err) {
      console.error('Webhook handler error:', err)
    }

    res.json({ received: true })
  })

  // ── Checkout helpers ───────────────────────────────────────────────────────

  async function createAddonCheckout(req, res, addonKey) {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const envKey = {
      ai_boost:    'STRIPE_AI_BOOST_PRICE_ID',
      vin_sticker: 'STRIPE_VIN_STICKER_PRICE_ID',
      ai_vision:   'STRIPE_AI_VISION_PRICE_ID',
      ai_chatbot:  'STRIPE_AI_CHATBOT_PRICE_ID',
      inv_intel:   'STRIPE_INV_INTEL_PRICE_ID',
    }[addonKey]

    // Inventory Intelligence tolerates the STRIPE_INVENTORY_INTELLIGANCE alias.
    const priceId = addonKey === 'inv_intel' ? INV_INTEL_PRICE_ID : process.env[envKey]
    if (!priceId) return res.status(500).json({ error: `Price ID for ${addonKey} is not configured` })

    const existingCustomerId = req.profile.dealerships?.stripe_customer_id

    try {
      const sessionParams = {
        // Omit payment_method_types — let Stripe choose dynamically
        payment_method_collection: 'if_required',
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        metadata: { type: addonKey, dealership_id: req.dealershipId },
        subscription_data: {
          // Every add-on gets a 30-day free trial (no card required up front).
          trial_period_days: 30,
          metadata: { type: addonKey, dealership_id: req.dealershipId },
        },
        success_url: `${FRONTEND_URL}/dashboard.html?${addonKey}_session={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${FRONTEND_URL}/dashboard.html`,
      }
      if (existingCustomerId) sessionParams.customer = existingCustomerId

      const session = await stripe.checkout.sessions.create(sessionParams)
      res.json({ url: session.url })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  async function verifyAddonSession(req, res, addonKey) {
    const { session_id } = req.query
    if (!session_id) return res.status(400).json({ error: 'session_id required' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      const meta = session.metadata || {}
      if (meta.type !== addonKey || meta.dealership_id !== req.dealershipId) {
        return res.status(403).json({ error: 'Session does not belong to this dealership' })
      }
      if (session.status !== 'complete') {
        return res.status(400).json({ error: 'Session not complete', status: session.status })
      }
      const updates = colsForAddon(addonKey, true)
      if (session.customer) updates.stripe_customer_id = session.customer
      await supabaseAdmin.from('dealerships').update(updates).eq('id', req.dealershipId)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  // ── Add-on subscription endpoints ─────────────────────────────────────────
  app.post('/billing/subscribe-ai-boost',    requireAuth, requireMfa, requireBillingManage, blockDemoStripeAction, (req, res) => createAddonCheckout(req, res, 'ai_boost'))
  app.post('/billing/subscribe-ai-chatbot',  requireAuth, requireMfa, requireBillingManage, blockDemoStripeAction, (req, res) => createAddonCheckout(req, res, 'ai_chatbot'))
  app.post('/billing/subscribe-inv-intel',   requireAuth, requireMfa, requireBillingManage, blockDemoStripeAction, (req, res) => createAddonCheckout(req, res, 'inv_intel'))
  // Retired add-ons — VIN & Brochure (OEM) is now core; AI Vision + generated docs
  // are part of AI Boost. Point any stale clients at AI Boost.
  const retired = (req, res) => res.status(410).json({ error: 'This add-on has moved into AI Boost.', redirect: 'ai_boost' })
  app.post('/billing/subscribe-vin-sticker', requireAuth, retired)
  app.post('/billing/subscribe-ai-vision',   requireAuth, retired)

  // ── Bundled package subscription (Starter / Growth / Pro) ─────────────────
  // Currency follows the dealer's country (US → USD, else CAD); the client may
  // override with { currency }. 30-day free trial, no card required up front.
  async function createPackageCheckout(req, res) {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const pkgKey = String(req.body?.package || '').toLowerCase()
    const pkg = PACKAGES[pkgKey]
    if (!pkg) return res.status(400).json({ error: 'Unknown package' })

    let currency = String(req.body?.currency || '').toUpperCase()
    if (currency !== 'USD' && currency !== 'CAD') {
      const { data: dl } = await supabaseAdmin.from('dealerships').select('country').eq('id', req.dealershipId).maybeSingle()
      currency = String(dl?.country || '').toUpperCase() === 'US' ? 'USD' : 'CAD'
    }
    const priceId = currency === 'USD' ? pkg.priceUsd : pkg.priceCad
    if (!priceId) return res.status(500).json({ error: `Price for ${pkg.label} (${currency}) is not configured` })

    const existingCustomerId = req.profile.dealerships?.stripe_customer_id
    try {
      const sessionParams = {
        payment_method_collection: 'if_required',
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        metadata: { type: 'package', package: pkgKey, currency, dealership_id: req.dealershipId },
        subscription_data: { trial_period_days: 30, metadata: { type: 'package', package: pkgKey, dealership_id: req.dealershipId } },
        success_url: `${FRONTEND_URL}/dashboard.html?package_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${FRONTEND_URL}/dashboard.html`,
      }
      if (existingCustomerId) sessionParams.customer = existingCustomerId
      const session = await stripe.checkout.sessions.create(sessionParams)
      recordCheckoutStart({ sessionId: session.id, dealershipId: req.dealershipId, kind: 'package', planKey: pkgKey, currency })
      res.json({ url: session.url })
    } catch (err) { res.status(500).json({ error: err.message }) }
  }
  app.post('/billing/subscribe-package', requireAuth, requireMfa, requireBillingManage, blockDemoStripeAction, createPackageCheckout)

  // ── Plan subscription (the entitlement-engine flow) ──────────────────────────
  // Start Stripe Checkout for a catalog plan (fb_solo / fb_dealership / os_starter /
  // os_growth / os_pro). Card required, 30-day trial. On completion the webhook resolves
  // the price → plan and provisionPlan grants the bundle (Pro unlocks Facebook + AI).
  // No requireMfa: this is part of onboarding, before a new owner has set up MFA.
  async function createPlanCheckout(req, res) {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const planId = String(req.body?.plan || '')
    const plan = getPlan(planId)
    if (!plan) return res.status(400).json({ error: 'Unknown plan' })
    const canonicalPlanId = plan.id

    let currency = String(req.body?.currency || '').toUpperCase()
    if (currency !== 'USD' && currency !== 'CAD') {
      const { data: dl } = await supabaseAdmin.from('dealerships').select('country').eq('id', req.dealershipId).maybeSingle()
      currency = String(dl?.country || '').toUpperCase() === 'US' ? 'USD' : 'CAD'
    }
    const priceId = stripePriceForPlan(canonicalPlanId, currency, process.env)
    if (!priceId) return res.status(500).json({ error: `Price for ${plan.label} (${currency}) is not configured yet` })

    const existingCustomerId = req.profile.dealerships?.stripe_customer_id
    try {
      // Charge immediately (no Stripe trial): the 39-day free trial is granted at sign-up
      // with no card, so by the time someone reaches Checkout they're subscribing to pay.
      const successUrl = (canonicalPlanId === 'ai-chatbot')
        ? `${FRONTEND_URL}/dashboard.html?page=website&tab=setup&section=ai-chatbot&plan_session={CHECKOUT_SESSION_ID}`
        : (canonicalPlanId === 'marketsync-seo' || canonicalPlanId === 'marketsync_seo')
        ? `${FRONTEND_URL}/dashboard.html?page=website&tab=seo&section=overview&plan_session={CHECKOUT_SESSION_ID}`
        : `${FRONTEND_URL}/dashboard.html?plan_session={CHECKOUT_SESSION_ID}`
      const cancelUrl = (canonicalPlanId === 'ai-chatbot')
        ? `${FRONTEND_URL}/dashboard.html?page=website&tab=setup&section=ai-chatbot`
        : (canonicalPlanId === 'marketsync-seo' || canonicalPlanId === 'marketsync_seo')
        ? `${FRONTEND_URL}/dashboard.html?page=website&tab=seo`
        : `${FRONTEND_URL}/dashboard.html`

      const params = {
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        metadata: { type: 'plan', plan: canonicalPlanId, currency, dealership_id: req.dealershipId },
        subscription_data: { metadata: { type: 'plan', plan: canonicalPlanId, dealership_id: req.dealershipId } },
        success_url: successUrl,
        cancel_url: cancelUrl,
      }
      if (existingCustomerId) params.customer = existingCustomerId
      const session = await stripe.checkout.sessions.create(params)
      recordCheckoutStart({ sessionId: session.id, dealershipId: req.dealershipId, kind: 'plan', planKey: canonicalPlanId, currency })
      res.json({ url: session.url })
    } catch (err) { res.status(500).json({ error: err.message }) }
  }
  app.post('/billing/subscribe-plan', requireAuth, requireBillingManage, blockDemoStripeAction, createPlanCheckout)

  async function verifyPlanSession(req, res) {
    const { session_id } = req.query
    if (!session_id) return res.status(400).json({ error: 'session_id required' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      const meta = session.metadata || {}
      if (meta.dealership_id !== req.dealershipId) {
        return res.status(403).json({ error: 'Session does not belong to this dealership' })
      }
      if (session.status !== 'complete') {
        return res.status(400).json({ error: 'Session not complete', status: session.status })
      }
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription)
        await syncSubscriptionFromStripe(req.dealershipId, sub, { preserveExisting: true })
      }
      res.json({ success: true, plan: meta.plan || null })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
  app.get('/billing/verify-plan-session', requireAuth, verifyPlanSession)

  // The plan catalog for the in-app "upgrade to unlock" UI. Reads plan-catalog.js (the
  // single source), annotates each plan with the caller's current active plan(s) and
  // whether its Stripe price is configured, so the modal can show real upgrade paths.
  app.get('/billing/plans', requireAuth, async (req, res) => {
    let current = []
    if (req.dealershipId) {
      const { data } = await supabaseAdmin
        .from('subscriptions').select('plan_id, status')
        .eq('dealership_id', req.dealershipId).in('status', ['trialing', 'active'])
      current = [...new Set((data || []).map(r => r.plan_id).filter(Boolean))]
    }
    const plans = PLAN_IDS.map(id => {
      const p = PLAN_CATALOG[id]
      return {
        id, label: p.label, monthly: p.monthly, tier: p.tier,
        product_primary: p.product_primary, products: p.products, org_type: p.org_type,
        feature_count: p.features.length,
        configured: !!(stripePriceForPlan(id, 'usd', process.env) || stripePriceForPlan(id, 'cad', process.env)),
        // Grandfathered plans kept only so existing subscribers keep their exact
        // entitlements — never offered as a new purchase option. The frontend still
        // shows one if the account is currently on it (current includes its id).
        legacyPlan: !!p.legacyPlan,
      }
    })
    res.json({ current, plans })
  })

  app.get('/billing/package-verify', requireAuth, requireMfa, requireBillingManage, async (req, res) => {
    const { session_id } = req.query
    if (!session_id) return res.status(400).json({ error: 'session_id required' })
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      const meta = session.metadata || {}
      if (meta.type !== 'package' || meta.dealership_id !== req.dealershipId) {
        return res.status(403).json({ error: 'Session does not belong to this dealership' })
      }
      if (session.status !== 'complete') return res.status(400).json({ error: 'Session not complete', status: session.status })
      const updates = colsForPackage(meta.package, true)
      if (session.customer) updates.stripe_customer_id = session.customer
      await supabaseAdmin.from('dealerships').update(updates).eq('id', req.dealershipId)
      res.json({ success: true, plan: meta.package })
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // Public pricing for the marketing page. Currency from ?currency=, else a geo
  // header (CDN/proxy), else CAD. Amounts are the same headline number per currency.
  app.get('/billing/packages', (req, res) => {
    let currency = String(req.query.currency || '').toUpperCase()
    if (currency !== 'USD' && currency !== 'CAD') {
      const country = String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-geo-country'] || '').toUpperCase()
      currency = country === 'US' ? 'USD' : 'CAD'
    }
    const symbol = '$'
    const rows = Object.entries(PACKAGES).map(([key, p]) => ({
      key, label: p.label, amount: p.amount, currency, symbol,
      configured: !!(currency === 'USD' ? p.priceUsd : p.priceCad),
    }))
    res.json({ currency, packages: rows })
  })

  // Each verify hits Stripe. The caller is already authenticated, MFA'd and permissioned, so
  // this is a cost guard rather than an access control — a stuck client retrying should not
  // hammer a third party on our account. (Phase 6S)
  const verifyLimit = rateLimit('billing-verify', 60, 15 * 60 * 1000, { dealership: true })
  app.get('/billing/ai-boost-verify',    requireAuth, requireMfa, requireBillingManage, verifyLimit, (req, res) => verifyAddonSession(req, res, 'ai_boost'))
  app.get('/billing/ai-chatbot-verify',  requireAuth, requireMfa, requireBillingManage, verifyLimit, (req, res) => verifyAddonSession(req, res, 'ai_chatbot'))
  app.get('/billing/vin-sticker-verify', requireAuth, requireMfa, requireBillingManage, verifyLimit, (req, res) => verifyAddonSession(req, res, 'vin_sticker'))
  app.get('/billing/inv-intel-verify',   requireAuth, requireMfa, requireBillingManage, verifyLimit, (req, res) => verifyAddonSession(req, res, 'inv_intel'))
  app.get('/billing/ai-vision-verify',   requireAuth, requireMfa, requireBillingManage, verifyLimit, (req, res) => verifyAddonSession(req, res, 'ai_vision'))

  // ── Customer Portal ────────────────────────────────────────────────────────
  app.post('/billing/portal', requireAuth, requireMfa, requireBillingManage, blockDemoStripeAction, async (req, res) => {
    const customerId = req.profile.dealerships?.stripe_customer_id || req.profile.stripe_customer_id
    if (!customerId) return res.status(400).json({ error: 'No billing account found' })

    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${FRONTEND_URL}/dashboard.html`,
      })
      res.json({ url: portal.url })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Main checkout (base platform plan) ────────────────────────────────────
  app.post('/billing/checkout', requireAuth, requireMfa, requireBillingManage, blockDemoStripeAction, async (req, res) => {
    const isPersonal = req.profile.dealerships?.is_personal === true
    const isSolo = !req.dealershipId || isPersonal

    const existingCustomerId = isSolo
      ? req.profile.stripe_customer_id
      : req.profile.dealerships?.stripe_customer_id

    const billingStatus = isSolo
      ? req.profile.billing_status
      : req.profile.dealerships?.billing_status

    if (!existingCustomerId && billingStatus !== 'TRIALING') {
      return res.status(200).json({ complimentary: true })
    }

    // Existing customer → open billing portal
    if (existingCustomerId) {
      try {
        const portal = await stripe.billingPortal.sessions.create({
          customer: existingCustomerId,
          return_url: `${FRONTEND_URL}/dashboard.html`,
        })
        return res.json({ url: portal.url })
      } catch {}
    }

    const priceId = req.body?.priceId || (isSolo
      ? process.env.STRIPE_SOLO_PRICE_ID
      : process.env.STRIPE_DEALER_PRICE_ID)
    if (!priceId) return res.status(500).json({ error: 'Missing Stripe price ID' })

    const metadata = isSolo
      ? { type: 'solo_rep', user_id: req.user.id }
      : { type: 'dealership', dealership_id: req.dealershipId }

    try {
      const session = await stripe.checkout.sessions.create({
        // Omit payment_method_types — dynamic payment methods
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        client_reference_id: isSolo ? req.user.id : req.dealershipId,
        metadata,
        subscription_data: { metadata },
        success_url: `${FRONTEND_URL}/dashboard.html`,
        cancel_url:  `${FRONTEND_URL}/dashboard.html`,
      })
      res.json({ url: session.url })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Trial status ───────────────────────────────────────────────────────────
  app.get('/billing/trial-status', requireAuth, async (req, res) => {
    const isPersonal = req.profile.dealerships?.is_personal === true
    const useProfileBilling = !req.profile.dealership_id || isPersonal
    const status = useProfileBilling
      ? req.profile.billing_status
      : req.profile.dealerships?.billing_status
    const trialEndsAt = useProfileBilling
      ? req.profile.trial_ends_at
      : req.profile.dealerships?.trial_ends_at

    let daysRemaining = null
    if (status === 'TRIALING' && trialEndsAt) {
      const ms = new Date(trialEndsAt).getTime() - Date.now()
      daysRemaining = Math.max(0, Math.ceil(ms / 86400000))
    }

    res.json({
      status: status || null,
      trial_ends_at: trialEndsAt || null,
      days_remaining: daysRemaining,
      is_active:   status === 'ACTIVE',
      is_trialing: status === 'TRIALING' && daysRemaining !== null && daysRemaining > 0,
    })
  })

  // ── Cron: trial expiry warnings ────────────────────────────────────────────
  // Hit daily by Render Cron (or any scheduler). Sends warning emails to any
  // dealership whose trial ends within the next 24 hours.
  app.post('/cron/trial-expiry', async (req, res) => {
    if (!requestHasCronSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 3600000).toISOString()

    // Find Stripe subscriptions in trial ending within 24h
    // We scan Supabase dealerships with ai_boost_active or vin_sticker_active
    // and check their Stripe subscription trial_end
    const { data: dealers } = await supabaseAdmin
      .from('dealerships')
      .select('id, name, ai_manager_email, stripe_customer_id')
      .not('stripe_customer_id', 'is', null)
      .not('ai_manager_email', 'is', null)

    let warned = 0
    for (const dealer of dealers || []) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: dealer.stripe_customer_id,
          status: 'trialing',
          limit: 10,
        })
        for (const sub of subs.data) {
          const trialEnd = sub.trial_end * 1000
          if (trialEnd > now.getTime() && trialEnd <= now.getTime() + 24 * 3600000) {
            const addons = addonsInSub(sub)
            if (addons.length) {
              await sendTrialExpiring({ to: dealer.ai_manager_email, dealerName: dealer.name, addons }).catch(() => {})
              warned++
            }
          }
        }
      } catch {}
    }

    res.json({ warned })
  })
}
