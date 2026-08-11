# Session handoff

Start every new coding session here (Doc 22 §13). Keep it short and **current** —
update it in the same commit as the work it describes. This is the living state
of the build; `docs/DEALEROS_UI_AUDIT.md` and the Stage 0 docs hold the detail.

---

## Where things stand

| | |
|---|---|
| **Last updated** | 2026-08-10 |
| **Next phase** | **Phase 8 — Dealer OS coherence, unified My Day, Management, Identity & Trust.** Phase 7 is merged and complete. Phase 8.0 is in progress; do not begin Management or Identity until its exit gate is green. |
| **Target branch** | `staging` (production deploys from `main` — see `render.yaml`) |
| **Baseline on `staging`** | `cc6313a` — Phase 8.0 coherence, normalized My Day, canonical operational-attention producers and Management composition are merged; CI is green. The suite is **1065/1065** with all six `check:*`; `staff_members.start_date`, the uninvited-email guard and the canonical Phase 8 Identity schema are applied to staging. |
| **Security** | **Phase 6S complete.** CodeQL's 68 pre-existing findings triaged: 12 fixed, 24 false positives with reasons, 32 accepted with reasons. See `docs/PHASE6S_SECURITY.md`. Worst was the anonymous visitor token generated with `Math.random()` — it is a bearer credential, so other visitors' chat transcripts were derivable. **Two hand-offs, both infrastructure not code: (1) CodeQL does not run on `staging` PRs at all — it fired once on #84 only because that PR was mis-based against `main`, so the entire development flow is unscanned; (2) DNS-rebinding SSRF needs egress controls.** |
| **Phase 7 truth check** | **DONE — read `docs/PHASE7_PEOPLE_LAUNCH.md` before writing any Phase 7 code.** The finding that reframes the phase: the People engine (24 tables, 14 routes, 17 permissions, 10 seeded templates) has **never held an employee** — `staff_members` has 0 rows against 7 logins, because **nothing creates one**. `routes/hr.js` has no create route; the only INSERT is a legacy `POST /team/staff` that writes a contact, not an employee. Every People feature correctly answers *"No staff profile linked to your account"*. Sixth instance of the A19 dead-wiring pattern. **PR 7.1 (identity + producer) is DONE**: inviting a user now creates their employment record, existing logins backfill on first read, transitions are audited to `staff_status_history`, and People is a My Day source. Termination deliberately REFUSES until offboarding (7.2) exists — a status flag that revokes nothing would read as if it had. **PR 7.2 (offboarding) is DONE.** Correction worth carrying: a terminated employee did NOT retain access — `requireAuth` enforces `profiles.active` per request. The real damage was that roles survived departure and **owned work was orphaned**. Offboarding now refuses (409) while live work would be left ownerless, reassigns live ownership only (never `created_by`), revokes roles, deactivates, and marks terminated LAST. `DELETE /admin/users/:id` routes through it. **PR 7.3 (Academy) is DONE.** The curriculum lives in the database, Your Learning is Required/Foundations/Advanced by role and department, and a credential is issued only when every required course is complete. **The defect it nearly shipped, seventh instance of A19:** `staff_training_assignments` carried a composite FK `(course_id, dealership_id) -> staff_training_courses(id, dealership_id)`, so a global course (`dealership_id null`) could never be assigned to anybody — a curriculum readable, searchable and permanently unassignable. Found by inserting a real assignment against staging; no test could see it, because CI has no database. The tenant guarantee is restated as a trigger rather than dropped. **PR 7.4 (the time clock) is DONE.** Eighth and ninth instances of A19, both on money: `time_entries` had one reference in the whole backend (a `.select()`) and zero rows, so **there was no clock** — and `roActualHours` therefore returned 0.0 for every repair order ever, reading as "this job took no time". `staff_payroll_items` was written nowhere, so every payroll batch was empty and **the payroll CSV export returned 200 with headers and no rows**. `time_entries.employee_id` had no foreign key at all — any uuid, including another dealership's employee, on the record that decides pay. All fixed; payroll now names everybody it could not compute instead of dropping them. **Named but NOT fixed (G9, compliance-evidence stop-gate): `staff_compliance_dashboard_v` counts overdue policies, onboarding tasks and safety actions from tables with no producer, so a dealership that has published no policy sees all zeros reading as "everybody compliant". `onboarding_not_started` from 7.1 has no remedy — nothing can start onboarding.** Also recorded: the unapplied `2026-08-06-hr-foundation.sql` would create a **third** employee identity and a second time system if anyone applied it — do not. **PR 7.5 (compliance) is DONE — G9 closed.** Policies can be created, published, assigned and acknowledged; onboarding can be started (the remedy `onboarding_not_started` never had); the core checklists are checked in and seeded on demand, because five dealerships were seeded once and every dealership created since had none. `/hr/compliance` now ships `coverage`, so an area with no records reads as "not measured" rather than "nothing wrong", and a failed count is `null` rather than `0`. **Second weaker-duplicate-guard catch of the phase:** the migration originally added a policy-immutability trigger; `protect_staff_policy_version()` already existed and is stricter (it also computes the checksum), so the duplicate was deleted and the route stopped sending a checksum. **PR 7.6 (Launch Hub backend) is DONE.** Correction to G7: the config columns (legal name, address, phone, HST, OMVIC) already existed — what was missing is **timezone** (absent entirely, so every date in the product is UTC), operating hours and locations. And nothing was ever filled in: **0 of 7 dealerships have an address**. The hub is typed (REQUIRED_TO_LAUNCH / REQUIRED_FOR_FEATURE / RECOMMENDED / OPTIONAL), **derived and never stored**, entitlement-scoped, role-aware, and reports `operational` separately from `fully_configured`. A failed check is `unknown`, never `false`. **It deliberately gates nothing** — a test asserts middleware/access/authorization do not import it. The **hub UI shipped in the same slice** rather than being deferred (an unreachable setup engine is the same dead-wiring shape this phase keeps finding): one screen in the system rail, two answers instead of one progress bar, contextual per-department prompts, not entitlement-gated, and pinned by tests as incapable of blocking anything. **PR 7.7 is DONE and PHASE 7 IS COMPLETE.** People finally has a workspace (it was the last department with real capabilities and no screen), `test/people-e2e.test.js` walks all twelve chains, and every one of the seven dead-wiring defects is pinned so it cannot return. **Seven defects, all invisible to a green suite: the employee record, offboarding, the Academy curriculum, global course assignment, the time clock, payroll lines, and every compliance producer.** Two weaker duplicate guards were caught before shipping. **Next: Phase 8 — see docs/DEALEROS_ROADMAP.md.** |
| **In flight** | **PHASE 8.2.** Shell fixes merged: stale `svcSetStatus` removed, one registered workspace header, structured Settings, Studio reachable, and every department leads with **My Day**. Employee creation is atomic; inviting a pre-existing employee links it instead of duplicating it. The Pro Demo now has five real staging employment rows: its linked dealer admin plus Marcus, Sarah, David and Elena as truthful **Not invited** employees. People Team reads canonical employment/account/training/manager/start-date state; Users & Access returns its linked employee; old People URLs are hidden redirects. The global header is identity/notifications/menu and the top Setup indicator derives from `/launch`. Management now has one canonical header (`My Day | Pulse | Exceptions | Approvals | Forecast | Financials`); the old Executive pages remain deep-link-only and the endpoint requires MFA plus `accounting.view`. **Open prerequisite truth:** Phase 6's provider-evidenced publishing pipeline exists, but the approved Canva-style Studio and dealer-facing Social calendar/queue/composer are still gaps; do not call final Dealer OS complete until closed. |
| **Phase 8.1** | **COMPLETE TO CURRENT SOURCES.** Login lands on the correct department My Day for the six assignable dealer roles. The shared `/my-day` result carries the Phase 8 reference-only contract (`source_type`, `source_id`, department, title, priority, owner, due, next action, deep link, attention type). Service, Parts, Inventory and F&I have server-side canonical attention producers; `MY_DAY_GAPS` is empty and source failure remains visible rather than reading as a quiet day. Management now consumes this same endpoint rather than maintaining a second task/exception queue. |
| **Phase 8.3** | **PROVIDER-FIRST FOUNDATION IN PROGRESS.** The prior route stored mutable verification truth on `contacts` and treated generic Persona approval as `selfie_matched: true` without report evidence. The canonical, purpose-scoped `identity_verifications` domain and dedicated permissions are now applied to staging. Stripe normalization preserves its provider-backed configured checks without inventing a score; Persona approval is Manual Review until report evidence exists. Legacy contact flags are not promoted. Manual Review/failure now feeds the shared My Day and Management approval layer from the canonical record. MarketSync Native is explicitly unavailable until a vetted liveness/face-match stack and retention policy exist. |
| **Phase 8.4** | **IN PROGRESS.** Customer Card now composes the existing credit application and selected lender decision into affordability, then ranks only canonical `inventory.status='available'` units. Sold, archived, awaiting-possession and over-budget vehicles are excluded. Payment is shown only when legitimate rate/term inputs exist; no neighbourhood-income or second credit score is used. |
| **Roadmap position** | **`docs/DEALEROS_ROADMAP.md` is the phase authority** — read it, do not infer a sequence from any other document. **Phases 0–7 are complete** on staging (Accounting production convergence deliberately deferred to 9A). **Phase 8 is active.** MarketSync's own internal workspaces, affiliate login/dashboard and any partner portal are **Phase 9B** and must not be built earlier. **Four database-owned control layers exist: the RO state machine (audit §32), the journal posting triggers, the accounting period lock, and the social publish claim (`social_claim_due_targets`, `for update skip locked`).** |
| **Staging storage buckets** | Staging had only `staff-documents`. `vehicle-photos` / `vehicle-pdfs` are referenced throughout the code but did not exist there and nothing creates buckets at runtime, so **every vehicle-photo upload was failing on staging**. All three plus `sales-videos` created 2026-08-10. |
| **PR base branch** | **`staging`, not `main`.** `main` shares no merge base with the working branch — a PR opened against it shows ~4,700 files and drags whole-repo CodeQL findings onto the diff. PR #84 was opened against `main` by mistake and retargeted. |

