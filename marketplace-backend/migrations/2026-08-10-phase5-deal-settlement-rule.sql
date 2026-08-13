-- Phase 5 PR 5.2 — financed deal posting semantics.
--
-- THE DEFECT: `vehicle_delivered` debited the entire sale to Accounts Receivable, while
-- `funding_received` credited Contracts in Transit — an account nothing ever debited. On
-- a financed deal that left customer AR overstated by the lender's share, and drove CIT
-- negative the moment funding arrived. A funded financed deal could never clear.
--
-- THE CORRECTION: the debit side becomes the deal's actual SETTLEMENT. The credit side
-- (revenue, F&I income, tax, COGS/inventory) is untouched, so revenue treatment and the
-- amount being settled are exactly what they were.
--
--   DR Contracts in Transit  cit_amount        lender's commitment — a lender receivable
--   DR Cash                  cash_received     down payment taken at delivery
--   DR Customer Deposits     deposit_applied   clears the liability `deposit_received` raised
--   DR Trade Allowance       trade_applied     clears the liability `trade_received` raised
--   DR Accounts Receivable   customer_ar       what the CUSTOMER genuinely still owes
--   CR Vehicle Sales / F&I Income / Tax Payable       (unchanged)
--   DR COGS / CR Inventory                             (unchanged)
--
-- The five debit tokens are apportioned by dealSettlement() to sum exactly to
-- selling_price + fni_gross + tax, so the entry balances by construction. Zero-valued
-- lines are dropped by the posting function, so a cash deal simply has no CIT line and
-- a deal with no trade has no trade line.
--
-- Contracts in Transit is a LENDER receivable and must never be presented as customer AR.
--
-- APPLIED TO STAGING ONLY. Safe to apply to production later unchanged — it is an upsert
-- on the existing rule row.

insert into public.accounting_rules (dealership_id, event_name, active, lines) values
(null, 'vehicle_delivered', true, '[
  {"account_key":"contracts_in_transit","side":"debit","source":"cit_amount","desc":"Lender receivable — awaiting funding"},
  {"account_key":"cash","side":"debit","source":"cash_received","desc":"Down payment received at delivery"},
  {"account_key":"customer_deposits","side":"debit","source":"deposit_applied","desc":"Apply prior customer deposit"},
  {"account_key":"trade_allowance","side":"debit","source":"trade_applied","desc":"Apply trade equity"},
  {"account_key":"accounts_receivable","side":"debit","source":"customer_ar","desc":"Balance owed by the customer"},
  {"account_key":"vehicle_sales","side":"credit","source":"selling_price","desc":"Vehicle sales revenue"},
  {"account_key":"fni_income","side":"credit","source":"fni_gross","desc":"F&I income"},
  {"account_key":"tax_collected","side":"credit","source":"tax","desc":"Sales tax payable"},
  {"account_key":"cogs","side":"debit","source":"cost","desc":"Cost of goods sold"},
  {"account_key":"inventory","side":"credit","source":"cost","desc":"Relieve inventory"}
]'::jsonb)
on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), event_name)
do update set lines = excluded.lines, active = true, updated_at = now();
