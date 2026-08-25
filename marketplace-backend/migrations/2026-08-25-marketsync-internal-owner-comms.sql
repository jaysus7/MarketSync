-- MarketSync Internal: canonical platform-owner login and connected communications.
-- The internal workspace is selected from profiles.system_role, never a dealership name.

update public.profiles p
set system_role = 'platform_owner',
    saas_role = 'owner',
    full_name = coalesce(nullif(p.full_name, ''), 'Jason Massie')
from auth.users u
where u.id = p.id
  and lower(u.email) = 'sales@marketsync.link';

insert into public.user_roles (user_id, role_id, dealership_id, assigned_by)
select p.id, 'platform_owner', p.dealership_id, p.id
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = 'sales@marketsync.link'
  and p.dealership_id is not null
on conflict (user_id, role_id, dealership_id) do nothing;

alter table public.profiles
  add column if not exists sms_consent_at timestamptz;

alter table public.saas_email_templates
  add column if not exists channel text not null default 'email',
  add column if not exists category text not null default 'general',
  add column if not exists active boolean not null default true;

alter table public.saas_email_templates
  drop constraint if exists saas_email_templates_channel_check;
alter table public.saas_email_templates
  add constraint saas_email_templates_channel_check
  check (channel in ('email', 'sms'));

alter table public.saas_campaigns
  add column if not exists channel text not null default 'email',
  add column if not exists scheduled_at timestamptz,
  add column if not exists recipient_count integer not null default 0,
  add column if not exists last_error text;

alter table public.saas_campaigns
  drop constraint if exists saas_campaigns_channel_check;
alter table public.saas_campaigns
  add constraint saas_campaigns_channel_check
  check (channel in ('email', 'sms'));

alter table public.saas_sequence_steps
  drop constraint if exists saas_sequence_steps_type_check;
alter table public.saas_sequence_steps
  add constraint saas_sequence_steps_type_check
  check (type in ('email', 'sms', 'task'));

create table if not exists public.saas_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.saas_campaigns(id) on delete set null,
  enrollment_id uuid references public.saas_sequence_enrollments(id) on delete set null,
  dealership_id uuid references public.dealerships(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  recipient_masked text,
  provider_message_id text,
  status text not null check (status in ('accepted', 'simulated', 'failed', 'skipped')),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists saas_message_deliveries_campaign_created_idx
  on public.saas_message_deliveries (campaign_id, created_at desc);
create index if not exists saas_message_deliveries_dealership_created_idx
  on public.saas_message_deliveries (dealership_id, created_at desc);

alter table public.saas_message_deliveries enable row level security;
alter table public.saas_message_deliveries force row level security;
revoke all on public.saas_message_deliveries from anon, authenticated;
grant all on public.saas_message_deliveries to service_role;

