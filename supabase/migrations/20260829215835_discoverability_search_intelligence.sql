create table if not exists public.discoverability_search_sync_runs (
  id uuid primary key default gen_random_uuid(), dealership_id uuid references public.dealerships(id) on delete cascade,
  provider text not null, property text, status text not null, date_range jsonb, fetched_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.discoverability_search_metrics (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.discoverability_search_sync_runs(id) on delete cascade,
  metric_type text not null check (metric_type in ('query','page','query_page')), query text, page_url text, country text, device text, metric_date date,
  clicks numeric, impressions numeric, ctr numeric, position numeric, created_at timestamptz not null default now()
);
create table if not exists public.discoverability_search_opportunities (
  id uuid primary key default gen_random_uuid(), dealership_id uuid references public.dealerships(id) on delete cascade,
  opportunity_type text not null, query text, opportunity_score numeric, evidence jsonb not null default '{}'::jsonb, status text not null default 'open', created_at timestamptz not null default now()
);
create table if not exists public.discoverability_indexnow_submissions (
  id uuid primary key default gen_random_uuid(), dealership_id uuid references public.dealerships(id) on delete cascade,
  url text not null, reason text not null, provider text not null default 'indexnow', status text not null, submitted_at timestamptz, result jsonb, indexed boolean, created_at timestamptz not null default now()
);
create index if not exists discoverability_search_runs_dealer_idx on public.discoverability_search_sync_runs(dealership_id, created_at desc);
create index if not exists discoverability_search_metrics_run_idx on public.discoverability_search_metrics(run_id);
create index if not exists discoverability_search_opportunities_dealer_idx on public.discoverability_search_opportunities(dealership_id, created_at desc);
create index if not exists discoverability_indexnow_dealer_idx on public.discoverability_indexnow_submissions(dealership_id, created_at desc);
alter table public.discoverability_search_sync_runs enable row level security;
alter table public.discoverability_search_metrics enable row level security;
alter table public.discoverability_search_opportunities enable row level security;
alter table public.discoverability_indexnow_submissions enable row level security;
