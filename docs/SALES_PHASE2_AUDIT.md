# Sales — Phase 2 audit (reference department)

Audit performed on `staging` at `dddcd81` (374/374 green) before any Phase 2 edit,
per Doc 22 §3 and AGENTS.md §A6. Classification: **KEEP · MOVE · COMPOSE · GAP**.

---

## 0. Corrections to the Phase 2 brief's premise

The brief assumes a Phase 1 that is richer than the one that shipped. Recording this
so nobody plans against things that do not exist:

| Brief assumes | Reality on `staging` | Impact |
|---|---|---|
| `docs/DEALER_OS_UX_ARCHITECTURE.md` | **does not exist** — Phase 1 produced `docs/DEALEROS_UI_AUDIT.md` | read that instead |
| Phase 1 built "My Day" | **no My Day.** Closest is `command` ("Daily Briefing") | Sales Today is a **GAP** to build |
| Phase 1 primitives `DepartmentShell`, `AttentionQueue`, `WorkflowBoard`, `RecordWorkspace`, `QuickActions`, `DepartmentKPI` | **none exist under those names** | but see below — equivalents exist |
| Phase 1 built shared UI patterns + Settings separation | Phase 1 was **navigation reorganization only** (registry, sidebar, workspace tabs, role-aware mobile, hash routing) | Phase 2 carries the UI-pattern work |

**No architectural conflict.** The primitives the brief wants already exist under
different names — the **`ENGINES` registry** (`dashboard-part10.js:471`):

| Brief's name | Existing primitive |
|---|---|
| DepartmentShell | `renderEngine(id)` + `ENGINES[id]` config (`rootId/title/subtitle/icon/accent/tabOrder/tabLabels/tabs`) |
| Department tabs | `ENGINE_TAB_ORDER = ['overview','work','insights','automation','settings']` — **exactly the tab set the brief asks for** |
| AttentionQueue | `nextActions(d)` → rendered by `engineRail()` |
| QuickActions | `quickActions[]` → rendered by `engineRail()` |
| DepartmentKPI | `engKpi(label, val, tone)` |
| Cards / empty / bars | `engCard()`, `engEmpty()`, `engBar()` |
| Memoized data + lazy tabs | `engineData()` / `engineTab()` (caches per engine, loads per tab) |

Nine pages already use it (`command`, `owner-users`, `affiliates-admin`, six `saas-*`).
**Sales becomes the tenth — and the first dealership-facing one.** This is the reference
pattern; Sales must not invent a parallel one.

---

## 1. KEEP — existing Sales functionality that is already correct

| Capability | Page | Module | API |
|---|---|---|---|
| CRM customers + kanban stages + drag-drop | `crm` | part4 (`loadCrmPage`), part9/10 | `/crm/contacts`, `/crm/contacts/:id` |
| Lead inbox + routing | `leads` | part17 (`loadLeadsPage`) | `/leads`, `/leads/routing` |
| Appointments | `appointments` | part2 (`loadAppointmentsPage`) | `/appointments`, `/calendar/*` |
| Tasks | `tasks` | part2 (`crmLoadTasks`) | `/crm/tasks`, `/dealer-tasks` |
| **Desk a deal** | `desk` | part2 (`loadDeskDeal`), contextual via `openDeskForContact()` | `/reports/deal` |
| Appraisals | `appraisal` | part16 | `/ai/appraisals` |
| Deliveries | `delivery` | part2 (`loadDeliveryQueue`) | `/delivery/queue` |
| F&I deals | `fni` | part15 (`loadFniPage`) | `/fni/*` |
| Sales insights | `crm-insights-root` | part4 (`loadCrmInsights`) | `/crm/insights` |
| Commissions | `commissions` | part13 | `/commissions/*` |

**Canonical stage model already exists** and must be reused, not replaced:

```
uncontacted · contacted · appointment · sold · fni · delivered · followup · lost
```
(`CRM_STATUS_LABEL`, part4:24). The brief's preferred stages (New/Contacted/Appointment/
**Showed**/**Negotiating**/Sold) are close but **Showed** and **Negotiating** do not exist
in the backend. Per the brief's own rule ("map the UI carefully rather than creating
duplicate state") we render the **existing** statuses. Adding two states is a backend
change requiring approval — logged as a gap, not silently invented.

Also KEEP: the standalone `pipeline` page is already retired into `crm`
(`switchPage`: `if (pageId === 'pipeline') pageId = 'crm'`). Do not resurrect it.

