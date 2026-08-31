-- HQ income ledger + receipt attachments for the expense ledger.
--
-- Income = anything not already covered by Stripe subscription MRR — one-off
-- invoices, consulting engagements, side revenue. Kept separate from
-- subscriptions so accounting can reconcile without double-counting.

create table if not exists public.hq_income_entries (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  category_key text,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  received_on date not null,
  memo text,
  invoice_url text,
  status text not null default 'recorded' check (status in ('recorded','pending','received','cancelled')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists hq_income_entries_received_idx
  on public.hq_income_entries (received_on desc);

-- Receipt image attached to a vendor expense (photo captured through the HQ
-- expense capture UI; stored as URL so we can keep the actual bytes in storage).
alter table public.hq_vendor_expenses
  add column if not exists receipt_url text;

alter table public.hq_income_entries enable row level security;
drop policy if exists hq_income_entries_read on public.hq_income_entries;
create policy hq_income_entries_read on public.hq_income_entries for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.system_role in ('platform_owner','platform_admin')
    )
  );
