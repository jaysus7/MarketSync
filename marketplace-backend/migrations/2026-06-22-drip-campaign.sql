-- Onboarding drip campaign
-- Run this once in the Supabase SQL editor (or via psql) before deploying the
-- drip code. Safe to re-run: every statement is guarded with IF NOT EXISTS.

-- Tracks which drip email each user has received. One row per (user, day_number).
-- The UNIQUE constraint makes sends idempotent: if the cron double-fires we get
-- a duplicate-key error on insert instead of a second email.
create table if not exists public.drip_sends (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  day_number  int  not null,                 -- 0..6, matches DRIP_EMAILS[].day in server.js
  sent_at     timestamptz not null default now(),
  unique (user_id, day_number)
);

create index if not exists drip_sends_user_idx on public.drip_sends (user_id);

-- Lets a recipient opt out of the onboarding series via the unsubscribe link in
-- the email footer. Null = still subscribed. We never delete the row, so re-signups
-- with the same id keep their preference.
alter table public.profiles
  add column if not exists drip_unsubscribed_at timestamptz;
