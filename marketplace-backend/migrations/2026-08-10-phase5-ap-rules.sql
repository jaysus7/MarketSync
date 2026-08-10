-- Phase 5 PR 5.2 — Accounts Payable reaches the real ledger.
--
-- THE DEFECT: an approved expense posted to `gl_entries`, the LEGACY single-sided
-- substrate — one row, one direction, no counter-entry. It never touched
-- journal_entries/journal_lines, so nothing AP did appeared in the trial balance, the
-- balance sheet, or as any Accounts Payable liability. Editing an approved expense also
-- mutated that posted row in place, and rejecting it deleted the posting outright.
--
-- Expenses keep writing gl_entries for now — the accounting engine has always been
-- documented as running in parallel with the legacy substrate during rollout, and
-- accountBalances() reads only journal_lines, so there is no double count.
--
-- What changes is that approval and payment now ALSO emit canonical business events, so
-- the double-entry ledger carries the liability:
--
--   expense.approved  DR <mapped expense/asset account>  CR Accounts Payable
--   expense.paid      DR Accounts Payable                CR Cash
--
-- Only `expense_paid` is a rule: both of its accounts are fixed, so a dealership can
-- legitimately override it (a different bank account, say). `expense.approved` is posted
-- directly by the engine instead, because its DEBIT account varies per bill — advertising,
-- rent, parts, recon-to-inventory. Encoding one debit account in a shared rule would force
-- every bill through a single account and quietly destroy category and department
-- reporting. The mapping lives in routes/expenses.js; an unmapped category fails the
-- posting with AC001 (PR 5.1) rather than inventing an account, because a bill that cannot
-- be classified must not be silently booked to the wrong place.
--
-- APPLIED TO STAGING ONLY.

insert into public.accounting_rules (dealership_id, event_name, active, lines) values
(null, 'expense_paid', true, '[
  {"account_key":"accounts_payable","side":"debit","source":"amount","desc":"Clear vendor payable"},
  {"account_key":"cash","side":"credit","source":"amount","desc":"Paid from bank"}
]'::jsonb)
on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), event_name)
do update set lines = excluded.lines, active = true, updated_at = now();
