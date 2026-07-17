-- ─────────────────────────────────────────────────────────────────────────────
-- F&I foundation: credit applications + the security groundwork they ride on.
--
-- This is the spine for desking real deals and, later, pushing credit apps to
-- RouteOne / Dealertrack and pulling Carfax. Sensitive PII (SIN / DOB / vendor
-- credentials) is stored ENCRYPTED at rest (AES-256-GCM, app-layer, keyed by the
-- PII_ENCRYPTION_KEY env var) — never in plaintext columns. Every decrypt/export is
-- written to sensitive_access_log so we have the audit trail partner security
-- reviews (Dealertrack et al.) require.
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-dealer credentials for the gated enterprise networks. The secret lives in
-- credentials_enc (encrypted blob); we NEVER return it to the client — only whether
-- it's configured. lender_code_map maps our internal lender/program ids to each
-- vendor's codes (Dealertrack/RouteOne assign these during onboarding).
create table if not exists dealer_integrations (
  id              uuid primary key default gen_random_uuid(),
  dealership_id   uuid not null references dealerships(id) on delete cascade,
  provider        text not null,                       -- carfax | routeone | dealertrack
  enabled         boolean default false,
  credentials_enc text,                                -- AES-256-GCM of a JSON credential blob
  lender_code_map jsonb default '{}'::jsonb,
  status          text default 'not_connected',        -- not_connected | configured | sandbox | live | error
  last_status_at  timestamptz,
  updated_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (dealership_id, provider)
);
create index if not exists dealer_integrations_dealer_idx on dealer_integrations (dealership_id);
alter table dealer_integrations enable row level security;

-- Audit trail for any access to sensitive data (reveal a SIN, export a credit app,
-- submit to a lender). Backend uses the service role; this is the compliance record.
create table if not exists sensitive_access_log (
  id             uuid primary key default gen_random_uuid(),
  dealership_id  uuid references dealerships(id) on delete cascade,
  actor_id       uuid references profiles(id) on delete set null,
  entity         text,                                 -- e.g. credit_application
  entity_id      uuid,
  action         text,                                 -- reveal | export | submit
  detail         text,
  ip             text,
  created_at     timestamptz default now()
);
create index if not exists sensitive_access_log_dealer_idx on sensitive_access_log (dealership_id, created_at desc);
alter table sensitive_access_log enable row level security;

-- The credit application itself. Non-sensitive data lives in jsonb blocks
-- (applicant / co_applicant / financing / vehicle) so the schema can flex with the
-- lender forms; the truly sensitive values (SIN, DOB) are in *_enc columns, with a
-- non-reversible mask (*_mask, e.g. •••••1234) stored for display without decrypting.
create table if not exists credit_applications (
  id                 uuid primary key default gen_random_uuid(),
  dealership_id      uuid not null references dealerships(id) on delete cascade,
  deal_id            uuid references deals(id) on delete set null,
  contact_id         uuid references contacts(id) on delete set null,
  created_by         uuid references profiles(id) on delete set null,
  status             text default 'draft',             -- draft | ready | submitted | approved | conditioned | declined
  applicant          jsonb default '{}'::jsonb,        -- name, contact, residence, employment, income, references
  co_applicant       jsonb,                            -- same shape, or null when none
  applicant_sin_enc  text,
  applicant_dob_enc  text,
  applicant_sin_mask text,
  co_sin_enc         text,
  co_dob_enc         text,
  co_sin_mask        text,
  financing          jsonb default '{}'::jsonb,        -- price, tax, fees, trade, down, rebate, amount financed, apr, term, payment, lender, program
  vehicle            jsonb default '{}'::jsonb,         -- year/make/model/trim/vin/mileage/stock/inventory_id
  consent            boolean default false,            -- credit-pull authorization from the applicant
  consent_at         timestamptz,
  consent_ip         text,
  consent_method     text,                             -- e-sign | verbal | paper
  provider           text,                             -- routeone | dealertrack | manual
  provider_ref       text,                             -- vendor's reference / deal number
  decision           jsonb,                            -- lender decisions (status, rate, term, amount, stips)
  submitted_at       timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (deal_id)
);
create index if not exists credit_applications_dealer_idx on credit_applications (dealership_id, status);
create index if not exists credit_applications_contact_idx on credit_applications (contact_id);
alter table credit_applications enable row level security;
