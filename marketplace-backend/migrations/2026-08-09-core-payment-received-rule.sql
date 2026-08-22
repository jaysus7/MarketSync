-- ONE canonical accounting effect for customer money arriving. STAGING only.
--
-- The invariant, stated once: the INVOICE creates revenue, tax and AR. A PAYMENT only
-- moves AR into cash. Cash arriving must never recognise revenue or tax a second time —
-- which is exactly the silent double-revenue failure this rule is shaped to prevent.
--
-- Money not yet applied to an obligation is a customer deposit — a liability, not a
-- receivable — so the credit side splits by what the payment was allocated to:
--
--   DR cash                = amount      (all the money that arrived)
--   CR accounts_receivable = applied     (the part that settles an invoice)
--   CR customer_deposits   = unapplied   (the part still owed back to the customer)
--
-- amount = applied + unapplied, so it balances for a full payment, a partial payment,
-- a pure deposit, or a deposit partly applied. Verified against all four.
insert into public.accounting_rules (dealership_id, event_name, lines) values
  (null, 'payment_received', '[
    {"account_key":"cash","side":"debit","source":"amount","desc":"Customer payment received"},
    {"account_key":"accounts_receivable","side":"credit","source":"applied","desc":"Clear customer receivable"},
    {"account_key":"customer_deposits","side":"credit","source":"unapplied","desc":"Unapplied customer money held on deposit"}
  ]'::jsonb)
on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), event_name) do update
  set lines = excluded.lines;

-- NOTE for production: the legacy `deposit_received` rule exists there (seeded by the
-- Stage 3 A5 migration, which never ran on staging). Before this canonical path is
-- enabled in production, `deposit.paid` and `payment.received` must not BOTH post for
-- the same money. Adapt deliberately; do not enable both. See the handoff.
