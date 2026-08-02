// Provisioning helpers for the access model — the ONE place registration, invitations,
// and (Phase 6) Stripe webhooks create/adjust subscriptions and product memberships.
// Pure helpers (defaultTrialPlan) are unit-tested; IO helpers use the server-only client.

import { supabaseAdmin } from './shared.js'
import { PRODUCTS, ACCOUNT_TYPES, defaultTrialPlan } from './entitlements-policy.js'

export { PRODUCTS, ACCOUNT_TYPES, defaultTrialPlan }

// Validate a product + optional caller-chosen plan against the catalog. Falls back to the
// trial default when no plan is given. Throws if the product is unknown or the plan does
// not belong to it (never trust a client-supplied plan id).
export async function resolvePlan(product, plan, accountType) {
  if (!PRODUCTS.includes(product)) throw new Error(`Unknown product: ${product}`)
  const planId = plan || defaultTrialPlan(product, accountType)
  const { data, error } = await supabaseAdmin
    .from('plans').select('id, product_id').eq('id', planId).maybeSingle()
  if (error) throw error
  if (!data || data.product_id !== product) throw new Error(`Plan ${planId} does not belong to product ${product}`)
  return { product, planId }
}

// Create/refresh the ORG's subscription for a product (idempotent on dealership+product).
// Note: the account OWNER never gets a product_membership row — an empty membership set
// means "all org products", which is what an owner/admin should see. Membership rows are
// only for members intentionally confined to a subset (see grantProductMembership).
export async function provisionSubscription({ dealershipId, product, planId, status = 'trialing', trialEndsAt = null, stripe = null }) {
  const row = {
    dealership_id: dealershipId,
    product_id: product,
    plan_id: planId,
    status,
    trial_ends_at: trialEndsAt,
    updated_at: new Date().toISOString(),
    ...(stripe || {}),
  }
  const { error } = await supabaseAdmin
    .from('subscriptions').upsert(row, { onConflict: 'dealership_id,product_id' })
  if (error) throw error
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
