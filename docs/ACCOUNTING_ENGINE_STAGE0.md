# Accounting Engine — Stage 0 blueprint

**Design law:** accounting stores no business logic in screens. Every financial
record is produced by an **event → workflow → system action → accounting executor →
journal → ledger → reports** pipeline. Balances are *computed from journals*, never
edited. State lives on the object (invoice/PO/RO/commission), never in the workflow.

This is DESIGN ONLY. No migrations applied, no code changed. It preserves the
existing commission / split-deal / bonus / budget logic — that is kept and made
event-driven, **not** replaced with a generic ledger.

---

## 1. Inspect first — what exists today (keep vs add)

### Keep (already automotive-specific and customizable)
| Piece | Where | Note |
|---|---|---|
| Commission compute + split deals | `routes/commissions.js` `computeCommission`, `recomputeDealCommission` | split_deal / split_rep_id / split_pct / split_covers, F&I back-end split, volume bonus, spiff, clawback, draws |
| Per-rep plans | `commission_plans` (JSON `config`, `is_default`) | dealer-authored, no code change to add a plan |
| Commission lines | `deal_commissions` (role, front/back, status, period) | pending → paid → clawed_back |
| Budgets | `accounting` budget endpoints | per-category, monthly |
| Chart of accounts | `gl_accounts` (name, category, system_key, code) | |
| Ledger (single-sided) | `gl_entries` (amount, direction in/out, source, ref_deal_id) | **superseded** by journals (below), migrated not deleted |
| Deposits posting | `postDepositToLedger` | reused by the AR executor |

### Add (the gap)
1. **Double-entry Journal Engine** — balanced `journal_entries` + `journal_lines`.
2. **Accounting Executor** — a new executor in the Stage-4 registry, with sub-modules
   (GL, AR, AP, Inventory, Commissions[reuse], Payroll, Tax, Banking, Reconciliation).
3. **Posting-rules engine** — dealership-configurable rule sets that translate an
   event into balanced journal lines (so a store customizes its own postings).
4. **Object state machines** — invoice / expense / PO / repair order / commission /
   bank transaction, each with state ON THE OBJECT.
5. **Reporting engine** — reads journals only (Balance Sheet, P&L, Trial Balance,
   Cash Flow, aged AR/AP, inventory valuation, dept P&L, tax, commissions).

---

## 2. Architecture (fits the existing workflow engine)

```
Business event  →  emitEvent()  →  Workflow engine  →  system_action (post_accounting)
        →  Accounting Executor  →  Rules engine  →  Journal generator
        →  journal_entries + journal_lines (balanced)  →  General Ledger
        →  Reporting engine (Balance Sheet / P&L / …)
```

Accounting is **one more executor** alongside email / sms / vin / carfax / webhook.
It never holds state; it reacts to events and writes balanced journals.

```
action_executor
├── email · sms · vin_decode · carfax · notification · webhook
└── accounting
      ├── gl            (journal generator)
      ├── ar            (invoices, deposits, customer balances)
      ├── ap            (bills, vendor payables — reuses vendors table)
      ├── inventory     (capitalize on acquire, relieve/COGS on deliver)
      ├── commissions   (REUSE recomputeDealCommission + deal_commissions)
      ├── payroll       (commission_payable → cash on pay run)
      ├── tax           (tax payable, period close)
      ├── banking       (bank_transactions import)
      └── reconciliation(match bank ↔ journals)
```

---

## 3. The Journal Engine (the new substrate)

Everything eventually becomes a balanced journal. New tables (review-only SQL):

```sql
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  entry_date date not null default current_date,
  reference text,                       -- deal #, invoice #, RO #
  source text not null,                 -- deal|invoice|expense|po|ro|commission|payroll|bank|manual
  event_name text,                      -- the emitEvent that produced it
  workflow_instance_id uuid,
  memo text,
  posted boolean not null default true, -- draft vs posted (period lock)
  reversal_of uuid,                     -- immutable: corrections are new reversing entries
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  dealership_id uuid not null,
  account_id uuid not null,             -- gl_accounts.id
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  department text,                      -- Sales|Service|Parts|Finance|BodyShop|Admin
  ref_deal_id uuid, ref_vehicle_id uuid, ref_contact_id uuid,
  ref_vendor_id uuid, ref_employee_id uuid,
  memo text
);
-- Invariant enforced by the generator (and a check): per entry, sum(debit)=sum(credit).
```

