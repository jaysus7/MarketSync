-- Phase 7 PR 7.3 — Academy: a curriculum that can be assigned, required and certified against.
--
-- CURRENT TRUTH: the ~189 courses live as a static array inside a frontend file. Nothing can
-- assign one, nothing can require one, nothing can certify against one, and a manager cannot
-- see who has done what. `staff_training_courses` is empty and `staff_certifications` records
-- only externally-issued certificates that somebody typed in.
--
-- THE BLOCKER this migration removes: `staff_training_courses.dealership_id` is NOT NULL, so
-- MarketSync's own curriculum has nowhere to live. Every dealership would need its own private
-- copy of "Lead Workflow Basics", and a fix to that course would have to be applied N times.
--
-- The convention already exists in this repo — `marketing_sources` (PR 6.1) uses
-- `dealership_id null = global`. This follows it, including `nulls not distinct` so the global
-- rows still cannot duplicate: a plain unique index treats every NULL as different, which
-- would let the same MarketSync course be inserted forever.
--
-- APPLIED TO STAGING ONLY.

-- ── A course can belong to MarketSync, or to one dealership ─────────────────
alter table public.staff_training_courses alter column dealership_id drop not null;

-- Where a course sits in Your Path. `reference` is the searchable library — present, but never
-- the default experience, which is the whole point of the Academy rebuild.
alter table public.staff_training_courses add column if not exists department text;
alter table public.staff_training_courses add column if not exists level text not null default 'reference';
-- Which roles this is FOR. Empty means "anyone" — a course nobody is targeted by is reference
-- material, not a gap.
alter table public.staff_training_courses add column if not exists role_keys text[] not null default '{}';
alter table public.staff_training_courses add column if not exists sort integer not null default 100;

do $$ begin
  alter table public.staff_training_courses add constraint staff_training_courses_level_valid
    check (level in ('required', 'foundation', 'advanced', 'reference'));
exception when duplicate_object then null; end $$;

-- The old index treated (null, key, 1) as distinct from itself, so the global catalog could be
-- inserted repeatedly. PG17 `nulls not distinct` is what makes "one global course per key and
-- version" actually true.
-- It is a CONSTRAINT, not a bare index, so it has to be dropped as one.
alter table public.staff_training_courses drop constraint if exists staff_training_courses_key_version_unique;
drop index if exists public.staff_training_courses_key_version_unique;
create unique index if not exists staff_training_courses_key_version_unique
  on public.staff_training_courses (dealership_id, course_key, version_number) nulls not distinct;

create index if not exists staff_training_courses_curriculum_idx
  on public.staff_training_courses (department, level, sort) where active;

-- ── The thing that made the whole slice dead wiring ─────────────────────────
--
-- FOUND BY PROBING STAGING, not by any test: `staff_training_assignments` carried
--
--   foreign key (course_id, dealership_id) references staff_training_courses(id, dealership_id)
--
-- which is how this schema keeps a dealership from assigning another dealership's private
-- course. A global course has `dealership_id = null`, so the pair NEVER matches and every
-- assignment of a MarketSync course fails with a foreign key violation. Making the catalog
-- global (above) would have produced a curriculum that could be read and never assigned —
-- schema, routes, courses and tests all present, and the capability dead. AGENTS.md A19.
--
-- The tenant guarantee is not being given up, it is being restated: a course must be global,
-- or belong to the assigning dealership. Nothing else may be assigned.
alter table public.staff_training_assignments drop constraint if exists staff_training_course_same_dealer;

do $$ begin
  alter table public.staff_training_assignments
    add constraint staff_training_assignments_course_id_fkey
    foreign key (course_id) references public.staff_training_courses(id) on delete cascade;
exception when duplicate_object then null; end $$;

