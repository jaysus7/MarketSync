-- Shared Social OAuth connection sessions.
-- Tokens remain encrypted and are held only until the dealer selects an account.
create table if not exists public.social_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  state_hash text not null unique,
  ownership text not null default 'dealership',
  owner_user_id uuid references public.profiles(id) on delete set null,
  credentials_enc text not null,
  credentials_encryption_version smallint not null default 1,
  candidate_credentials_enc text,
  candidates jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  expires_at timestamptz not null,
  selected_account_id uuid references public.social_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint social_oauth_sessions_status_valid check (status in ('pending','consumed','expired','failed')),
  constraint social_oauth_sessions_ownership_valid check (ownership in ('dealership','user'))
);
create index if not exists social_oauth_sessions_dealer_idx
  on public.social_oauth_sessions (dealership_id, status, expires_at);
alter table public.social_oauth_sessions enable row level security;

alter table public.social_accounts
  add column if not exists capability_evidence jsonb not null default '{}'::jsonb;
