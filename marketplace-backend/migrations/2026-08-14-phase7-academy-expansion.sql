-- Phase 7 Overhaul — Academy Expansion & Guide Engine (2026-08-14)
--
-- Adds AI Video Pipeline tracking, Course Quizzes & Knowledge Checks, Page Tours,
-- and Searchable Contextual Guides.

-- 1. AI Video Pipeline metadata schema
create table if not exists public.academy_videos (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  video_type text not null default 'product_walkthrough' check (video_type in ('product_walkthrough', 'knowledge_course', 'policy_compliance', 'management')),
  script text not null,
  script_version integer not null default 1,
  source_course_version integer not null default 1,
  avatar_provider text default 'heygen',
  avatar_id text,
  voice_id text,
  screen_demo_plan jsonb default '{}'::jsonb,
  render_provider text default 'heygen',
  render_job_id text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer default 0,
  captions_url text,
  status text not null default 'draft' check (status in ('draft', 'rendering', 'approved', 'outdated', 'failed')),
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_academy_videos_course_key on public.academy_videos (course_key, status);

-- 2. Quizzes & Knowledge Checks
create table if not exists public.academy_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_key text not null unique,
  passing_score_pct integer not null default 80,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.academy_quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'multiple_choice' check (question_type in ('multiple_choice', 'true_false', 'workflow_order')),
  options jsonb not null default '[]'::jsonb,
  correct_option_index integer not null default 0,
  explanation text,
  sort_order integer not null default 1
);

create index if not exists idx_academy_questions_quiz_id on public.academy_questions (quiz_id, sort_order);

-- 3. In-App Guided Page Tours
create table if not exists public.academy_tours (
  id uuid primary key default gen_random_uuid(),
  page_route text not null unique,
  tour_title text not null,
  steps jsonb not null default '[]'::jsonb,
  tour_version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_tour_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  page_route text not null,
  tour_version integer not null default 1,
  status text not null default 'completed' check (status in ('seen', 'completed', 'dismissed')),
  completed_at timestamptz not null default now(),
  unique (user_id, page_route)
);

-- 4. Searchable Guides & Help System
create table if not exists public.academy_guides (
  id uuid primary key default gen_random_uuid(),
  guide_key text not null unique,
  title text not null,
  summary text not null,
  applies_to_roles text[] default '{}',
  applies_to_products text[] default '{}',
  applies_to_departments text[] default '{}',
  steps jsonb not null default '[]'::jsonb,
  next_steps text,
  permissions_required text,
  common_errors text,
  troubleshooting text,
  related_guides text[] default '{}',
  related_course_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_academy_guides_key on public.academy_guides (guide_key);
