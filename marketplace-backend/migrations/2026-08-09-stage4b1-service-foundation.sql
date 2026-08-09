-- Phase 4 (PR 4.1) — Fixed Ops foundation: customer-owned vehicles, an idempotent
-- appointment check-in, a real Ready timestamp, and a Service permission split.
--
-- Applied to STAGING (hpxnjbdiaaoopxeayfen) only. Production (omyuqzveegzspeojrqkd)
-- is untouched and requires a separate deliberate decision.
--
-- Everything here is additive. No column is dropped, no data is rewritten, and every
-- existing repair order keeps working: the new vehicle link is nullable and the legacy
-- free-text `vehicle_desc` / `vin` fields stay exactly as they are.

-- ── 1. Service appointment state ─────────────────────────────────────────────
-- `routes/service.js` has always selected `crm_tasks.status`, but the column never
-- existed — PostgREST errored, the route swallowed it, and the appointment list came
-- back empty for every dealership (Stage 4A audit, finding B1). The fix is the column
-- the code already expects, not a second appointment system: Service appointments stay
-- crm_tasks on the same unified contact.
alter table public.crm_tasks add column if not exists status text;
alter table public.crm_tasks add column if not exists arrived_at timestamptz;

comment on column public.crm_tasks.status is
  'Service appointment state: scheduled | arrived | no_show | converted | canceled. Null = scheduled.';

-- ── 2. Customer-owned vehicles ───────────────────────────────────────────────
-- `inventory` is DEALER-OWNED stock. A customer''s car is not stock and must never be
-- inserted there (it would corrupt counts, merchandising, pricing, syndication and the
-- Stage 3 acquisition model). This is the canonical customer-owned vehicle.
create table if not exists public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  contact_id uuid,                        -- current owner; may change hands
  vin text,
  year integer,
  make text,
  model text,
  trim text,
  plate text,
  color text,
  current_odometer integer,
  -- Sold-vehicle continuity: when this car was once our stock, keep the link instead of
  -- inventing an unrelated identity. The inventory row still says the dealer sold it —
  -- it is NOT made to pretend the dealer still owns it.
  origin_inventory_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One vehicle per VIN per dealership, so the same car returning for service resolves to
-- the SAME record instead of a new one every visit. VIN is optional (older units, no
-- plate/VIN on file), so the constraint is partial and case-insensitive.
create unique index if not exists customer_vehicles_dealer_vin_uk
  on public.customer_vehicles (dealership_id, upper(vin))
  where vin is not null and length(btrim(vin)) > 0;

create index if not exists customer_vehicles_contact_idx
  on public.customer_vehicles (dealership_id, contact_id);
create index if not exists customer_vehicles_origin_idx
  on public.customer_vehicles (origin_inventory_id)
  where origin_inventory_id is not null;

-- Engine-internal table: service-role only, matching repair_orders / parts / part_txns.
alter table public.customer_vehicles enable row level security;

-- ── 3. Repair order ↔ customer vehicle ───────────────────────────────────────
-- Nullable on purpose: every historical RO keeps its free-text vehicle and nothing is
-- backfilled. New work resolves a canonical vehicle; old work stays readable.
alter table public.repair_orders add column if not exists customer_vehicle_id uuid;
create index if not exists repair_orders_customer_vehicle_idx
  on public.repair_orders (dealership_id, customer_vehicle_id)
  where customer_vehicle_id is not null;

-- ── 4. Check-in idempotency ──────────────────────────────────────────────────
-- One appointment produces exactly ONE repair order. This is enforced by the database,
-- not by the interface: a double-click, a retry or two advisors checking the same
-- customer in at once all collide here and the loser re-reads the winner''s RO.
create unique index if not exists repair_orders_appointment_uk
  on public.repair_orders (appointment_task_id)
  where appointment_task_id is not null;

-- ── 5. Ready is not Closed ───────────────────────────────────────────────────
-- Operational completion, timestamped once on the genuine transition into `ready` so
-- "ready awaiting customer" can actually age. Re-entering ready does not rewrite it;
-- returning to active work clears it (see setRoStatus).
alter table public.repair_orders add column if not exists ready_at timestamptz;

-- ── 6. Repair-order status vocabulary — ALIGN THE CODE, NOT THE DATABASE ─────
-- Found while proving check-in idempotency against the live database, and missed by
-- the Stage 4A audit, which read columns but not constraints or triggers.
--
-- `repair_orders` already carries the FULL canonical Fixed Ops control layer:
--   * check constraint `repair_orders_status_valid` — a 12-state vocabulary
--   * trigger `repair_orders_state_machine` -> controls.enforce_state_transition,
--     driven by `controls.state_transitions`, with a required permission and an
--     optional required reason PER EDGE
--   * further triggers for business invariants, a terminal guard, row versioning,
--     soft-delete metadata and tenant-relationship enforcement
--
-- The engine writes a different, simpler vocabulary (`open`, `awaiting_parts`,
-- `canceled`) that the database has never accepted. `openRepairOrder` inserts
-- status 'open', which the check constraint rejects outright -- which is why staging
-- holds ZERO repair orders.
--
-- The database is right and the code is wrong, so this migration deliberately
-- changes NOTHING here. Widening the constraint to admit 'open' would let a repair
-- order be created in a state the transition graph has no edges out of: a unit that
-- can be opened and then never moved. The fix belongs in `service-engine.js`, which
-- now speaks the database's vocabulary.

-- ── 7. Service permission split ──────────────────────────────────────────────
-- Stage 4A finding: every /service-engine route — reads included — required
-- `service.write_repair_order`, so a general manager could not read an RO while a
-- technician could close one and post its journal. Closing an RO is a FINANCIAL
-- transition and now needs its own permission.
insert into public.permissions (id, description)
  values ('service.close_repair_order', 'Close a repair order — finalizes totals and posts the accounting journal')
on conflict (id) do nothing;

-- Close: management and the service desk. Deliberately NOT the technician — completing
-- work is not the same business act as resolving the customer''s money.
insert into public.role_permissions (role_id, permission_id)
select r, 'service.close_repair_order'
from unnest(array['platform_owner','dealer_group_owner','dealer_owner','general_manager','service_manager']) r
on conflict do nothing;

-- A general manager could hold `service.view` and `service.reopen_repair_order` but not
-- `service.write_repair_order`, which left them unable to act on the shop they run.
insert into public.role_permissions (role_id, permission_id)
values ('general_manager', 'service.write_repair_order')
on conflict do nothing;
