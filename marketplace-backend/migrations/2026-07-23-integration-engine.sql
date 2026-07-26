-- Integration Engine (Phase 4 of the AI Engine / DealerOS).
--
-- MarketSync stays the source of truth; the Integration Engine syncs a COPY of
-- every captured lead OUT to the dealer's CRM via their chosen method (api / adf /
-- webhook / extension). It subscribes to the kernel `lead.created` event, so it
-- covers manual leads and AI-captured leads through one path.
--
-- integration_deliveries is the delivery ledger: one row per (dealership, entity,
-- method) so a lead is pushed exactly once. A unique index enforces the dedupe.
--
-- The dealer's chosen method lives in the Configuration Engine under the
-- `crm_integration` key (seeded below), NOT in this table.

create table if not exists public.integration_deliveries (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  entity_type   text not null default 'lead',   -- 'lead' | 'customer'
  entity_id     uuid not null,
  method        text not null,                  -- 'api' | 'adf' | 'webhook' | 'extension'
  status        text not null default 'sent',   -- 'sent' | 'queued' | 'acked' | 'failed'
  provider      text,                           -- CRM/name that received it
  payload       jsonb,                          -- queued lead payload (extension/api)
  response      text,                           -- provider response / destination
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Dedupe: a lead is delivered at most once per method.
create unique index if not exists integ_deliv_dedupe
  on public.integration_deliveries (dealership_id, entity_id, method);

-- Queue / delivery-log lookups.
create index if not exists integ_deliv_queue_idx
  on public.integration_deliveries (dealership_id, method, status);

-- Engine-internal table: service-role only (enable RLS, add no policies).
alter table public.integration_deliveries enable row level security;

-- Seed the GLOBAL default outbound config (dealership_id null). The Configuration
-- Engine resolves dealer → global → fallback, so every dealer inherits this until
-- they set their own crm_integration. Method defaults to 'adf' (industry-standard;
-- almost every CRM ingests ADF email).
insert into public.dealer_config (dealership_id, key, value)
select null, 'crm_integration',
       '{"method":"adf","crm":"Other","lead_email":"","webhook_url":"","api":{}}'::jsonb
where not exists (
  select 1 from public.dealer_config c
  where c.dealership_id is null and c.key = 'crm_integration'
);
