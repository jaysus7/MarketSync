-- MarketSync Digital exposes SEO as part of its Digital Presence work area.
-- Keep database entitlement resolution aligned with plan-catalog.js.

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
on conflict (id) do update set
  product_id = excluded.product_id,
  name = excluded.name,
  feature_group = excluded.feature_group,
  sort_order = excluded.sort_order;

insert into public.plan_products (plan_id, product_id)
values
  ('marketsync-digital', 'marketsync_seo'),
  ('dealer-os-pro', 'marketsync_seo')
on conflict (plan_id, product_id) do nothing;

insert into public.plan_features (plan_id, feature_id)
select entitled_plan.plan_id, entitled.feature_id
from (values ('marketsync-digital'), ('dealer-os-pro')) as entitled_plan(plan_id)
cross join (values
  ('seo.overview'), ('seo.audit'), ('seo.autofix'), ('seo.content'),
  ('seo.competitors'), ('seo.local'), ('seo.inventory'), ('seo.ai_search'),
  ('seo.reports'), ('seo.settings')
) as entitled(feature_id)
on conflict (plan_id, feature_id) do nothing;
