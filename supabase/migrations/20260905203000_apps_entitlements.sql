-- MarketSync Standalone Apps — per-user entitlements
--
-- Each row grants ONE user access to ONE standalone app (design-studio,
-- video-studio, etc.). A user with an entitlement can open the app's
-- launcher and land inside the embedded dashboard tool without needing
-- a dealership subscription — this is the "single-user tenant" model.
--
-- We deliberately reuse the existing profiles/dealerships infrastructure:
-- the signup flow creates a personal dealership (is_personal=true) so
-- every RLS policy that keys off dealership_id keeps working. This table
-- is the ADDITIVE per-app gate on top of that.

create table if not exists public.apps_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  plan text not null default 'trial',
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate entitlements — one row per user per app.
create unique index if not exists apps_entitlements_user_app_uidx
  on public.apps_entitlements (user_id, app_slug);

-- Fast lookup on the embedded-mode boot path.
create index if not exists apps_entitlements_user_idx
  on public.apps_entitlements (user_id);

alter table public.apps_entitlements enable row level security;

-- A user can read their own entitlements.
drop policy if exists "apps_entitlements_self_read" on public.apps_entitlements;
create policy "apps_entitlements_self_read"
  on public.apps_entitlements
  for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go through the service role only (signup + Stripe webhook).
-- No INSERT/UPDATE/DELETE policies for authenticated — force writes
-- through the backend so entitlement grants stay auditable.

-- Optional: allow HQ platform owners/admins to read every row (for the
-- HQ product-usage screen).
drop policy if exists "apps_entitlements_platform_read" on public.apps_entitlements;
create policy "apps_entitlements_platform_read"
  on public.apps_entitlements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.system_role in ('platform_owner', 'platform_admin')
    )
  );

-- Keep updated_at fresh on any mutation.
create or replace function public.apps_entitlements_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists apps_entitlements_touch on public.apps_entitlements;
create trigger apps_entitlements_touch
  before update on public.apps_entitlements
  for each row execute function public.apps_entitlements_touch();
