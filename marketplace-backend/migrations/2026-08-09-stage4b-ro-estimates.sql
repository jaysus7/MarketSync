-- Phase 4 Batch 1, step 2 — versioned estimates, frozen once presented.
-- Applied to STAGING only. Additive: a new table plus its own triggers, so the
-- migration is inert until code writes estimates.
--
-- The live RO keeps changing as work is discovered — that is normal. What must never
-- change is what the customer was actually shown. Each estimate snapshots the priced
-- lines at one moment; once presented_at is set the database refuses to alter or
-- delete it. Revising work means a NEW version, never an edit to the old one.
create table if not exists public.ro_estimates (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  ro_id uuid not null,
  version integer not null,
  lines_snapshot jsonb not null default '[]'::jsonb,
  labor_total numeric not null default 0,
  parts_total numeric not null default 0,
  sublet_total numeric not null default 0,
  fee_total numeric not null default 0,
  discount numeric not null default 0,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  presented_at timestamptz
);
create unique index if not exists ro_estimates_ro_version_uk on public.ro_estimates (ro_id, version);
create index if not exists ro_estimates_ro_idx on public.ro_estimates (dealership_id, ro_id, version desc);
alter table public.ro_estimates enable row level security;

-- Versions are assigned by the database, so two concurrent writers cannot mint the
-- same number and no caller can choose one.
create or replace function public.ro_estimates_assign_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(max(version), 0) + 1 into new.version
    from public.ro_estimates where ro_id = new.ro_id;
  return new;
end $$;
drop trigger if exists ro_estimates_version on public.ro_estimates;
create trigger ro_estimates_version before insert on public.ro_estimates
  for each row execute function public.ro_estimates_assign_version();

-- Once presented, an estimate is evidence: frozen in the database, not by convention.
create or replace function public.ro_estimates_immutable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.presented_at is not null then
    if new.presented_at is distinct from old.presented_at then
      raise exception 'A presented estimate cannot be re-presented' using errcode = '23514';
    end if;
    if new.version is distinct from old.version
       or new.ro_id is distinct from old.ro_id
       or new.dealership_id is distinct from old.dealership_id
       or new.lines_snapshot is distinct from old.lines_snapshot
       or new.labor_total is distinct from old.labor_total
       or new.parts_total is distinct from old.parts_total
       or new.sublet_total is distinct from old.sublet_total
       or new.fee_total is distinct from old.fee_total
       or new.discount is distinct from old.discount
       or new.subtotal is distinct from old.subtotal
       or new.tax is distinct from old.tax
       or new.total is distinct from old.total then
      raise exception 'Estimate v% was presented to the customer and cannot be changed. Create a new version.', old.version using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ro_estimates_freeze on public.ro_estimates;
create trigger ro_estimates_freeze before update on public.ro_estimates
  for each row execute function public.ro_estimates_immutable();

create or replace function public.ro_estimates_no_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.presented_at is not null then
    raise exception 'A presented estimate is evidence and cannot be deleted' using errcode = '23514';
  end if;
  return old;
end $$;
drop trigger if exists ro_estimates_nodelete on public.ro_estimates;
create trigger ro_estimates_nodelete before delete on public.ro_estimates
  for each row execute function public.ro_estimates_no_delete();
