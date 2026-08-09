# MarketSync — agent guardrails (READ BEFORE EDITING ANYTHING)

**Part A** is the governing product/architecture law for the whole repo.
**Part B** is the specific frontend guardrails that exist because well-meaning
automated edits repeatedly broke the dashboard and the marketing site. **Keep
everything working exactly as it is now.** Do not "improve", "restore",
"modernize", or "re-modularize" anything below unless a human explicitly asks
for that specific change.

---

# PART A — Product & architecture law

*(The "MarketSync Build" project instructions, committed here so every session
inherits them. The uploaded specification documents remain the authority on
product detail; this is the standing summary.)*

## A1. Sources of truth

- **The repository** is the source of truth for **what currently exists**.
- **The project specification documents** are the source of truth for **what
  MarketSync should become**. Governing docs: **21 — Master Dealer OS
  Architecture**, **22 — Master Build Roadmap / Audit Method**, **23 — Credit
  Application & Finance Intake**. Department docs cover their own areas.
- In-repo companions: `docs/KERNEL_CONTRACT.md` (frozen), `docs/*_STAGE0.md`,
  `docs/DEALEROS_UI_AUDIT.md`, `docs/SESSION_HANDOFF.md`.
- **Do not assume a feature is missing because it is hard to find in the UI.
  Audit first.**

## A2. Core product principle

MarketSync should feel like **operating a dealership, not operating software**.
A user must understand within ~3 seconds: *What needs my attention? What is
happening? What should I do next?* Employees navigate their **job and workflow**,
never MarketSync's internal architecture.

## A3. Architectural law

> ONE DEALER → ONE RECORD MODEL → ONE EVENT SYSTEM → ONE WORKFLOW ENGINE →
> MANY ROLE EXPERIENCES → ONE INTELLIGENCE LAYER

Canonical records — Customer, Vehicle, Deal, Employee, Dealership, Repair Order,
Part, Task, Appointment, Document, Payment, Work Order, Credit Application,
Campaign, Vendor, Store, Department. Each has **one owning domain** but is reused
cross-engine through validated services. Departments may have specialized
**views**; they must never recreate the record. **Never create duplicate business
truth or per-department KPI stores.**

## A4. The kernel is frozen

Preserve and reuse: authentication/session architecture, RBAC, MFA gates,
tenant/dealership/store isolation, Event Bus, Workflow Engine, Action Executor,
retry/idempotency, Timeline, Accounting Engine, Configuration Engine, Tool
Registry, Audit, integrations architecture, entitlements, existing canonical
records and sound API contracts.

`docs/KERNEL_CONTRACT.md` is **frozen unless Jason explicitly approves** an
architectural change. Never bypass an engine's ownership boundary by writing
another engine's tables — query through published read APIs, change state through
events/owning engines.

## A5. Test baseline is a regression gate

The suite must stay green. **Do not** delete tests because new code fails them,
weaken assertions to get green CI, skip tests without justification, change tests
to hide a regression, or bypass RLS/RBAC/MFA/entitlements/security gates.

When behavior intentionally changes, update or add tests **only when the approved
specification requires the changed behavior** — and say so in the commit.

## A6. Audit before code

Classify every relevant component: **KEEP · FIX · MOVE · MERGE · DELETE · BUILD**.
Preference order **KEEP > FIX > MOVE > MERGE > BUILD > DELETE**. Do not assume
BUILD first. **Never delete a legacy path until the replacement has parity, tests
and a rollback point.**

## A7. No big-bang rewrites

No repository-wide refactors, no framework migrations for preference, no
replacing working backend engines to make frontend work easier, no turning a
focused request into a cleanup. Implement the **smallest safe change**; split
large work into testable phases.

## A8. Frontend strategy — workspaces, not architecture

Primary navigation is the nine workspaces: **Executive · Sales · Inventory · F&I ·
Service · Parts · Accounting · Marketing · People**, with system access for
**Ask MarketSync · Notifications · Settings · Profile**. Not every page belongs in
the global sidebar — each workspace has local navigation. See §B1 and
`docs/DEALEROS_UI_AUDIT.md` for the live registry and the full page mapping.

Standing UI placement rules: CRM is **not** a department (customer functionality
lives under Sales → Customers and is reused OS-wide) · Acquisition, Appraisals and
Equity Mining → **Inventory → Acquire** · Cleanup/Recon → **Inventory → Recon** ·
Inventory Intelligence → **Inventory → Pricing/Overview** · F&I is a first-class
workspace · Credit Application → **F&I → Credit** with contextual initiation ·
Marketplace → **Inventory → Syndication** · Automation is **not** an employee
department (contextual in workspaces; advanced under **Settings → Automation**) ·
AI is one intelligence layer, never a per-department silo · one global Settings.

