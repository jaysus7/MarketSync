555555555555555555555555555555555555555555555555555555555555555555555555555// ─────────────────────────────────────────────────────────────────────────────
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
  marketsync_video: ['video.library', 'video.record', 'video.templates', 'video.settings'],
  marketsync_website: ['website.builder', 'website.pages', 'website.domains', 'website.settings'],
  marketsync_social: ['social.scheduler', 'social.accounts', 'social.calendar', 'social.studio'],
  marketsync_email: ['email.campaigns', 'email.templates', 'email.audiences', 'email.automations'],
  marketsync_seo: ['seo.overview', 'seo.audit', 'seo.autofix', 'seo.content', 'seo.competitors', 'seo.local', 'seo.inventory', 'seo.ai_search', 'seo.reports', 'seo.settings'],
  // Sold standalone ($19.99/mo flat) and also bundled into every Marketing Suite /
  // DealerOS tier. Graphic design & creative editor.
  design_studio: ['design.templates', 'design.assets', 'design.canvas', 'design.suggestions'],
  dealer_os: [
    'os.dashboard', 'os.crm', 'os.inventory', 'os.sales', 'os.accounting', 'os.service',
    'os.marketing', 'os.website', 'os.reports', 'os.automations', 'os.email_marketing',
    'os.integrations', 'os.team', 'os.settings',
    'video.library', 'video.record', 'video.templates', 'video.settings',
    'social.scheduler', 'social.accounts', 'social.calendar', 'social.studio',
    'email.campaigns', 'email.templates', 'email.audiences', 'email.automations',
  ],
})

const OS = FEATURES_BY_PRODUCT.dealer_os
// Dealer OS tier feature sets (each higher tier is a superset of the one below).
const OS_STARTER = ['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.team', 'os.settings']
const OS_GROWTH = [...new Set([...OS_STARTER,
  'os.sales', 'os.accounting', 'os.marketing', 'os.website', 'os.automations', 'os.integrations'])]
const OS_PRO = [...OS] // every Dealer OS feature, including service

