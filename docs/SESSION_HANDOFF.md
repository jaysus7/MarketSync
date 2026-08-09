# Session handoff

Start every new coding session here (Doc 22 §13). Keep it short and **current** —
update it in the same commit as the work it describes. This is the living state
of the build; `docs/DEALEROS_UI_AUDIT.md` and the Stage 0 docs hold the detail.

---

## Where things stand

| | |
|---|---|
| **Last updated** | 2026-08-09 |
| **Target branch** | `staging` (production deploys from `main` — see `render.yaml`) |
| **Baseline on `staging`** | `8cc0489` — 465/465 tests green, all six `check:*` green |
| **In flight** | **Batch 1 COMPLETE** (20/20 E2E). **Batch 2 started** — Service tax/AR and parts-receipt accounting corrected going forward (503/503, six checks). Remaining in Batch 2: invoice, payments/AR clearing (**blocked — no payment record exists anywhere in MarketSync; see the decision note below**), delivered→closed. Then Batch 3 (operating UI). |
| **Roadmap position** | Phase 1–3 complete. Phase 4: #72/#73/#74 merged to `staging`; Batch 1 steps 1–5 built on the branch and green. **The database owns the RO state machine — read audit §32 before touching Service.** Remaining: Batch 1 integration proof → Batch 2 (financial close) → Batch 3 (Service/Parts operating UI + E2E). After Fixed Ops the handoff's stated order is Accounting → Marketing → People → dealership-wide My Day; **confirm against the canonical roadmap before assigning a phase number to it.** |

## Read before coding

1. `AGENTS.md` — **Part A** is the governing product/architecture law, **Part B**
   the frontend guardrails. Both are binding.
2. `docs/KERNEL_CONTRACT.md` — **frozen**.
3. `docs/DEALER_OS_UX_ARCHITECTURE.md` — **the as-built UI architecture**: engine
   registration, standard tabs, role/entitlement behaviour, department ownership,
   handoffs, the shared helpers that really exist, and the rules a new department
   must follow. Note the naming warning: DepartmentShell / AttentionQueue /
   RecordWorkspace / QuickActions / DepartmentKPI / WorkflowBoard / "My Day" are
   **conceptual names only** — no such runtime components exist.
4. `docs/DEALEROS_UI_AUDIT.md` — every page → workspace/tab mapping, the four
   gating layers, and what is deliberately deferred.
5. `docs/SALES_PHASE2_AUDIT.md` — the Sales reference department (see §0).
6. `docs/STAGE4_SERVICE_PARTS_AUDIT.md` — **the Fixed Ops domain truth.** Start at §0
   (executive summary) and §31 (stop gate). Schema- and code-level evidence for Service
   and Parts; supersedes `docs/SERVICE_PARTS_ENGINE_STAGE0.md` wherever they disagree.
7. The project specification documents (21 Architecture, 22 Roadmap, 23 Credit,
   plus the department docs) for product detail.

## Completed

- **Public marketing shell** — shared header/footer/theme/auth across 33 public
  pages (`assets/public-shell.js`). Guarded by `test/public-shell.test.js`.
- **`dashboard.js` split** — contiguous, load-order-critical split into
  `js/modules/dashboard-part2..26.js`; concatenation equals the original
  byte-for-byte. **Do not feature-split or reorder.**
- **P0 security fixes** — removed the automatic `dealer_os` entitlement fallback
  and the registration email auto-confirm bypass.
- **CI release gate** — `npm test` runs in `.github/workflows/ci.yml`.
  *Still to do: mark "Run test suite" a required check in branch protection.*
- **People/HR engine** — `routes/hr.js` rebuilt on the real `staff_*` schema with
  feature + RBAC + MFA gates; migration `2026-08-07-people-engine.sql` applied to
  **staging Supabase only** (`hpxnjbdiaaoopxeayfen`). Production
  (`omyuqzveegzspeojrqkd`) untouched.
