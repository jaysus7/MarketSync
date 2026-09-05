-- MarketSync Standalone Apps — waitlist table
--
-- Backs the /apps/*.html launcher pages. The row is written by the
-- service role (from routes/apps-waitlist.js) so no client policies are
-- needed. The unique constraint on (lower(email), product) makes
-- duplicate signups a no-op instead of an error.

create table if not exists public.apps_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product text not null,
  source text,
  created_at timestamptz not null default now()
);

create unique index if not exists apps_waitlist_email_product_uidx
  on public.apps_waitlist (lower(email), product);

alter table public.apps_waitlist enable row level security;

-- No SELECT/INSERT policies for anon/authenticated roles: this table is
-- read/written by the service role only. HQ staff can view via a
-- controlled admin endpoint later; keeping the raw table private for now.
