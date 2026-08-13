-- Phase 7 PR 7.6 — the Dealer Launch Hub: canonical operating configuration.
--
-- A CORRECTION TO G7, made after reading the schema rather than assuming. The truth check said
-- "no canonical location or dealership operating configuration". That was too broad:
-- `dealerships` already carries `legal_name`, `street_address`, `city`, `province`, `country`,
-- `postal_code`, `phone`, `hst_number` and `omvic_reg`. Those columns are real and correctly
-- placed.
--
-- What is ACTUALLY missing is narrower and worse:
--
--   • **Timezone.** Absent entirely. Every date this product computes — a training due date, an
--     accounting period, a repair-order promised time, "is this shift overnight" — is evaluated
--     in UTC. A dealership in Vancouver closing its month on the 31st is closing it at 5pm on
--     the 31st, and nothing in the system knows that.
--   • **Operating hours.** Absent. Nothing can say whether the store is open, which is what
--     turns "no response in 20 minutes" into either a problem or a Sunday.
--   • **Locations.** Absent. `group_id` handles dealer groups; a single dealership with two
--     rooftops has nowhere to put the second.
--
-- And the columns that DO exist are empty: 0 of 7 dealerships have an address or a legal name.
-- The configuration surface was never the gap — nothing ever asked anybody to fill it in. That
-- is what the Launch Hub is for.
--
-- APPLIED TO STAGING ONLY.

-- ── Timezone ────────────────────────────────────────────────────────────────
-- No default. A guessed timezone is worse than a missing one: it silently produces dates that
-- are wrong by hours, and nobody looks at a field that already has a value in it. The Launch
-- Hub asks for it, and `REQUIRED_TO_LAUNCH` is what makes that unavoidable.
alter table public.dealerships add column if not exists timezone text;

-- Validated against the database's own zone table, so a typo cannot be stored and then
-- silently mis-shift every date the dealership sees. A trigger rather than a check constraint,
-- because a check constraint may not contain a subquery — and validating against a hard-coded
-- list would go stale the next time a country changes its rules.
create or replace function public.validate_timezone()
returns trigger language plpgsql as $fn$
begin
  if new.timezone is not null
     and not exists (select 1 from pg_timezone_names z where z.name = new.timezone) then
    raise exception '% is not a timezone this database recognises', new.timezone;
  end if;
  return new;
end $fn$;

drop trigger if exists dealerships_timezone_valid on public.dealerships;
create trigger dealerships_timezone_valid
  before insert or update of timezone on public.dealerships
  for each row execute function public.validate_timezone();

-- ── Operating hours ─────────────────────────────────────────────────────────
-- Per weekday, `{"mon": {"open": "09:00", "close": "18:00"}, ...}`; a missing or null day means
-- closed. Kept as jsonb rather than seven column pairs because departments have different
-- hours (Service opens before Sales) and that shape is coming.
alter table public.dealerships add column if not exists operating_hours jsonb;

-- ── Locations ───────────────────────────────────────────────────────────────
-- One row per rooftop. A dealership with a single location gets exactly one, created by the
-- Launch Hub from the dealership's own address, so "enter once" is true: nobody types their
-- address twice to satisfy two different screens.
create table if not exists public.dealership_locations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  name text not null,
  -- The one location that stands for the dealership when nothing else is specified.
  is_primary boolean not null default false,
  street_address text,
  city text,
  province text,
  country text,
  postal_code text,
  phone text,
  timezone text,
  operating_hours jsonb,
  -- Departments that physically operate here. A satellite service centre is a location with
  -- Service and no Sales, and that difference decides what its people see.
  departments text[] not null default '{}',
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists dealership_locations_timezone_valid on public.dealership_locations;
create trigger dealership_locations_timezone_valid
  before insert or update of timezone on public.dealership_locations
  for each row execute function public.validate_timezone();

-- Exactly one primary. Two primaries means two answers to "where is this dealership", and
-- every report that groups by location would silently pick one.
create unique index if not exists dealership_locations_one_primary
  on public.dealership_locations (dealership_id) where is_primary and active;

create unique index if not exists dealership_locations_name_uk
  on public.dealership_locations (dealership_id, lower(name)) where active;

alter table public.dealership_locations enable row level security;

-- Tenant isolation, matching the pattern the staff tables use.
do $$ begin
  alter table public.dealership_locations add constraint dealership_locations_id_dealership_unique
    unique (id, dealership_id);
exception when duplicate_object then null; when duplicate_table then null; end $$;

-- ── What the Launch Hub is NOT ──────────────────────────────────────────────
-- There is deliberately no `setup_completed` column, no `onboarding_step`, and no checklist
-- table. Readiness is DERIVED from the configuration above on every read (AGENTS.md A19 and
-- the Phase 7 brief's D6): a stored checklist can be ticked without the underlying thing being
-- true, and then the product reports itself ready while a dealership cannot take a payment.
-- Nothing here should ever be added to store "the user finished setup".