## A9. Role-aware experience & entitlements

Users see what their job needs. Respect role, permission, department, store,
entitlement, product and per-user configuration. **Do not duplicate desktop and
mobile authorization logic** — use one central access/workspace registry.

Products smaller than full DealerOS must keep working: **Facebook Solo**,
**Facebook Dealer** and **AI-only** intentionally expose a reduced surface.
Navigation = workspace + role + permission + entitlement + department + store + user.

## A10. Mobile

Mobile navigation is **role-aware**, not a shrunken sidebar (salesperson:
Home/Pipeline/Customers/Tasks/More · technician: Home/Repair Orders/Schedule/
Tasks/More · manager: Home/Sales/Inventory/Tasks/More).

## A11. Workflow-first design

Think in lifecycle objects, not pages: **Customer** (Lead→Contacted→Appointment→
Showroom→Deal→Sold→Owner) · **Vehicle** (Acquired→Received→Recon→Frontline→
Listed→Sold→Delivered) · **Deal** (Working→Approval→Credit→F&I→Contracted→
Delivery Ready→Delivered→Posted) · **Repair Order** (Appointment→Checked In→
Diagnosed→Authorization→Parts/Repair→QC→Ready→Payment→Closed) · **Employee**
(Candidate→Hired→Onboarding→Active→Leave→Offboarding) · **Campaign**
(Draft→Review→Scheduled→Active→Completed→Analysis).

## A12. Cross-department handoffs

Protect: Sales→F&I · Sales/Trade→Inventory · F&I→Delivery · Delivery→Accounting ·
Delivery→Commission · Delivery→Service ownership · Inventory→Recon → Photos/
Publishing · Service↔Parts · Service close→Accounting · Marketing→Lead→Sales ·
Campaign→Deal→Gross/ROI · Employee→Training · Employee→Time/Payroll · Internal
Work Order→Approval→Department→Accounting.

**No department re-enters information already captured elsewhere** unless legally
or operationally required.

## A13. Domain rules that constrain implementation

- **Credit Application** — one canonical model. Sales may initiate without seeing
  every sensitive finance field; F&I owns the sensitive workflow. **Never present
  a submission as an approval. AI cannot make credit decisions.**
- **Service/Parts** — Service owns Repair Orders; Parts owns inventory and the
  movement ledger. They cooperate; they are not one engine.
- **Accounting is final financial truth.** Operational engines emit business
  events and may show estimates; Accounting translates approved events into
  ledger consequences. No autonomous AI financial posting.
- **Communications** — one customer timeline; no per-department histories.
- **Intelligence** — no direct database authority. It retrieves through
  policy-controlled services and acts only through validated tools.
- **Automation** — powerful, but users may extend protected workflows, never
  silently remove mandatory compliance/accounting/security steps.

## A14. Security & compliance are architectural

Never bypass tenant isolation, RLS, RBAC, MFA, consent, DNC/CASL, audit,
retention, legal holds, sensitive-field protection or approval authority.
Operational accountability is allowed; **covert employee surveillance is not**.
Do not make legal claims the governing documents or verified jurisdictional
requirements do not support.

## A15. Integrations

**Never fake an integration.** If vendor/API access is unavailable: create the
adapter boundary, support manual fallback, expose integration status, document
the missing dependency — and stop short of pretending connectivity exists.
Provider-specific logic belongs behind adapters.

## A16. UI design rules

Professional and simple: strong hierarchy, spacing, typography, responsive
behavior, light/dark, accessibility, obvious primary actions. Restrained
department differentiation. **No dashboards of decorative KPI cards — every
metric must help someone decide or act.** Prefer progressive disclosure.

## A17. Stage merge policy (branch discipline)

A completed stage must not sit as a draft while the next brief assumes it exists.
That has repeatedly cost a whole session to rediscover.

**Merge a stage/substage PR into `staging` at the end of that stage when ALL hold:**
1. CI is green and the full suite passes,
2. the change is scoped to that stage,
3. you have reviewed it against the brief yourself,
4. there is no unresolved blocker or open question for the user.

**After every merge, in the same turn:** sync `staging`, record the new HEAD, and run
the authoritative baseline (`npm test` + all six `check:*`). Report both.

**Never auto-merge into `main`.** Production deploys from `main` (see `render.yaml`)
and promotion stays a deliberate, separately-approved decision.

If any of the four conditions fails, leave the PR open and say plainly what is
blocking — do not merge to keep momentum, and do not leave it silent.

## A18. Development process

For every meaningful task: read the relevant spec → inspect the real code →
identify the owning engine → classify KEEP/FIX/MOVE/MERGE/DELETE/BUILD → state
the smallest plan → modify only necessary files → add/update targeted tests →
run the regression gates → confirm existing behavior intact → report exactly what
changed → **stop before unrelated work**. Small commits, one concern each.

