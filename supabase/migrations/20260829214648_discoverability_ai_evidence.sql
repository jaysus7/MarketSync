create table if not exists public.discoverability_ai_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid references public.dealerships(id) on delete cascade,
  query_set_version text not null,
  evidence_type text not null check (evidence_type in ('live_ai_response','live_search','synthetic_test','manual_verified')),
  locale text,
  created_at timestamptz not null default now()
);

create table if not exists public.discoverability_ai_benchmark_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.discoverability_ai_benchmark_runs(id) on delete cascade,
  query text not null,
  engine text not null,
  model text,
  dealership_mentioned boolean,
  dealership_cited boolean,
  cited_urls jsonb not null default '[]'::jsonb,
  response_excerpt_hash text,
  competitors_mentioned jsonb not null default '[]'::jsonb,
  factual_accuracy boolean,
  evidence_type text not null check (evidence_type in ('live_ai_response','live_search','synthetic_test','manual_verified')),
  measured_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb
);

alter table public.discoverability_ai_benchmark_runs enable row level security;
alter table public.discoverability_ai_benchmark_evidence enable row level security;
create index if not exists discoverability_ai_runs_dealer_created_idx on public.discoverability_ai_benchmark_runs(dealership_id, created_at desc);
create index if not exists discoverability_ai_evidence_run_idx on public.discoverability_ai_benchmark_evidence(run_id);