- **DealerOS UI Phase 1** (PR #67) — `js/modules/workspace-registry.js` is the ONE
  registry behind the desktop sidebar, workspace tabs and role-aware mobile nav;
  nine workspaces; additive `#/w/<workspace>/<page>` routing; restored two
  unreachable pages (`commissions`, `ai-inbox`). Reorganization only — no page or
  backend rewritten.
- **Sales reference department, Phase 2** (PR #68) — `js/modules/sales-workspace.js`
  registers `ENGINES['sales']`: role-aware Today/Work/Insights/Automation/Settings,
  an attention-first Today, and Work sub-views (Opportunities/Appointments/Customers/
  Deals/Deliveries). Composition only — zero backend change, actions delegate to the
  existing CRM/desking functions. **This is the pattern every other department
  follows** — see `docs/DEALER_OS_UX_ARCHITECTURE.md` §11–12.
- **Stage 3 — Inventory + F&I** — `js/modules/inventory-workspace.js` and
  `js/modules/fni-workspace.js` register `ENGINES['inventory-overview']` /
  `ENGINES['fni-overview']` on the same pattern. Handoffs verified as ONE record:
  Sales customer → appraisal → Inventory vehicle → recon → F&I deal. Zero backend
  change. Also hardened `check:frontend`, which could not see declarations after a
  nested template literal and had let a duplicate `let` silently disable a module.
- **Stage 3A** (PR #69) — the domain and the three canonical accounting producers:
  `funding_status`/`funded_at`/`funding_submitted_at`, `deal_lender_decisions` (one
  selected per deal, enforced by a partial unique index), and the sole emitters of
  `funding.received`, `trade.received` and `vehicle.acquired`. Idempotency proven
  before the producers were enabled; **no historical replay or journal backfill**.
- **Stage 3B.1** (PR #70) — made that backend reachable: the F&I Funding queue
  (`GET /fni/funding`), the lender decision panel, and non-trade Take Possession.
- **Stage 3B.2 — Acquisition, Merchandising, Vehicle Record** — Inventory Work now
  follows the vehicle lifecycle end to end (Vehicles · Acquisition · Recon ·
  Merchandising · Pricing · Syndication). Acquisition groups the intake pipeline by
  step and splits *awaiting possession* into purchased vs customer trade, because
  those two halves have **different canonical transitions** — the grouping is the
  guard rail against calling the wrong one. Merchandising scores frontline readiness
  off the canonical vehicle record (`invMerchChecks`: photos · price · description ·
  window sticker · AI copy). `js/modules/vehicle-record.js` adds `vehicleOpen(id)`:
  one vehicle, one surface, zero writes of its own — see
  `docs/DEALER_OS_UX_ARCHITECTURE.md` §13. A sold unit still in recon is now the
  highest-severity Inventory exception. Deliberate omissions (feed-failure and PDI
  exceptions, Automation tabs) and why: `docs/STAGE3_INVENTORY_FNI_AUDIT.md` §5.1.

## Execution strategy — audit-first is OVER for this phase

The architecture, invariants, canonical records and department boundaries are
established. **Stop creating separate audit / spec / reconciliation PRs** unless
implementation exposes a genuinely new architectural conflict. Read what is already
frozen — `docs/STAGE4_SERVICE_PARTS_AUDIT.md` (esp. §32), `docs/STAGE4_PR42_SPEC.md`,
merged PRs #73 and #74 — follow it, and build.

Work in **three large batches**, not a cycle of small PRs per primitive. The goal is no
longer to prove Service can be built. **The goal is to finish Service.**

### Batch 1 — Complete Service Operations (PR 4.2 + 4.3 together)

Build the whole connected workflow, not isolated primitives:

`inspection → estimate → customer authorization → technician assignment → parts
demand/reservation → work → additional work / re-authorization → completion → QC → ready`

- **Estimate & authorization** — immutable versions, presented estimates,
  approve/decline/defer evidence, e-sign, coverage against the *latest* estimate,
  revised estimates. Contract: `docs/STAGE4_PR42_SPEC.md`.
- **Technician workflow** — assignment, concern/cause/correction, jobs on `ro_lines`,
  recommended work, start/block/complete, actual time via `time_entries`, QC handoff.
- **Parts workflow** — demand from RO lines, availability, reservation, concurrency,
  shortage/backorder, receiving, issue to RO, returns/reversals, cost onto the RO.

**Step 1 is DONE and merged-ready.** `service_move_stock` (Postgres) now does one
locked row + one ledger entry + one balance update, or nothing. `parts.qty_reserved`
exists so availability is `on_hand - reserved` server-side; `qty_on_hand >= 0` is a
table constraint; `part_txns` dedupes on `(dealership_id, idempotency_key)`; RO close
consumes under `ro-close:<roId>:<lineId>` so a retried close draws nothing twice; a
deduped retry emits no second event. Proved live: last unit issues once · second issue
refused · retry with the same key moves nothing and leaves exactly one ledger row ·
a different key moves again · a cross-dealership move is refused.
**Steps 2–5 start from here — reservation and issue can now safely depend on stock.**

**BATCH 1 IS COMPLETE.** The end-to-end fixture ran green against staging on the first
attempt — 20/20, including every refusal path:

customer + customer vehicle · check-in at `checked_in` · inspection with a job line
carrying the concern · estimate v1 $400 presented and approved · parts demand moves no
stock · reserving touches `qty_reserved` not `qty_on_hand` · technician starts work ·
additional work found · estimate v2 $1,900 presented · **v1 authorization preserved** ·
**v1 does NOT cover v2** · v1 estimate still immutable · v2 reauthorized · issue draws
stock exactly once · duplicate issue idempotent · reservation released after issue ·
concern survives cause/correction · **completing work did not close the RO** · QC then
ready via canonical transitions · ready→active refused · close-direct-from-ready refused ·
cross-dealership reserve refused.

Probe rows cleaned up. `test/fixedops-batch1-e2e.test.js` pins the seams so a later
refactor cannot quietly break a link in that chain.

Test the complete workflow plus the refusal and concurrency paths.

### Batch 2 — Complete Service Financial Close (4.4)

`ready → delivered → invoice → tax → payment/deposit/AR → accounting events → closed`,
covering labour, parts, sublet, fees, discounts, configured taxes, invoice, deposits,
payments, balances, AR, parts-receipt accounting, reversals, idempotency, posting.
**Reuse MarketSync's existing financial/payment infrastructure** (deposits/Stripe
abstraction — no MCP connector dependency). Do not build a Service-specific accounting
system.

### Batch 3 — Service Operating Product (4.5)

A complete department UI built around jobs-to-be-done, for **advisor**, **technician**
and **manager**, finishing with full E2E of real dealership workflows.

Then repeat the same shape for Parts, Accounting, F&I — complete department workflows in
meaningful batches, not another audit→foundation→reconciliation→spec cycle per feature.

### Rules that still hold

DB-enforced invariants · dealership isolation · the canonical state machine (the database
owns it; no JS copy) · permissions · idempotency · concurrency · **immutable evidence**
(authorization is never deleted or mutated; coverage is derived) · shared DealerOS
primitives over duplication · standalone Service capability.

Run tests throughout; fix failures **inside the same batch**. Optimize for completed
dealership workflows, not number of PRs.

**Stop early only for:** a genuine architectural contradiction · destructive migration
risk · an external dependency needing a human decision · insufficient context to safely
finish the current atomic change.

## Core Payment + Allocation — BUILT (approved decision)

MarketSync had **no payment record at all**: deposits existed only as a Stripe checkout
flow, a `deposit.paid` event and a journal entry. Nothing you could query to answer
"what has this customer paid?".

`payments` + `payment_allocations` are now **DealerOS core primitives**, not Service
tables — the wrong fix was `service_payments`, then `deal_payments`, then `fni_payments`,
with Accounting reconciling three of them.

```
CUSTOMER → PAYMENT ─┬→ ALLOCATIONS → Service RO / vehicle deal / other receivable
                    └→ UNAPPLIED  (which is what a deposit actually is)
```

Deliberately **no `ro_id`/`deal_id` on the payment itself** — a payment can split across
obligations, be partially applied, or move from deposit to invoice, so where it lands is
a separate fact. Idempotency is enforced by two database unique indexes (provider
reference and caller key), not application checks. A received payment is frozen: amount,
currency and provider identity cannot be rewritten and the row cannot be deleted —
refunds are **recorded** via `refunded_amount` + status, never simulated by mutation.
Over-allocation is refused under the payment row lock.

Proved live, 9/9: payment recorded · duplicate webhook refused · partial allocation ·
unapplied remainder is the deposit · over-allocation refused · rewrite refused · delete
refused · partial refund leaves the original intact · cross-dealership allocation refused.

**Accounting integration DONE.** `routes/payments.js` is the core module;
`payment.received` is the one canonical financial event for customer money, and the
`payment_received` rule is:

```
DR cash                = amount      (all the money that arrived)
CR accounts_receivable = applied     (the part that settles an invoice)
CR customer_deposits   = unapplied   (the part still owed back to the customer)
```

**It provably touches no revenue and no tax** — the invoice already recognised those at
RO close, and cash arriving must never do it again. Verified balanced against all four
real shapes: paid in full · partial payment · pure deposit · deposit partly applied.
A retried payment emits no second event, and the posting itself dedupes on the payment id.

**Invoice read + close DONE.** `GET /service-engine/ros/:id/financials` answers
"what is the customer charged, what have they paid, what remains?" in one response —
totals from the RO (already canonical), money from the core Payment primitive, no second
invoice truth, and estimates deliberately excluded because they are what was *proposed*.

Closing now requires an explicit `financial_disposition` (`paid_in_full` · `partial_ar` ·
`ar` · `warranty` · `internal` · `goodwill`) and records `closed_balance`. A zero balance
is **not** required — carrying AR is a real decision — but an *implicit* balance is
refused by a database constraint, and you cannot claim paid-in-full with money
outstanding or carry AR that does not exist.

**Still to wire — the last piece of Batch 2:**
`routes/deposits.js` becomes a **producer into** `payments`. Keep the Stripe flow;
persist the canonical Payment before anything downstream depends on it, and emit
`payment.received` only on genuine creation.

⚠️ **Production only:** the legacy `deposit_received` rule exists there (Stage 3 A5
migration, which never ran on staging). `deposit.paid` and `payment.received` must not
both post for the same money — adapt deliberately before enabling this path there.

## ⚠️ PRODUCTION ACCOUNTING — needs a deliberate decision

Found while correcting Stage 4A findings F1/F2: **the `service_closed` posting rule does
not exist on staging at all.** The Stage 3 migration that seeded the A5 rules
(`2026-07-23-accounting-engine-a5-events.sql`) was applied to **production only**.

So the corrected rule has been *inserted* on staging, while **production still carries
the uncorrected one** — debiting AR with the pre-tax subtotal and leaving collected tax
inside `service_revenue`. Every repair order closed in production understates AR by the
tax and overstates revenue by the same amount.

Correcting production is a separate, deliberate decision (owner call), and per the
standing rule **no historical replay or journal backfill is proposed**. The reconciliation
queries the brief asks for — closed ROs whose AR/tax journal is inconsistent, parts
consumption with no receipt-side entry, Service AR with no payment — should be run
against production before any remediation is chosen.

## Known gaps / deferred (UI missing, backend often present)

Executive→Exceptions · F&I→Credit/Products/Contracts (`/credit/*`, `/fni-catalog`
exist) · Service→Technicians/Customers · Parts→Orders/Receiving/Requests ·
Accounting→Transactions/AP/AR/Bank · Marketing→Advertising/Reputation/Attribution
(`/adspend/*` partial) · People→Time/Payroll/Training (`/hr/*` exists).

**Pre-existing, found during Stage 3B.2 mobile validation:** at 390px the dashboard
document is 399px wide — a 9px horizontal overflow. It reproduces on a *bare*
dashboard with no workspace rendered, traced to a legacy `<table class="w-full
text-sm border-collapse">` on a hidden page, so it predates Stage 3 and is not
caused by any workspace. Every Stage 3B.2 surface measured clean (zero overflowing
elements). Fixing it means giving that legacy table an `overflow-x:auto` wrapper —
worth doing in whichever department owns that page, not as drive-by scope here.

Also open, outside code: branch protection required-check, MCP audit, Supabase
leaked-password protection, Stripe matrix, E2E, backup/restore drill, monitoring,
and a two-dealer cross-tenant vector test.

## Acceptance gates — run before every commit

```bash
cd marketplace-backend
npm test                       # full suite — must stay green (441 on this branch)
npm run check:syntax           # every backend source parses
npm run check:imports          # ESM import resolution
npm run check:exports          # named export bindings
npm run check:routes           # Express route registration
npm run check:frontend         # frontend parse + no duplicate top-level globals
npm run check:startup          # server boots in dry-run mode
```

For frontend changes also load `dashboard.html` in a headless browser with a
seeded token and confirm the workspace nav renders with **no `ReferenceError` /
`SyntaxError`** (backend-network errors are expected offline). Verify the
restricted tiers explicitly — Facebook Solo, Facebook Dealer (owner **and** rep),
AI Chatbot and the staff roles must be unchanged.

## Standing constraints

- Never weaken, skip or delete a test to get green CI.
- Never bypass RLS, RBAC, MFA, entitlements or tenant/store isolation.
- Never create a duplicate Customer/Vehicle/Deal/Employee/RO/Part/Task/Document/
  Payment/Work Order model, or a second navigation registry.
- Apply migrations to **staging** first; never to production without approval.
- Small commits, one concern each; stop before unrelated work.
