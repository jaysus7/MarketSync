# Phase 5 — Accounting: critical financial truth check

> **Update — PR 5.1 (Ledger Integrity) is complete.** Every gap below is corrected on
> staging and proved against the live database; see
> [PR 5.1 outcome](#pr-51-outcome--ledger-integrity) at the foot of this document.
> The remaining truth areas (AR, AP, banking, close, commissions, statements) are now
> answerable and belong to the next PR.

**Status when written: STOP GATE reached before UI work.** The truth check found material
issues in the first two areas (journal integrity, producer coverage) that make the
remaining six unanswerable as posed: you cannot build an AR queue, a close checklist or a
P&L on a ledger that has never recorded a transaction.

Baseline: `staging` @ `fe61f77`, 553/553 tests, six `check:*` green.
Evidence gathered by querying both Supabase projects read-only, plus one probe on
staging inside a transaction that always rolls back. **Nothing was written to either
database. No events were replayed. No journals were backfilled.**

---

## CURRENT TRUTH

The infrastructure is real and mostly well-shaped:

- `journal_entries` / `journal_lines` — double-entry substrate, `posted` flag,
  `reversal_of` self-reference for auditable corrections.
- `accounting_rules` — one `event_name` → N balanced lines, dealership-overridable,
  unique on `(coalesce(dealership_id, …), event_name)`.
- `accounting_periods` — `open → manager_approved → controller_approved → closed → locked`.
- `postJournal()` is the only writer; `postByRule()` maps an event to a rule.
- `routeFinancialEvent()` handles **12** event types across Sales, F&I, Inventory,
  Service, Parts, deposits, payments and commissions.
- `accounting_event_log` records every event→journal mapping for replay.
- **Staging only:** four database triggers — `enforce_journal_entry_posting`
  (≥2 lines and debits = credits), `enforce_journal_line_immutability`,
  `enforce_accounting_period_lock`, `enforce_core_tenant_relationships`.

**Both environments have zero journal entries and zero journal lines.** Not one
financial transaction has ever been recorded, on either. That is the finding everything
below explains.

| | staging `hpxnjbdiaaoopxeayfen` | production `omyuqzveegzspeojrqkd` |
|---|---|---|
| `journal_entries.posted` default | **`false`** | **`true`** |
| Triggers on journal tables | **4 present** | **none** |
| `gl_accounts` | 14 | 30 |
| `accounting_rules` | **3** | **9** |
| `journal_entries` / `journal_lines` | 0 / 0 | 0 / 0 |

The two environments have **diverged schemas**, and the rule sets are near-disjoint
complements of each other.

---

## CRITICAL GAPS

### G1 — Nothing is ever posted, and the one real integrity control never runs *(staging)*

`postJournal()` never sets `posted`, so it inherits the column default. On staging that
default is `false`, so every entry it writes is a permanent **draft**.

`enforce_journal_entry_posting` only checks line count and debits = credits **when
`posted` is or becomes true**. Since nothing is ever posted, the balance check is
dormant. `enforce_journal_line_immutability` likewise only bites when the parent is
posted — so in practice every journal line is freely mutable and deletable.

Meanwhile `accountBalances()` reads `journal_lines` with **no `posted` filter and no join
to entry status**. The write path produces drafts; the read path treats everything as
authoritative.

> Verified by probe: header insert succeeded with `posted=false`, and both lines
> inserted cleanly — no balance check, no immutability.

**Consequence:** the ledger is simultaneously never posted, never balance-checked, fully
mutable, and read as if it were final. Any statement built on it today would be
untrustworthy in a way nothing in the system would flag.

### G2 — Production has no journal protection at all

Production carries **no triggers** on `journal_entries` / `journal_lines`, and `posted`
defaults to `true`. So there is no database-level balance enforcement, no line-count
requirement and no immutability — the guarantees exist only on staging. The application
balance check in `postJournal()` validates its *input* lines, but then silently drops any
line whose account fails to resolve (`if (!acct) continue`), so an entry can still reach
the database unbalanced.

### G3 — Posting failures are swallowed

`postJournal()` returns `null` and only `console.error`s on: unbalanced input, locked
period, and header-insert failure. The `journal_lines` insert error is **not checked at
all**. Producers therefore cannot distinguish "posted" from "silently dropped", and a
locked-period posting discards the business event with no exception record.

`onFinancialEvent()` does log `status: 'skipped'` to `accounting_event_log`, which is the
one saving grace — but nothing surfaces it, and "skipped" is used both for "not a
financial event" and "financial event that failed to post".

### G4 — Posting is not atomic

The entry header and its lines are two separate inserts with no transaction. A failure
between them leaves a header with no lines — which on production (no triggers) is a
permanently unbalanced journal.

### G5 — Idempotency is a race

Deduplication is an application-level select-then-insert on
`(dealership_id, source, reference, event_name)`. There is **no unique index** — the only
index is the non-unique `je_source_idx (dealership_id, source, reference)`, which does
not even include `event_name`. Two concurrent deliveries of the same event both pass the
check and both insert. Compare Phase 4, where stock movement got
`part_txns_idempotency_uk` as a real backstop.

### G6 — Producer coverage is broken in opposite directions per environment

The router handles 12 event types. `postByRule()` returns `null` when no rule exists, so
an event with no rule posts nothing, silently.

- **Staging has 3 rules** (`parts_received`, `payment_received`, `service_closed`).
  The 8 base rules were seeded by a migration marked *"already applied to
  omyuqzveegzspeojrqkd"* — production. **Staging never received them.** So on staging,
  delivered vehicles, funding, deposits, acquisitions, trades, recon and every commission
  event post nothing.
- **Production has 9 rules** but is missing `parts_received` and `payment_received`, and
  its `service_closed` is the **uncorrected 4-line version** (staging's is the corrected
  5-line one from Phase 4).

Neither environment has a complete rule set. This is the quantified form of the
reconciliation the Phase 4 handoff flagged as an outstanding owner decision.

### G7 — Unknown account keys silently mint new accounts

`resolveAccount()` auto-creates a GL account for any key it does not recognise,
defaulting to `category: 'expense'`. A typo in a posting rule creates a new expense
account rather than failing, which quietly corrupts the chart of accounts.

---

## Financial consequence

No dealership using MarketSync today has a general ledger. Every producer has been
emitting correct business events, and every one of them has been dropped on the floor
without a visible error. Trial balance, P&L, balance sheet, AR and AP aging all currently
read from an empty ledger — they would render zeroes, not wrong numbers, which is the one
piece of luck here.

**Historical remediation: not required.** Both environments have zero journal rows, so
there is nothing corrupted to unwind. This must be fixed *before* volume arrives, not
after. That is the whole reason this gate is worth stopping at.

---

## IMPLEMENTATION — smallest safe correction, in order

Ordered so each step is independently verifiable, and none of it touches production.

1. **Converge the schema.** Bring staging and production to one definition:
   `posted` default, the four triggers, and a **unique index** on
   `(dealership_id, source, reference, event_name)` where `reference is not null`.
2. **Make posting atomic and explicit.** Move `postJournal` into a single database
   function that inserts the header unposted, inserts all lines, then flips `posted` to
   true — so the trigger's balance check fires as the last act of one transaction.
   A line whose account cannot resolve must **fail** the posting, not be skipped.
3. **Stop swallowing failures.** `postJournal` raises; `onFinancialEvent` records a
   distinct `status: 'failed'` with the reason, separate from `'skipped'`. A
   locked-period posting becomes a recorded exception, never a silent drop.
4. **Seed the complete rule set on staging** — the 8 base rules it never received —
   and reconcile the two `service_closed` versions.
5. **Filter reads by `posted`.** `accountBalances()` and every statement must join entry
   status. Drafts are not balances.
6. Only then: the Accounting department UI (Today / Work / Insights / Automation /
   Settings) and E2E 1–12 as specified.

Steps 1–5 are the prerequisite for every E2E in the brief. E2E 12 (trial balance
balances) is currently vacuous — it balances because it is empty.

---

## DEFERRED

- **Production schema/rule correction** — needs an explicit owner decision, per the
  standing rule that production is a separate deliberate act. Documented, not applied.
- **Cash Flow statement** — cannot be produced correctly until posting works and
  dimensions exist. Per the brief, defer rather than approximate.
- **Department P&L** — depends on `journal_lines.department` actually being populated by
  the rules; assess after step 4.
- **AP/AR/banking/close/commission truth areas (3–7)** — inspected only far enough to
  confirm they depend on the ledger. Full assessment resumes after posting works.
- **Historical remediation queue** — nothing to remediate today; revisit once posting is
  live and real volume exists.

---

## TESTS

To be written alongside the correction, not after:

- `postJournal` refuses an unbalanced entry, and **raises** rather than returning null.
- A line with an unresolvable account fails the whole posting.
- Concurrent identical events produce exactly one journal (the unique index, proved by
  racing two inserts).
- A locked-period posting produces a recorded exception, not a silent drop.
- A posted entry cannot be updated, deleted, or have its lines changed.
- Every one of the 12 routed event types has an active rule, and each rule's lines
  balance by construction.
- `accountBalances()` excludes unposted entries.
- Trial balance balances **on non-empty data**.

---

# PR 5.1 outcome — Ledger Integrity

The general ledger is now real. Every gap G1–G7 is corrected on **staging**; production is
untouched and its convergence is listed at the end.

## Schema changes (staging)

| Change | Why |
|---|---|
| `journal_entries.posted` default → `false` | Financial semantics must not come from a column default. Production defaulted `true`, staging `false`, so identical code meant two different things. |
| `journal_entries_source_identity_uk` unique on `(dealership_id, source, reference, event_name) where reference is not null` | Idempotency becomes a database guarantee. Unreferenced manual/adjusting entries are deliberately excluded — they carry no source identity. |
| `gl_accounts_system_key_uk` unique on `(dealership_id, system_key)` | The chart had no uniqueness at all, so account resolution could pick arbitrarily between duplicates. |
| Three integrity triggers restated idempotently | They existed on staging and were **absent on production**. Shipping them in the migration is what lets production converge. |
| `accounting_post_journal(...)` | The one atomic posting path. |
| `accounting_seed_chart(...)` + full chart seed | Strict account resolution is only safe if the accounts a rule may name already exist. |

## Atomic posting

One database function, one transaction: idempotency check → **draft** header → all lines →
`posted = true` **last**. Posting last is the entire point — the balance and line-count
triggers only fire on the draft→posted transition, which under the old code never happened,
so they had never run once.

`postJournal()` now returns `{ id, created, duplicate }` or **throws**. There is no longer
an outcome where nothing posted and the caller believes it succeeded.

## Idempotency

Application pre-check for the common case; the **unique index** is the guarantee. The
function catches `unique_violation` and returns the winner's journal, so a lost race is a
duplicate result rather than an error.

## Failure handling

`PostingError` carries dealership, source, event, reference and a SQLSTATE
(`AC001` unknown account · `AC002` period locked · `AC003` no lines · `AC004` no dealership),
plus a `userMessage` written for a controller rather than the raw driver text.

`accounting_event_log` now distinguishes `processed` / `skipped` / **`failed`** — previously
a refused posting was indistinguishable from "not a financial event". Every failure also
raises an `accounting_posting_failed` exception through the existing DealerOS exception
primitive (department Accounting, severity high). No second system was built.

A locked period is now a refusal (`AC002`), not a silent discard.

## Account resolution

`resolveAccount()` is gone. Resolution happens inside the posting transaction against the
dealership's chart; an unknown key **fails the posting**. It can no longer mint an expense
account from a mistyped rule key. `ACCOUNT_DEFS` is pinned to the chart migration by test.

## Final staging rule inventory — 11 active, one per canonical event

`vehicle_delivered` (6 lines) · `funding_received` · `deposit_received` ·
`vehicle_acquired` · `trade_received` · `recon_cost` · `commission_calculated` ·
`commission_paid` · `service_closed` (5 lines, **corrected**) · `parts_received` ·
`payment_received` (3 lines)

`commission_clawed_back` deliberately has **no rule** — it posts the exact inverse of the
original accrual, so a rule could only drift from it.

The corrected `service_closed` debits AR by the **tax-inclusive total** and credits
`tax_collected`. Production's version debits AR by pre-tax `revenue` and never credits tax
at all, so tax charged to customers was billed to nobody and recorded as no liability.

## Posted-only reads

`accountBalances()` resolves through `journal_entries` with `.eq('posted', true)`
**unconditionally** — previously the entry join happened only when a date range was given.
Trial balance, P&L, balance sheet, dashboard cards and forecast all share that one function,
so posted-only is decided in one place. The journal listing still shows drafts, carrying
their `posted` flag, which is what makes them visibly non-authoritative.

## Integrity proofs (live staging, every probe rolled back)

| Proof | Result |
|---|---|
| Valid two-sided journal | posted, 2 lines, DR 100.00 = CR 100.00 |
| Unbalanced 100 vs 90 | refused by trigger · **residue 0** |
| Single-line journal | refused (minimum two lines) · **residue 0** |
| Same source identity twice | **1 journal**, second returns `duplicate: true` |
| Concurrent duplicate (index-level, bypassing the app check) | second insert **rejected by unique index**, rows = 1 |
| Unreferenced manual entries | correctly **not** deduped (2 allowed) |
| Mutate a posted line | blocked — "Lines belonging to a posted journal entry are immutable" |
| Unknown account key | refused `AC001` · accounts 34 → 34 · **residue 0** |
| Draft journal | posted balances unchanged (0 → 0); trial balance ignores it; lines editable |
| Draft edited unbalanced, then posted | **refused at posting** (8888 vs 9999) |
| Draft edited balanced, then posted | ledger moves by exactly 7500.00 |

## Business-event smoke tests (through the real seeded rules)

Every department's canonical event resolved its rule, balanced, and landed posted:

`vehicle_delivered` (Sales, 6 lines) · `funding_received` · `deposit_received` (F&I) ·
`vehicle_acquired` · `trade_received` · `recon_cost` (Inventory) · `service_closed`
(Service, 5 lines) · `parts_received` (Parts) · `payment_received` (Payments) ·
`commission_calculated` · `commission_paid` (Payroll)

Replay of a business event produced **exactly one** journal.
**Trial balance on non-empty data: DR 104,964.00 = CR 104,964.00.**

Staging afterwards: 0 entries, 0 lines, 0 phantom accounts, 11 rules, 247 accounts. No
backfill, no historical replay, no residue.

## Tests

`test/ledger-integrity.test.js` — 17 tests covering atomic ordering, trigger installation,
idempotency, strict account resolution, chart↔`ACCOUNT_DEFS` agreement, typed failures,
skipped-vs-failed, posted-only reads, rule coverage and one-rule-per-event.

`scripts/phase5-ledger-proof.mjs` — the live proof as a runnable script for any environment
holding staging credentials (it refuses to run against anything but staging). CI has no
Supabase credentials, so it is not part of `npm test`, matching the repo's convention.

Two pre-existing tests (`funding-events`, `vehicle-acquired`) asserted on a **comment**
describing the old dedupe. They now assert the unique index and the RPC — the actual, and
stronger, guarantee.

**570/570 tests · all six `check:*` green.**

## Production convergence — WRITTEN BUT UNAPPLIED

Production remained read-only throughout. Applying these three migrations there, unchanged
and in order, would:

1. `2026-08-10-phase5-ledger-integrity.sql` — flip `posted` default `true` → `false`,
   add both unique indexes, and **install the three integrity triggers production currently
   lacks entirely**, plus the posting function.
2. `2026-08-10-phase5-chart-of-accounts.sql` — seed the 34-account chart per dealership
   (additive; existing accounts keep their id, code and name).
3. `2026-08-10-phase5-accounting-rules.sql` — add the two missing Phase 4 rules and
   **repair the defective `service_closed`** via its upsert.

All three are idempotent. Production holds 0 journal entries, so there is nothing to
remediate and no backfill is implied. **This remains an explicit owner decision.**

## Carried forward to PR 5.2 — not a ledger-integrity issue

`vehicle_delivered` debits **Accounts Receivable** for the whole sale, while
`funding_received` credits **Contracts in Transit** — an account nothing ever debits. For a
financed deal, CIT would go negative and the AR raised at delivery would never clear. The
intended model (delivery → CIT → funding clears CIT) needs a decision about deal posting
semantics, which is producer coverage rather than ledger integrity, so the rules were
converged as-approved and this is left for the next PR to resolve deliberately.

---

# PR 5.2 outcome — deal posting semantics, AR and AP

## Financed deal posting correction

`vehicle_delivered` debited the entire sale to Accounts Receivable while
`funding_received` credited Contracts in Transit — an account nothing ever debited. Customer
AR was overstated by the lender's share and CIT went negative on funding, so a funded
financed deal could never clear.

The debit side is now the deal's **settlement**. The credit side (revenue, F&I, tax,
COGS/inventory) is untouched, so revenue treatment and the amount being settled are exactly
what they were — only the meaning of the debit changed.

