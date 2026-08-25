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

-- 2. Grant the product to the plans that sell it and were missing it.
insert into public.plan_products (plan_id, product_id)
values
  ('dealer-os-complete', 'marketsync_seo'),
  ('marketsync-seo', 'marketsync_seo')
on conflict (plan_id, product_id) do nothing;

-- 3. Grant the features alongside the product. Without these the page resolves as
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
-- NOT APPLIED -- this one is a commercial decision, not an engineering one.
--
-- The same 2026-08-20 migration also granted marketsync_seo to dealer-os-pro.
-- plan-catalog.js is explicit that it should not: "Digital is sold separately
-- (marketsync-digital) and bundled only into Complete", and Pro sells neither the
-- product nor any seo.* feature. So the database currently gives SEO away on a
-- tier that does not pay for it.
--
-- Revoking is two statements, but it takes a working feature away from any live
-- Pro dealership already using it. That is the owner's call, so it is written out
-- here rather than executed. Uncomment to apply.
--
-- delete from public.plan_features
--  where plan_id = 'dealer-os-pro'
--    and feature_id in ('seo.overview','seo.audit','seo.autofix','seo.content',
--                       'seo.competitors','seo.local','seo.inventory',
--                       'seo.ai_search','seo.reports','seo.settings');
-- delete from public.plan_products
--  where plan_id = 'dealer-os-pro' and product_id = 'marketsync_seo';
-- ---------------------------------------------------------------------------
