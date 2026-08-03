// ─────────────────────────────────────────────────────────────────────────────
// THE SINGLE SOURCE OF TRUTH FOR ENTITLEMENTS.
//
// Every plan is defined here ONCE: which products it grants, which features it
// unlocks, its price (per currency, via Stripe Price env vars), the owner role, and
// the organization type. Nothing else in the codebase may hardcode "what this plan
// can do" — the webhook resolves a Stripe Price ID to a plan here, and the
// entitlement engine grants exactly what the plan declares.
//
// Access is determined by the ACTIVE SUBSCRIPTION's plan — never by what the user
// picked at registration. Registration creates the account; the plan (via Stripe)
// grants access. Upgrades/downgrades re-run this mapping, so Pro automatically
// unlocks Facebook + AI Dealer and a downgrade revokes them.
//
// Pure module (no IO) so it can be imported by tests and by the DB seed alike.
// ─────────────────────────────────────────────────────────────────────────────

// Feature ids per product (mirror of the seeded `features` catalog).
export const FEATURES_BY_PRODUCT = Object.freeze({
  facebook: ['fb.inventory', 'fb.leaderboard', 'fb.sales_reps'],
  ai_dealer: ['ai.overview', 'ai.conversations', 'ai.agents', 'ai.knowledge', 'ai.settings'],
  dealer_os: [
    'os.dashboard', 'os.crm', 'os.inventory', 'os.sales', 'os.accounting', 'os.service',
    'os.marketing', 'os.website', 'os.reports', 'os.automations', 'os.integrations',
    'os.team', 'os.settings',
  ],
})

const OS = FEATURES_BY_PRODUCT.dealer_os
// Dealer OS tier feature sets (each higher tier is a superset of the one below).
const OS_STARTER = ['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.team', 'os.settings']
const OS_GROWTH = [...new Set([...OS_STARTER,
  'os.sales', 'os.accounting', 'os.marketing', 'os.website', 'os.automations', 'os.integrations'])]
const OS_PRO = [...OS] // every Dealer OS feature, including service

// Legacy dealership flags a plan should set (the existing app still reads these).
// Kept in sync so the transition to the entitlement engine never regresses behavior.
// ai_boost / inv_intel cascade to Vision / VIN / appraisal per the existing billing code.
function legacyFlags({ plan = null, ai = false, invIntel = false, fbOnly = false } = {}) {
  return {
    plan,
    ai_boost_active: ai, ai_boost_paid: ai,
    inv_intel_active: invIntel, inv_intel_paid: invIntel,
    vin_sticker_active: ai, ai_vision_active: ai,
    ai_chatbot_active: false, ai_chatbot_paid: false,
    fb_only: fbOnly,
  }
}

// ── The catalog ──────────────────────────────────────────────────────────────
export const PLAN_CATALOG = Object.freeze({
  fb_solo: {
    id: 'fb_solo', label: 'Facebook Solo', product_primary: 'facebook',
    products: ['facebook'], org_type: 'solo', owner_role: 'OWNER',
    monthly: 79, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_FB_SOLO_CAD', priceEnvUsd: 'STRIPE_PRICE_FB_SOLO_USD',
    features: ['fb.inventory', 'fb.leaderboard'],
    legacy: { ...legacyFlags({ fbOnly: true }), products: { facebook_solo: true } },
  },
  fb_dealership: {
    id: 'fb_dealership', label: 'Facebook Dealer', product_primary: 'facebook',
    products: ['facebook'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 499, tier: 1,
    priceEnvCad: 'STRIPE_PRICE_FB_DEALER_CAD', priceEnvUsd: 'STRIPE_PRICE_FB_DEALER_USD',
    features: ['fb.inventory', 'fb.sales_reps', 'fb.leaderboard'],
    legacy: { ...legacyFlags({ fbOnly: true }), products: { facebook_dealer: true } },
  },
  ai_standard: {
    id: 'ai_standard', label: 'AI Dealer', product_primary: 'ai_dealer',
    products: ['ai_dealer'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 499, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_AI_STANDARD_CAD', priceEnvUsd: 'STRIPE_PRICE_AI_STANDARD_USD',
    features: [...FEATURES_BY_PRODUCT.ai_dealer],
    legacy: { ...legacyFlags({}), ai_chatbot_active: true, ai_chatbot_paid: true, products: { ai_chatbot: true } },
  },
  os_starter: {
    id: 'os_starter', label: 'Dealer OS Starter', product_primary: 'dealer_os',
    products: ['dealer_os'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 999, tier: 0,
    // Reuse the existing Stripe package price env vars for the Dealer OS tiers.
    priceEnvCad: 'STRIPE_PKG_STARTER_CAD', priceEnvUsd: 'STRIPE_PKG_STARTER_USD',
    features: OS_STARTER,
    legacy: { ...legacyFlags({ plan: 'starter', ai: false, invIntel: false }), products: { dealer_os: true } },
  },
  os_growth: {
    id: 'os_growth', label: 'Dealer OS Growth', product_primary: 'dealer_os',
    products: ['dealer_os'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 1799, tier: 1,
    priceEnvCad: 'STRIPE_PKG_GROWTH_CAD', priceEnvUsd: 'STRIPE_PKG_GROWTH_USD',
    features: OS_GROWTH,
    legacy: { ...legacyFlags({ plan: 'growth', ai: true, invIntel: true }), products: { dealer_os: true } },
  },
  os_pro: {
    id: 'os_pro', label: 'Dealer OS Pro', product_primary: 'dealer_os',
    // THE BUNDLE: Pro grants all three products. No separate Facebook/AI subscription.
    products: ['dealer_os', 'facebook', 'ai_dealer'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 2499, tier: 2,
    priceEnvCad: 'STRIPE_PKG_PRO_CAD', priceEnvUsd: 'STRIPE_PKG_PRO_USD',
    features: [...new Set([...OS_PRO, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.ai_dealer])],
    legacy: {
      ...legacyFlags({ plan: 'pro', ai: true, invIntel: true }),
      ai_chatbot_active: true, ai_chatbot_paid: true,
      products: { dealer_os: true, facebook_dealer: true, ai_chatbot: true },
    },
  },
})

export const PLAN_IDS = Object.freeze(Object.keys(PLAN_CATALOG))

export function getPlan(planId) { return PLAN_CATALOG[planId] || null }

// Resolve a Stripe Price ID → plan id, using the env vars declared in the catalog.
// This is the ONLY place a price maps to a plan. env is passed in (process.env) so the
// function stays pure/testable.
export function planForStripePrice(priceId, env = {}) {
  if (!priceId) return null
  for (const plan of Object.values(PLAN_CATALOG)) {
    if (priceId === env[plan.priceEnvCad] || priceId === env[plan.priceEnvUsd]) return plan.id
  }
  return null
}

// The Stripe Price ID to charge for a plan in a given currency (falls back to the
// other currency if only one is configured).
export function stripePriceForPlan(planId, currency = 'usd', env = {}) {
  const plan = PLAN_CATALOG[planId]
  if (!plan) return null
  const cad = env[plan.priceEnvCad] || ''
  const usd = env[plan.priceEnvUsd] || ''
  return (String(currency).toLowerCase() === 'cad' ? cad : usd) || usd || cad || null
}

// The products a plan grants (the bundle expansion). Access is the union of these
// across all of an org's active plans.
export function productsForPlan(planId) { return PLAN_CATALOG[planId]?.products || [] }

// The features a plan grants.
export function featuresForPlan(planId) { return PLAN_CATALOG[planId]?.features || [] }
