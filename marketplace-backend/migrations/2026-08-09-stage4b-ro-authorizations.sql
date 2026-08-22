-- Phase 4 Batch 1, step 3 — customer authorization as permanent evidence.
-- Applied to STAGING only. Additive: a new table plus its own triggers.
--
-- Authorization is never edited and never deleted, not even when newer work
-- supersedes it. A dealership must be able to prove, months later: the customer
-- approved v1 at 10:42, then additional work was found, v2 was issued, and a second
-- approval was required.
--
-- "Is this RO authorized?" is therefore NOT a flag anyone writes. It is DERIVED from
-- the newest presented estimate plus the decision recorded against that exact version.
create table if not exists public.ro_authorizations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  ro_id uuid not null,
  estimate_id uuid not null,
  decision text not null check (decision in ('approved','declined','deferred')),
  approved_amount numeric,
  authorized_party_name text,
  contact_id uuid,
  method text not null check (method in ('in_person','phone','sms','email','esign','portal')),
  decided_at timestamptz not null default now(),
  captured_by uuid,
  decline_reason text,
  evidence jsonb not null default '{}'::jsonb,
  esign_request_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists ro_auth_idempotency_uk
  on public.ro_authorizations (dealership_id, idempotency_key) where idempotency_key is not null;
create index if not exists ro_auth_ro_idx on public.ro_authorizations (dealership_id, ro_id, decided_at desc);
create index if not exists ro_auth_estimate_idx on public.ro_authorizations (estimate_id, decided_at desc);
alter table public.ro_authorizations enable row level security;

-- Evidence must point at an estimate on the SAME repair order and dealership, and at
-- one the customer was actually shown. A decline must say why.
create or replace function public.ro_auth_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_est public.ro_estimates%rowtype;
begin
  select * into v_est from public.ro_estimates where id = new.estimate_id;
  if not found then raise exception 'estimate not found' using errcode = '23503'; end if;
  if v_est.ro_id is distinct from new.ro_id or v_est.dealership_id is distinct from new.dealership_id then
    raise exception 'Authorization must reference an estimate on the same repair order and dealership'
      using errcode = '23514';
  end if;
  if v_est.presented_at is null then
    raise exception 'Estimate v% has not been presented to the customer yet', v_est.version
      using errcode = '23514';
  end if;
  if new.decision = 'declined' and nullif(btrim(coalesce(new.decline_reason,'')),'') is null then
    raise exception 'A decline must record why' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists ro_auth_validate_trg on public.ro_authorizations;
create trigger ro_auth_validate_trg before insert on public.ro_authorizations
  for each row execute function public.ro_auth_validate();

create or replace function public.ro_auth_immutable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Customer authorization is immutable evidence: it cannot be % ',
    case when tg_op = 'DELETE' then 'deleted' else 'modified' end using errcode = '23514';
end $$;
drop trigger if exists ro_auth_freeze on public.ro_authorizations;
create trigger ro_auth_freeze before update or delete on public.ro_authorizations
  for each row execute function public.ro_auth_immutable();
