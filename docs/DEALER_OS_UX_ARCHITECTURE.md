# Dealer OS — UX architecture (as built)

**Documentation only.** This file describes the architecture that exists in the
repository today. It was written *after* Phase 1 (navigation) and Phase 2 (Sales
reference department) shipped, precisely so future work plans against reality.

> **Naming warning.** Earlier planning documents referred to `DepartmentShell`,
> `AttentionQueue`, `RecordWorkspace`, `QuickActions`, `DepartmentKPI`,
> `WorkflowBoard` and a standalone **My Day**. **None of those exist as runtime
> components.** They were conceptual. Their intended behaviour is already provided
> by the components named below. Do **not** create parallel abstractions to match
> the old vocabulary — see `docs/SALES_PHASE2_AUDIT.md` §0.

Reference implementation: **Sales** (`marketplace-frontend/js/modules/sales-workspace.js`).

---

## 1. Dealer OS navigation structure

Three navigations, **one registry**: `MS_WORKSPACES` in
`marketplace-frontend/js/modules/workspace-registry.js`.

```
Desktop sidebar   renderDeptNav()      → workspace buttons (+ system rail)
Workspace tabs    renderDeptTabbar()   → the pages inside the active workspace
Mobile bottom bar applyMobileQuickRow()→ role-aware, MS_ROLE_MOBILE_NAV
```

Nine departments in workflow order, plus Settings as a `system: true` workspace
rendered under a divider:

```
Executive · Sales · Inventory · F&I · Service · Parts · Accounting · Marketing · People
                                                                    (+ Settings)
```

System engines — Customer/CRM, Automation, AI, Integrations, Analytics,
Communications, Configuration, Marketplace — are **not** departments. They power the
workspaces underneath.

Registry entry shape:

```js
workspaceId: {
  label, icon, accent,
  mgr?: true | roles?: ['DEALER_ADMIN','OWNER','MANAGER','FNI'],
  probe?: '#css-selector',   // DOM presence as a visibility signal
  always?: true,             // always visible
  system?: true,             // render on the bottom system rail
  pages: [ { page, label, invmode?, mgr?, roles? } ],
}
```

Every `page` must be an existing `[data-page-content]` container in `dashboard.html`.

**Routing.** `switchPage(pageId)` shows/hides page containers; there is no router
framework. A thin additive hash route (`#/w/<workspace>/<page>`, `#/p/<page>`) gives
deep links, Back/Forward and refresh-restore. `msBootRoute()` retries the restore as
entitlements arrive, then gives up — a gated deep link never escapes its gate.

## 2. Engine registration model (the real "department shell")

`dashboard-part10.js` defines the engine system. A department registers one object:

```js
ENGINES['sales'] = {
  rootId: 'sales-root',              // <div id> inside its page container
  title, subtitle, icon, accent,
  tabLabels: { overview: 'Today' },  // rename standard tabs
  get tabOrder() { ... },            // role-aware subset of the five tabs
  fetch: async () => ({ ... }),      // ONE payload, memoized per engine
  quickActions: [ { label, icon, onclick } ],
  nextActions: (d) => [ { label, icon, tone, onclick } ],
  tabs: { overview(body,d){}, work(){}, insights(){}, automation(){}, settings(){} },
};
```

Wiring a department takes four small edits:

1. a page container + `#<id>-root` in `dashboard.html`
2. a module registering `ENGINES[id]` (loaded **after** the `dashboard-part*` files)
3. one line in `switchPage`: `if (pageId === 'x') renderEngine('x')`
4. a `PAGE_FEATURE[x]` entitlement key + the registry entry

| Function | Responsibility |
|---|---|
| `renderEngine(id)` | builds the shell: header, tab bar, body, right rail |
| `engineTab(id, tab, force)` | switches tab, renders body, refreshes rail |
| `engineData(id, force)` | memoized `fetch()` — one call per engine, not per tab |
| `engineRail(eng, d)` | right panel: Ask AI · **Next Actions** · **Quick Actions** |

Consumers today: `command`, `owner-users`, `affiliates-admin`, six `saas-*`, and
**`sales`** — the first dealership-facing one.

## 3. Standard department tabs

```js
ENGINE_TAB_ORDER = ['overview', 'work', 'insights', 'automation', 'settings']
ENGINE_TAB_LABEL = { overview:'Overview', work:'Work', insights:'Insights',
                     automation:'Automation', settings:'Settings' }
```