## Read before coding

1. `docs/DEALEROS_ROADMAP.md` — **the phase authority.** What is done, what is next.
2. `AGENTS.md` — **Part A** is the governing product/architecture law, **Part B**
   the frontend guardrails. Both are binding.
3. `docs/KERNEL_CONTRACT.md` — **frozen**.
4. `docs/DEALER_OS_UX_ARCHITECTURE.md` — **the as-built UI architecture**: engine
   registration, standard tabs, role/entitlement behaviour, department ownership,
   handoffs, the shared helpers that really exist, and the rules a new department
   must follow. Note the naming warning: DepartmentShell / AttentionQueue /
   RecordWorkspace / QuickActions / DepartmentKPI / WorkflowBoard / "My Day" are
   **conceptual names only** — no such runtime components exist.
5. `docs/DEALEROS_UI_AUDIT.md` — every page → workspace/tab mapping, the four
   gating layers, and what is deliberately deferred.
6. `docs/SALES_PHASE2_AUDIT.md` — the Sales reference department (see §0).
7. `docs/STAGE4_SERVICE_PARTS_AUDIT.md` — **the Fixed Ops domain truth.** Start at §0
   (executive summary) and §31 (stop gate). Schema- and code-level evidence for Service
   and Parts; supersedes `docs/SERVICE_PARTS_ENGINE_STAGE0.md` wherever they disagree.