## Settlement model

`dealSettlement()` lives in the **Deal Engine**, not Accounting: every figure is read from
the finalized deal and the only arithmetic is apportioning what is already there. Order:
deposit → trade equity → down payment → lender, remainder is the genuine customer balance.

| Debit | From |
|---|---|
| Contracts in Transit | selected lender decision's `approved_amount` (fallback `amount_financed`) |
| Cash | `down_payment` |
| Customer Deposits | `deposit_amount` — clears the liability `deposit_received` raised |
| Trade Allowance | trade equity — clears the liability `trade_received` raised |
| Accounts Receivable | **only** what the customer still owes |

`apportionSettlement()` is pure, so tests exercise the real arithmetic. Over-settlement is
reported as a `deal_over_settled` exception rather than absorbed into a fabricated liability;
the journal still balances by construction.

## CIT result

Proved on staging: financed delivery → CIT 30,000.00 / customer AR 0.00; funding → **CIT
0.00, never negative**. Cash deal → no CIT. F&I funding now clears CIT from the same
derivation delivery used; it previously fell back to `selling_price`, which delivery never
debited, and would have left a permanent unexplained residue.

## AR result

Derived from posted journal lines against Accounts Receivable, grouped by the canonical
source, netted by `payment_allocations` — no second ledger, no status flag. Aging is derived
on read from real dates, never persisted. Application refuses to over-apply. Contracts in
Transit is reported **separately** as a lender receivable.

