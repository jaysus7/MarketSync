-- Phase 4 Batch 2 — correct the two Service accounting defects from the Stage 4A audit.
-- Applied to STAGING only. GOING FORWARD ONLY: no historical replay, no backfill.
--
-- F1 — tax was treated as revenue and AR was understated.
-- service_closed debited accounts_receivable with the PRE-TAX subtotal while the
-- customer owes the tax-inclusive total, and no tax liability was ever credited. On a
-- $1000 job at 13%, AR was short by $130 and the government's $130 sat inside revenue.
-- Now: DR accounts_receivable (total) / CR service_revenue (pre-tax) / CR tax_collected.
--
-- NOTE: this rule did not exist on staging at all — the Stage 3 A5 migration was applied
-- to PRODUCTION only, so staging is being seeded with the corrected version here.
-- **Production still carries the uncorrected rule and needs a separate, deliberate
-- decision.** See the handoff.
insert into public.accounting_rules (dealership_id, event_name, lines) values
  (null, 'service_closed', '[
    {"account_key":"accounts_receivable","side":"debit","source":"total","desc":"Service billed to customer (incl. tax)"},
    {"account_key":"service_revenue","side":"credit","source":"revenue","desc":"Service revenue (pre-tax)"},
    {"account_key":"tax_collected","side":"credit","source":"tax","desc":"Sales tax collected — a liability, not revenue"},
    {"account_key":"parts_cost","side":"debit","source":"cost","desc":"Parts cost"},
    {"account_key":"parts_inventory","side":"credit","source":"cost","desc":"Relieve parts inventory"}
  ]'::jsonb)
on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), event_name) do update
  set lines = excluded.lines;

-- F2 — parts inventory was relieved but never capitalized.
-- service_closed credits parts_inventory on every RO; nothing ever debited it, so the
-- balance sheet drifted negative by the value of every part ever received. A receipt now
-- debits Parts Inventory with Accounts Payable as the credit side — the receipt creates
-- the obligation; matching the vendor invoice belongs to Accounting later, not Service.
insert into public.accounting_rules (dealership_id, event_name, lines) values
  (null, 'parts_received', '[
    {"account_key":"parts_inventory","side":"debit","source":"amount","desc":"Parts received into stock"},
    {"account_key":"accounts_payable","side":"credit","source":"amount","desc":"Owed to parts vendor"}
  ]'::jsonb)
on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), event_name) do update
  set lines = excluded.lines;

-- Both account keys already exist in the canonical chart (ACCOUNT_DEFS in
-- accounting-engine.js): tax_collected 2200 Sales Tax Payable, accounts_payable 2000.
-- No GL account was invented for this.
