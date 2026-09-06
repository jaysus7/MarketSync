# MarketSync HQ — the company operating system

**Audit date:** 2026-09-06 · **Branch:** `staging` · **Supersedes:** nothing.
`docs/HQ_AUDIT.md` (2026-08-26) remains accurate for the owner-admin batches it
describes; this document is the wider architecture and the gap ledger against the
full HQ specification.

HQ is MarketSync's own operating system — the SaaS company running itself. It is
**not** DealerOS with different labels. Dealer data and MarketSync corporate data
are separate stores, separate permissions, separate terminology.

---

## 0. The two findings that reframe this work

### Finding 1 — HQ had no database (FIXED 2026-09-06)

Every table owned by the six HQ migrations was missing from **both** the staging
and production Supabase projects. Not "some columns drifted" — the tables did
not exist:

```
before:  43 of 43 HQ tables missing (CRM, finance ledger, website control
         plane, command centre, announcements, income)
after:   43 of 43 present, 31 chart-of-accounts rows and 5 expense categories
         seeded, on staging
```

The AI-workforce `hq_*` tables *did* exist — they were migrated separately —
which is precisely why the agent hub was the one HQ feature that worked while
Money, CRM, announcements, onboarding and the corporate website returned errors.

**Root cause.** `hq_expense_categories` was declared twice with incompatible
shapes, both as `CREATE TABLE IF NOT EXISTS`:

| | `20260828000003_hq_finance_ledger.sql` (runs 1st) | `20260831180000_hq_command_center_tables.sql` (runs 2nd) |
|---|---|---|
| columns | `name`, `account_code NOT NULL`, `budget_limit_monthly` | `key`, `label`, `monthly_budget` |

The second `CREATE` silently no-opped against the first table. Its very next
statement creates `hq_vendor_expenses` with
`category_key REFERENCES hq_expense_categories(key)` — against a table with no
`key` column at all. Postgres raised *"there is no unique constraint matching
given keys"*, which aborted the entire command-centre migration, and every
migration after it. One column-name disagreement took out the whole HQ schema.

Worse, the ledger **lied about it**: `hq_website_control_plane` is recorded in
staging's `supabase_migrations` at version `20260830192541` while having created
zero of its 16 tables. A recorded migration is not evidence that it ran.

**Fix (this pass).** The two declarations are merged into one superset — `key` /
`label` / `monthly_budget` (what the live routes and the foreign key need) plus
`account_code` (nullable, for GL roll-up), `description`, `is_cogs`. The dropped
columns had zero consumers in the backend. The command-centre file now carries
additive `add column if not exists` guards and a backfill so the two files
converge whichever order they run in, and a `create unique index if not exists`
so the foreign key can always bind.

### Finding 2 — HQ does not mainly need new backends. It needs the backends it already has to be reachable.

Four HQ route modules and five HQ services are fully built, migrated, and mounted
on the server — and the frontend calls **none of them**:

| Backend | Lines | Tables | Frontend references |
|---|---|---|---|
| `routes/hq-crm.js` | 505 | `hq_leads`, `hq_contacts`, `hq_companies`, `hq_opportunities`, `hq_trials`, `hq_consent_records`, `hq_attribution` | **0** |
| `routes/hq-finance.js` | 516 | `hq_budgets`, `hq_budget_lines`, `hq_journal_entries`, `hq_journal_lines`, `hq_chart_of_accounts`, `hq_commission_plans`, `hq_staff_commissions`, `hq_payouts`, `hq_financial_forecasts` | **0** |
| `routes/hq-website.js` | 236 | `hq_website_pages`, posts, change-sets, deployments, discovery findings | **0** |
| `routes/hq-pulse.js` | 38 | — (composes the above) | **0** |
| `services/hqCrmService.js`, `hqFinanceService.js`, `hqWebsiteService.js`, `hqCommissionService.js`, `hqAnalyticsPulseService.js` | 1,400 | — | **0** |

That is ~2,700 lines of working corporate-context backend that no screen can
reach. This is the ninth-plus instance of the dead-wiring pattern
(`docs/SESSION_HANDOFF.md` calls it A19): a capability that exists, tests green,
and is invisible to the person who needs it.

By contrast the **AI agent hub is wired** (`/api/hq/agents`, `/api/hq/tasks`,
`/api/hq/approvals` — 9 frontend references) and works.

**Consequence for sequencing:** wiring beats building. Every slice below that is
marked WIRE is cheaper and higher-value than any slice marked BUILD, and several
requested features (Opportunities, Pipeline, Commissions, Forecasting, corporate
Website pages/SEO/deployments) are WIRE, not BUILD.

