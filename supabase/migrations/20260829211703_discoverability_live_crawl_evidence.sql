-- Batch 2: normalized evidence for public Discoverability crawls.
-- RLS keeps these internal; the authenticated backend reads them through the
-- existing service-role route after entitlement checks.
create table if not exists public.discoverability_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid references public.dealerships(id) on delete cascade,
  base_url text not null,
  status text not null check (status in ('queued','running','completed','failed')),
  options jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  page_count integer not null default 0,
  finding_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.discoverability_crawl_pages (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.discoverability_crawl_runs(id) on delete cascade,
  requested_url text not null,
  final_url text,
  status_code integer,
  content_type text,
  response_time_ms integer,
  redirect_chain jsonb not null default '[]'::jsonb,
  robots_allowed boolean,
  body_hash text,
  metadata jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists public.discoverability_crawl_findings (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.discoverability_crawl_runs(id) on delete cascade,
  url text,
  finding_type text not null,
  severity text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists discoverability_crawl_runs_dealer_created_idx on public.discoverability_crawl_runs(dealership_id, created_at desc);
create index if not exists discoverability_crawl_pages_run_idx on public.discoverability_crawl_pages(crawl_run_id);
create index if not exists discoverability_crawl_findings_run_idx on public.discoverability_crawl_findings(crawl_run_id);

alter table public.discoverability_crawl_runs enable row level security;
alter table public.discoverability_crawl_pages enable row level security;
alter table public.discoverability_crawl_findings enable row level security;