8. The project specification documents (21 Architecture, 22 Roadmap, 23 Credit,
   plus the department docs) for product detail.

## Completed

- **Phase 6 — Marketing + Communications (COMPLETE)** — attribution now
  follows a **campaign id**, not a display name; budget and actual spend are separate columns;
  gross is read from **posted** journals, so a campaign whose deliveries never reached the
  books reports its units with the gross marked incomplete rather than an assumed average.
  Publishing is authorized **server-side** per account (`canActOnAccount`), with the
  user-owned branch resolving first so `marketing.publish` can never reach a salesperson's
  personal account. One consent gate (`mayContact`) answers with a *basis*, not a boolean.
  Conversations follow the **customer**, not the channel — `identifyConversation` merges into
  an open thread and a partial unique index makes one-open-per-contact real. My Day is
  **composed** from each slice's own attention builder; the workspace derives no severity of
  its own. Publishing is real: a claim owned by the database, and `published` only when a provider
  returned an id for something it created — no adapter, no credentials, a throw or a success
  with no id are all failures with a reason a person can read. **No provider adapter ships
  yet; each network is its own integration.** Guarded by `test/social-authorization.test.js`,
  `test/consent-gate.test.js`, `test/conversation-continuity.test.js`,
  `test/marketing-workspace.test.js`, `test/social-publishing.test.js`.
  See `docs/PHASE6_MARKETING.md`.