**Immutability:** posted entries are never edited. A correction is a new
`reversal_of` entry. This gives the audit trail. `gl_entries` stays for historical
reads; new postings go to journals; a compatibility view can union both during
transition.

---

## 4. Chart of accounts (seed the standard dealership CoA)

Assets: Cash · Inventory · Accounts Receivable · Contracts-in-Transit · Prepaids.
Liabilities: Accounts Payable · Taxes Payable · Floorplan · Customer Deposits ·
Commission Payable. Equity: Retained Earnings. Revenue: Vehicle Sales · F&I ·
Warranty · Accessories · Service · Parts. Expenses: COGS · Advertising · Payroll ·
Commissions · Reconditioning · Repairs · Office · Interest · Utilities.
(Extends the existing `gl_accounts.system_key` set.)

---

## 5. Event catalog → posting rules

Each event maps, via a **dealership-editable rule**, to balanced journal lines.

| Event | Journal (debit / credit) |
|---|---|
| `vehicle.acquired` | DR Inventory · CR Cash/Floorplan/AP |
| `deal.delivered` | DR AR (or Contracts-in-Transit) · CR Vehicle Sales, F&I, Warranty, Accessories, Finance Reserve · DR COGS · CR Inventory · CR Taxes Payable |
| `commission.calculated` | DR Commission Expense · CR Commission Payable |
| `commission.paid` (pay run) | DR Commission Payable · CR Cash |
| `deposit.paid` | DR Cash · CR Customer Deposits |
| `expense.approved` | DR Expense · CR AP |
| `expense.paid` | DR AP · CR Cash |
| `po.received` | DR Inventory/Parts · CR AP |
| `repair.invoiced` | DR AR · CR Service/Parts revenue · DR COGS · CR Inventory |
| `bank.funding_received` | DR Cash · CR AR / Contracts-in-Transit |
| `chargeback` | reverse the original commission/reserve lines |
| `month.closed` / `year.closed` | lock period; roll to Retained Earnings |

The rule engine is `accounting_rules` (dealership_id null = default), so a store
customizes account mapping and which components it books — no code change.

---

## 6. Object state machines (state on the object)

Invoice: `draft→approved→sent→partially_paid→paid→written_off|cancelled`
Expense: `draft→submitted→approved→scheduled→paid→reconciled`
Purchase order: `draft→approved→ordered→received→matched→closed`
Repair order: `open→working→waiting_parts→completed→invoiced→paid→closed`
Commission: `pending→calculated→approved→payable→paid` (already close to `deal_commissions.status`)
Bank txn: `imported→matched→reconciled`

Each transition emits an event → the accounting executor posts the matching journal.
New tables: `invoices`, `bills`, `purchase_orders`, `repair_orders` (service already
has some of this — reuse), `bank_transactions` (exists), plus status columns.

---

## 6b. Engine component map (the accounting engine's internals)

```
Accounting Engine
├── Event Listener      (subscribes to the events bus)
├── Rule Engine         (accounting_rules → which accounts, which components)
├── Journal Engine      (double-entry; the ONLY thing allowed to post)
├── Ledger              (journal_entries + journal_lines)
├── Commission Engine   (EXISTING — unchanged calc, now emits commission_result)
├── Bonus Engine        (EXISTING)
├── Split Deal Engine   (EXISTING)
├── Draw Engine         (EXISTING)
├── Budget Engine       (EXISTING — expanded)
├── Payroll Engine      (pay-period + approval lock)
├── Financial Statements(read-only over journals)
├── Forecast Engine     (projects from live deal/workflow state)
└── Audit Engine        (immutable trail; reversing entries only)
```

**The one rule:** nothing writes financial postings except the Journal Engine.
Every other component *produces a result*; the Journal Engine turns results into
balanced entries. No `insert into gl_entries` anywhere else, ever.

## 6c. Financial vs operational events

Operational events (already emitted: `deal.created`, `recon.stage_changed`, …)
drive tasks and workflow. A subset are **financial events** that the accounting
executor consumes to post journals:

```
deal_sold · vehicle_delivered · deposit_received · expense_created · expense_paid
trade_received · trade_sold · inventory_adjusted · vehicle_written_off
commission_calculated · commission_adjusted · draw_paid · bonus_awarded
bonus_reversed · chargeback_created · warranty_cancelled · gap_cancelled
reserve_received · bank_funding_received · payroll_posted · month_closed · year_closed
```

An operational event can *also* be financial (e.g. `vehicle.delivered`); the
accounting executor simply subscribes to the financial subset. Each produces
journals **through rules**, never hard-coded postings.

