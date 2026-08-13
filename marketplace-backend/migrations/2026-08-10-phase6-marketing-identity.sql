-- Phase 6 PR 6.1 — Marketing identity: source taxonomy, canonical Campaign, attribution by ID.
--
-- THE DEFECT this addresses: attribution ran entirely on display names.
-- `buildMarketingRoi()` passed the free-text `contacts.source` through a string normaliser,
-- and nothing linked a customer to a campaign by ID. Two campaigns on the same channel were
-- indistinguishable, and renaming a source silently re-bucketed history.
--
-- Nothing here rewrites existing data. `contacts.source` / `sold_source` keep their strings
-- exactly as they are — they are the historical record, and overwriting them would destroy
-- the only attribution older rows have. New columns sit alongside, and a legacy string is
-- reported as INFERRED attribution rather than being silently upgraded to linked.
--
-- APPLIED TO STAGING ONLY.

-- ── 1. Source taxonomy ──────────────────────────────────────────────────────
-- One vocabulary, so screens stop inventing their own spelling. Global rows
-- (dealership_id null) are the canonical set; a dealership may add its own without
-- forking the shared ones.
create table if not exists public.marketing_sources (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid references public.dealerships(id) on delete cascade,   -- null = global
  key text not null,                        -- stable identifier, never displayed
  label text not null,                      -- what a human sees
  channel text not null,                    -- grouping for reporting
  paid boolean not null default false,      -- does this source cost money
  active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists marketing_sources_key_uk
  on public.marketing_sources (coalesce(dealership_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
alter table public.marketing_sources enable row level security;

insert into public.marketing_sources (dealership_id, key, label, channel, paid, sort) values
  (null, 'facebook_ads',        'Facebook Ads',              'Social',      true,  10),
  (null, 'instagram_ads',       'Instagram Ads',             'Social',      true,  20),
  (null, 'google_ads',          'Google Ads',                'Search',      true,  30),
  (null, 'facebook_organic',    'Facebook Organic',          'Social',      false, 40),
  (null, 'instagram_organic',   'Instagram Organic',         'Social',      false, 50),
  (null, 'tiktok',              'TikTok',                    'Social',      false, 60),
  (null, 'youtube',             'YouTube',                   'Social',      false, 70),
  (null, 'linkedin',            'LinkedIn',                  'Social',      false, 80),
  (null, 'facebook_marketplace','Facebook Marketplace',      'Marketplace', false, 90),
  (null, 'website',             'Website',                   'Owned',       false, 100),
  (null, 'organic_search',      'Organic Search',            'Search',      false, 110),
  (null, 'email',               'Email',                     'Owned',       false, 120),
  (null, 'sms',                 'SMS',                       'Owned',       false, 130),
  (null, 'referral',            'Referral',                  'Referral',    false, 140),
  (null, 'phone',               'Phone',                     'Direct',      false, 150),
  (null, 'walk_in',             'Walk-In',                   'Direct',      false, 160),
  (null, 'third_party_lead',    'Third-Party Lead Provider', 'Third Party', true,  170)
on conflict (coalesce(dealership_id, '00000000-0000-0000-0000-000000000000'::uuid), key) do nothing;

-- ── 2. Canonical Campaign ───────────────────────────────────────────────────
-- The Marketing initiative, which may span several channels. A provider's own "campaign"
-- is an external REFERENCE to this one, never the identity — see campaign_external_refs.
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  name text not null,
  objective text,                                    -- what it is meant to achieve
  campaign_type text,                                -- vehicle | aging | model | service | retention | equity | review | referral | seasonal | event
  status text not null default 'draft',
  channels text[] not null default '{}',             -- source keys this campaign runs on
  offer text,
  inventory_scope jsonb not null default '{}'::jsonb, -- how vehicles are selected; not a copy of them
  starts_at date,
  ends_at date,
  budget numeric(14,2) not null default 0,           -- PLANNED. Actual spend lives in marketing_spend.
  owner_id uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  constraint campaigns_status_valid check (status in
    ('draft','needs_approval','approved','active','paused','completed','cancelled','exception'))
);
create index if not exists campaigns_dealer_idx on public.campaigns (dealership_id, status);
create index if not exists campaigns_dates_idx on public.campaigns (dealership_id, starts_at, ends_at);
alter table public.campaigns enable row level security;

-- A provider's campaign id is a pointer TO our campaign. One provider id maps to at most
-- one campaign, so a provider row cannot be double-counted across campaigns.
create table if not exists public.campaign_external_refs (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider text not null,                    -- meta | google | tiktok | …
  external_id text not null,
  external_name text,
  created_at timestamptz not null default now()
);
create unique index if not exists campaign_external_refs_uk
  on public.campaign_external_refs (dealership_id, provider, external_id);
alter table public.campaign_external_refs enable row level security;

-- ── 3. Attribution by ID ────────────────────────────────────────────────────
-- Added alongside the legacy free-text columns, which are left untouched.
alter table public.contacts add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.contacts add column if not exists source_key text;
create index if not exists contacts_campaign_idx on public.contacts (dealership_id, campaign_id) where campaign_id is not null;

alter table public.leads add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.leads add column if not exists source_key text;
create index if not exists leads_campaign_idx on public.leads (dealership_id, campaign_id) where campaign_id is not null;

-- ── 4. Budget is not spend ──────────────────────────────────────────────────
-- marketing_spend held ONE amount, so planned and actual were indistinguishable and any
-- ROI built on it risked reporting budget as spend. `origin` records where an actual
-- figure came from, so an imported provider number is never confused with a typed one.
alter table public.marketing_spend add column if not exists kind text not null default 'actual';
alter table public.marketing_spend add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.marketing_spend add column if not exists origin text not null default 'manual';
alter table public.marketing_spend add column if not exists provider text;

do $$ begin
  alter table public.marketing_spend add constraint marketing_spend_kind_valid check (kind in ('budget','actual'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.marketing_spend add constraint marketing_spend_origin_valid check (origin in ('manual','imported'));
exception when duplicate_object then null; end $$;

-- The old unique could not tell a budget row from an actual one, nor separate campaigns.
--
-- NULLS NOT DISTINCT (PG15+) rather than a coalesce() expression: an expression index
-- cannot be named as an ON CONFLICT target by PostgREST, which would break every spend
-- upsert. This gives the same guarantee — one row per (dealership, channel, period, kind)
-- even when campaign_id is null — while staying targetable.
alter table public.marketing_spend drop constraint if exists marketing_spend_dealership_id_channel_period_key;
create unique index if not exists marketing_spend_identity_uk
  on public.marketing_spend (dealership_id, channel, period, kind, campaign_id)
  nulls not distinct;

-- Existing rows predate the distinction. They were entered by hand as what a dealer spent,
-- so they stay 'actual'/'manual' — which the defaults above already gave them.