- **Phase 5 — Accounting (COMPLETE)** — 5.1 ledger integrity, 5.2 deal settlement + AR/AP,
  5.3 Journal/Close/Banking/Payroll. Financed deals now debit Contracts in Transit for the
  lender's share instead of dumping the whole sale into customer AR, so funding clears CIT to
  zero; AP reaches the double-entry ledger; AR/AP/CIT are derived from posted truth only.
  Guarded by `test/ledger-integrity.test.js`, `test/deal-settlement.test.js`,
  `test/accounting-ar-ap.test.js`. **Still deferred: bank reconciliation (no data model
  exists), Cash Flow, manual journal entry UI, Parts receipt→bill matching.**
  **Production convergence for all five accounting migrations remains UNAPPLIED.**
  See `docs/PHASE5_ACCOUNTING.md`.
  The one finding worth carrying: **`postJournal` had left `posted` to a column default**,
  so the database's balance and line-count triggers — which fire only on the draft→posted
  transition — had never run once. Posting now flips `posted` LAST, deliberately, so the
  database control is what decides. Live proof in `scripts/phase5-ledger-proof.mjs`.
- **Phase 4 — Fixed Ops (Service + Parts)** — complete on the branch across three
  batches: Service operations (state machine respected, estimates, immutable
  authorization, technician workflow, parts demand), financial close (Payment +
  Allocation core primitive, corrected `service_closed` posting, explicit disposition),
  and the operating product (advisor workspace, Parts department, technician `My Work`,
  390px mobile, Service-only E2E). Guarded by `test/fixedops-foundation.test.js`,
  `test/fixedops-batch1-e2e.test.js`, `test/core-payments.test.js`,
  `test/service-workspace.test.js`, `test/parts-workspace.test.js`,
  `test/service-standalone-e2e.test.js`.
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

### Batch 3 — Service Operating Product (4.5) — **COMPLETE**

A complete department UI built around jobs-to-be-done, for **advisor**, **technician**
and **manager**, finishing with full E2E of real dealership workflows.

**What landed, and the three findings worth carrying forward:**

1. **The technician surface is keyed off a permission, not a role.** There is no
   `TECHNICIAN` role — the assignable vocabulary is
   `MANAGER/SALES_REP/FNI/SERVICE/ACCOUNTING/CLEANUP`, and a single `SERVICE` role
   covers advisor and technician alike. `My Work` therefore keys off the server's own
   dividing line in `assertLineActor()`: holding `service.manage_workflow` is the desk.
   `window.canDo` fails OPEN, so a missing access context lands on the advisor surface —
   the safe direction. **Do not "fix" this by inventing a technician role.**

2. **Mobile at 390px found a real defect, not a cosmetic one.** A coloured state signal
   appended to a `truncate` line is ellipsed out of existence on a phone. Three rows had
   it: an advisor could not see "waiting for parts", a parts clerk could not see
   "0 available". Status and flags now lead their own line. Regression tests pin the
   invariant as **order** (signal leads, detail gets cut), not "never truncate".
   Validation was a real headless render at 390px, not class-name grepping.

3. **Parts is bundled with Service today.** There is no `os.parts` entitlement anywhere
   in the codebase; `parts-overview` is gated on `os.service`. That is coherent for a
   shop but is **not** the same as Parts being separately purchasable, which the stated
   product direction calls for. `test/service-standalone-e2e.test.js` pins this
   deliberately so it stays visible. Parts is nonetheless built as its own engine over
   Service's one stock ledger, so splitting it later is an entitlement change rather
   than a rewrite. **This is an owner decision, not a bug to quietly fix.**

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

**Deposits producer DONE — BATCH 2 IS COMPLETE.** `stampDepositPaid` now persists a
canonical Payment *before* anything downstream relies on it, keyed on Stripe's
`payment_intent`, so a webhook retry returns the existing Payment and emits nothing. No
allocation is made: the unapplied balance **is** the deposit, which is why no deposits
table exists. The Stripe Checkout experience is untouched.

**Production double-post is guarded.** The `deposit.paid` event now carries
`posted_via: 'payment'`, and the accounting engine's legacy `deposit.paid` case returns
early when it sees it. The legacy `deposit_received` rule is **preserved, not deleted** —
production has producers that predate the payment primitive — but it will not post money
that already posted canonically. Exactly one accounting effect per real payment.

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