Proved: Service RO closes at 452.00 AR, a 200.00 payment leaves **252.00**.

## AP result

**AP previously posted only to the legacy single-sided `gl_entries`** — it never touched the
double-entry ledger, so no Accounts Payable liability existed in the trial balance at all,
and editing an approved expense mutated the posted row in place.

Approval and payment now emit canonical events: `expense.approved` posts
DR <mapped account> / CR Accounts Payable, `expense.paid` posts DR AP / CR Cash. Every one of
the 23 expense categories has a decided `account_key`; `Other` maps to nothing on purpose, so
an unclassifiable bill fails with **AC001** rather than being booked to the wrong place. The
debit is posted directly rather than through a shared rule, because one rule would force
every category through a single account and destroy department reporting.

Proved: bill approved → AP 1,200.00; paid → **AP 0.00**, cash −1,200.00.

## Accounting Today

An exception queue, not a KPI wall: posting failures first (money moved, books do not know),
then negative CIT, aging funding, AR overpaid/overdue, AP awaiting approval/overdue, and
ledger-vs-status disagreements. Each item carries source, amount, age, reason, owner and next
action. It reuses the existing `exceptions` primitive — no second system.

## Deal Posting + CIT queue

Deal Posting answers "has this transaction reached the books", with posting state derived
from the ledger and the event log rather than a second persisted flag, showing CIT and
customer AR as **separate** figures. The CIT queue groups awaiting-funding / aging /
exception / cleared, and surfaces negative CIT explicitly as the signature of the old defect.

