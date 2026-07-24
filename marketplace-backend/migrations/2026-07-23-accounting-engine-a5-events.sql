-- Accounting Engine — A5 automotive transaction events + Event Replay ledger.
-- Already applied to project omyuqzveegzspeojrqkd. Service-role-only RLS.

-- Event → journal audit/replay log: which event produced which journal, so a bug can
-- be fixed and the event safely replayed (postings are idempotent per source+ref+event).
create table if not exists public.accounting_event_log (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  event_id uuid,
  event_name text not null,
  processed_by text,
  journal_entry_id uuid,
  status text not null default 'processed',   -- processed | skipped | error
  error text,
  processed_at timestamptz not null default now()
);
create index if not exists ael_dealer_idx on public.accounting_event_log (dealership_id, processed_at desc);
create index if not exists ael_event_idx  on public.accounting_event_log (event_id);
alter table public.accounting_event_log enable row level security;

-- A5 automotive transaction posting rules (dealership_id null = default). Amount
-- tokens (amount / revenue / cost) come from each event's payload.
insert into public.accounting_rules (dealership_id, event_name, lines) values
  (null, 'vehicle_acquired', '[
    {"account_key":"inventory","side":"debit","source":"amount","desc":"Capitalize vehicle"},
    {"account_key":"cash","side":"credit","source":"amount","desc":"Cash / floorplan out"}
  ]'::jsonb),
  (null, 'recon_cost', '[
    {"account_key":"inventory","side":"debit","source":"amount","desc":"Add recon to vehicle cost"},
    {"account_key":"accounts_payable","side":"credit","source":"amount","desc":"Owed to vendor"}
  ]'::jsonb),
  (null, 'trade_received', '[
    {"account_key":"inventory","side":"debit","source":"amount","desc":"Trade-in into inventory"},
    {"account_key":"trade_allowance","side":"credit","source":"amount","desc":"Trade allowance"}
  ]'::jsonb),
  (null, 'funding_received', '[
    {"account_key":"cash","side":"debit","source":"amount","desc":"Lender funding received"},
    {"account_key":"contracts_in_transit","side":"credit","source":"amount","desc":"Clear contract in transit"}
  ]'::jsonb),
  (null, 'service_closed', '[
    {"account_key":"accounts_receivable","side":"debit","source":"revenue","desc":"Service billed"},
    {"account_key":"service_revenue","side":"credit","source":"revenue","desc":"Service revenue"},
    {"account_key":"parts_cost","side":"debit","source":"cost","desc":"Parts cost"},
    {"account_key":"parts_inventory","side":"credit","source":"cost","desc":"Relieve parts inventory"}
  ]'::jsonb)
on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), event_name) do nothing;
