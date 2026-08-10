# Phase 5 — Accounting: critical financial truth check

**Status: STOP GATE reached before UI work.** The truth check found material issues in
the first two areas (journal integrity, producer coverage) that make the remaining six
unanswerable as posed: you cannot build an AR queue, a close checklist or a P&L on a
ledger that has never recorded a transaction.

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
