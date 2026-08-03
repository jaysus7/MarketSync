-- Plan-centric entitlement model. Aligns the plans catalog to plan-catalog.js (the single
-- source of truth): the 5 sold plans, their prices, their features, and — new — a
-- plan_products table so a single plan can grant MULTIPLE products (Dealer OS Pro bundles
-- dealer_os + facebook + ai_dealer). Access is granted by the active subscription's plan,
-- never by registration.
--
-- Grandfathered plans (os_enterprise, ai_standard) are left in place so existing
-- subscriptions stay valid; they simply aren't offered at registration.
-- Apply to STAGING first, verify, then production.

alter table public.plans add column if not exists org_type text;

-- ── The 5 sold plans (idempotent upsert) ─────────────────────────────────────
insert into public.plans (id, product_id, name, tier, monthly_price_cents, org_type) values
  ('fb_solo',       'facebook',  'Facebook Solo',       0,   7900, 'solo'),
  ('fb_dealership', 'facebook',  'Facebook Dealer',     1,  49900, 'dealership'),
  ('os_starter',    'dealer_os', 'Dealer OS Starter',   0,  99900, 'dealership'),
  ('os_growth',     'dealer_os', 'Dealer OS Growth',    1, 179900, 'dealership'),
  ('os_pro',        'dealer_os', 'Dealer OS Pro',       2, 249900, 'dealership')
on conflict (id) do update
  set name = excluded.name, tier = excluded.tier,
      monthly_price_cents = excluded.monthly_price_cents, org_type = excluded.org_type,
      product_id = excluded.product_id;

-- ── plan_products: which products each plan grants (the bundle expansion) ─────
create table if not exists public.plan_products (
  plan_id    text not null references public.plans(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  primary key (plan_id, product_id)
);
alter table public.plan_products enable row level security;
alter table public.plan_products force row level security;
drop policy if exists "plan_products_select_all" on public.plan_products;
drop policy if exists "plan_products_write_platform" on public.plan_products;
create policy "plan_products_select_all" on public.plan_products for select to authenticated using (true);
create policy "plan_products_write_platform" on public.plan_products for all to authenticated
  using (authz.is_platform_staff()) with check (authz.is_platform_staff());

delete from public.plan_products where plan_id in ('fb_solo','fb_dealership','os_starter','os_growth','os_pro');
insert into public.plan_products (plan_id, product_id) values
  ('fb_solo','facebook'),
  ('fb_dealership','facebook'),
  ('os_starter','dealer_os'),
  ('os_growth','dealer_os'),
  ('os_pro','dealer_os'), ('os_pro','facebook'), ('os_pro','ai_dealer');

-- ── Refresh plan_features for the 5 plans from the catalog ────────────────────
delete from public.plan_features where plan_id in ('fb_solo','fb_dealership','os_starter','os_growth','os_pro');
insert into public.plan_features (plan_id, feature_id) values
  -- fb_solo
  ('fb_solo','fb.inventory'), ('fb_solo','fb.leaderboard'),
  -- fb_dealership
  ('fb_dealership','fb.inventory'), ('fb_dealership','fb.sales_reps'), ('fb_dealership','fb.leaderboard'),
  -- os_starter
  ('os_starter','os.dashboard'), ('os_starter','os.crm'), ('os_starter','os.inventory'),
  ('os_starter','os.reports'), ('os_starter','os.team'), ('os_starter','os.settings'),
  -- os_growth (starter + growth)
  ('os_growth','os.dashboard'), ('os_growth','os.crm'), ('os_growth','os.inventory'),
  ('os_growth','os.reports'), ('os_growth','os.team'), ('os_growth','os.settings'),
  ('os_growth','os.sales'), ('os_growth','os.accounting'), ('os_growth','os.marketing'),
  ('os_growth','os.website'), ('os_growth','os.automations'), ('os_growth','os.integrations'),
  -- os_pro: all Dealer OS + all Facebook + all AI Dealer (the bundle)
  ('os_pro','os.dashboard'), ('os_pro','os.crm'), ('os_pro','os.inventory'), ('os_pro','os.sales'),
  ('os_pro','os.accounting'), ('os_pro','os.service'), ('os_pro','os.marketing'), ('os_pro','os.website'),
  ('os_pro','os.reports'), ('os_pro','os.automations'), ('os_pro','os.integrations'),
  ('os_pro','os.team'), ('os_pro','os.settings'),
  ('os_pro','fb.inventory'), ('os_pro','fb.leaderboard'), ('os_pro','fb.sales_reps'),
  ('os_pro','ai.overview'), ('os_pro','ai.conversations'), ('os_pro','ai.agents'),
  ('os_pro','ai.knowledge'), ('os_pro','ai.settings')
on conflict do nothing;
