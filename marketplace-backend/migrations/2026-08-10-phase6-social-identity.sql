-- Phase 6 PR 6.2 — Social account identity and publishing authorization.
--
-- Built BEFORE any composer exists, deliberately. Publishing is irreversible and external:
-- a post made as the wrong account cannot be recalled, and a UI that decides who may post
-- as whom is the one Phase 6 failure a later migration cannot repair.
--
-- The distinction that matters: a dealership-owned page (Welland Motors' Facebook) is not
-- the same kind of thing as a salesperson's own account (Jason's Instagram). A connection
-- existing does NOT mean every user may publish through it.
--
-- Tokens reuse the existing encrypted-credential pattern (crypto-pii.js encryptJson, as
-- dealer_integrations does). They are never selected into an API response.
--
-- APPLIED TO STAGING ONLY.

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  provider text not null,                       -- facebook | instagram | tiktok | youtube | linkedin
  external_account_id text not null,            -- page / channel / profile id at the provider
  display_name text not null,
  handle text,
  avatar_url text,

  -- WHO owns this account. The whole authorization model turns on this.
  ownership text not null,                      -- 'dealership' | 'user'
  owner_user_id uuid references public.profiles(id) on delete set null,

  status text not null default 'connected',     -- connected | disconnected | expired | revoked
  -- What the provider ACTUALLY permits for this connection. Never assume a capability;
  -- an honest assisted workflow beats a publish button that fails at the provider.
  capabilities jsonb not null default '{}'::jsonb,

  credentials_enc text,                         -- encrypted; never returned to a client
  credentials_encryption_version int,
  token_expires_at timestamptz,

  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint social_accounts_ownership_valid check (ownership in ('dealership','user')),
  constraint social_accounts_status_valid check (status in ('connected','disconnected','expired','revoked')),
  -- A user-owned account without an owner is unattributable, and would fall through to
  -- "anyone in the dealership" on every check below.
  constraint social_accounts_owner_required check (ownership <> 'user' or owner_user_id is not null)
);
-- One connection per provider account per dealership. Connecting the same page twice would
-- otherwise create two identities with different grants.
create unique index if not exists social_accounts_identity_uk
  on public.social_accounts (dealership_id, provider, external_account_id);
create index if not exists social_accounts_owner_idx
  on public.social_accounts (dealership_id, owner_user_id) where owner_user_id is not null;
alter table public.social_accounts enable row level security;

-- An explicit grant of one account to one user. This is what lets a marketing manager
-- publish to the dealership page, and what a salesperson does NOT have for it by default.
create table if not exists public.social_account_grants (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_publish boolean not null default false,
  can_schedule boolean not null default false,
  can_approve boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now()
);
create unique index if not exists social_account_grants_uk
  on public.social_account_grants (social_account_id, user_id);
alter table public.social_account_grants enable row level security;

-- ── Posts ───────────────────────────────────────────────────────────────────
-- Composed once, then adapted per channel. The post is the intent; a target is one
-- account it goes to, and each target carries its own outcome — a post that succeeded on
-- Facebook and failed on Instagram is exactly that, not a single ambiguous "failed".
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  inventory_id uuid,                            -- the vehicle this is about, when it is about one
  body text,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  scheduled_for timestamptz,
  requires_approval boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint social_posts_status_valid check (status in
    ('draft','needs_approval','scheduled','publishing','published','partially_published','failed','cancelled'))
);
create index if not exists social_posts_dealer_idx on public.social_posts (dealership_id, status, scheduled_for);
alter table public.social_posts enable row level security;

create table if not exists public.social_post_targets (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  body_override text,                           -- channels differ; forcing one caption is wrong
  status text not null default 'pending',
  external_post_id text,
  published_at timestamptz,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_post_targets_status_valid check (status in
    ('pending','publishing','published','failed','skipped'))
);
-- One target per account per post: the same post cannot be queued twice to one account,
-- which is how a duplicate external publish would happen.
create unique index if not exists social_post_targets_uk
  on public.social_post_targets (post_id, social_account_id);
create index if not exists social_post_targets_dealer_idx
  on public.social_post_targets (dealership_id, status);
alter table public.social_post_targets enable row level security;
