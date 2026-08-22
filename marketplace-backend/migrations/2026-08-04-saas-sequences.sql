-- MarketSync HQ — customer-success sequences (Phase 3).
-- Cadences (dunning / win-back / onboarding) that MarketSync runs against its OWN
-- customers (dealership accounts). The catalog lives in code (routes/saas-sequences.js);
-- these tables track enrollment + a per-step audit log. Service-role only (HQ backend):
-- RLS is enabled with no policies, so anon/authenticated clients get nothing.

create table if not exists public.saas_sequence_enrollments (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  sequence_key  text not null,
  status        text not null default 'active',   -- active | paused | done | stopped
  current_step  int  not null default 0,          -- next step index to run
  started_at    timestamptz not null default now(),
  last_step_at  timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- At most one live (active/paused) enrollment per account per sequence — makes
-- auto-enrollment idempotent.
create unique index if not exists saas_seq_enr_live_uniq
  on public.saas_sequence_enrollments (dealership_id, sequence_key)
  where status in ('active', 'paused');
create index if not exists saas_seq_enr_status on public.saas_sequence_enrollments (status);
alter table public.saas_sequence_enrollments enable row level security;

create table if not exists public.saas_sequence_events (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.saas_sequence_enrollments(id) on delete cascade,
  dealership_id uuid not null,
  sequence_key  text not null,
  step_index    int  not null,
  action        text not null,   -- email | task
  detail        text,
  created_at    timestamptz not null default now()
);
create index if not exists saas_seq_ev_enr on public.saas_sequence_events (enrollment_id);
alter table public.saas_sequence_events enable row level security;