---

# PART B — Frontend guardrails

## 1. Dashboard navigation — data-driven, ONE source of truth

- The live sidebar nav is the **workspace nav** (`#dept-nav`), built at runtime by
  `renderDeptNav()` from the **`MS_WORKSPACES`** registry in
  **`marketplace-frontend/js/modules/workspace-registry.js`** (plus `SAAS_DEPARTMENTS`
  in `dashboard-part2.js` for MarketSync HQ owner mode).
- That one registry drives **all three** navigations — desktop sidebar, the local
  workspace tab-bar, and the role-aware mobile bottom row. Never create a second
  navigation registry; add to this one.
- **To add / rename / reorder / gate a nav item or workspace, edit `MS_WORKSPACES`
  there — nowhere else.** `DEPARTMENTS` in `dashboard-part2.js` is only an alias of it,
  kept so the existing renderers work untouched.
- The registry decides **grouping and labels only**. Gating stays where it is: role
  (`mgr`/`roles`), plan entitlement (`PAGE_FEATURE` / `PAGE_PRODUCT`), dealer feature
  flags (`PAGE_DEALER_FLAG`) and the product/staff tier short-circuits. Every `page`
  value must be an existing `[data-page-content]` container.
- Nine workspaces, per `docs/DEALEROS_UI_AUDIT.md`: Executive · Sales · Inventory ·
  F&I · Service · Parts · Accounting · Marketing · People (+ Settings as a `system`
  workspace). System engines — CRM/Customer, Automation, AI, Integrations, Analytics,
  Communications, Configuration, Marketplace — are **not** primary departments; they
  power the workspaces underneath.
- The static `#nav-desktop` tree in `marketplace-frontend/dashboard.html` is
  **LEGACY and hidden at runtime** (`.nav-init` / `.dept-mode`). It is kept ONLY so
  existing role/tier feature-gating selectors keep resolving. **Do NOT add nav items
  to it, surface it, un-hide it, or wire it up.** It is not the navigation.

## 2. `dashboard.js` is split — do NOT reorder or feature-split

- `marketplace-frontend/dashboard.js` + `marketplace-frontend/js/modules/dashboard-part*.js`
  are a **contiguous, load-order-critical split** of one original script. Concatenated
  in the order they are listed in `dashboard.html`, they equal the original file
  byte-for-byte, so global scope/behavior is preserved.
- **Do NOT reorder the `<script>` tags** in `dashboard.html`, and do not move code
  between parts casually.
- **Do NOT attempt a feature-based re-modularization** (extracting functions into
  standalone ES modules / rewiring dependencies). That has broken the dashboard with
  runtime `ReferenceError`s multiple times. If a real refactor is needed, do it
  incrementally and verify the dashboard still loads (see §4) after every step.

## 3. Public marketing pages — shared shell, no inline headers

- Public pages (`index.html`, `features.html`, `compare.html`, `faq.html`, `blog.html`,
  `guide.html`, `support.html`, `security.html`, `privacy-policy.html`, `terms.html`,
  `affiliates.html`, and the product/feature landing pages, plus `dealer-os.html` /
  `ai-chatbot.html` / `facebook-autoposter.html`) render their header/footer from the
  **shared shell**: mount points `#ms-public-header` / `#ms-public-footer` +
  `/assets/public-shell.js` + `/assets/auth.js`.
- **Do NOT inline a page header/footer, and do NOT re-introduce the old "The Loop"
  anchor menu.** To change site nav/footer, edit `marketplace-frontend/assets/public-shell.js`.
- Auth-aware nav goes through `/assets/auth.js` (`MSAuth.isAuthenticated()`), never a
  bare `localStorage` token check.
- App/auth pages are intentionally NOT on the shell: `dashboard.html`, `chat-widget.html`,
  `site.html`, `post.html`, `esign.html`, `group.html`, `training.html`, `affiliate.html`
  (affiliate dashboard), `marketsync-guide.html`, `upgrade.html`, `login/register/forgot/reset`.

## 4. Verify before you commit frontend changes

- Backend suite: `cd marketplace-backend && npm test` (includes `test/public-shell.test.js`).
- Dashboard "does it still load?" check: serve `marketplace-frontend/` and load
  `dashboard.html` in a headless browser with a seeded token; it must render the
  department nav with **no `ReferenceError` / `SyntaxError`** (only backend-network
  errors are expected offline).

## 5. Deploy reality

- Production (`marketsync.link`) deploys from **`main`** (see `render.yaml`); the
  staging site deploys from `staging`. Work merged to `staging` is NOT live on
  `marketsync.link` until `staging` is promoted to `main`.