## 7. Preserve the automotive commission/bonus/budget engine

The generic ledger is the *plumbing*; your comp logic stays the *brain*. **Do not
touch the calculation logic.** The migration objective is: **replace the ledger,
not the commission calculations.**

- **Commission engine → `commission_result` contract.** The EXISTING
  `recomputeDealCommission` (splits, F&I manager split, volume bonus, spiff,
  clawback, draw) runs unchanged, but its output becomes a structured
  `commission_result` (per-rep role lines + amounts) instead of writing the ledger.
  The Journal Engine consumes that result and posts:
  `DR Commission Expense / CR Commission Payable`, then on pay run
  `DR Commission Payable / CR Cash`. The comp code no longer knows the ledger exists.
- **Bonus / draw / chargeback / manufacturer-program / F&I-product** rules become
  additional dealer-configured rule sets feeding the same journal generator.
- **Budgets** expand to dealer/department/salesperson/expense/ad/floorplan/recon/
  payroll/marketing/capital across month/quarter/year, compared against ledger
  actuals (budget vs actual vs variance vs forecast).
- **Profit centers**: `journal_lines.department` → per-department P&L from journals.
- **Payroll**: pay-period engine (weekly/biweekly/semi-monthly/monthly), approval
  chain (rep → manager → controller → GM → locked → posted), immutable after post.

---

## 7b. Period Lock Engine (audit integrity)

Accounting periods move through a state machine, state on the period object:

```
open → manager_approved → controller_approved → closed → locked
```

After `locked`: **no edits, no deletes** to journals in that period. Corrections
are new **reversing entries** (`journal_entries.reversal_of`) dated in an open
period. New table `accounting_periods` (dealership_id, period, status, approvals,
locked_at, locked_by). The Journal Engine refuses to post/edit into a locked period.

## 7c. Forecast Engine (the differentiator)

Because the workflow engine already knows every deal's live state, the forecast
engine projects — in real time, not at month-end — from open deals + posted
journals + comp plans:

```
month-end gross · payroll owed · sales commissions · F&I payouts
reconditioning cost · advertising spend · net profit · cash flow
```

Reads: `deals` (working/sold/delivered), `deal_commissions` (pending), budgets,
and posted journals. Pure projection — writes nothing. Surfaces on the exec
dashboard and updates continuously as deals move.

## 8. Staged rollout (each stage reviewed, nothing rebuilt)

- **A1 Journal engine** — tables + generator + balance invariant + CoA seed.
- **A2 Accounting executor** — register in the Stage-4 registry; wire engine
  `post_ledger`/`post_commission` steps to it (replaces the current no-ops).
  Reuse `postDealToLedger`/`recomputeDealCommission` idempotently → **no double-post**.
- **A3 deal.delivered full posting** — revenue + COGS + inventory relief + tax + AR,
  as balanced journals via the rules engine.
- **A4 Commissions → journals** — `commission.calculated`/`paid` post from existing
  comp results; payroll pay-run.
- **A5 AR/AP/Inventory** — invoices, bills, PO receive, inventory capitalize/relieve.
- **A6 Repair orders + service** — RO lifecycle → journals.
- **A7 Banking + reconciliation** — import, match, reconcile against journals.
- **A8 Reporting engine** — Balance Sheet, P&L, Trial Balance, Cash Flow, aged
  AR/AP, inventory valuation, dept P&L, tax, commission statements — all read-only
  over journals.
- **A9 Budgets + forecasting + month/year close** — period lock, retained earnings.

---

## 9. Coexistence (avoid the double-post trap)

Same rule we used for tasks: **idempotent dedupe.** The accounting executor reuses
`postDealToLedger` (already deletes+reinserts by `ref_deal_id`) and
`recomputeDealCommission` (idempotent). The imperative delivery-path calls can then
be removed once the executor path is proven — the executor becomes the single
source, gradually, with no window of double-counting.

---

## 10. Open decisions before A1

1. **Journal model**: introduce `journal_entries`/`journal_lines` as the new
   substrate and keep `gl_entries` read-only for history (recommended), or extend
   `gl_entries` in place?
2. **First slice**: safest first step is **A2** (make accounting an executor wrapping
   existing logic — event-driven, zero rebuild, no schema change). Confirm start there
   before the double-entry migration (A1/A3).
3. **Service/RO**: reuse the existing service module tables or add `repair_orders`?
4. **Payroll scope**: build the pay-period + approval-lock engine now, or after AR/AP?
```