| Tab | Purpose |
|---|---|
| **overview** | The department's *Today*: what needs attention, right now. Not analytics. Rename via `tabLabels.overview = 'Today'`. |
| **work** | The operational working area. Sub-views are rendered inside this tab, not as extra sidebar destinations. |
| **insights** | Manager-focused, operational metrics. Not a report dump. |
| **automation** | The department's slice of the **shared** Automation Engine. Never a second engine. |
| **settings** | Department-specific settings only. |

A department may show a subset. Tabs are not required to exist.

## 4. Role-aware tab visibility

`tabOrder` may be a getter that inspects the caller's role:

```js
get tabOrder() {
  const mgr = ['DEALER_ADMIN','OWNER','MANAGER'].includes(profileContext?.role);
  return mgr ? ['overview','work','insights','automation','settings']
             : ['overview','work'];
}
```

Workspace/page visibility uses `deptRoleOk()`: an explicit `roles[]` wins, else `mgr`
means `DEPT_MGR_ROLES` (`DEALER_ADMIN`/`OWNER`/`MANAGER`), else everyone.

> **Rule:** role controls what is *worth showing*. It is **not** a security boundary.
> The server scopes the data — e.g. `/crm/contacts` already restricts a non-manager to
> `assigned_rep = me OR created_by = me`. Never expose privileged data and rely on the
> UI to hide it.

## 5. Entitlement behaviour

Four independent layers, applied by `dashboard-part2.js`:

1. **Role** — `deptRoleOk()`.
2. **Plan entitlement** — `pageFeatureOk()` via `PAGE_FEATURE` (`os.*`) and
   `PAGE_PRODUCT`, with the `DEALER_OS_PLAN_FEATURES` cold-start fallback. It **fails
   closed**: with no `window.__access` and no plan fallback, only pages declaring no
   feature stay visible. Nav therefore fills in once `/access/context` resolves.
3. **Dealer feature flags** — `PAGE_DEALER_FLAG` → `__featureFlags`.
4. **Product / staff tiers** — `__productAllowedPages`, `__fbOnly`,
   `__staffAllowedPages` short-circuit *before* the workspace nav renders.

Restricted tiers (**Facebook Solo**, **Facebook Dealer**, **AI Chatbot**) and the
narrow staff roles (`FNI`/`SERVICE`/`ACCOUNTING`/`CLEANUP`) bypass the workspace nav
entirely via `deptNavEligible()` and use `restrictedNavPages()` / `STAFF_ROLE_NAV`.
**Any department change must leave those paths untouched.**

`switchPage()` re-applies every gate, so a stale link or bookmark cannot escape a tier.

## 6. Department ownership

| Department | Owns |
|---|---|
| Executive | cross-department exceptions, performance, operations, reports |
| **Sales** | opportunities, customers, appointments, tasks, the sales side of a deal |
| **Inventory** | vehicle lifecycle: acquire → recon → price → publish |
| **F&I** | credit, products, contracts, funding, delivery of the deal |
| Service | repair orders, schedule |
| Parts | parts inventory and movement |
| Accounting | final financial truth |
| Marketing | campaigns, website, content, attribution |
| People | employee lifecycle, compliance |

Ownership means responsibility for state transitions — **not** exclusive possession of
data. Other departments read through the owning engine's API.

## 7. Canonical records

One record per business object; no departmental duplicates (Doc 21 §3).
Customer · Vehicle · Deal · Employee · Dealership · Repair Order · Part · Task ·
Appointment · Document · Payment · Work Order · Credit Application · Campaign · Vendor.

**Customer status enum (canonical, do not extend casually):**

```
uncontacted · contacted · appointment · sold · fni · turnover · delivered · followup · lost
```

Labels come from `CRM_STATUS`. "Showed" and "Negotiating" are **not** stages — a UI may
*derive* such context from appointments/deals/tasks, but must not persist fake stages.
Extending this enum is a schema decision requiring explicit approval; it must not be
made opportunistically inside department work.

## 8. Cross-department handoffs

The same record continues across departments — never copied, never re-entered.

```
Marketing lead → Sales (customer)
Sales opportunity → Deal → F&I → Delivery → Accounting + Commission + Service ownership
Sales trade      → Appraisal → Inventory (acquisition)
Inventory        → Recon → Photos → Publishing/Syndication
Service          ↔ Parts
Service close    → Accounting
Employee         → Training, Time/Payroll
```

A handoff is correct when both sides show the **same** customer, vehicle, appraisal and
deal ids. Departments display each other's blockers/status and deep-link to the owning
record; they do not reimplement the other department's logic.

## 9. Shared UI helpers that actually exist