### Finding 3 — HQ Website Studio is currently the dealer builder

`loadSaasWebsite()` (`dashboard-part10.js:2322`) calls
`engMountPage(host, 'website', () => loadWebsitePage())` — it mounts the **dealer**
Website Studio inside HQ. That is precisely the "do not simply expose DealerOS
pages inside HQ" failure, and it means MarketSync corporate site edits and dealer
site edits currently share one surface and one data path. Meanwhile
`routes/hq-website.js` — a purpose-built corporate control plane with pages,
posts, SEO discovery, change-sets and deployments — sits unused.

---

## 1. Architecture map

```
                    ┌──────────────── one login, three front doors ────────────────┐
                    │  workspace = saas_admin  │  affiliate  │  dealer             │
                    └──────────┬───────────────────────────────────────────────────┘
                               │  resolved server-side in /auth/me (routes/profile.js)
                               │  from SYSTEM_ROLES.PLATFORM_OWNER / PLATFORM_ADMIN
                               ▼
   data-dash-owner="1" + data-dash-mode="marketsync"   ← the only HQ switch in the DOM
                               │
        ┌──────────────────────┴──────────────────────┐
        │  SAAS_DEPARTMENTS (dashboard-part2.js)      │  the ONE authoritative HQ nav
        │  renderDeptNav → #dept-nav                  │  (legacy #nav-desktop stays hidden)
        └──────────────────────┬──────────────────────┘
                               ▼
                     HQ page containers (#<page>-root)
                               │
        ┌──────────────────────┼───────────────────────────────┐
        ▼                      ▼                               ▼
  HQ-only backends       shared engines                  dealer-only backends
  (corporate context)    (reused, re-contexted)          (NOT reachable from HQ)
  ─────────────────      ────────────────────            ────────────────────
  /saas/*                Design Studio (studio-shell)    /inventory, /service
  /owner/*               Video Studio                    /parts, /desking
  /hq/crm/*      NO UI   Email/SMS transport (Twilio)    dealer /website/*
  /hq/finance/*  NO UI   Social OAuth + publish claim    dealer /marketing/*
  /hq/website/*  NO UI   Fabric canvas adapter
  /hq/pulse/*    NO UI   apiGetJson / apiPostJson
  /api/hq/*      WIRED
  (all four now have their tables as of 2026-09-06; what they lack is a screen)
```

### Separation guarantee

| | Dealer | HQ corporate |
|---|---|---|
| Tenant key | `dealership_id` on every row, RLS-enforced | no `dealership_id` — HQ tables are singleton-company |
| Auth | dealer roles + entitlements | `SYSTEM_ROLES.PLATFORM_OWNER` + `saas_role` |
| CRM | `contacts`, `leads` | `hq_contacts`, `hq_leads`, `hq_companies` |
| Money | `journal_entries` (per dealership) | `hq_journal_entries`, `hq_budgets` |
| Website | `site_pages` (per dealership) | `hq_website_pages` |
| Brand | dealership logo/colors | MarketSync Brand Kit (Market Blue) |

Nothing in HQ reads a dealer-scoped table without going through the customer-360
path, which is explicitly a *view of a customer*, not HQ's own data.

---

## 2. Permission model — as built vs. required

`routes/profile.js:34-48`. Permissions are config-as-code derived from
`profiles.saas_role`; the platform owner is always `owner` with `['*']`.

| Requested role | Exists | Notes |
|---|---|---|
| Owner | ✅ `owner` | `['*']` |
| Executive | ❌ | no read-everything-write-nothing role |
| Finance | ❌ | **nobody but the owner can touch money today** |
| Marketing | ✅ `marketing` | has `marketing`, `communications`, `affiliates`, `website` |
| Sales | ✅ `sales` | |
| Customer Success | ❌ | `support` is the nearest, scoped to tickets/impersonation |
| Support | ✅ `support` | |
| Product/Admin | ~ `developer` | has `products`, `settings`, `logs` |
| Employee | ❌ | no floor role; a staff member with no `saas_role` gets `[]` |

**Gap:** 4 roles missing, and the missing `finance` role blocks delegating any of
the Money section. Backend authorization is real (`saasCan` guards routes, not
just UI) — that part of the requirement is already satisfied and must stay so.

---

## 3. Navigation map

### As built (9 groups, 26 pages)

