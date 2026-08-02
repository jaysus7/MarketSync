-- Access-model foundation (Phase 1). Normalizes the scattered product/plan/feature
-- state (dealerships.products jsonb + fb_only + plan + *_active booleans) into a real
-- catalog + per-org subscriptions, WITHOUT introducing a parallel org/permission model:
-- the organization is still `dealerships`, membership is still profiles.dealership_id +
-- user_roles, and permissions still flow through the existing RBAC (authz.has_permission).
-- This migration only ADDS the missing normalized pieces. Fully additive — no existing
-- table or row is modified except one nullable column on dealerships.
--
-- Every new table ships with RLS + policies per docs/rls-standard.md.
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.

-- ── Catalog ──────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id          text primary key,                 -- 'facebook','ai_dealer','dealer_os'
  name        text not null,
  description text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.features (
  id            text primary key,               -- 'os.crm','fb.inventory','ai.conversations'
  product_id    text not null references public.products(id),
  name          text not null,
  feature_group text,
  description   text,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists features_product_idx on public.features(product_id);

create table if not exists public.plans (
  id                text primary key,           -- 'fb_solo','os_pro',...
  product_id        text not null references public.products(id),
  name              text not null,
  tier              int  not null default 0,    -- higher = more inclusive
  monthly_price_cents int,
  stripe_price_id   text,                        -- server-side Stripe→plan mapping
  is_trial_default  boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists plans_product_idx on public.plans(product_id);
create unique index if not exists plans_stripe_price_idx on public.plans(stripe_price_id) where stripe_price_id is not null;

create table if not exists public.plan_features (
  plan_id    text not null references public.plans(id) on delete cascade,
  feature_id text not null references public.features(id) on delete cascade,
  primary key (plan_id, feature_id)
);

-- ── Per-organization subscriptions (org = dealership) ────────────────────────
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  dealership_id         uuid not null references public.dealerships(id) on delete cascade,
  product_id            text not null references public.products(id),
  plan_id               text references public.plans(id),
  status                text not null default 'trialing'
                          check (status in ('trialing','active','past_due','cancelled','expired')),
  stripe_subscription_id text,
  stripe_customer_id    text,
  current_period_end    timestamptz,
  trial_ends_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (dealership_id, product_id)
);
create index if not exists subscriptions_dealership_idx on public.subscriptions(dealership_id);
create unique index if not exists subscriptions_stripe_sub_idx on public.subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;

-- ── Which products a USER has within an org (a rep can have facebook only even if
--    the dealership also subscribes to dealer_os) ──────────────────────────────
create table if not exists public.product_memberships (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  product_id    text not null references public.products(id),
  created_at    timestamptz not null default now(),
  primary key (user_id, dealership_id, product_id)
);
create index if not exists product_memberships_dealership_idx on public.product_memberships(dealership_id);

-- ── Per-member permission overrides layered on top of RBAC role_permissions ──
create table if not exists public.member_permission_overrides (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  permission_id text not null references public.permissions(id),
  effect        text not null check (effect in ('grant','deny')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  primary key (user_id, dealership_id, permission_id)
);

-- ── Dealership invitations (employees join via invite, never a new paid dealership) ─
create table if not exists public.invitations (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  email         text not null,
  product_id    text references public.products(id),
  role_id       text references public.roles(id),
  permissions   jsonb not null default '[]'::jsonb,   -- [{permission_id,effect}] overrides
  data_scope    text,                                  -- 'own' | 'assigned' | 'all'
  token         text not null unique,
  status        text not null default 'pending'
                  check (status in ('pending','accepted','revoked','expired')),
  invited_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  accepted_at   timestamptz
);
create index if not exists invitations_dealership_idx on public.invitations(dealership_id);
create index if not exists invitations_email_idx on public.invitations(lower(email));

-- ── account_type on the org (solo vs dealership); backfilled from is_personal ──
alter table public.dealerships add column if not exists account_type text;
update public.dealerships
  set account_type = case when is_personal then 'solo' else 'dealership' end
  where account_type is null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Catalog tables are global reference data: any authenticated user may read; only
-- platform staff may write.
do $$
declare tbl text;
begin
  foreach tbl in array array['products','features','plans','plan_features'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('alter table public.%I force row level security', tbl);
    execute format('drop policy if exists "%s_select_all" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_write_platform" on public.%I', tbl, tbl);
    execute format($f$create policy "%s_select_all" on public.%I for select to authenticated using (true)$f$, tbl, tbl);
    execute format($f$create policy "%s_write_platform" on public.%I for all to authenticated using (authz.is_platform_staff()) with check (authz.is_platform_staff())$f$, tbl, tbl);
  end loop;
end $$;

-- subscriptions: any dealership member may READ their org's entitlements (needed to
-- compute the access context); billing.manage (or platform staff) may write.
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
drop policy if exists "subscriptions_select_authorized" on public.subscriptions;
create policy "subscriptions_select_authorized" on public.subscriptions
  for select to authenticated
  using (authz.belongs_to_dealership(dealership_id) or authz.is_platform_staff());
drop policy if exists "subscriptions_write_authorized" on public.subscriptions;
create policy "subscriptions_write_authorized" on public.subscriptions
  for all to authenticated
  using (authz.has_permission(dealership_id, 'billing.manage') or authz.is_platform_staff())
  with check (authz.has_permission(dealership_id, 'billing.manage') or authz.is_platform_staff());

-- product_memberships: a user reads their own; users.manage manages the roster.
alter table public.product_memberships enable row level security;
alter table public.product_memberships force row level security;
drop policy if exists "product_memberships_select_authorized" on public.product_memberships;
create policy "product_memberships_select_authorized" on public.product_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff());
drop policy if exists "product_memberships_write_authorized" on public.product_memberships;
create policy "product_memberships_write_authorized" on public.product_memberships
  for all to authenticated
  using (authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff())
  with check (authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff());

-- member_permission_overrides: a user reads their own; users.manage manages them.
alter table public.member_permission_overrides enable row level security;
alter table public.member_permission_overrides force row level security;
drop policy if exists "mpo_select_authorized" on public.member_permission_overrides;
create policy "mpo_select_authorized" on public.member_permission_overrides
  for select to authenticated
  using (user_id = (select auth.uid()) or authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff());
drop policy if exists "mpo_write_authorized" on public.member_permission_overrides;
create policy "mpo_write_authorized" on public.member_permission_overrides
  for all to authenticated
  using (authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff())
  with check (authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff());

-- invitations: users.manage sees + manages; accept-by-token runs server-side (service role).
alter table public.invitations enable row level security;
alter table public.invitations force row level security;
drop policy if exists "invitations_select_authorized" on public.invitations;
create policy "invitations_select_authorized" on public.invitations
  for select to authenticated
  using (authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff());
drop policy if exists "invitations_write_authorized" on public.invitations;
create policy "invitations_write_authorized" on public.invitations
  for all to authenticated
  using (authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff())
  with check (authz.has_permission(dealership_id, 'users.manage') or authz.is_platform_staff());

-- ── Seed the catalog (3 products, their features, tiered plans, entitlements) ──
insert into public.products (id, name, description, sort_order) values
  ('facebook',  'Facebook Marketplace', 'Facebook Marketplace posting + leaderboard', 1),
  ('ai_dealer', 'AI Dealer',            'AI sales concierge: conversations, agents, knowledge', 2),
  ('dealer_os', 'Dealer OS',            'Full dealership operating system', 3)
on conflict (id) do nothing;

insert into public.features (id, product_id, name, feature_group, sort_order) values
  ('fb.inventory',    'facebook','Inventory',   'facebook', 1),
  ('fb.leaderboard',  'facebook','Leaderboard', 'facebook', 2),
  ('fb.sales_reps',   'facebook','Sales Reps',  'facebook', 3),
  ('ai.overview',     'ai_dealer','Overview',      'ai_dealer', 1),
  ('ai.conversations','ai_dealer','Conversations', 'ai_dealer', 2),
  ('ai.agents',       'ai_dealer','Agents',        'ai_dealer', 3),
  ('ai.knowledge',    'ai_dealer','Knowledge',     'ai_dealer', 4),
  ('ai.settings',     'ai_dealer','Settings',      'ai_dealer', 5),
  ('os.dashboard',    'dealer_os','Dashboard',    'core',        1),
  ('os.crm',          'dealer_os','CRM',          'sales',       2),
  ('os.inventory',    'dealer_os','Inventory',    'inventory',   3),
  ('os.sales',        'dealer_os','Sales',        'sales',       4),
  ('os.accounting',   'dealer_os','Accounting',   'accounting',  5),
  ('os.service',      'dealer_os','Service',      'service',     6),
  ('os.marketing',    'dealer_os','Marketing',    'marketing',   7),
  ('os.website',      'dealer_os','Website',      'marketing',   8),
  ('os.reports',      'dealer_os','Reports',      'core',        9),
  ('os.automations',  'dealer_os','Automations',  'ops',        10),
  ('os.integrations', 'dealer_os','Integrations', 'ops',        11),
  ('os.team',         'dealer_os','Team',         'admin',      12),
  ('os.settings',     'dealer_os','Settings',     'admin',      13)
on conflict (id) do nothing;

insert into public.plans (id, product_id, name, tier, is_trial_default) values
  ('fb_solo',       'facebook', 'Facebook Solo',        0, false),
  ('fb_dealership', 'facebook', 'Facebook Dealership',  1, false),
  ('ai_standard',   'ai_dealer','AI Dealer',            0, false),
  ('os_starter',    'dealer_os','Dealer OS Starter',    0, false),
  ('os_pro',        'dealer_os','Dealer OS Pro',        1, false),
  ('os_enterprise', 'dealer_os','Dealer OS Enterprise', 2, false)
on conflict (id) do nothing;

insert into public.plan_features (plan_id, feature_id) values
  ('fb_solo','fb.inventory'), ('fb_solo','fb.leaderboard'),
  ('fb_dealership','fb.inventory'), ('fb_dealership','fb.leaderboard'), ('fb_dealership','fb.sales_reps'),
  ('ai_standard','ai.overview'), ('ai_standard','ai.conversations'), ('ai_standard','ai.agents'),
  ('ai_standard','ai.knowledge'), ('ai_standard','ai.settings'),
  ('os_starter','os.dashboard'), ('os_starter','os.crm'), ('os_starter','os.inventory'),
  ('os_starter','os.reports'), ('os_starter','os.team'), ('os_starter','os.settings'),
  ('os_pro','os.dashboard'), ('os_pro','os.crm'), ('os_pro','os.inventory'), ('os_pro','os.sales'),
  ('os_pro','os.accounting'), ('os_pro','os.marketing'), ('os_pro','os.website'),
  ('os_pro','os.reports'), ('os_pro','os.automations'), ('os_pro','os.integrations'),
  ('os_pro','os.team'), ('os_pro','os.settings'),
  ('os_enterprise','os.dashboard'), ('os_enterprise','os.crm'), ('os_enterprise','os.inventory'),
  ('os_enterprise','os.sales'), ('os_enterprise','os.accounting'), ('os_enterprise','os.service'),
  ('os_enterprise','os.marketing'), ('os_enterprise','os.website'), ('os_enterprise','os.reports'),
  ('os_enterprise','os.automations'), ('os_enterprise','os.integrations'), ('os_enterprise','os.team'),
  ('os_enterprise','os.settings')
on conflict do nothing;
