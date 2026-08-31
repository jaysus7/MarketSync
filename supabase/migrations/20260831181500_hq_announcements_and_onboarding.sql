-- HQ announcements + per-staff onboarding checklist state.

create table if not exists public.hq_announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('customer','staff')),
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info','warning','success')),
  publish_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists hq_announcements_audience_publish_idx
  on public.hq_announcements (audience, publish_at desc);

alter table public.hq_announcements enable row level security;

-- Customer announcements: any signed-in profile may read (they may be shown
-- inside a customer dashboard). Staff announcements: platform staff only.
drop policy if exists hq_announcements_read on public.hq_announcements;
create policy hq_announcements_read on public.hq_announcements for select
  using (
    audience = 'customer'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.system_role in ('platform_owner','platform_admin')
    )
  );

-- Staff onboarding checklist state — JSON per profile, service-role writes.
alter table public.profiles
  add column if not exists hq_onboarding jsonb not null default '{}'::jsonb;
