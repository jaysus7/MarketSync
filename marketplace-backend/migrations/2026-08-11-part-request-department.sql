-- Parts: who asked for this part?
--
-- Every part request was, structurally, a Service request: part_requests.ro_id was NOT
-- NULL, so the only way to ask Parts for anything was to open a repair order. A counter
-- customer buying a filter, or a salesperson needing a floor mat for a delivery, had
-- nowhere to go — which is why the Requests screen could only ever show one kind of
-- demand and Parts had no idea who the rest of its day was for.
--
-- One column answers it, and one relaxed constraint makes the non-Service cases
-- expressible at all.
--
-- STAGING ONLY (hpxnjbdiaaoopxeayfen) pending 9A convergence. Every existing row is a
-- Service request against a real RO, so the default backfills them correctly and the
-- new check constraint cannot fail on current data.

alter table public.part_requests add column if not exists requested_for text not null default 'service';

alter table public.part_requests drop constraint if exists part_requests_requested_for_valid;
alter table public.part_requests
  add constraint part_requests_requested_for_valid
  check (requested_for in ('service', 'sales', 'customer', 'internal'));

-- A counter sale has no repair order. A Service request still must have one — dropping
-- NOT NULL without this would let a Service request float free of the job it is for.
alter table public.part_requests alter column ro_id drop not null;

alter table public.part_requests drop constraint if exists part_requests_service_needs_ro;
alter table public.part_requests
  add constraint part_requests_service_needs_ro
  check (requested_for <> 'service' or ro_id is not null);

-- The Requests screen groups by department first.
create index if not exists part_requests_department_idx
  on public.part_requests (dealership_id, requested_for, status);

-- RLS on part_requests is unchanged: its policies key off dealership_id, and neither
-- the new column nor the relaxed NOT NULL touches that.