`SAAS_DEPARTMENTS` in `js/modules/dashboard-part2.js`. The registry carries a
standing rule, already enforced and worth restating:

> Any page that is a placeholder (no CRUD, static text) is NOT listed here — HQ
> must have no dead navigation.

That rule and the specification's "REMOVE DEAD/FALSE UI" are the same rule. It is
why the requested ~100-item navigation **cannot** be pasted in wholesale: 74 of
those entries have no screen, and adding them would manufacture exactly the dead
UI the specification forbids. Nav entries land as their screens become real.

### Requested IA → reality (the gap ledger)

Legend: **W** = wired and real · **O** = backend exists, orphaned (wire it) ·
**P** = partial · **✗** = nothing exists (build it)

| Group | Item | State | Where it is / what is missing |
|---|---|---|---|
| **Pulse** | Executive Dashboard | W | `saas-command` |
| | Today | W | `saas-intelligence` (Daily Brief) |
| | Alerts | ✗ | no alert store |
| | Tasks | O | `/api/hq/tasks` wired to agents only, no human task screen |
| | Approvals | O | `/api/hq/approvals` wired to agents only |
| | AI Workforce | W | `saas-agents` |
| | Platform Health | W | `saas-usage` + `/saas/platform-health` |
| **Customers** | Accounts / Dealerships | W | `saas-customers` |
| | Users | W | `owner-users` |
| | Trials | W | `saas-trials` (+ orphaned `/hq/crm/trials`) |
| | Subscriptions | W | `saas-billing` (full Stripe: portal, cancel, plan, coupon) |
| | Product Usage | W | `saas-product-usage` |
| | Churn / Retention | P | `saas-health` shows health, no churn cohort |
| | Support | ✗ | no ticket store in HQ |
| | Customer Success | P | folded into `saas-health` |
| **Marketing** | Website | **P/wrong** | mounts the **dealer** builder; `/hq/website/*` orphaned |
| | Design Studio | W | `saas-studio` → shared studio-shell |
| | Video Studio | P | `loadSaasVideoStudio()` renders inside Design Studio, no nav entry |
| | Social Studio | ✗ | dealer social exists; no HQ corporate accounts |
| | Email / SMS Campaigns | P | `saas-email-marketing` + `/saas/automation/campaigns`; no SMS channel, no segment builder, no per-campaign analytics |
| | Automations | P | `saas-automation` — sequences/steps/templates are real and executable; no visual builder, no branch/condition, no per-step logs |
| | Audiences | ✗ | `/saas/automation/segment-count` exists; no audience objects |
| | Forms / Landing Pages | O | `hq_website_pages` supports both |
| | SEO / Discoverability | O | `/hq/website/discovery/*` orphaned |
| | Ads | ✗ | no ad-platform ingestion for corporate spend |
| | Analytics | O | `/hq/pulse/analytics` orphaned |
| **Sales** | Leads | P/O | `saas-funnel`; richer `/hq/crm/leads` orphaned |
| | Opportunities / Pipeline | O | `/hq/crm/opportunities` + convert, orphaned |
| | Demo Requests | ✗ | |
| | Follow-ups | W | `saas-followups` |
| | Tasks / Sales Reports | ✗ | |
| **People** | Staff | W | `saas-employees` |
| | Onboarding | P | `saas-onboarding` is *customer* onboarding, not employee |
| | Roles / Permissions | ✗ | removed as placeholders; `/owner/user/:id/role` exists |
| | Payroll | ✗ | dealer payroll exists; no HQ payroll |
| | Commissions | O | `/hq/finance/commission-plans`, `/hq/finance/commissions` orphaned |
| | Time / Training / Performance | ✗ | |
| **Affiliates** | all 7 items | P | one `saas-affiliates` page + `/saas/affiliates`; payouts via `hq_payouts` orphaned |
| **Money** | Financial Dashboard | P | `saas-accounting` (overview + P&L) |
| | **Budget** | **O** | `hq_budgets`/`hq_budget_lines` exist; only `GET /hq/finance/budgets/vs-actual`, no CRUD, no screen |
| | Income | W | `/saas/accounting/income` + scan |
| | Expenses | W | `/saas/accounting/expenses` + receipt scan, approve, recurring |
| | AR / AP / Transactions | O | `hq_journal_entries` + `hq_payment_allocations` |
| | Stripe | W | `saas-billing` |
| | Refunds / Taxes | ✗ | |
| | Commissions / Affiliate Payouts | O | as above |
| | Forecasting | O | `/hq/finance/forecast` orphaned |
| | Reports | P | P&L only |
| **Product** | Products / Plans / Pricing | ✗ | removed as placeholders |
| | Entitlements | W | `saas-entitlements` |
| | Feature Flags | O | `/owner/flags/:id` exists, page was removed as a placeholder |
| | Integrations | W | `saas-integrations` |
| | Release Mgmt / API / Webhooks | ✗ | |
| | Usage | W | `saas-usage` |
| **Platform** | System Health | W | `/owner/health` |
| | Security | W | `saas-security` |
| | Audit Logs | W | `saas-audit` + `hq_audit_log` |
| | Background Jobs | O | `hq_job_runs` table, no screen |
| | Logs / Environment / Incidents | ✗ | |
| | Staging / Production | P | banner only |
| **Settings** | Company / Branding / Billing / Team / Roles / Integrations / Notifications / Security | P | one `config` page |

