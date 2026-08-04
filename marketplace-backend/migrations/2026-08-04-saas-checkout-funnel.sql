-- MarketSync HQ — checkout funnel (Phase 2).
-- One row per Stripe Checkout Session we start for an acquisition flow (plan or
-- package). The webhook flips it to 'completed'; anything left 'started' past a
-- short grace window is an abandoned cart HQ can recover. Service-role only.
create table if not exists public.saas_checkout_sessions (
  id                 uuid primary key default gen_random_uuid(),
  stripe_session_id  text unique,
  dealership_id      uuid references public.dealerships(id) on delete set null,
  kind               text,        -- plan | package
  plan_key           text,
  currency           text,
  status             text not null default 'started',  -- started | completed
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);
create index if not exists saas_checkout_status on public.saas_checkout_sessions (status);
create index if not exists saas_checkout_created on public.saas_checkout_sessions (created_at);
alter table public.saas_checkout_sessions enable row level security;