## Validation

- **604/604 tests**, all six `check:*` green.
- 34 new tests: `deal-settlement.test.js` (15, running the real apportionment),
  `accounting-ar-ap.test.js` (19).
- Mobile at **390px** across 8 surfaces (Service ×2, Parts, Accounting Today, Deal Posting,
  CIT, AR, AP): no horizontal overflow, no clipped state signals, no collapsed tap targets.
- Staging left at 0 journal rows. No backfill, no historical replay. Production untouched.

## Deferred

- **Parts receipt clearing → vendor bill matching — deferred depth.** `parts_received` debits
  Parts Inventory and credits Accounts Payable directly; there is no GRNI/clearing account and
  no PO, so no deterministic receipt↔bill relationship exists to connect. Nothing presents a
  "fully reconciled" state, so nothing is misleading. Three-way matching would be new
  procurement scope.
- **Partial funding.** The canonical model has one `funded` transition, so CIT clears in full.
  Partial funding was not invented for this PR.
- **Unapplied payment** already exists in the payment primitive (`payment_received` credits
  Customer Deposits for the unapplied portion); no cash-application UI was built beyond
  applying to a named receivable.
- Banking/reconciliation, period close and Payroll & Commissions workspaces remain for a later
  PR — they are outside PR 5.2's merge gate.

