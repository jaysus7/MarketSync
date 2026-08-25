-- Revoke MarketSync SEO from DealerOS Pro.
--
-- plan-catalog.js has always been explicit that Pro does not include SEO: Pro
-- carries products ['dealer_os'] and CURRENT_PRO_OS, which contains no seo.*
-- feature. The database disagreed. 2026-08-20-marketsync-digital-seo-entitlement.sql
-- granted marketsync_seo and all ten seo.* features to BOTH marketsync-digital
-- (correct -- Digital sells SEO) and dealer-os-pro (not correct -- Pro does not).
--
-- Provisioning and entitlement resolution read the DB, so Pro dealerships have
-- been getting a $149/mo product for free. This aligns the DB with the catalog.
--
-- This does NOT take SEO away from anyone who actually pays for it:
--   * dealer-os-complete bundles SEO (granted in the companion migration,
--     2026-08-25-dealer-os-complete-seo-entitlement.sql).
--   * marketsync-digital bundles SEO (untouched).
--   * marketsync-seo is the standalone plan (untouched).
--   * A Pro dealership that separately subscribes to marketsync-seo keeps it:
--     access.js::expandPlanProductCoverage unions coverage across every
--     subscription a dealership holds, and this only removes the grant attached
--     to the dealer-os-pro plan itself.
--
-- What it does change: a Pro dealership relying on the accidental grant loses the
-- SEO pages and is offered the standalone upgrade instead (upgradeToSeo ->
-- plan marketsync-seo), which is how Pro was always meant to reach SEO.
--
-- Idempotent -- deleting rows that are already gone is a no-op.

delete from public.plan_features
 where plan_id = 'dealer-os-pro'
   and feature_id in ('seo.overview', 'seo.audit', 'seo.autofix', 'seo.content',
                      'seo.competitors', 'seo.local', 'seo.inventory',
                      'seo.ai_search', 'seo.reports', 'seo.settings');

delete from public.plan_products
 where plan_id = 'dealer-os-pro'
   and product_id = 'marketsync_seo';