create or replace function public.staff_training_course_tenant_check()
returns trigger language plpgsql as $$
declare course_dealership uuid; course_found boolean;
begin
  select c.dealership_id, true into course_dealership, course_found
  from public.staff_training_courses c where c.id = new.course_id;

  if not coalesce(course_found, false) then
    raise exception 'course % does not exist', new.course_id using errcode = 'foreign_key_violation';
  end if;
  -- null = MarketSync's own catalog, assignable by everyone. Anything else must be this
  -- dealership's own course.
  if course_dealership is not null and course_dealership <> new.dealership_id then
    raise exception 'course % belongs to another dealership', new.course_id using errcode = 'foreign_key_violation';
  end if;
  return new;
end $$;

drop trigger if exists staff_training_assignments_tenant on public.staff_training_assignments;
create trigger staff_training_assignments_tenant
  before insert or update of course_id, dealership_id on public.staff_training_assignments
  for each row execute function public.staff_training_course_tenant_check();

-- The trigger above checks at assignment time. Moving a course between owners afterwards would
-- retroactively invalidate assignments the check already passed, so ownership is fixed at
-- creation — which it was anyway, under the constraint this replaces.
create or replace function public.staff_training_course_owner_frozen()
returns trigger language plpgsql as $$
begin
  if new.dealership_id is distinct from old.dealership_id then
    raise exception 'a course cannot change owner once created';
  end if;
  return new;
end $$;

drop trigger if exists staff_training_courses_owner_frozen on public.staff_training_courses;
create trigger staff_training_courses_owner_frozen
  before update on public.staff_training_courses
  for each row execute function public.staff_training_course_owner_frozen();

-- ── What a MarketSync certification actually requires ───────────────────────
-- A credential issued because somebody opened a page is worth nothing. These rows are what
-- makes issuing checkable.
create table if not exists public.academy_certifications (
  id uuid primary key default gen_random_uuid(),
  certification_key text not null,
  name text not null,
  department text,
  description text,
  -- Bumped when the requirements change, so an old credential still says what it meant.
  version_number int not null default 1,
  -- null = does not expire. A certification that never expires is a decision, not an oversight.
  validity_months int,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists academy_certifications_key_version_uk
  on public.academy_certifications (certification_key, version_number);

create table if not exists public.academy_certification_requirements (
  id uuid primary key default gen_random_uuid(),
  certification_id uuid not null references public.academy_certifications(id) on delete cascade,
  course_key text not null,
  -- A recommended course inside a certification is context, not a gate.
  required boolean not null default true,
  sort int not null default 100
);

create unique index if not exists academy_cert_req_uk
  on public.academy_certification_requirements (certification_id, course_key);

alter table public.academy_certifications enable row level security;
alter table public.academy_certification_requirements enable row level security;

-- ── The credential ──────────────────────────────────────────────────────────
-- `staff_certifications` already recorded externally-issued certificates somebody typed in.
-- These columns let it also hold a credential MarketSync issued and can stand behind.
alter table public.staff_certifications add column if not exists certification_key text;
alter table public.staff_certifications add column if not exists certification_version int;
-- The public identifier. Unguessable, because it is the whole authorisation for the
-- verification page — anyone holding it may confirm the credential, and nobody else may
-- enumerate their way to an employee's record.
alter table public.staff_certifications add column if not exists credential_id text;
alter table public.staff_certifications add column if not exists source text not null default 'external';

do $$ begin
  alter table public.staff_certifications add constraint staff_certifications_source_valid
    check (source in ('marketsync', 'external'));
exception when duplicate_object then null; end $$;

-- A credential id identifies exactly one credential, globally — it is looked up without a
-- dealership, because the person verifying it does not have one.
create unique index if not exists staff_certifications_credential_uk
  on public.staff_certifications (credential_id) where credential_id is not null;

-- One live MarketSync credential per person per certification. Re-earning renews the existing
-- one rather than growing a pile of duplicates.
create unique index if not exists staff_certifications_one_active_per_key
  on public.staff_certifications (dealership_id, staff_member_id, certification_key)
  where certification_key is not null and status = 'active';