## Production convergence — still UNAPPLIED

Adds to the PR 5.1 list: `2026-08-10-phase5-deal-settlement-rule.sql` (corrects
`vehicle_delivered`) and `2026-08-10-phase5-ap-rules.sql` (adds `expense_paid`). Both are
upserts. Production still holds 0 journal entries, so there is nothing to remediate.

---

# PR 5.3 outcome — Journal, Close, Banking, Payroll & Commissions

Completes the Accounting department's operating surface over infrastructure that already
existed. No new financial primitives; nothing here posts a journal.

## Journal

The general journal with every line, showing **Debits = Credits** per entry. Drafts are
labelled *"not financial truth"* and listed separately, because they pass no balance check and
are excluded from every balance. Nothing in the view mutates a posting — a posted entry is
immutable and a correction is a new reversing entry.

## Close

`closeChecklist()` derives every item from real accounting state — posting failures, unposted
journals in the period, open accounting exceptions, negative CIT, AR/AP condition, commission
exceptions, and a period trial balance computed from posted entries only. Advancing the period
is **disabled while a blocking item stands**, and the server owns the flow
(`open → manager_approved → controller_approved → closed → locked`) and its permission.

Exactly **one** item is a manual attestation — bank reconciliation — and it says why it cannot
be derived rather than looking like a real result.

## Banking

**Deliberately shallow, and says so.** `bank_transactions` is a raw Plaid feed with no match
state, no statement and no reconciliation record; the schema has no reconciliation model at
all. The view presents cash movement and states plainly that matching is not built, so nothing
can read as reconciled. Building that model is its own piece of work.

## Payroll & Commissions

Composes the Commission Engine: pay periods, open commission exceptions, and their status.
Commission amounts are **not recalculated** — two calculations would eventually disagree, and
payroll is the wrong place to discover it. A test pins that no commission arithmetic exists in
the surface.

## Validation

**613/613 tests**, six checks green. 9 new tests. Mobile validated at **390px across all
twelve workspace surfaces**. Staging still holds 0 journal rows; no backfill.

## What Accounting still does not have

- **Bank reconciliation** — no data model. Matching, statements and reconciliation records
  would all be new.
- **Financial statements inside the workspace** — Insights points at the existing Accounting
  page, which already computes P&L, balance sheet and trial balance from posted journals.
  Department P&L, Budget vs Actual and Cash Flow remain as they were; Cash Flow in particular
  should not ship until it can be produced correctly.
- **Manual journal entry** — the ledger supports drafts and the posting function enforces
  balance, but no UI creates one.
