-- Reconditioning workflow: track each vehicle from arrival to frontline-ready so
-- nothing sits un-posted because it's stuck in the detail/service bay. Feeds the
-- days-on-lot / speed-to-market story (time-in-recon before a unit can go live).
create table if not exists recon (
  id             uuid primary key default gen_random_uuid(),
  dealership_id  uuid not null references dealerships(id) on delete cascade,
  inventory_id   uuid not null references inventory(id) on delete cascade,
  -- arrived | mechanical | parts | detail | photos | frontline
  stage          text not null default 'arrived',
  assigned_to    uuid references profiles(id) on delete set null,
  notes          text,
  started_at     timestamptz default now(),   -- entered recon
  stage_since    timestamptz default now(),   -- entered the current stage (time-in-stage)
  done_at        timestamptz,                 -- reached frontline-ready
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (inventory_id)                        -- one recon record per vehicle
);

create index if not exists recon_dealership_stage_idx on recon (dealership_id, stage);

alter table recon enable row level security;

-- Direct Data API access is intentionally denied. The backend enforces RBAC.
drop policy if exists "recon_read" on recon;
drop policy if exists "recon_write" on recon;
