-- Service & Parts Engine — Stage 1 (schema).
--
-- Repair orders + parts become first-class, event-driven objects on the kernel. The
-- engine owns these four tables; accounting is already wired (service.closed →
-- service_closed rule), so the engine's financial duty is only to EMIT service.closed.
--
-- All engine-internal: service-role-only RLS (enable, no policies).

-- ── Repair orders ────────────────────────────────────────────────────────────
create table if not exists public.repair_orders (
  id                uuid primary key default gen_random_uuid(),
  dealership_id     uuid not null,
  ro_number         text,                       -- dealer-friendly (ro_prefix + seq)
  contact_id        uuid,                       -- CRM customer (unified record)
  inventory_id      uuid,                       -- vehicle if it's a lot unit
  vehicle_desc      text,                       -- free text for customer-owned cars
  vin               text,
  odometer          integer,
  advisor_id        uuid,                       -- profiles.id
  technician_id     uuid,                       -- profiles.id
  status            text not null default 'open',
  complaint         text,
  labor_total       numeric not null default 0,
  parts_total       numeric not null default 0,
  sublet_total      numeric not null default 0,
  fee_total         numeric not null default 0,
  discount          numeric not null default 0,
  tax               numeric not null default 0,
  total             numeric not null default 0,
  labor_cost        numeric not null default 0, -- COGS side
  parts_cost        numeric not null default 0,
  appointment_task_id uuid,                     -- crm_tasks appointment this RO came from
  opened_at         timestamptz not null default now(),
  promised_at       timestamptz,
  closed_at         timestamptz,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ro_dealer_status_idx on public.repair_orders (dealership_id, status);
create index if not exists ro_dealer_contact_idx on public.repair_orders (dealership_id, contact_id);

-- ── RO line items ────────────────────────────────────────────────────────────
create table if not exists public.ro_lines (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  ro_id         uuid not null,
  line_type     text not null default 'labor',  -- labor | part | sublet | fee
  part_id       uuid,                            -- when line_type = 'part'
  description   text,
  qty           numeric not null default 1,
  hours         numeric,                         -- labor hours
  rate          numeric,                         -- labor rate applied
  unit_cost     numeric not null default 0,
  unit_price    numeric not null default 0,
  total         numeric not null default 0,      -- extended price
  tech_id       uuid,
  created_at    timestamptz not null default now()
);
create index if not exists ro_lines_ro_idx on public.ro_lines (ro_id);

-- ── Parts catalog + on-hand stock ────────────────────────────────────────────
create table if not exists public.parts (
  id             uuid primary key default gen_random_uuid(),
  dealership_id  uuid not null,
  part_number    text not null,
  description    text,
  bin            text,
  qty_on_hand    numeric not null default 0,
  cost           numeric not null default 0,
  price          numeric not null default 0,
  reorder_point  numeric not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists parts_dealer_number_idx on public.parts (dealership_id, part_number);

-- ── Immutable stock ledger ───────────────────────────────────────────────────
create table if not exists public.part_txns (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  part_id       uuid not null,
  txn_type      text not null,                   -- receive | consume | adjust | return
  qty           numeric not null,                -- signed: +receive/+return, -consume
  unit_cost     numeric,
  ro_id         uuid,                            -- when consumed on an RO
  reference     text,                            -- PO / dedupe key
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists part_txns_dealer_part_idx on public.part_txns (dealership_id, part_id);
create index if not exists part_txns_ro_idx on public.part_txns (ro_id);

-- Engine-internal tables: service-role only.
alter table public.repair_orders enable row level security;
alter table public.ro_lines      enable row level security;
alter table public.parts         enable row level security;
alter table public.part_txns     enable row level security;

-- ── Department ownership for RO states (Operations board + exception aging) ───
insert into public.state_ownership (dealership_id, entity_type, state, department)
select null, 'repair_order', v.state, v.dept
from (values
  ('open','Service'), ('in_progress','Service'), ('awaiting_parts','Service'),
  ('ready','Service'), ('canceled','Service'), ('closed','Accounting')
) as v(state, dept)
where not exists (
  select 1 from public.state_ownership s
  where s.dealership_id is null and s.entity_type='repair_order' and s.state=v.state
);

-- ── Global default service config (contract §6 — read via getConfig) ──────────
insert into public.dealer_config (dealership_id, key, value)
select null, 'service',
       '{"labor_rate":149,"tax_rate":0,"shop_supplies_pct":0,"part_markup_pct":40,"ro_prefix":"RO-"}'::jsonb
where not exists (
  select 1 from public.dealer_config c where c.dealership_id is null and c.key='service'
);
