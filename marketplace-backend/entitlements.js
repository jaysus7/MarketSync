// Provisioning helpers for the access model — the ONE place registration, invitations,
// and (Phase 6) Stripe webhooks create/adjust subscriptions and product memberships.
// Pure helpers (defaultTrialPlan) are unit-tested; IO helpers use the server-only client.

import { supabaseAdmin } from './shared.js'
import { PRODUCTS, ACCOUNT_TYPES, defaultTrialPlan, mapStripeStatus } from './entitlements-policy.js'
import { PLAN_CATALOG, getPlan, planForStripePrice as planIdForStripePrice, productsForPlan } from './plan-catalog.js'

export { PRODUCTS, ACCOUNT_TYPES, defaultTrialPlan, mapStripeStatus }
export { PLAN_CATALOG, getPlan } from './plan-catalog.js'

// Validate a caller-supplied plan id against the catalog (never trust the client).
export function resolvePlanId(planId) {
  if (!getPlan(planId)) throw new Error(`Unknown plan: ${planId}`)
  return planId
}

// Reconcile the overall account billing status from the union of all subscriptions.
// If any subscription is active or in a valid trial, the account remains viable (ACTIVE/TRIALING).
// If no active subscriptions exist but at least one is past_due, the account is PAST_DUE.
// Only when all subscriptions are cancelled/expired does the account gate become INACTIVE.
export async function reconcileDealershipBillingStatus(dealershipId) {
  if (!dealershipId) return 'INACTIVE'
  const { data: subs, error } = await supabaseAdmin
    .from('subscriptions')
    .select('product_id, plan_id, status, trial_ends_at, current_period_end')
    .eq('dealership_id', dealershipId)

  if (error) {
    console.error('[entitlements] failed to fetch subscriptions for reconciliation:', error)
    return 'INACTIVE'
  }

  const now = Date.now()
  let hasActive = false
  let hasValidTrial = false
  let hasPastDue = false

  for (const s of (subs || [])) {
    if (s.status === 'active') {
      hasActive = true
    } else if (s.status === 'trialing') {
      const trialExpired = s.trial_ends_at && new Date(s.trial_ends_at).getTime() < now
      if (!trialExpired) hasValidTrial = true
    } else if (s.status === 'past_due') {
      hasPastDue = true
    }
  }

  let reconciled = 'INACTIVE'
  if (hasActive) {
    reconciled = 'ACTIVE'
  } else if (hasValidTrial) {
    reconciled = 'TRIALING'
  } else if (hasPastDue) {
    reconciled = 'PAST_DUE'
  } else {
    reconciled = 'INACTIVE'
  }

  await supabaseAdmin.from('dealerships').update({ billing_status: reconciled }).eq('id', dealershipId)

  const { data: dealer } = await supabaseAdmin
    .from('dealerships')
    .select('is_personal')
    .eq('id', dealershipId)
    .maybeSingle()

  if (dealer?.is_personal) {
    await supabaseAdmin.from('profiles').update({ billing_status: reconciled }).eq('dealership_id', dealershipId)
  }

  return reconciled
}

