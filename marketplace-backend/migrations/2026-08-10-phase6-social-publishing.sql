-- Phase 6 PR 6.6 — Studio and social publishing: posts actually leave the building.
--
-- PR 6.2 built the authorization and the state vocabulary. It anticipated everything this
-- slice needs: social_posts.status already allows 'publishing', 'published',
-- 'partially_published' and 'failed'; social_post_targets.status already allows 'publishing',
-- 'published', 'failed' and 'skipped'; there is already an `attempts` counter.
--
-- Nothing has ever written any of them. A scheduled post sits at 'scheduled' forever and the
-- dealership is never told. That silence is the defect this migration and its dispatcher fix.
--
-- Two things are added:
--   1. What a worker needs to claim work safely — a lease, a retry time, and a database-owned
--      claim function so two workers can never publish the same target twice.
--   2. A marketing asset library, so a post can carry the dealership's own images rather than
--      arbitrary URLs typed into a box.
--
-- APPLIED TO STAGING ONLY.

-- ── What a dispatcher needs to claim work ───────────────────────────────────
alter table public.social_post_targets add column if not exists next_attempt_at timestamptz;
-- A lease, not a lock. If a worker dies mid-publish the row would otherwise stay
-- 'publishing' forever; claimed_at lets a later run reclaim it once the lease expires.
alter table public.social_post_targets add column if not exists claimed_at timestamptz;
alter table public.social_post_targets add column if not exists last_attempt_at timestamptz;

-- The provider's id for what it actually created. This is the evidence a publish happened —
-- without it, "published" is just a word we wrote about ourselves.
--
-- One provider post per account, enforced by the database. A retry that races, a webhook that
-- double-fires, or a worker that reclaims an in-flight lease cannot produce two live posts on
-- the same page: the second write is refused rather than duplicated in front of customers.
create unique index if not exists social_post_targets_external_uk
  on public.social_post_targets (social_account_id, external_post_id)
  where external_post_id is not null;

-- Finding due work must not scan every target ever published.
create index if not exists social_post_targets_due_idx
  on public.social_post_targets (status, next_attempt_at)
  where status in ('pending', 'publishing');

-- ── The claim, owned by the database ────────────────────────────────────────
-- `for update skip locked` is what makes concurrency safe here: two workers running the same
-- second take disjoint sets of rows instead of both taking the same one. Doing this in
-- application code would mean a read, then a write, with a window in between — and that
-- window is exactly where a customer sees the same post twice.
--
-- A target is due when its post is scheduled (or publishing, mid-run), the schedule time has
-- arrived, and its backoff has elapsed. Approval is a precondition, not an afterthought: a
-- post still awaiting approval is never claimed, because 'needs_approval' is not in the list.
create or replace function public.social_claim_due_targets(
  p_limit int default 25,
  p_lease_seconds int default 300
) returns setof public.social_post_targets
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select t.id
    from public.social_post_targets t
    join public.social_posts p on p.id = t.post_id
    where p.deleted_at is null
      and p.status in ('scheduled', 'publishing')
      and coalesce(p.scheduled_for, now()) <= now()
      and t.status in ('pending', 'publishing')
      and coalesce(t.next_attempt_at, '-infinity'::timestamptz) <= now()
      -- Already claimed and still inside its lease: someone else is working on it.
      and (t.claimed_at is null or t.claimed_at < now() - make_interval(secs => p_lease_seconds))
      -- Never re-publish something the provider already accepted.
      and t.external_post_id is null
    order by coalesce(p.scheduled_for, p.created_at)
    limit p_limit
    for update of t skip locked
  )
  update public.social_post_targets t
     set status = 'publishing',
         claimed_at = now(),
         last_attempt_at = now(),
         attempts = t.attempts + 1,
         updated_at = now()
    from due
   where t.id = due.id
  returning t.*;
end;
$$;

revoke all on function public.social_claim_due_targets(int, int) from public, anon, authenticated;

-- ── Studio: the dealership's own media ──────────────────────────────────────
-- A post's `media` column is jsonb and will take any URL at all. That is fine for a prototype
-- and wrong for a product: nobody can find last month's photo again, and nothing ties an image
-- to the vehicle or campaign it belongs to.
create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  kind text not null default 'image',
  storage_path text not null,
  public_url text not null,
  width int,
  height int,
  bytes int,
  title text,
  alt_text text,
  inventory_id uuid references public.inventory(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$ begin
  alter table public.marketing_assets add constraint marketing_assets_kind_valid
    check (kind in ('image', 'video'));
exception when duplicate_object then null; end $$;

-- One row per stored object. Re-uploading the same object updates the row rather than
-- growing a second library entry pointing at the same bytes.
create unique index if not exists marketing_assets_path_uk
  on public.marketing_assets (dealership_id, storage_path);

create index if not exists marketing_assets_dealership_idx
  on public.marketing_assets (dealership_id, created_at desc) where deleted_at is null;

create index if not exists marketing_assets_inventory_idx
  on public.marketing_assets (inventory_id) where inventory_id is not null and deleted_at is null;

-- Default-deny, matching every other Phase 6 table: RLS on with no policy, so nothing reaches
-- this data except the service role, and every read goes through a route that has already
-- resolved the dealership from the session. A policy here would be a second, weaker opinion
-- about tenancy.
alter table public.marketing_assets enable row level security;
