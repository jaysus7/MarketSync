// Pure entitlement policy — no IO, safe to import from tests. entitlements.js re-exports
// these alongside its DB-backed provisioning helpers.

export const PRODUCTS = Object.freeze([
  'facebook',
  'ai_dealer',
  'dealer_os',
  'design_studio',
  'marketsync_social',
  'marketsync_video',
  'marketsync_email',
  'marketsync_website',
  'marketsync_seo',
  'marketsync_identity',
])
export const ACCOUNT_TYPES = Object.freeze(['solo', 'dealership'])

// The default plan a fresh product trial provisions. Dealer OS trials at the fullest
// tier so the trial experience matches today's "everything unlocked" onboarding; the
// point products trial on their natural tier (dealership vs solo for Facebook).
export function defaultTrialPlan(product, accountType) {
  if (product === 'facebook') return accountType === 'dealership' ? 'fb_dealership' : 'fb_solo'
  if (product === 'ai_dealer') return 'ai_standard'
  return 'os_enterprise' // dealer_os
}

// Map a Stripe subscription status onto our subscriptions.status enum.
const STRIPE_STATUS_MAP = Object.freeze({
  trialing: 'trialing', active: 'active', past_due: 'past_due', unpaid: 'past_due',
  canceled: 'cancelled', incomplete: 'past_due', incomplete_expired: 'expired', paused: 'past_due',
})
export function mapStripeStatus(status) { return STRIPE_STATUS_MAP[status] || 'past_due' }