// ── THE ENTITLEMENT ENGINE ───────────────────────────────────────────────────
// Grant a plan to an organization. This turns "active plan" into access:
// it expands the plan into its products (the bundle), writes one subscription row
// per product, preserves other products for multi-subscription accounts, merges legacy flags,
// and reconciles the global billing status.
export async function provisionPlan({ dealershipId, planId, status = 'trialing', trialEndsAt = null, stripe = null, preserveExisting = true }) {
  const plan = getPlan(planId)
  if (!dealershipId || !plan) throw new Error(`provisionPlan: bad args (dealership=${dealershipId}, plan=${planId})`)
  const products = plan.products
  const now = new Date().toISOString()

  // One subscription row per product the plan grants.
  const rows = products.map(product => ({
    dealership_id: dealershipId, product_id: product, plan_id: planId,
    status, trial_ends_at: trialEndsAt, updated_at: now, ...(stripe || {}),
  }))
  const { error: upErr } = await supabaseAdmin
    .from('subscriptions').upsert(rows, { onConflict: 'dealership_id,product_id' })
  if (upErr) throw upErr

  // Prune products this plan no longer covers only when preserveExisting is explicitly false.
  if (preserveExisting === false) {
    const { error: delErr } = await supabaseAdmin
      .from('subscriptions').delete().eq('dealership_id', dealershipId).not('product_id', 'in', `(${products.join(',')})`)
    if (delErr) throw delErr
  }

  // Fetch current dealership to merge legacy compatibility flags without clobbering other products.
  const { data: currentDealer } = await supabaseAdmin
    .from('dealerships')
    .select('products, ai_chatbot_active, ai_chatbot_paid, inv_intel_active, inv_intel_paid, ai_boost_active, ai_boost_paid, seo_active, vin_sticker_active, ai_vision_active, fb_only, plan, account_type')
    .eq('id', dealershipId)
    .maybeSingle()

  const currentProducts = (currentDealer?.products && typeof currentDealer.products === 'object') ? { ...currentDealer.products } : {}
  const dealerUpdate = { account_type: plan.org_type }
  if (trialEndsAt !== null) dealerUpdate.trial_ends_at = trialEndsAt

  const isLive = status === 'active' || status === 'trialing'

  if (isLive) {
    for (const p of products) {
      currentProducts[p] = true
    }
    if (plan.legacy?.products) {
      Object.assign(currentProducts, plan.legacy.products)
    }
    dealerUpdate.products = currentProducts

    if (plan.legacy) {
      if (plan.legacy.plan !== undefined && (plan.legacy.plan || !currentDealer?.plan)) {
        dealerUpdate.plan = plan.legacy.plan
      }
      if (plan.legacy.ai_chatbot_active !== undefined) {
        dealerUpdate.ai_chatbot_active = plan.legacy.ai_chatbot_active
        dealerUpdate.ai_chatbot_paid = plan.legacy.ai_chatbot_paid ?? plan.legacy.ai_chatbot_active
      }
      if (plan.legacy.ai_boost_active !== undefined) {
        dealerUpdate.ai_boost_active = plan.legacy.ai_boost_active
        dealerUpdate.ai_boost_paid = plan.legacy.ai_boost_paid ?? plan.legacy.ai_boost_active
      }
      if (plan.legacy.inv_intel_active !== undefined) {
        dealerUpdate.inv_intel_active = plan.legacy.inv_intel_active
        dealerUpdate.inv_intel_paid = plan.legacy.inv_intel_paid ?? plan.legacy.inv_intel_active
      }
      if (plan.legacy.vin_sticker_active !== undefined) dealerUpdate.vin_sticker_active = plan.legacy.vin_sticker_active
      if (plan.legacy.ai_vision_active !== undefined) dealerUpdate.ai_vision_active = plan.legacy.ai_vision_active
      if (plan.legacy.fb_only !== undefined && !currentDealer?.products?.dealer_os) dealerUpdate.fb_only = plan.legacy.fb_only
    }
    if (products.includes('marketsync_seo')) {
      dealerUpdate.seo_active = true
    }
  } else {
    for (const p of products) {
      currentProducts[p] = false
    }
    if (plan.legacy?.products) {
      for (const k of Object.keys(plan.legacy.products)) {
        currentProducts[k] = false
      }
    }
    dealerUpdate.products = currentProducts

    if (products.includes('marketsync_seo')) {
      dealerUpdate.seo_active = false
    }
    if (products.includes('ai_dealer') && planId === 'ai-chatbot') {
      dealerUpdate.ai_chatbot_active = false
      dealerUpdate.ai_chatbot_paid = false
    }
  }

  const { error: dErr } = await supabaseAdmin.from('dealerships').update(dealerUpdate).eq('id', dealershipId)
  if (dErr) throw dErr

  // Reconcile global billing status from all subscription rows
  await reconcileDealershipBillingStatus(dealershipId)
}
// Subscription status → the legacy billing_status the middleware gate reads.
const SUB_STATUS_TO_BILLING = Object.freeze({
  trialing: 'TRIALING', active: 'ACTIVE', past_due: 'PAST_DUE', cancelled: 'INACTIVE', expired: 'INACTIVE',
})