## 2. MOVE — **already done in Phase 1**

The brief's "REMOVE / MOVE FROM SALES" list is largely satisfied. Sales today is:

```
Overview(insights) · Pipeline(leads) · Customers(crm) · Appointments · Tasks · My Commission
```

Already moved out of Sales by Phase 1: Inventory + Inventory Intelligence + Market →
**Inventory**; Recon/Cleanup → **Inventory**; Appraisals + Equity Mining → **Inventory ·
Acquire**; Deliveries → **F&I**; broad Reports + Operations + Task Board → **Executive**;
Marketing → its own workspace. Nothing further to move; **nothing to delete**.

One reconciliation: the brief wants **Deliveries** inside Sales Work, while Phase 1 put
`delivery` under F&I. Resolution: surface the **same `delivery` page** from Sales Work —
one page, one record, two entry points (the brief explicitly allows this: "Delivery is
part of the customer Sales lifecycle"). No duplicate queue.

## 3. COMPOSE — existing pieces to combine

| Target | Composed from | Data |
|---|---|---|
| **Sales → Today** (attention-first) | contacts by status/age, open+overdue tasks, today's appointments, delivery queue | `/crm/contacts`, `/crm/tasks`, `/appointments`, `/delivery/queue` |
| **Sales → Work → Opportunities** | existing CRM contact list + canonical statuses | `/crm/contacts` |
| **Work → Appointments** | existing appointments data, bucketed Today/Upcoming/Needs confirmation/Missed | `/appointments` |
| **Work → Customers** | existing CRM record + `crmOpenContact()` | `/crm/contacts/:id` |
| **Work → Deals** | existing deals via delivery/F&I reads + `openDeskForContact()` | `/delivery/queue` |
| **Work → Deliveries** | existing delivery queue + blockers | `/delivery/queue` |
| **Insights** (manager) | existing insights payload — funnel, sources, per-rep, tasks | `/crm/insights`, `/leads/response-metrics` |

## 4. GAP — genuinely missing

1. **Sales Today** — no attention-first Sales command center exists. `insights` is an
   analytics dashboard, which the brief explicitly does not want as the landing page.
2. **Work grouping** — Opportunities/Appointments/Customers/Deals/Deliveries are five
   separate sidebar destinations, not one working area.
3. **Next Action derivation** — no per-record "what do I do next" exists. Derived
   read-only from existing status + task + appointment state; **no new workflow engine.**
4. **Showed / Negotiating stages** — absent from the backend status enum. Deferred,
   needs approval (schema change).
5. Sales-scoped Automation and Settings tabs — the engines exist globally; Sales has no
   filtered view.

## 5. FILE PLAN

| File | Change |
|---|---|
| `marketplace-frontend/js/modules/sales-workspace.js` | **new** — registers `ENGINES['sales']` (Today/Work/Insights/Automation/Settings) |
| `marketplace-frontend/dashboard.html` | **+1 page container** (`data-page-content="sales"`, `#sales-root`) + script tag |
| `marketplace-frontend/js/modules/workspace-registry.js` | Sales workspace leads with the new `sales` page; existing pages retained |
| `marketplace-frontend/js/modules/dashboard-part2.js` | one `switchPage` loader line + `PAGE_FEATURE` entry |
| `marketplace-backend/test/sales-workspace.test.js` | **new** — Sales structure/role/reuse regression |

Not touched: every existing Sales page module, the desking implementation, CRM behavior,
role gating, `dashboard-part*` ordering, public site, auth, Supabase schema.

## 6. BACKEND IMPACT

**Zero.** Every field Today/Work/Insights needs is already returned by an existing
endpoint:

- `/crm/contacts` → `id, full_name, phone, assigned_rep, source, status, tags, dnc, last_activity_at, created_at`
- `/crm/insights` → `leads{total,trend_pct,by_source,per_rep}, pipeline{funnel,total_contacts,won,conversion_pct}, tasks{open,overdue,due_today}, is_manager`
- `/crm/tasks`, `/appointments`, `/delivery/queue`, `/leads/response-metrics`

No new table, no new endpoint, no schema change. Existing per-user scoping is preserved:
`/crm/contacts` already restricts a non-manager to `assigned_rep = me OR created_by = me`
server-side, and `/crm/insights` returns `is_manager` — so the salesperson-vs-manager
split is **enforced by the server**, not by hiding UI.
