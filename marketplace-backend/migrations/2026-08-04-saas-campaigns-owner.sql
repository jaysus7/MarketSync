-- MarketSync HQ — email campaigns (Part 2) + account owner / CSM (Part 3).
-- Campaigns: one-off sends to a customer segment from a template. Owner: which HQ
-- staff member owns each account. Service-role only (RLS on, no policies).

create table if not exists public.saas_campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  segment     text not null default 'all',      -- all | trialing | active | past_due | cancelled
  subject     text not null,
  body        text not null,
  template_id uuid references public.saas_email_templates(id) on delete set null,
  status      text not null default 'draft',     -- draft | sent
  sent_count  int not null default 0,
  fail_count  int not null default 0,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
alter table public.saas_campaigns enable row level security;

-- Account owner (a MarketSync HQ staff member responsible for the account).
alter table public.dealerships add column if not exists hq_owner_id uuid;