// Fully deactivate an org's plan (Stripe cancellation): mark every subscription row
// cancelled (access-policy grants only trialing/active) and clear the legacy paid flags.
export async function cancelAllSubscriptions(dealershipId) {
  if (!dealershipId) return
  await supabaseAdmin.from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('dealership_id', dealershipId)
  await supabaseAdmin.from('dealerships').update({
    plan: null, ai_boost_active: false, ai_boost_paid: false,
    inv_intel_active: false, inv_intel_paid: false, ai_chatbot_active: false, ai_chatbot_paid: false,
    seo_active: false, billing_status: 'INACTIVE',
  }).eq('id', dealershipId)
}

// Confine a member to a specific product within the org (idempotent). Only call this for
// members who should NOT see every org product — e.g. a rep hired for Facebook only.
export async function grantProductMembership(userId, dealershipId, product) {
  if (!PRODUCTS.includes(product)) throw new Error(`Unknown product: ${product}`)
  const { error } = await supabaseAdmin
    .from('product_memberships')
    .upsert({ user_id: userId, dealership_id: dealershipId, product_id: product }, { onConflict: 'user_id,dealership_id,product_id' })
  if (error) throw error
}

// ── Stripe → plan mapping (server-side; never trust the client for the plan) ──
// mapStripeStatus lives in entitlements-policy.js (pure/testable) and is re-exported above.
// Which catalog plan a Stripe price id corresponds to (env-based, single source in
// plan-catalog.js). Returns a plan id or null.
export function planForStripePrice(priceId) {
  return planIdForStripePrice(priceId, process.env)
}

// Reconcile the entitlement state from a Stripe subscription object: resolve its price to
// the internal plan, then grant that plan (expand→products, prune, dual-write legacy). One
// Stripe subscription = one plan. Prices not in the catalog are ignored here (legacy
// à-la-carte add-ons keep their own dealership-flag webhook path).
export async function syncSubscriptionFromStripe(dealershipId, stripeSub, { preserveExisting = true } = {}) {
  if (!dealershipId || !stripeSub) return
  const isCanceled = stripeSub.status === 'canceled'
  // If cancel_at_period_end is true but status is still active/trialing, preserve active access until period end.
  const status = isCanceled ? 'cancelled' : mapStripeStatus(stripeSub.status)
  const trialEndsAt = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null
  const stripe = {
    stripe_subscription_id: stripeSub.id || null,
    stripe_customer_id: stripeSub.customer || null,
    current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
  }
  // Find the line item whose price maps to a plan.
  let planId = null
  for (const item of (stripeSub.items?.data || [])) {
    const p = planForStripePrice(item.price?.id)
    if (p) { planId = p; break }
  }
  if (!planId) return
  await provisionPlan({ dealershipId, planId, status, trialEndsAt, stripe, preserveExisting })
}

// Apply per-member permission overrides (grant/deny) on top of their RBAC role. Validates
// the effect; the permission_id FK is enforced by the DB. Replaces the member's overrides
// for the given permissions.
export async function setPermissionOverrides(userId, dealershipId, overrides = [], createdBy = null) {
  const rows = (overrides || [])
    .filter(o => o && o.permission_id && (o.effect === 'grant' || o.effect === 'deny'))
    .map(o => ({ user_id: userId, dealership_id: dealershipId, permission_id: o.permission_id, effect: o.effect, created_by: createdBy }))
  if (!rows.length) return
  const { error } = await supabaseAdmin
    .from('member_permission_overrides')
    .upsert(rows, { onConflict: 'user_id,dealership_id,permission_id' })
  if (error) throw error
}
