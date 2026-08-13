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

// ── THE ENTITLEMENT ENGINE ───────────────────────────────────────────────────
// Grant a plan to an organization. This is the ONE function that turns "active plan" into
// access: it expands the plan into its products (the bundle), writes one subscription row
// per product, PRUNES any product no longer covered (so a downgrade revokes it), and
// dual-writes the legacy dealership flags the existing app still reads. Access = the union
// of the org's active-subscription products; features come from the plan's plan_features.
export async function provisionPlan({ dealershipId, planId, status = 'trialing', trialEndsAt = null, stripe = null }) {
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

  // Prune products this plan no longer covers (downgrade revokes them automatically).
  const { error: delErr } = await supabaseAdmin
    .from('subscriptions').delete().eq('dealership_id', dealershipId).not('product_id', 'in', `(${products.join(',')})`)
  if (delErr) throw delErr

  // Keep the legacy dealership flags + account_type + billing gate in sync so the
  // middleware (requireAuth) reflects the plan: trialing→TRIALING (with trial_ends_at),
  // active→ACTIVE, past_due→PAST_DUE, cancelled/expired→INACTIVE. This is what makes the
  // paywall appear at trial end and disappear once they pay.
  const billing_status = SUB_STATUS_TO_BILLING[status] || null
  const dealerUpdate = { ...(plan.legacy || {}), account_type: plan.org_type, billing_status }
  if (trialEndsAt !== null) dealerUpdate.trial_ends_at = trialEndsAt
  const { error: dErr } = await supabaseAdmin.from('dealerships').update(dealerUpdate).eq('id', dealershipId)
  if (dErr) throw dErr

  // Personal/solo workspaces are billed on the OWNER's profile (requireAuth uses
  // profile.billing_status when is_personal), so mirror the gate there too.
  const { data: dealer } = await supabaseAdmin.from('dealerships').select('is_personal').eq('id', dealershipId).maybeSingle()
  if (dealer?.is_personal) {
    const profileUpdate = { billing_status }
    if (trialEndsAt !== null) profileUpdate.trial_ends_at = trialEndsAt
    await supabaseAdmin.from('profiles').update(profileUpdate).eq('dealership_id', dealershipId)
  }
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
export async function syncSubscriptionFromStripe(dealershipId, stripeSub) {
  if (!dealershipId || !stripeSub) return
  const status = mapStripeStatus(stripeSub.status)
  const trialEndsAt = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null
  const stripe = {
    stripe_subscription_id: stripeSub.id || null,
    stripe_customer_id: stripeSub.customer || null,
    current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
  }
  // Find the (first) line item whose price maps to a plan.
  let planId = null
  for (const item of (stripeSub.items?.data || [])) {
    const p = planForStripePrice(item.price?.id)
    if (p) { planId = p; break }
  }
  if (!planId) return
  await provisionPlan({ dealershipId, planId, status, trialEndsAt, stripe })
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
