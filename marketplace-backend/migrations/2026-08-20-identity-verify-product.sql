-- MarketSync Identity Verify: standalone product and DealerOS Complete inclusion.
-- Raw documents and biometric media remain with the configured verification provider;
-- MarketSync persists only normalized evidence and audit outcomes.

insert into public.products (id, name, sort_order)
values ('marketsync_identity', 'MarketSync Identity Verify', 10)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.features (id, product_id, name, feature_group, sort_order) values
  ('identity.verify', 'marketsync_identity', 'Identity verification', 'identity', 1),
  ('identity.reports', 'marketsync_identity', 'Verification reports', 'identity', 2),
  ('identity.settings', 'marketsync_identity', 'Verification settings', 'identity', 3)
on conflict (id) do update set
  product_id = excluded.product_id,
  name = excluded.name,
  feature_group = excluded.feature_group,
  sort_order = excluded.sort_order;

insert into public.plans
  (id, product_id, name, tier, monthly_price_cents, org_type, is_public, is_trial_default)
values
  ('identity-verify', 'marketsync_identity', 'MarketSync Identity Verify', 0, 29900, 'dealership', true, false)
on conflict (id) do update set
  product_id = excluded.product_id,
  name = excluded.name,
  tier = excluded.tier,
  monthly_price_cents = excluded.monthly_price_cents,
  org_type = excluded.org_type,
  is_public = excluded.is_public;

insert into public.plan_products (plan_id, product_id) values
  ('identity-verify', 'marketsync_identity'),
  ('dealer-os-complete', 'marketsync_identity')
on conflict (plan_id, product_id) do nothing;

insert into public.plan_features (plan_id, feature_id)
select plan_id, feature_id
from (values
  ('identity-verify', 'identity.verify'),
  ('identity-verify', 'identity.reports'),
  ('identity-verify', 'identity.settings'),
  ('dealer-os-complete', 'identity.verify'),
  ('dealer-os-complete', 'identity.reports'),
  ('dealer-os-complete', 'identity.settings')
) as entitled(plan_id, feature_id)
on conflict (plan_id, feature_id) do nothing;
