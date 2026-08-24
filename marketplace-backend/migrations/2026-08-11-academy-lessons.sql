-- The Academy gets lessons.
--
-- staff_training_courses holds 32 courses. Every one of them has content_url NULL and
-- there is no lesson table, which means the Academy has course RECORDS and no course
-- CONTENT: you can be assigned "Credit applications and privacy law", be blocked from a
-- certification until you complete it, and have nothing whatsoever to open. A course
-- page listing "lessons in order" on top of that would be the purest form of the defect
-- A19 names — a screen describing something that does not exist.
--
-- Two tables. Lessons belong to a course and carry their own order; progress belongs to
-- a person and a lesson.
--
-- STAGING ONLY (hpxnjbdiaaoopxeayfen) pending 9A convergence.

-- ── Lessons ─────────────────────────────────────────────────────────────────
-- Global lessons (dealership_id null) come from academy-lessons.js via
-- scripts/academy-sync.mjs, the same path the courses themselves take, so the content
-- is reviewable in a diff rather than typed into a database by hand.
create table if not exists public.staff_training_lessons (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid references public.dealerships(id) on delete cascade,
  course_id uuid not null references public.staff_training_courses(id) on delete cascade,
  lesson_key text not null,
  sort integer not null default 0,
  title text not null,
  summary text,
  body text,
  -- What kind of thing this is. `lesson` reads; `checkpoint` asks the learner to go and
  -- do it in the product. Anything else would be a claim we cannot currently deliver.
  kind text not null default 'lesson',
  estimated_minutes integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_training_lessons_kind_valid check (kind in ('lesson', 'checkpoint'))
);

-- One lesson key per course. `nulls not distinct` so the global rows (dealership_id
-- null) collide with each other on re-sync and update rather than growing a second copy
-- — the same idiom staff_training_courses uses.
create unique index if not exists staff_training_lessons_key_uniq
  on public.staff_training_lessons (dealership_id, course_id, lesson_key) nulls not distinct;

create index if not exists staff_training_lessons_course_idx
  on public.staff_training_lessons (course_id, sort) where active;

-- ── Progress ────────────────────────────────────────────────────────────────
-- A row means this person finished this lesson. There is no partial percentage: a
-- lesson is read or it is not, and a fabricated 60% is worse than an honest "not yet".
create table if not exists public.staff_training_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  staff_member_id uuid not null,
  lesson_id uuid not null references public.staff_training_lessons(id) on delete cascade,
  course_id uuid not null references public.staff_training_courses(id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Completing the same lesson twice is the same fact, not two facts.
create unique index if not exists staff_training_lesson_progress_uniq
  on public.staff_training_lesson_progress (staff_member_id, lesson_id);

create index if not exists staff_training_lesson_progress_course_idx
  on public.staff_training_lesson_progress (dealership_id, staff_member_id, course_id);

-- Tenant isolation the way the rest of this schema does it: a progress row may only
-- point at a staff member in its OWN dealership.
alter table public.staff_members drop constraint if exists staff_members_id_dealership_key;
alter table public.staff_members add constraint staff_members_id_dealership_key unique (id, dealership_id);

alter table public.staff_training_lesson_progress
  drop constraint if exists staff_training_lesson_progress_staff_fk;
alter table public.staff_training_lesson_progress
  add constraint staff_training_lesson_progress_staff_fk
  foreign key (staff_member_id, dealership_id)
  references public.staff_members (id, dealership_id) on delete cascade;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.staff_training_lessons enable row level security;
alter table public.staff_training_lessons force row level security;
alter table public.staff_training_lesson_progress enable row level security;
alter table public.staff_training_lesson_progress force row level security;

drop policy if exists "staff_training_lessons_select_authorized" on public.staff_training_lessons;
drop policy if exists "staff_training_lessons_write_authorized" on public.staff_training_lessons;
drop policy if exists "staff_training_lesson_progress_select_authorized" on public.staff_training_lesson_progress;
drop policy if exists "staff_training_lesson_progress_insert_self" on public.staff_training_lesson_progress;

-- Course content is readable by anyone who may see training at all. A global lesson
-- (dealership_id null) is MarketSync's own curriculum and is readable by every tenant —
-- that is what makes it global — while a dealership's own lesson stays theirs.
create policy "staff_training_lessons_select_authorized" on public.staff_training_lessons
  for select to authenticated
  using (dealership_id is null or authz.has_permission(dealership_id, 'staff.training.self'));

-- Only a dealership's own lessons are writable through the API. The global curriculum
-- is written by the sync script on the service role, which bypasses RLS by design.
create policy "staff_training_lessons_write_authorized" on public.staff_training_lessons
  for all to authenticated
  using (dealership_id is not null and authz.has_permission(dealership_id, 'staff.training.manage'))
  with check (dealership_id is not null and authz.has_permission(dealership_id, 'staff.training.manage'));

-- Your own progress, or anybody's if you may see the team's training.
create policy "staff_training_lesson_progress_select_authorized" on public.staff_training_lesson_progress
  for select to authenticated
  using (
    authz.has_permission(dealership_id, 'staff.training.view')
    or staff_member_id in (
      select id from public.staff_members
      where dealership_id = staff_training_lesson_progress.dealership_id and user_id = auth.uid()
    )
  );

-- You may only ever record YOUR OWN completion. Marking a colleague's training complete
-- is how a compliance record stops meaning anything.
create policy "staff_training_lesson_progress_insert_self" on public.staff_training_lesson_progress
  for insert to authenticated
  with check (
    staff_member_id in (
      select id from public.staff_members
      where dealership_id = staff_training_lesson_progress.dealership_id and user_id = auth.uid()
    )
  );
