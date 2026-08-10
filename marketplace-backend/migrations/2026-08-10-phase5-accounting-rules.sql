-- Phase 5 PR 5.1 — the canonical accounting rule set.
--
-- staging and production had diverged into near-disjoint complements: staging carried
-- only the three Phase 4 rules (its base seed migration had been applied to production
-- only), production carried the eight base rules but neither Phase 4 rule and the
-- UNCORRECTED service_closed. Neither environment could post a full dealership.
--
-- This establishes ONE unambiguous active rule per canonical business event. Every rule
-- is global (dealership_id null); a dealership may still override by inserting its own
-- row, which postByRule prefers.
--
-- `source` names the amount token the context builder computes. Debits must equal
-- credits for every event, given how those tokens are derived.
--
-- APPLIED TO STAGING ONLY in this PR. Safe to apply to production later unchanged:
-- it is an upsert, so it also repairs production's service_closed when authorized.

insert into public.accounting_rules (dealership_id, event_name, active, lines) values

-- ── Sales / F&I ────────────────────────────────────────────────────────────
-- ar_total = selling_price + fni_gross + tax, so the entry balances; the cost pair
-- nets to zero when cost tracking is off.
(null, 'vehicle_delivered', true, '[
  {"account_key":"accounts_receivable","side":"debit","source":"ar_total","desc":"Amount due from sale"},
  {"account_key":"vehicle_sales","side":"credit","source":"selling_price","desc":"Vehicle sales revenue"},
  {"account_key":"fni_income","side":"credit","source":"fni_gross","desc":"F&I income"},
  {"account_key":"tax_collected","side":"credit","source":"tax","desc":"Sales tax payable"},
  {"account_key":"cogs","side":"debit","source":"cost","desc":"Cost of goods sold"},
  {"account_key":"inventory","side":"credit","source":"cost","desc":"Relieve inventory"}
]'::jsonb),

(null, 'funding_received', true, '[
  {"account_key":"cash","side":"debit","source":"amount","desc":"Lender funding received"},
  {"account_key":"contracts_in_transit","side":"credit","source":"amount","desc":"Clear contract in transit"}
]'::jsonb),

(null, 'deposit_received', true, '[
  {"account_key":"cash","side":"debit","source":"deposit_amount","desc":"Cash received"},
  {"account_key":"customer_deposits","side":"credit","source":"deposit_amount","desc":"Customer deposit liability"}
]'::jsonb),

-- ── Inventory ──────────────────────────────────────────────────────────────
(null, 'vehicle_acquired', true, '[
  {"account_key":"inventory","side":"debit","source":"amount","desc":"Capitalize vehicle"},
  {"account_key":"cash","side":"credit","source":"amount","desc":"Cash / floorplan out"}
]'::jsonb),

(null, 'trade_received', true, '[
  {"account_key":"inventory","side":"debit","source":"amount","desc":"Trade-in into inventory"},
  {"account_key":"trade_allowance","side":"credit","source":"amount","desc":"Trade allowance"}
]'::jsonb),

(null, 'recon_cost', true, '[
  {"account_key":"inventory","side":"debit","source":"amount","desc":"Add recon to vehicle cost"},
  {"account_key":"accounts_payable","side":"credit","source":"amount","desc":"Owed to vendor"}
]'::jsonb),

-- ── Commissions ────────────────────────────────────────────────────────────
-- commission_clawed_back has no rule by design: it posts the exact inverse of the
-- original accrual through postJournal directly, so it can never drift from it.
(null, 'commission_calculated', true, '[
  {"account_key":"commission_expense","side":"debit","source":"commission_total","desc":"Commission expense"},
  {"account_key":"commission_payable","side":"credit","source":"commission_total","desc":"Commission payable"}
]'::jsonb),

(null, 'commission_paid', true, '[
  {"account_key":"commission_payable","side":"debit","source":"commission_total","desc":"Clear commission payable"},
  {"account_key":"cash","side":"credit","source":"commission_total","desc":"Cash paid"}
]'::jsonb),

-- ── Service / Parts (Phase 4) ──────────────────────────────────────────────
-- The CORRECTED service_closed. Production's version debits AR by the pre-tax `revenue`
-- and never credits tax_collected, so tax charged to the customer was billed to nobody
-- and recorded as no liability. The invoice creates revenue + tax + AR; the customer's
-- later payment only moves AR into cash.
(null, 'service_closed', true, '[
  {"account_key":"accounts_receivable","side":"debit","source":"total","desc":"Service billed to customer (incl. tax)"},
  {"account_key":"service_revenue","side":"credit","source":"revenue","desc":"Service revenue (pre-tax)"},
  {"account_key":"tax_collected","side":"credit","source":"tax","desc":"Sales tax collected — a liability, not revenue"},
  {"account_key":"parts_cost","side":"debit","source":"cost","desc":"Parts cost"},
  {"account_key":"parts_inventory","side":"credit","source":"cost","desc":"Relieve parts inventory"}
]'::jsonb),

(null, 'parts_received', true, '[
  {"account_key":"parts_inventory","side":"debit","source":"amount","desc":"Parts received into stock"},
  {"account_key":"accounts_payable","side":"credit","source":"amount","desc":"Owed to parts vendor"}
]'::jsonb),

-- ── Core payment primitive (Phase 4 Batch 2) ───────────────────────────────
-- amount = applied + unapplied, so this balances. Cash arriving CLEARS a receivable and
-- never recognises revenue or tax again — the invoice already did that.
(null, 'payment_received', true, '[
  {"account_key":"cash","side":"debit","source":"amount","desc":"Customer payment received"},
  {"account_key":"accounts_receivable","side":"credit","source":"applied","desc":"Clear customer receivable"},
  {"account_key":"customer_deposits","side":"credit","source":"unapplied","desc":"Unapplied customer money held on deposit"}
]'::jsonb)

on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), event_name)
do update set lines = excluded.lines, active = true, updated_at = now();
