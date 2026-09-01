-- Batch 8A: canonical finding/recommendation models and durable autopilot core.
-- Public crawl/evidence tables from Batches 1–7 remain the source of truth.
create table if not exists public.discoverability_findings (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  pillar text not null,
  category text,
  type text not null,
  severity text not null,
  status text not null default 'open' check (status in ('open','resolved','regressed','dismissed')),
  affected_urls jsonb not null default '[]'::jsonb,
  entity_type text,
  entity_id text,
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  source_run_id uuid,
  source_type text not null,
  confidence numeric,
  fingerprint text not null,
  resolved_at timestamptz,
  recurrence_count integer not null default 0,
  unique (dealership_id, fingerprint)
);

create table if not exists public.discoverability_recommendations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  finding_ids jsonb not null default '[]'::jsonb,
  pillar text not null,
  title text not null,
  summary text,
  rationale text,
  execution_class text not null check (execution_class in ('auto_fixable','approval_required','manual')),
  risk_level text not null check (risk_level in ('low','medium','high')),
  confidence numeric,
  status text not null default 'detected',
  affected_urls jsonb not null default '[]'::jsonb,
  recommended_change jsonb,
  apply_strategy jsonb,
  expected_evidence jsonb,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  applied_at timestamptz,
  published_at timestamptz,
  validated_at timestamptz,
  unique (dealership_id, fingerprint)
);

create table if not exists public.discoverability_autopilot_queue (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  recommendation_id uuid not null references public.discoverability_recommendations(id) on delete cascade,
  mode text not null check (mode in ('monitor','recommend','auto_fix')),
  status text not null,
  idempotency_key text not null,
  risk_decision jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  evidence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealership_id, idempotency_key)
);

create table if not exists public.discoverability_autopilot_transitions (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.discoverability_autopilot_queue(id) on delete cascade,
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  from_status text,
  to_status text not null,
  evidence jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.discoverability_validation_jobs (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  deployment_id uuid,
  revision_id uuid,
  recommendation_id uuid references public.discoverability_recommendations(id) on delete set null,
  affected_urls jsonb not null default '[]'::jsonb,
  expected_state jsonb not null default '{}'::jsonb,
  observed_state jsonb,
  status text not null default 'published_pending_validation',
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.discoverability_autopilot_settings (
  dealership_id uuid primary key references public.dealerships(id) on delete cascade,
  mode text not null default 'monitor' check (mode in ('monitor','recommend','auto_fix')),
  max_automatic_fixes_per_day integer not null default 10,
  max_pages_per_batch integer not null default 25,
  max_simultaneous_deployments integer not null default 1,
  max_recrawl_volume integer not null default 100,
  minimum_confidence numeric not null default 90,
  cooldown_seconds integer not null default 300,
  updated_at timestamptz not null default now()
);

create index if not exists discoverability_findings_dealer_status_idx on public.discoverability_findings(dealership_id, status, last_observed_at desc);
create index if not exists discoverability_recommendations_dealer_status_idx on public.discoverability_recommendations(dealership_id, status, created_at desc);
create index if not exists discoverability_autopilot_queue_dealer_status_idx on public.discoverability_autopilot_queue(dealership_id, status, created_at desc);
create index if not exists discoverability_validation_jobs_dealer_status_idx on public.discoverability_validation_jobs(dealership_id, status, created_at desc);

alter table public.discoverability_findings enable row level security;
alter table public.discoverability_recommendations enable row level security;
alter table public.discoverability_autopilot_queue enable row level security;
alter table public.discoverability_autopilot_transitions enable row level security;
alter table public.discoverability_validation_jobs enable row level security;
alter table public.discoverability_autopilot_settings enable row level security;
