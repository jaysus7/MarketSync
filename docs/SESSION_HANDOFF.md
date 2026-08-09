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
| **Baseline on `staging`** | `c8dee2a` — 460/460 tests green, all six `check:*` green |
| **In flight** | **Phase 4 PR 4.2a** — repair-order state reconciliation |
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

## Next recommended slice

### Stage 4B is at a STOP GATE — read the audit before writing any code

`docs/STAGE4_SERVICE_PARTS_AUDIT.md` §31. Stage 4A found **nine G3–G6 gaps** in the
protected areas (authorization, parts quantity, reservation, receiving, accounting,
payment, RO close, customer/vehicle identity). The brief's own rule stops dependent UI
until they are decided. **Do not re-run the audit; do not guess the decisions.**

The five that matter most, in one line each:

1. Service revenue posts **pre-tax** to AR and **tax is never credited**.
2. `parts_inventory` is **credited on every RO close and debited by nothing** —
   receiving posts no journal at all.
3. There is **no payment** — AR is never cleared.
4. There is **no customer authorization** anywhere in the system.
5. There is **no parts demand object** — stock moves only at RO close.

Also found: Service has **no customer-owned vehicle model** (only dealer `inventory`),
`GET /service/appointments` selects a column that does not exist so the list is always
empty, and `service.view` / `service.reopen_repair_order` are granted to roles but used
by zero code — so a GM cannot read an RO while a technician can close one.

**Safe to start without any decision (G0–G2):** register Service and Parts as `ENGINES`
workspaces on the Stage 3 pattern, the shop-status aggregate read, surfacing the
existing timeline and low-stock exceptions, and the Tier 0 permission/bug fixes in §30.

⚠️ **The Stage 4B brief is also incomplete** — it arrived truncated mid-sentence in the
SERVICE → DRIVE section ("Do not retype data MarketS"). Repair Orders, Dispatch,
Inspections, Ready, the Parts UI, the E2E paths and the exit criteria are all missing.
Ask for the rest before building 4B.

### After Fixed Ops
Accounting, Marketing and People on the same engine-shell pattern; then a
dealership-wide My Day that aggregates the department Today views once they all exist.

Standing decisions: do **not** add `Showed`/`Negotiating` to the CRM enum (UI may derive
that context, never persist it); Phase 2 deferred items (opportunity-row appraisal
shortcut, per-blocker delivery deep links, response/show/close metrics) do not block
Stage 3 and should not reopen Phase 2.

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