**Honest coverage: 26 real screens against ~100 requested items.**
~24 items are **O** — reachable by wiring alone. ~40 are **✗** — genuine builds.

---

## 4. Reused from DealerOS (deliberately)

Reuse is at the **engine** layer, never the page layer, and every reuse carries
its own corporate context object:

| Engine | Reused for | Context swap |
|---|---|---|
| `studio-shell.js` + `fabric-adapter.js` | HQ Design Studio | MarketSync Brand Kit, not dealership brand |
| Video Studio module | HQ Video Studio | MarketSync media library |
| Twilio messaging transport | HQ SMS | HQ sender identity + HQ consent records |
| Social OAuth + publish claim | HQ Social Studio (not yet built) | MarketSync corporate accounts |
| `apiGetJson` / `apiPostJson`, `engCard`, `engKpi`, `svgIcon` | all HQ pages | none needed |
| Website **builder engine** | HQ Website Studio (target state) | `hq_website_pages`, not `site_pages` |

**Not reused, deliberately:** dealer CRM, dealer accounting, dealer inventory,
dealer marketing routes. HQ has its own `hq_*` equivalents.

---

## 5. Build order

Sequenced by value ÷ cost. WIRE slices first — they convert existing, tested
backends into reachable product.

| # | Slice | Type | Status |
|---|---|---|---|
| 0 | **HQ schema exists at all** | FIX | **DONE 2026-09-06.** 43 tables applied to staging; collision merged; budget-vs-actual proven on real rows |
| 1 | **Money → Budget** | WIRE + extend | NEXT. `hq_budgets`/`hq_budget_lines` now exist but carry no department, owner, notes, committed spend, quarter, or approval columns, and `/hq/finance/budgets/vs-actual` is read-only with no CRUD and no screen |
| 2 | Navigation → requested 10-group IA | REFACTOR | One authoritative model; every new screen has a home. Entries land only as screens become real — the registry's own no-dead-nav rule |
| 3 | Money → AR/AP/Transactions/Forecasting | WIRE | `/hq/finance/*` orphaned |
| 4 | Sales → Leads/Opportunities/Pipeline | WIRE | `/hq/crm/*` orphaned |
| 5 | Marketing → corporate Website Studio | WIRE + replace | Stop mounting the dealer builder; move to `/hq/website/*` |
| 6 | People → Commissions | WIRE | `/hq/finance/commissions` orphaned |
| 7 | HQ roles: Finance, Executive, Customer Success, Employee | BUILD | Unblocks delegation of everything above |
| 8 | Campaigns: SMS channel, audiences, per-campaign analytics | BUILD | |
| 9 | Automations: visual builder, branches, per-step logs | BUILD | |
| 10 | Social Studio, Ads, Support, Payroll, Product catalog | BUILD | |

---

## 6. Blockers and things that must not be faked

- **No `finance` HQ role.** Until slice 7, only the owner can operate Money.
- **Stripe writes** are real but refuse with 503 when Stripe is unconfigured —
  keep that; never fake a successful mutation.
- **Corporate social accounts** are not provisioned. Social Studio must stay
  unavailable-with-a-reason until OAuth apps exist, exactly as dealer social does.
- **Ad platforms** have no corporate ingestion; a spend number would be invented.
- **Runway/burn** require a cash-balance source HQ does not have. The Financial
  Dashboard must show an explicit empty state rather than deriving cash from MRR.
- **CI on `staging` is red** (55 pre-existing failures, unrelated to HQ) — a green
  suite is not currently available as an acceptance signal; slices are verified by
  their own targeted tests plus the untouched-baseline comparison.
