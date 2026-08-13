-- Promote the (previously grandfathered) ai_standard plan to a sold standalone product:
-- AI Dealer at $499/mo. Sets price + org_type, maps its product, and ensures its features.
-- Apply to STAGING first, then production.

insert into public.plans (id, product_id, name, tier, monthly_price_cents, org_type)
values ('ai_standard', 'ai_dealer', 'AI Dealer', 0, 49900, 'dealership')
on conflict (id) do update
  set name = excluded.name, monthly_price_cents = excluded.monthly_price_cents,
      org_type = excluded.org_type, product_id = excluded.product_id, tier = excluded.tier;

delete from public.plan_products where plan_id = 'ai_standard';
insert into public.plan_products (plan_id, product_id) values ('ai_standard', 'ai_dealer');

delete from public.plan_features where plan_id = 'ai_standard';
insert into public.plan_features (plan_id, feature_id) values
  ('ai_standard','ai.overview'), ('ai_standard','ai.conversations'), ('ai_standard','ai.agents'),
  ('ai_standard','ai.knowledge'), ('ai_standard','ai.settings')
on conflict do nothing;