// Current public DealerOS ladder. Keep this separate from the grandfathered
// Starter/Growth/Pro catalog above: the public Core/Pro/Complete packages have
// different promises and must produce visibly different department navigation.
const CURRENT_CORE_OS = ['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings']
const CURRENT_PRO_OS = [...new Set([...CURRENT_CORE_OS, 'os.sales', 'os.service', 'os.team'])]
const CURRENT_COMPLETE_OS = [...new Set([...CURRENT_PRO_OS,
  'os.accounting', 'os.marketing', 'os.website', 'os.automations',
  'os.email_marketing', 'os.integrations'])]

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
    monthly: 79, tier: 0, legacyPlan: true,
    priceEnvCad: 'STRIPE_PRICE_FB_SOLO_CAD', priceEnvUsd: 'STRIPE_PRICE_FB_SOLO_USD',
    priceEnvCadAliases: ['STRIPE_SOLO_PRICE_ID_CAD', 'STRIPE_SOLO_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_SOLO_PRICE_ID_USD', 'STRIPE_SOLO_PRICE_ID'],
    features: ['fb.inventory', 'fb.leaderboard'],
    legacy: { ...legacyFlags({ fbOnly: true }), products: { facebook_solo: true } },
  },
  fb_dealership: {
    id: 'fb_dealership', label: 'Facebook Dealer', product_primary: 'facebook',
    products: ['facebook'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 499, tier: 1, legacyPlan: true,
    priceEnvCad: 'STRIPE_PRICE_FB_DEALER_CAD', priceEnvUsd: 'STRIPE_PRICE_FB_DEALER_USD',
    priceEnvCadAliases: ['STRIPE_DEALER_PRICE_ID_CAD', 'STRIPE_DEALER_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_DEALER_PRICE_ID_USD', 'STRIPE_DEALER_PRICE_ID'],
    features: ['fb.inventory', 'fb.sales_reps', 'fb.leaderboard'],
    legacy: { ...legacyFlags({ fbOnly: true }), products: { facebook_dealer: true } },
  },
  ai_standard: {
    id: 'ai_standard', label: 'AI Dealer', product_primary: 'ai_dealer',
    products: ['ai_dealer'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 499, tier: 0, legacyPlan: true,
    priceEnvCad: 'STRIPE_PRICE_AI_STANDARD_CAD', priceEnvUsd: 'STRIPE_PRICE_AI_STANDARD_USD',
    priceEnvCadAliases: ['STRIPE_AI_CHATBOT_PRICE_ID_CAD'],
    priceEnvUsdAliases: ['STRIPE_AI_CHATBOT_PRICE_ID_USD'],
    features: [...FEATURES_BY_PRODUCT.ai_dealer],
    legacy: { ...legacyFlags({}), ai_chatbot_active: true, ai_chatbot_paid: true, products: { ai_chatbot: true } },
  },
  marketsync_video: {
    id: 'marketsync_video', label: 'MarketSync Video', product_primary: 'marketsync_video',
    products: ['marketsync_video'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 199, tier: 0, legacyPlan: true,
    priceEnvCad: 'STRIPE_PRICE_MARKETSYNC_VIDEO_CAD', priceEnvUsd: 'STRIPE_PRICE_MARKETSYNC_VIDEO_USD',
    priceEnvCadAliases: ['STRIPE_VIDEO_PRICE_ID_CAD', 'STRIPE_VIDEO_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_VIDEO_PRICE_ID_USD', 'STRIPE_VIDEO_PRICE_ID'],
    features: [...FEATURES_BY_PRODUCT.marketsync_video],
    legacy: { ...legacyFlags({}), products: { marketsync_video: true, video: true } },
  },
  marketsync_website: {
    id: 'marketsync_website', label: 'MarketSync Website', product_primary: 'marketsync_website',
    products: ['marketsync_website'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 299, tier: 0, legacyPlan: true,
    priceEnvCad: 'STRIPE_PRICE_MARKETSYNC_WEBSITE_CAD', priceEnvUsd: 'STRIPE_PRICE_MARKETSYNC_WEBSITE_USD',
    priceEnvCadAliases: ['STRIPE_WEBSITE_PRICE_ID_CAD', 'STRIPE_WEBSITE_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_WEBSITE_PRICE_ID_USD', 'STRIPE_WEBSITE_PRICE_ID'],
    features: [...FEATURES_BY_PRODUCT.marketsync_website],
    legacy: { ...legacyFlags({}), products: { marketsync_website: true, website: true } },
  },
  marketsync_social: {
    id: 'marketsync_social', label: 'MarketSync Social', product_primary: 'marketsync_social',
    products: ['marketsync_social'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 299, tier: 0, legacyPlan: true,
    priceEnvCad: 'STRIPE_PRICE_MARKETSYNC_SOCIAL_CAD', priceEnvUsd: 'STRIPE_PRICE_MARKETSYNC_SOCIAL_USD',
    priceEnvCadAliases: ['STRIPE_SOCIAL_PRICE_ID_CAD', 'STRIPE_SOCIAL_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_SOCIAL_PRICE_ID_USD', 'STRIPE_SOCIAL_PRICE_ID'],
    features: [...FEATURES_BY_PRODUCT.marketsync_social],
    legacy: { ...legacyFlags({}), products: { marketsync_social: true, social: true } },
  },
  marketsync_email: {
    id: 'marketsync_email', label: 'MarketSync Email', product_primary: 'marketsync_email',
    products: ['marketsync_email'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 199, tier: 0, legacyPlan: true,
    priceEnvCad: 'STRIPE_PRICE_MARKETSYNC_EMAIL_CAD', priceEnvUsd: 'STRIPE_PRICE_MARKETSYNC_EMAIL_USD',
    priceEnvCadAliases: ['STRIPE_EMAIL_PRICE_ID_CAD', 'STRIPE_EMAIL_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_EMAIL_PRICE_ID_USD', 'STRIPE_EMAIL_PRICE_ID'],
    features: [...FEATURES_BY_PRODUCT.marketsync_email],
    legacy: { ...legacyFlags({}), products: { marketsync_email: true, email: true } },
  },
  os_starter: {
    id: 'os_starter', label: 'Dealer OS Starter', product_primary: 'dealer_os',
    products: ['dealer_os'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 999, tier: 0, legacyPlan: true,
    priceEnvCad: 'STRIPE_PKG_STARTER_CAD', priceEnvUsd: 'STRIPE_PKG_STARTER_USD',
    features: OS_STARTER,
    legacy: { ...legacyFlags({ plan: 'starter', ai: false, invIntel: false }), products: { dealer_os: true } },
  },
  os_growth: {
    id: 'os_growth', label: 'Dealer OS Growth', product_primary: 'dealer_os',
    products: ['dealer_os'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 1799, tier: 1, legacyPlan: true,
    priceEnvCad: 'STRIPE_PKG_GROWTH_CAD', priceEnvUsd: 'STRIPE_PKG_GROWTH_USD',
    features: OS_GROWTH,
    legacy: { ...legacyFlags({ plan: 'growth', ai: true, invIntel: true }), products: { dealer_os: true } },
  },
  os_pro: {
    id: 'os_pro', label: 'Dealer OS Pro', product_primary: 'dealer_os',
    products: ['dealer_os', 'facebook', 'ai_dealer', 'marketsync_video', 'marketsync_website', 'marketsync_social', 'marketsync_email'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 2499, tier: 2, legacyPlan: true,
    priceEnvCad: 'STRIPE_PKG_PRO_CAD', priceEnvUsd: 'STRIPE_PKG_PRO_USD',
    features: [...new Set([...OS_PRO, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.ai_dealer, ...FEATURES_BY_PRODUCT.marketsync_video, ...FEATURES_BY_PRODUCT.marketsync_website, ...FEATURES_BY_PRODUCT.marketsync_social, ...FEATURES_BY_PRODUCT.marketsync_email])],
    legacy: {
      ...legacyFlags({ plan: 'pro', ai: true, invIntel: true }),
      ai_chatbot_active: true, ai_chatbot_paid: true,
      products: { dealer_os: true, facebook_dealer: true, ai_chatbot: true, marketsync_video: true, marketsync_website: true, marketsync_social: true, marketsync_email: true },
    },
  },

  // ── Current public catalog (marketplace-frontend/js/public-config.js) ────────
  // fb_solo/fb_dealership/ai_standard/marketsync_*/os_starter/os_growth/os_pro above
  // are LEFT UNTOUCHED — real subscriptions on staging currently reference those exact
  // ids (verified against the subscriptions table before adding anything here), and
  // renaming or repricing them would silently break an active subscriber's entitlements.
  //
  // The 15 plans below are additive: their ids match public-config.js's product/suite/
  // dealerOS ids exactly (hyphenated, e.g. 'design-studio'), because /auth/register
  // resolves `?plan=<id>` straight through getPlan(id) — before this, registering from
  // any of the 9 newer pricing-page links (Design Studio, both AutoPoster tiers as
  // currently named, Social Scheduler, the 3 Marketing Suites, MarketSync Digital, the
  // DealerOS Core/Pro/Complete names) failed with "Unknown plan" since no matching
  // catalog entry existed. This also gives the demo system a Product Switcher whose
  // options are the real, currently-sold catalog.
  //
  // Suites/DealerOS tiers bundle their constituent standalone products' features rather
  // than inventing new ones — see each plan's `products`/`features` composition below.
  // service-marketing-suite is the one approximation: its public copy ("service reminder
  // campaigns", "reactivation SMS/email", "survey loops") doesn't yet have dedicated
  // feature ids, so it grants the closest existing capability (marketsync_email) —
  // flagged here for a follow-up if service-specific gating is needed later.
  // Includes the social scheduler (post scheduling, connected accounts, content
  // calendar) and AI generation — a flat, all-in price, not a separate add-on line.
  'design-studio': {
    id: 'design-studio', label: 'Design Studio', product_primary: 'design_studio',
    products: ['design_studio'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 19.99, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_DESIGN_STUDIO_CAD', priceEnvUsd: 'STRIPE_PRICE_DESIGN_STUDIO_USD',
    features: [...FEATURES_BY_PRODUCT.design_studio],
    legacy: { ...legacyFlags({}), products: { design_studio: true } },
  },
  'social-scheduler': {
    id: 'social-scheduler', label: 'Social Scheduler', product_primary: 'marketsync_social',
    products: ['marketsync_social'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 99, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_SOCIAL_SCHEDULER_CAD', priceEnvUsd: 'STRIPE_PRICE_SOCIAL_SCHEDULER_USD',
    priceEnvCadAliases: ['STRIPE_SOCIAL_PRICE_ID_CAD', 'STRIPE_SOCIAL_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_SOCIAL_PRICE_ID_USD', 'STRIPE_SOCIAL_PRICE_ID'],
    features: [...FEATURES_BY_PRODUCT.marketsync_social],
    legacy: { ...legacyFlags({}), products: { marketsync_social: true, social: true } },
  },
  'autoposter-salesperson': {
    id: 'autoposter-salesperson', label: 'Facebook AutoPoster', product_primary: 'facebook',
    products: ['facebook'], org_type: 'solo', owner_role: 'OWNER',
    monthly: 39, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_AUTOPOSTER_SALESPERSON_CAD', priceEnvUsd: 'STRIPE_PRICE_AUTOPOSTER_SALESPERSON_USD',
    features: ['fb.inventory', 'fb.leaderboard'],
    legacy: { ...legacyFlags({ fbOnly: true }), products: { autoposter_salesperson: true, facebook_solo: true } },
  },
  'autoposter-dealer': {
    id: 'autoposter-dealer', label: 'Facebook AutoPoster — Dealer', product_primary: 'facebook',
    products: ['facebook'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 149, tier: 1,
    priceEnvCad: 'STRIPE_PRICE_AUTOPOSTER_DEALER_CAD', priceEnvUsd: 'STRIPE_PRICE_AUTOPOSTER_DEALER_USD',
    features: [...FEATURES_BY_PRODUCT.facebook],
    legacy: { ...legacyFlags({ fbOnly: true }), products: { autoposter_dealer: true, facebook_dealer: true } },
  },
  video: {
    id: 'video', label: 'Video', product_primary: 'marketsync_video',
    products: ['marketsync_video'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 149, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_VIDEO_CAD', priceEnvUsd: 'STRIPE_PRICE_VIDEO_USD',
    features: [...FEATURES_BY_PRODUCT.marketsync_video],
    legacy: { ...legacyFlags({}), products: { marketsync_video: true, video: true } },
  },
  'campaigns-email-sms': {
    id: 'campaigns-email-sms', label: 'Campaigns — Email + SMS', product_primary: 'marketsync_email',
    products: ['marketsync_email'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 199, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_CAMPAIGNS_CAD', priceEnvUsd: 'STRIPE_PRICE_CAMPAIGNS_USD',
    features: [...FEATURES_BY_PRODUCT.marketsync_email],
    legacy: { ...legacyFlags({}), products: { marketsync_email: true, campaigns: true } },
  },
  'dealer-website': {
    id: 'dealer-website', label: 'Dealer Website', product_primary: 'marketsync_website',
    products: ['marketsync_website'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 249, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_DEALER_WEBSITE_CAD', priceEnvUsd: 'STRIPE_PRICE_DEALER_WEBSITE_USD',
    features: [...FEATURES_BY_PRODUCT.marketsync_website],
    legacy: { ...legacyFlags({}), products: { marketsync_website: true, website: true } },
  },
  'marketsync-seo': {
    id: 'marketsync-seo', label: 'MarketSync SEO', product_primary: 'marketsync_seo',
    products: ['marketsync_seo'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 149, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_MARKETSYNC_SEO_CAD', priceEnvUsd: 'STRIPE_PRICE_MARKETSYNC_SEO_USD',
    priceEnvCadAliases: ['STRIPE_SEO_PRICE_ID_CAD', 'STRIPE_SEO_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_SEO_PRICE_ID_USD', 'STRIPE_SEO_PRICE_ID'],
    features: [...FEATURES_BY_PRODUCT.marketsync_seo],
    legacy: { ...legacyFlags({}), products: { marketsync_seo: true, seo: true } },
  },
  marketsync_seo: {
    id: 'marketsync_seo', label: 'MarketSync SEO', product_primary: 'marketsync_seo',
    products: ['marketsync_seo'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 149, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_MARKETSYNC_SEO_CAD', priceEnvUsd: 'STRIPE_PRICE_MARKETSYNC_SEO_USD',
    priceEnvCadAliases: ['STRIPE_SEO_PRICE_ID_CAD', 'STRIPE_SEO_PRICE_ID'],
    priceEnvUsdAliases: ['STRIPE_SEO_PRICE_ID_USD', 'STRIPE_SEO_PRICE_ID'],
    features: [...FEATURES_BY_PRODUCT.marketsync_seo],
    legacy: { ...legacyFlags({}), products: { marketsync_seo: true, seo: true } },
  },
  'ai-chatbot': {
    id: 'ai-chatbot', label: 'AI ChatBot', product_primary: 'ai_dealer',
    products: ['ai_dealer'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 599, tier: 0,
    priceEnvCad: 'STRIPE_PRICE_AI_CHATBOT_V2_CAD', priceEnvUsd: 'STRIPE_PRICE_AI_CHATBOT_V2_USD',
    features: [...FEATURES_BY_PRODUCT.ai_dealer],
    legacy: { ...legacyFlags({}), ai_chatbot_active: true, ai_chatbot_paid: true, products: { ai_chatbot: true } },
  },
  'sales-marketing-suite': {
    id: 'sales-marketing-suite', label: 'Sales Marketing Suite', product_primary: 'marketsync_social',
    products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 399, tier: 1,
    priceEnvCad: 'STRIPE_PRICE_SALES_SUITE_CAD', priceEnvUsd: 'STRIPE_PRICE_SALES_SUITE_USD',
    features: [...new Set([...FEATURES_BY_PRODUCT.design_studio, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.marketsync_social, ...FEATURES_BY_PRODUCT.marketsync_email, ...FEATURES_BY_PRODUCT.marketsync_video])],
    legacy: { ...legacyFlags({}), products: { design_studio: true, facebook_dealer: true, marketsync_social: true, marketsync_email: true, marketsync_video: true, sales_marketing_suite: true } },
  },
  'service-marketing-suite': {
    id: 'service-marketing-suite', label: 'Service Marketing Suite', product_primary: 'marketsync_email',
    products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 399, tier: 1,
    priceEnvCad: 'STRIPE_PRICE_SERVICE_SUITE_CAD', priceEnvUsd: 'STRIPE_PRICE_SERVICE_SUITE_USD',
    features: [...new Set([...FEATURES_BY_PRODUCT.design_studio, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.marketsync_social, ...FEATURES_BY_PRODUCT.marketsync_email, ...FEATURES_BY_PRODUCT.marketsync_video])],
    legacy: { ...legacyFlags({}), products: { design_studio: true, facebook_dealer: true, marketsync_social: true, marketsync_email: true, marketsync_video: true, service_marketing_suite: true } },
  },
  'complete-marketing-suite': {
    id: 'complete-marketing-suite', label: 'Complete Marketing Suite', product_primary: 'marketsync_social',
    products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 699, tier: 2,
    priceEnvCad: 'STRIPE_PRICE_COMPLETE_SUITE_CAD', priceEnvUsd: 'STRIPE_PRICE_COMPLETE_SUITE_USD',
    features: [...new Set([...FEATURES_BY_PRODUCT.design_studio, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.marketsync_social, ...FEATURES_BY_PRODUCT.marketsync_email, ...FEATURES_BY_PRODUCT.marketsync_video])],
    legacy: { ...legacyFlags({}), products: { design_studio: true, facebook_dealer: true, marketsync_social: true, marketsync_email: true, marketsync_video: true, complete_marketing_suite: true } },
  },
  'marketsync-digital': {
    id: 'marketsync-digital', label: 'MarketSync Digital', product_primary: 'marketsync_website',
    products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 1199, tier: 2,
    priceEnvCad: 'STRIPE_PRICE_MARKETSYNC_DIGITAL_CAD', priceEnvUsd: 'STRIPE_PRICE_MARKETSYNC_DIGITAL_USD',
    features: [...new Set([...FEATURES_BY_PRODUCT.design_studio, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.marketsync_social, ...FEATURES_BY_PRODUCT.marketsync_email, ...FEATURES_BY_PRODUCT.marketsync_video, ...FEATURES_BY_PRODUCT.marketsync_website, ...FEATURES_BY_PRODUCT.ai_dealer])],
    legacy: {
      ...legacyFlags({}), ai_chatbot_active: true, ai_chatbot_paid: true,
      products: { design_studio: true, facebook_dealer: true, marketsync_social: true, marketsync_email: true, marketsync_video: true, marketsync_website: true, ai_chatbot: true, marketsync_digital: true },
    },
  },
  'dealer-os-core': {
    id: 'dealer-os-core', label: 'DealerOS Core', product_primary: 'dealer_os',
    products: ['dealer_os', 'design_studio', 'facebook', 'marketsync_social', 'marketsync_email'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 1499, tier: 0,
    priceEnvCad: 'STRIPE_PKG_CORE_CAD', priceEnvUsd: 'STRIPE_PKG_CORE_USD',
    features: [...new Set([...CURRENT_CORE_OS, ...FEATURES_BY_PRODUCT.design_studio, ...FEATURES_BY_PRODUCT.facebook, 'social.scheduler', 'social.accounts', 'social.calendar', ...FEATURES_BY_PRODUCT.marketsync_email])],
    legacy: { ...legacyFlags({ plan: 'core', ai: false, invIntel: false }), products: { dealer_os: true, design_studio: true, facebook_dealer: true, marketsync_social: true, marketsync_email: true } },
  },
  'dealer-os-pro': {
    id: 'dealer-os-pro', label: 'DealerOS Pro', product_primary: 'dealer_os',
    products: ['dealer_os', 'design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 2499, tier: 1,
    priceEnvCad: 'STRIPE_PKG_DEALEROS_PRO_CAD', priceEnvUsd: 'STRIPE_PKG_DEALEROS_PRO_USD',
    features: [...new Set([...CURRENT_PRO_OS, ...FEATURES_BY_PRODUCT.design_studio, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.marketsync_social, ...FEATURES_BY_PRODUCT.marketsync_email, ...FEATURES_BY_PRODUCT.marketsync_video, ...FEATURES_BY_PRODUCT.marketsync_website, ...FEATURES_BY_PRODUCT.ai_dealer])],
    legacy: {
      ...legacyFlags({ plan: 'dealeros_pro', ai: true, invIntel: true }), ai_chatbot_active: true, ai_chatbot_paid: true,
      products: { dealer_os: true, design_studio: true, facebook_dealer: true, marketsync_social: true, marketsync_email: true, marketsync_video: true, marketsync_website: true, ai_chatbot: true },
    },
  },
  // Complete retains Pro's product bundle and adds the operating departments promised
  // by the public package: Accounting, Automations and Integrations/API access.
  'dealer-os-complete': {
    id: 'dealer-os-complete', label: 'DealerOS Complete', product_primary: 'dealer_os',
    products: ['dealer_os', 'design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer'], org_type: 'dealership', owner_role: 'DEALER_ADMIN',
    monthly: 3999, tier: 2,
    priceEnvCad: 'STRIPE_PKG_DEALEROS_COMPLETE_CAD', priceEnvUsd: 'STRIPE_PKG_DEALEROS_COMPLETE_USD',
    features: [...new Set([...CURRENT_COMPLETE_OS, ...FEATURES_BY_PRODUCT.design_studio, ...FEATURES_BY_PRODUCT.facebook, ...FEATURES_BY_PRODUCT.marketsync_social, ...FEATURES_BY_PRODUCT.marketsync_email, ...FEATURES_BY_PRODUCT.marketsync_video, ...FEATURES_BY_PRODUCT.marketsync_website, ...FEATURES_BY_PRODUCT.ai_dealer])],
    legacy: {
      ...legacyFlags({ plan: 'dealeros_complete', ai: true, invIntel: true }), ai_chatbot_active: true, ai_chatbot_paid: true,
      products: { dealer_os: true, design_studio: true, facebook_dealer: true, marketsync_social: true, marketsync_email: true, marketsync_video: true, marketsync_website: true, ai_chatbot: true },
    },
  },
})

export const PLAN_ALIASES = Object.freeze({
  campaigns: 'campaigns-email-sms',
  marketsync_seo: 'marketsync-seo',
  'sales-suite': 'sales-marketing-suite',
  'service-suite': 'service-marketing-suite',
  'complete-suite': 'complete-marketing-suite',
  digital: 'marketsync-digital',
})

export const PLAN_IDS = Object.freeze(Object.keys(PLAN_CATALOG))

export function getPlan(planId) {
  if (!planId) return null
  const canonicalId = PLAN_ALIASES[planId] || planId
  return PLAN_CATALOG[canonicalId] || null
}

// Resolve a Stripe Price ID → plan id, using the env vars declared in the catalog.
// This is the ONLY place a price maps to a plan. env is passed in (process.env) so the
// function stays pure/testable.
export function planForStripePrice(priceId, env = {}) {
  if (!priceId) return null
  for (const plan of Object.values(PLAN_CATALOG)) {
    if (priceId === priceFromEnv(env, plan.priceEnvCad, plan.priceEnvCadAliases)
      || priceId === priceFromEnv(env, plan.priceEnvUsd, plan.priceEnvUsdAliases)) return plan.id
  }
  return null
}

function priceFromEnv(env, primaryKey, aliases = []) {
  for (const key of [primaryKey, ...aliases]) {
    if (env[key]) return env[key]
  }
  return ''
}

// The Stripe Price ID to charge for a plan in a given currency (falls back to the
// other currency if only one is configured).
export function stripePriceForPlan(planId, currency = 'usd', env = {}) {
  const plan = getPlan(planId)
  if (!plan) return null
  const cad = priceFromEnv(env, plan.priceEnvCad, plan.priceEnvCadAliases)
  const usd = priceFromEnv(env, plan.priceEnvUsd, plan.priceEnvUsdAliases)
  return (String(currency).toLowerCase() === 'cad' ? cad : usd) || usd || cad || null
}

// The products a plan grants (the bundle expansion). Access is the union of these
// across all of an org's active plans.
export function productsForPlan(planId) { return getPlan(planId)?.products || [] }

// The features a plan grants.
export function featuresForPlan(planId) { return getPlan(planId)?.features || [] }

/**
 * Returns all products and features from the catalog that are showcaseable in demo mode.
 * Any plan or feature marked `demo_excluded: true` is omitted.
 */
export function getShowcaseOverlay() {
  const products = new Set()
  const features = new Set()

  for (const plan of Object.values(PLAN_CATALOG)) {
    if (plan.demo_excluded) continue
    if (Array.isArray(plan.products)) {
      plan.products.forEach(p => products.add(p))
    }
    if (Array.isArray(plan.features)) {
      plan.features.forEach(f => features.add(f))
    }
  }

  return {
    products: [...products],
    features: [...features],
  }
}