| Helper | Location | Use |
|---|---|---|
| `renderEngine(id)` | part10 | department shell |
| `engineTab(id, tab)` | part10 | tab switching (memoized data) |
| `engineRail(eng, d)` | part10 | Ask AI + Next Actions + Quick Actions |
| `engKpi(label, val, tone)` | part10 | KPI tile |
| `engCard(title, inner, extra)` | part10 | section card |
| `engEmpty(msg)` | part10 | empty state |
| `engBar(segments)` | part10 | segmented bar + legend |
| `ENGINE_ACCENTS` | part10 | per-department accent classes |
| `svgIcon(name, cls)`, `esc()` | core | icons, escaping |
| `apiGetJson`, `apiSendJson` | core | HTTP with retry |
| `switchPage(pageId)` | part2 | navigate |
| `showToast()` | core | feedback |

`nextActions` **is** the attention queue. `quickActions` **is** the quick-action row.
`engKpi` **is** the department KPI. There is no separate component to build.

## 10. Department UI ↔ engines / workflows

The department UI is a **projection**. It must not own business state.

- **Reads** go to existing endpoints. Prefer an aggregate read over new storage.
- **Writes** delegate to the existing implementation (e.g. Sales calls
  `crmOpenForm`, `crmApptForm`, `crmLogForm`, `openDeskForContact`), so validation,
  events and audit keep running exactly as before.
- **"Next action" is derived, never stored** — computed from existing status + task +
  appointment state. Departments must not create a second workflow engine.
- **Automation** tabs filter the shared Automation Engine; they never hold logic.
- The timeline/event system stays the single customer story — no per-department
  activity log.

## 11. Sales reference implementation

`marketplace-frontend/js/modules/sales-workspace.js` — read this before building a
department.

- `ENGINES['sales']`, `rootId: 'sales-root'`, `tabLabels.overview = 'Today'`
- role-aware `tabOrder`: rep → `Today | Work`; manager adds Insights/Automation/Settings
- `fetch()` — **one parallel `Promise.all`** (`/crm/contacts`, `/crm/tasks`,
  `/appointments`); deliveries and insights load lazily inside their own tab
- `salesAttention(d)` — ranked, **deduplicated per customer**, each row carrying
  *customer · reason · age · specific action* (Call, Confirm Appointment, Log outcome,
  Desk Deal, Prepare delivery), never a generic "View"
- `salesNextAction(c, ctx)` — derived read-only from canonical status/task/appointment
- Work sub-views (`SALES_WORK_VIEWS`) render **inside** the Work tab
- zero backend change; no new endpoint, table or write

Guarded by `marketplace-backend/test/sales-workspace.test.js`.

## 12. Rules a new department must follow

1. **Audit first.** Classify KEEP/FIX/MOVE/MERGE/DELETE/BUILD before editing.
2. **Register on `ENGINES`.** Do not build a bespoke shell or re-create the helpers.
3. **Compose, don't rebuild.** Delegate actions to the existing pages/functions.
4. **No new backend** unless you can prove existing data cannot satisfy the UX. Prefer
   a read aggregation over new storage. Never add a table to make UI coding easier.
5. **No duplicate canonical records** and no invented persisted state.
6. **Overview = attention, not analytics.** Every row: record, reason, age, specific
   action. Metrics must drive a decision.
7. **Work holds sub-views**; do not add sidebar destinations for them.
8. **Role-aware tabs, server-scoped data.**
9. **Keep restricted tiers intact** — Facebook Solo/Dealer, AI-only and staff roles must
   be verified unchanged.
10. **Performance:** one parallel payload for the landing tab; heavy datasets lazy-load
    inside their tab.
11. **Mobile:** validate at ~390px; no horizontal page overflow.
12. **Test it.** Add a `<department>-workspace.test.js` pinning shell reuse, role-aware
    tabs, attention-first overview, the no-new-endpoint rule and navigation hygiene.
13. **Don't reopen a finished phase**, and don't reorganize `dashboard-part*` or reorder
    scripts.

### Wiring checklist

- [ ] page container + `#<id>-root` in `dashboard.html`
- [ ] `js/modules/<id>-workspace.js` registering `ENGINES['<id>']`, loaded after the parts
- [ ] `switchPage`: `if (pageId === '<id>') render<Id>Workspace()`
- [ ] `PAGE_FEATURE['<id>']` entitlement key
- [ ] `MS_WORKSPACES.<id>` leads with the workspace page; existing pages stay reachable
- [ ] `MS_ROLE_MOBILE_NAV` updated if the department changes a role's landing
- [ ] tests green (`npm test`) + all `check:*` + headless dashboard load
