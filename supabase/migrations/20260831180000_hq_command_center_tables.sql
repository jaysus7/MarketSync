-- HQ Command Center — time-series snapshots, company expense ledger, and job-run
-- health signals. Every table is HQ-scoped (no dealership_id) and RLS-locked so
-- only the service role or an authenticated platform_owner/platform_admin can
-- read/write. Dealer users cannot see or touch any of it.

-- ── 1. Daily HQ metric snapshots ─────────────────────────────────────────────
-- One row per calendar day, filled by /cron/hq-snapshot. Everything the Pulse
-- top KPIs already surface (MRR, ARR, customers, trials, churn_risk, past_due,
-- affiliate_payouts_due) gets a durable copy so trend charts have real history
-- instead of showing "not measured" forever.
create table if not exists public.hq_daily_snapshots (
  snapshot_date date primary key,
  mrr numeric(14,2) not null default 0,
  arr numeric(14,2) not null default 0,
  active_customers integer not null default 0,
  trial_accounts integer not null default 0,
  new_this_month integer not null default 0,
  churn_risk integer not null default 0,
  past_due integer not null default 0,
  affiliate_payouts_due numeric(14,2),
  captured_at timestamptz not null default now()
);
comment on table public.hq_daily_snapshots is
  'One HQ-wide metrics row per day, produced by /cron/hq-snapshot. Basis for trend charts.';

-- ── 2. Company expense ledger + budgets ──────────────────────────────────────
-- MarketSync's own operating expenses (vendors, tools, ads, contractors). This
-- is the OPERATING company's ledger — NOT the dealership accounting ledger,
-- which stays in the accounting-engine tables.
-- Same table as 20260828000003_hq_finance_ledger.sql section 7. Both files
-- must converge on the merged shape no matter which order they run in, so
-- the create below is followed by additive guards: if the ledger migration
-- created the table first (or an older shape is already live), these bring
-- it up to the shape hq_vendor_expenses and the /saas/accounting routes
-- need, instead of silently no-opping the way this file used to.
create table if not exists public.hq_expense_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  monthly_budget numeric(12,2),
  account_code text,
  description text,
  is_cogs boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.hq_expense_categories add column if not exists key text;
alter table public.hq_expense_categories add column if not exists label text;
alter table public.hq_expense_categories add column if not exists monthly_budget numeric(12,2);
alter table public.hq_expense_categories add column if not exists account_code text;
alter table public.hq_expense_categories add column if not exists description text;
alter table public.hq_expense_categories add column if not exists is_cogs boolean not null default false;

-- Backfill key/label from the superseded (name, budget_limit_monthly) shape
-- before enforcing NOT NULL, so an environment that already ran the older
-- ledger definition converges rather than failing.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='hq_expense_categories' and column_name='name') then
    execute 'update public.hq_expense_categories set key = coalesce(key, lower(regexp_replace(name, ''[^a-zA-Z0-9]+'', ''_'', ''g''))), label = coalesce(label, name) where key is null or label is null';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='hq_expense_categories' and column_name='budget_limit_monthly') then
    execute 'update public.hq_expense_categories set monthly_budget = coalesce(monthly_budget, budget_limit_monthly)';
  end if;
end $$;

-- The foreign key below targets hq_expense_categories(key), so the unique
-- constraint has to exist even when the table was created elsewhere.
create unique index if not exists hq_expense_categories_key_uniq
  on public.hq_expense_categories (key);

create table if not exists public.hq_vendor_expenses (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  category_key text references public.hq_expense_categories(key) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  incurred_on date not null,
  memo text,
  recurring boolean not null default false,
  status text not null default 'recorded' check (status in ('recorded','pending','paid','cancelled')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists hq_vendor_expenses_incurred_idx
  on public.hq_vendor_expenses (incurred_on desc);
create index if not exists hq_vendor_expenses_category_idx
  on public.hq_vendor_expenses (category_key);

comment on table public.hq_expense_categories is
  'MarketSync operating expense categories + monthly budgets. HQ-scoped.';
comment on table public.hq_vendor_expenses is
  'MarketSync vendor/tool/ad spend rows. HQ-scoped. Not a dealership ledger.';

-- ── 3. Job runs & webhook events (platform health signals) ───────────────────
-- Every cron endpoint SHOULD log a row so /saas/platform-health can surface
-- failed jobs. The wrapper does the writing; consumer routes stay unchanged
-- until they opt in. Rows expire cheaply (index on started_at).
create table if not exists public.hq_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  status text not null check (status in ('success','error','running')),
  duration_ms integer,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists hq_job_runs_started_idx on public.hq_job_runs (started_at desc);
create index if not exists hq_job_runs_key_started_idx on public.hq_job_runs (job_key, started_at desc);

create table if not exists public.hq_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text,
  status text not null check (status in ('received','processed','failed','skipped')),
  error text,
  payload_hash text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists hq_webhook_events_received_idx
  on public.hq_webhook_events (received_at desc);
create index if not exists hq_webhook_events_provider_status_idx
  on public.hq_webhook_events (provider, status);

comment on table public.hq_job_runs is
  'Cron / background job run log for HQ Platform Health.';
comment on table public.hq_webhook_events is
  'Inbound webhook receipts (Stripe / Twilio / etc.) for HQ Platform Health.';

-- ── RLS: HQ-only. Deny anon + authenticated dealer users; service role bypasses. ─
alter table public.hq_daily_snapshots enable row level security;
alter table public.hq_expense_categories enable row level security;
alter table public.hq_vendor_expenses enable row level security;
alter table public.hq_job_runs enable row level security;
alter table public.hq_webhook_events enable row level security;

-- Platform staff (owner + admin) can read; nobody else. Writes stay
-- service-role-only — the /saas routes all go through supabaseAdmin, so a
-- SELECT-only policy is all the app needs.
do $$
declare
  t text;
begin
  foreach t in array array[
    'hq_daily_snapshots',
    'hq_expense_categories',
    'hq_vendor_expenses',
    'hq_job_runs',
    'hq_webhook_events'
  ] loop
    execute format($p$
      drop policy if exists %I_select on public.%I;
      create policy %I_select on public.%I for select
        using (
          exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.system_role in ('platform_owner','platform_admin')
          )
        );
    $p$, t || '_hq', t, t || '_hq', t);
  end loop;
end $$;

-- Seed a small default set of expense categories so the UI has something to
-- render the first time an HQ user visits Accounting. Real rows are added by
-- the HQ admin through the new /saas/accounting/expense endpoints.
insert into public.hq_expense_categories (key, label, monthly_budget) values
  ('infrastructure', 'Infrastructure & hosting', null),
  ('software',       'Software & tooling',      null),
  ('marketing',      'Marketing & ads',         null),
  ('contractors',    'Contractors & pros',      null),
  ('operations',     'Office & operations',     null)
on conflict (key) do nothing;
