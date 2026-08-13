-- Workflow Engine — Stage 4.1: system_action_runs (executor retry ledger).
--
-- Every system action the engine dispatches (email, sms, vin_decode, carfax,
-- accounting, webhook, …) is executed through a single action_executor and its
-- attempt is recorded here. This is what makes side effects retry-safe and
-- auditable: on a transient failure the run stays 'failed' with next_retry_at set,
-- a background worker retries with backoff, and after max_attempts it goes 'dead'
-- and raises an exception + notifies the manager. Provider responses are captured
-- for support/debugging.
--
-- Service-role-only (RLS enabled, no policies) — engine-internal, like the rest of
-- the workflow spine. Already applied to project omyuqzveegzspeojrqkd.

create table if not exists public.system_action_runs (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  workflow_instance_id uuid,
  workflow_step_id uuid,
  action_type text not null,               -- email | sms | vin_decode | carfax | accounting | webhook | notification
  executor text,                           -- which executor handled it (resolved from action_type)
  entity_type text,
  entity_id uuid,
  status text not null default 'pending',  -- pending | running | succeeded | failed | dead
  attempts int not null default 0,
  max_attempts int not null default 3,
  error text,
  provider_response jsonb,
  payload jsonb not null default '{}',     -- executor input (recipient, body, vin, deal_id, url, …)
  next_retry_at timestamptz,               -- when a failed run becomes eligible again
  executed_at timestamptz,                 -- last attempt time
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Retry worker scans due failures; dashboards scan by dealership + status.
create index if not exists sar_retry_idx  on public.system_action_runs (status, next_retry_at);
create index if not exists sar_dealer_idx on public.system_action_runs (dealership_id, status, created_at desc);
create index if not exists sar_wf_idx     on public.system_action_runs (workflow_instance_id);

alter table public.system_action_runs enable row level security;
