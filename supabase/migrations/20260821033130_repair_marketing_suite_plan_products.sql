-- Repair staging drift between the canonical plan catalog and normalized bundle
-- coverage. Idempotent and additive: real subscription authorization continues to
-- derive from plan_products/plan_features; the demo receives no special bypass.
insert into public.plan_products (plan_id, product_id)
select plan_id, product_id
from (values
  ('sales-marketing-suite', 'design_studio'),
  ('sales-marketing-suite', 'facebook'),
  ('sales-marketing-suite', 'marketsync_social'),
  ('sales-marketing-suite', 'marketsync_email'),
  ('sales-marketing-suite', 'marketsync_video'),
  ('service-marketing-suite', 'design_studio'),
  ('service-marketing-suite', 'facebook'),
  ('service-marketing-suite', 'marketsync_social'),
  ('service-marketing-suite', 'marketsync_email'),
  ('service-marketing-suite', 'marketsync_video'),
  ('complete-marketing-suite', 'design_studio'),
  ('complete-marketing-suite', 'facebook'),
  ('complete-marketing-suite', 'marketsync_social'),
  ('complete-marketing-suite', 'marketsync_email'),
  ('complete-marketing-suite', 'marketsync_video')
) as expected(plan_id, product_id)
on conflict (plan_id, product_id) do nothing;

insert into public.plan_features (plan_id, feature_id)
select expected.plan_id, features.id
from (values
  ('sales-marketing-suite'),
  ('service-marketing-suite'),
  ('complete-marketing-suite')
) as expected(plan_id)
join public.features features
  on features.product_id in ('design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video')
on conflict (plan_id, feature_id) do nothing;
