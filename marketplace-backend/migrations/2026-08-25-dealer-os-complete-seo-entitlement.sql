-- DealerOS Complete sells MarketSync SEO but the database never granted it.
--
-- The catalog lives in two places: plan-catalog.js and the DB plans/plan_products/
-- plan_features tables. They drifted. plan-catalog.js has always listed
-- marketsync_seo under dealer-os-complete; the DB seed
-- (2026-08-17-current-catalog-db-plans.sql) gave Complete eight products and never
-- mentions marketsync_seo at all, and the follow-up
-- (2026-08-20-marketsync-digital-seo-entitlement.sql) granted SEO to
-- marketsync-digital and dealer-os-pro -- but not to Complete.
--
-- Provisioning reads the DB, so switching a dealership to DealerOS Complete failed
-- with "Plan dealer-os-complete does not include product marketsync_seo", and a
-- paying Complete customer could not be given the product they bought.
--
-- The standalone marketsync-seo plan had no plan_products row either, so someone
-- who bought SEO on its own was in the same position.
--
-- Idempotent and additive.

-- 1. The product and its features must exist before anything can reference them.
insert into public.products (id, name, sort_order)
values ('marketsync_seo', 'MarketSync SEO', 9)
on conflict (id) do nothing;

insert into public.features (id, product_id, name, feature_group, sort_order) values
  ('seo.overview', 'marketsync_seo', 'Overview', 'seo', 1),
  ('seo.audit', 'marketsync_seo', 'Audit', 'seo', 2),
  ('seo.autofix', 'marketsync_seo', 'Auto Fix', 'seo', 3),
  ('seo.content', 'marketsync_seo', 'Content', 'seo', 4),
  ('seo.competitors', 'marketsync_seo', 'Competitors', 'seo', 5),
  ('seo.local', 'marketsync_seo', 'Local SEO', 'seo', 6),
  ('seo.inventory', 'marketsync_seo', 'Inventory SEO', 'seo', 7),
  ('seo.ai_search', 'marketsync_seo', 'AI Search', 'seo', 8),
  ('seo.reports', 'marketsync_seo', 'Reports', 'seo', 9),
  ('seo.settings', 'marketsync_seo', 'Settings', 'seo', 10)
on conflict (id) do nothing;

-- 2. The standalone marketsync-seo plan row itself was never created. The
--    2026-08-17 seed listed 15 SKUs and this was not one of them, and no later
--    migration adds it. plan_products.plan_id and plan_features.plan_id are both
--    foreign keys to plans(id), so granting anything to marketsync-seo before the
--    plan exists aborts the whole file -- taking the dealer-os-complete grant
--    below down with it. Values come from PLAN_CATALOG['marketsync-seo']
--    ($149/mo = 14900 cents, tier 0, dealership).
insert into public.plans (id, product_id, name, tier, monthly_price_cents, org_type, is_public, is_trial_default)
values ('marketsync-seo', 'marketsync_seo', 'MarketSync SEO', 0, 14900, 'dealership', true, false)
on conflict (id) do nothing;

-- 3. Grant the product to the plans that sell it and were missing it.
insert into public.plan_products (plan_id, product_id)
values
  ('dealer-os-complete', 'marketsync_seo'),
  ('marketsync-seo', 'marketsync_seo')
on conflict (plan_id, product_id) do nothing;

-- 4. Grant the features alongside the product. Without these the page resolves as
--    unentitled even though the product row is present.
insert into public.plan_features (plan_id, feature_id)
select entitled_plan.plan_id, entitled.feature_id
from (values ('dealer-os-complete'), ('marketsync-seo')) as entitled_plan(plan_id)
cross join (values
  ('seo.overview'), ('seo.audit'), ('seo.autofix'), ('seo.content'),
  ('seo.competitors'), ('seo.local'), ('seo.inventory'), ('seo.ai_search'),
  ('seo.reports'), ('seo.settings')
) as entitled(feature_id)
on conflict (plan_id, feature_id) do nothing;

-- ---------------------------------------------------------------------------
-- The same 2026-08-20 migration also granted marketsync_seo to dealer-os-pro,
-- which plan-catalog.js says Pro does not include. That was flagged here as a
-- commercial decision rather than an engineering one; the owner has since
-- decided to revoke it.
--
-- The revoke lives in its own migration so this one stays purely additive:
--   2026-08-25-revoke-dealer-os-pro-seo.sql
-- ---------------------------------------------------------------------------
