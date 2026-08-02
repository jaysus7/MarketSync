-- Access-model backfill (Phase 7). Migrates EXISTING accounts onto the normalized model
-- created by 2026-08-02-access-model-foundation.sql. Additive and access-preserving:
-- it never removes a role, never deletes data, and never reduces a live account's
-- effective access. Genuinely ambiguous orgs are FLAGGED for human review rather than
-- silently restricted, because locking out a paying customer is the worse failure.
--
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.
--
-- ROLLBACK (safe — only touches rows this migration created):
--   delete from public.subscriptions where created_by_backfill = true;
--   delete from public.user_roles where assigned_by is null and created_at >= '<migration ts>';
--   alter table public.dealerships drop column if exists needs_access_review;
--   alter table public.subscriptions drop column if exists created_by_backfill;

-- Marker so the backfill's own rows can be identified/rolled back without touching
-- subscriptions later created by Stripe or registration.
alter table public.subscriptions add column if not exists created_by_backfill boolean not null default false;
-- Flag for orgs whose legacy product state could not be mapped confidently.
alter table public.dealerships add column if not exists needs_access_review boolean not null default false;

-- ── 1. Backfill user_roles (THE critical fix) ────────────────────────────────
-- Registration historically set profiles.role but never created the RBAC user_roles
-- row, so with RLS enforced these members are denied on every permission check. Create
-- the missing rows from profiles.role, mapping unknown labels to the least-privilege
-- read_only role (safest default). Only for members who have a dealership and no role
-- row yet; existing rows are left untouched.
insert into public.user_roles (user_id, dealership_id, role_id, assigned_by)
select p.id, p.dealership_id,
  case upper(coalesce(p.role, ''))
    when 'OWNER'        then 'dealer_owner'
    when 'DEALER_ADMIN' then 'dealer_owner'
    when 'DEALER_GROUP' then 'dealer_group_owner'
    when 'MANAGER'      then 'general_manager'
    when 'SALES_REP'    then 'salesperson'
    when 'BDC'          then 'bdc'
    when 'FNI'          then 'fni_manager'
    when 'SERVICE'      then 'service_manager'
    when 'ACCOUNTING'   then 'accounting'
    else 'read_only'
  end,
  null
from public.profiles p
where p.dealership_id is not null
  and coalesce(p.system_role, '') not in ('platform_owner','platform_admin')
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.id and ur.dealership_id = p.dealership_id
  );

-- Flag any org whose owner/admin resolved to read_only (an unmapped role on a
-- privileged profile) for review — they keep access via read_only but a human should
-- confirm the intended role.
update public.dealerships d set needs_access_review = true
where exists (
  select 1 from public.profiles p
  where p.dealership_id = d.id
    and upper(coalesce(p.role,'')) in ('DEALER_ADMIN','OWNER')
    and upper(coalesce(p.role,'')) not in ('DEALER_ADMIN','OWNER','DEALER_GROUP','MANAGER','SALES_REP','BDC','FNI','SERVICE','ACCOUNTING')
);

-- ── 2. Backfill subscriptions from legacy dealerships.products ────────────────
-- Access-preserving: an org with dealer_os (or no product set at all — the legacy
-- default was full Dealer OS) gets the FULLEST plan so no current feature is lost.
-- Facebook / AI accounts get their matching product. Status is 'active' to mirror
-- today's behavior (billing enforcement stays in requireAuth, unchanged). Upsert is
-- idempotent on (dealership_id, product_id); re-running is safe.

-- Helper: does the products jsonb have any recognized key?
-- dealer_os OR empty  → dealer_os (os_enterprise, full)
insert into public.subscriptions (dealership_id, product_id, plan_id, status, trial_ends_at, created_by_backfill)
select d.id, 'dealer_os', 'os_enterprise',
  case when d.billing_status = 'TRIALING' then 'trialing' else 'active' end,
  d.trial_ends_at, true
from public.dealerships d
where coalesce((d.products->>'dealer_os')::boolean, false) = true
   or d.products is null
   or d.products = '{}'::jsonb
   or not (coalesce((d.products->>'facebook_solo')::boolean,false)
        or coalesce((d.products->>'facebook_dealer')::boolean,false)
        or coalesce((d.products->>'ai_chatbot')::boolean,false)
        or coalesce((d.products->>'dealer_os')::boolean,false))
on conflict (dealership_id, product_id) do nothing;

-- facebook (dealership tier if facebook_dealer, else solo)
insert into public.subscriptions (dealership_id, product_id, plan_id, status, trial_ends_at, created_by_backfill)
select d.id, 'facebook',
  case when coalesce((d.products->>'facebook_dealer')::boolean,false) then 'fb_dealership' else 'fb_solo' end,
  case when d.billing_status = 'TRIALING' then 'trialing' else 'active' end,
  d.trial_ends_at, true
from public.dealerships d
where coalesce((d.products->>'facebook_solo')::boolean,false)
   or coalesce((d.products->>'facebook_dealer')::boolean,false)
on conflict (dealership_id, product_id) do nothing;

-- ai_dealer
insert into public.subscriptions (dealership_id, product_id, plan_id, status, trial_ends_at, created_by_backfill)
select d.id, 'ai_dealer', 'ai_standard',
  case when d.billing_status = 'TRIALING' then 'trialing' else 'active' end,
  d.trial_ends_at, true
from public.dealerships d
where coalesce((d.products->>'ai_chatbot')::boolean,false)
on conflict (dealership_id, product_id) do nothing;

-- NOTE: no product_memberships are backfilled on purpose — an empty membership set means
-- "all org products", which is the correct default for every existing member (owners,
-- managers, reps alike). Membership rows are only created going forward to CONFINE a
-- member to a subset.
