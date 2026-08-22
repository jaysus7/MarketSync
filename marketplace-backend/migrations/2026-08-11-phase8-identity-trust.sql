-- Phase 8.3 — canonical, purpose-scoped Identity & Trust.
-- Provider sessions are evidence references, never customer-level booleans. Raw document and
-- biometric media remain with the provider; MarketSync stores only normalized outcomes.

insert into public.permissions (id, description) values
  ('identity.view', 'View permissioned identity verification results'),
  ('identity.request', 'Request identity verification for a customer'),
  ('identity.review', 'Manually review identity verification evidence'),
  ('identity.override', 'Override an identity verification decision')
on conflict (id) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role_id, permission_id from
  (values
    ('dealer_group_owner','identity.view'),('dealer_group_owner','identity.request'),('dealer_group_owner','identity.review'),('dealer_group_owner','identity.override'),
    ('dealer_owner','identity.view'),('dealer_owner','identity.request'),('dealer_owner','identity.review'),('dealer_owner','identity.override'),
    ('general_manager','identity.view'),('general_manager','identity.request'),('general_manager','identity.review'),
    ('sales_manager','identity.view'),('sales_manager','identity.request'),
    ('fni_manager','identity.view'),('fni_manager','identity.request'),('fni_manager','identity.review'),
    ('salesperson','identity.view'),('salesperson','identity.request')
  ) grants(role_id, permission_id)
on conflict do nothing;

-- The composite target makes a cross-dealer customer reference structurally impossible.
create unique index if not exists contacts_id_dealership_identity_uk
  on public.contacts (id, dealership_id);

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  provider text not null check (provider in ('marketsync_native','stripe','persona')),
  provider_reference text,
  purpose text not null check (purpose in ('test_drive','credit_application','remote_purchase','esign','payment','delivery')),
  decision text not null default 'pending' check (decision in ('pending','processing','verified','manual_review','failed','expired','cancelled')),
  document_type text,
  document_result text check (document_result is null or document_result in ('passed','review','failed','unknown')),
  live_face_result text check (live_face_result is null or live_face_result in ('passed','review','failed','unknown')),
  liveness_result text check (liveness_result is null or liveness_result in ('passed','review','failed','unknown')),
  face_match_score numeric(5,2) check (face_match_score is null or (face_match_score between 0 and 100)),
  legal_name text,
  date_of_birth date,
  verified_address jsonb,
  masked_document_number text,
  document_expiry date,
  issuing_jurisdiction text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  requested_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_reason text,
  machine_decision text check (machine_decision is null or machine_decision in ('pending','processing','verified','manual_review','failed','expired','cancelled')),
  override_reason text,
  provider_version text,
  model_version text,
  evidence_reference text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dealership_id, provider, provider_reference),
  unique (id, dealership_id),
  foreign key (contact_id, dealership_id) references public.contacts(id, dealership_id) on delete cascade
);

create index if not exists identity_verifications_contact_idx
  on public.identity_verifications (dealership_id, contact_id, requested_at desc);
create index if not exists identity_verifications_review_idx
  on public.identity_verifications (dealership_id, decision, requested_at desc)
  where decision = 'manual_review';

alter table public.identity_verifications enable row level security;

drop policy if exists identity_verifications_select on public.identity_verifications;
create policy identity_verifications_select on public.identity_verifications for select
  using (authz.has_permission(dealership_id, 'identity.view'));

drop policy if exists identity_verifications_insert on public.identity_verifications;
create policy identity_verifications_insert on public.identity_verifications for insert
  with check (authz.has_permission(dealership_id, 'identity.request'));

drop policy if exists identity_verifications_review on public.identity_verifications;
create policy identity_verifications_review on public.identity_verifications for update
  using (authz.has_permission(dealership_id, 'identity.review'))
  with check (authz.has_permission(dealership_id, 'identity.review'));

create or replace function public.touch_identity_verification_updated_at()
returns trigger language plpgsql as $fn$
begin new.updated_at = now(); return new; end $fn$;

drop trigger if exists identity_verification_touch on public.identity_verifications;
create trigger identity_verification_touch before update on public.identity_verifications
for each row execute function public.touch_identity_verification_updated_at();

grant select, insert, update, delete on table public.identity_verifications to service_role, authenticated, postgres, anon;

