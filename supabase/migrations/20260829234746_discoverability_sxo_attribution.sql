create table if not exists public.discoverability_sxo_snapshots (
  id uuid primary key default gen_random_uuid(), dealership_id uuid references public.dealerships(id) on delete cascade,
  period_start timestamptz, period_end timestamptz, event_count integer not null default 0, funnel jsonb not null default '{}'::jsonb,
  attribution jsonb not null default '{}'::jsonb, roi jsonb not null default '{}'::jsonb, evidence_coverage numeric, created_at timestamptz not null default now()
);
create table if not exists public.discoverability_attribution_links (
  id uuid primary key default gen_random_uuid(), dealership_id uuid references public.dealerships(id) on delete cascade,
  anonymous_session_id text not null, contact_id uuid, confidence text not null, source text not null, linked_at timestamptz not null default now()
);
create index if not exists discoverability_sxo_snapshots_dealer_idx on public.discoverability_sxo_snapshots(dealership_id, created_at desc);
create index if not exists discoverability_attribution_links_dealer_idx on public.discoverability_attribution_links(dealership_id, linked_at desc);
alter table public.discoverability_sxo_snapshots enable row level security;
alter table public.discoverability_attribution_links enable row level security;
