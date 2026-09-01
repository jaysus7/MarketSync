create table if not exists public.discoverability_search_impacts (
  id uuid primary key default gen_random_uuid(), recommendation_id text not null, dealership_id uuid references public.dealerships(id) on delete cascade,
  url text, query text, baseline_period jsonb, baseline_metrics jsonb, applied_at timestamptz, measurement_start_at timestamptz,
  post_change_metrics jsonb, status text not null default 'baseline_captured', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.discoverability_validation_jobs (
  id uuid primary key default gen_random_uuid(), dealership_id uuid references public.dealerships(id) on delete cascade, deployment_id uuid, revision_id uuid,
  affected_urls jsonb not null default '[]'::jsonb, status text not null default 'published_pending_validation', expected_state jsonb not null default '{}'::jsonb,
  observed_state jsonb, error text, created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.discoverability_local_rank_evidence (
  id uuid primary key default gen_random_uuid(), dealership_id uuid references public.dealerships(id) on delete cascade, query text, location text, grid_point jsonb,
  provider text, measured_at timestamptz, organic_position numeric, local_pack_position numeric, map_position numeric,
  evidence_type text not null check (evidence_type in ('live_search','synthetic_test','manual_verified')), status text not null, created_at timestamptz not null default now()
);
create index if not exists discoverability_search_impacts_dealer_idx on public.discoverability_search_impacts(dealership_id, created_at desc);
create index if not exists discoverability_validation_jobs_dealer_idx on public.discoverability_validation_jobs(dealership_id, created_at desc);
create index if not exists discoverability_local_rank_dealer_idx on public.discoverability_local_rank_evidence(dealership_id, measured_at desc);
alter table public.discoverability_search_impacts enable row level security;
alter table public.discoverability_validation_jobs enable row level security;
alter table public.discoverability_local_rank_evidence enable row level security;
