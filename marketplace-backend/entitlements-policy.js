// Pure entitlement policy — no IO, safe to import from tests. entitlements.js re-exports
// these alongside its DB-backed provisioning helpers.

export const PRODUCTS = Object.freeze(['facebook', 'ai_dealer', 'dealer_os'])
export const ACCOUNT_TYPES = Object.freeze(['solo', 'dealership'])

// The plan a fresh 30-day trial provisions per product. Dealer OS trials at the fullest
// tier so the trial experience matches today's "everything unlocked" onboarding; the
// point products trial on their natural tier (dealership vs solo for Facebook).
export function defaultTrialPlan(product, accountType) {
  if (product === 'facebook') return accountType === 'dealership' ? 'fb_dealership' : 'fb_solo'
  if (product === 'ai_dealer') return 'ai_standard'
  return 'os_enterprise' // dealer_os
}
