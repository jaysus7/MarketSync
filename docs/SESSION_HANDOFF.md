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
| **In flight** | **Batch 1 steps 1–5 done** — atomic stock, versioned estimates, authorization evidence, technician workflow, parts demand/reservation/issue (494/494). Batch 1 integration proof remains, then Batch 2 (financial close) and Batch 3 (operating UI). |
| **Roadmap position** | Phase 1–3 complete. Phase 4: audit (#72) and foundation (#73) merged. **The database owns the RO state machine — see audit §32 before touching Service.** PR 4.2 (authorization) → 4.3 (parts) → 4.4 (accounting) → 4.5 (UI) remain. |

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
