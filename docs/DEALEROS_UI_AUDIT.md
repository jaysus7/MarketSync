# DealerOS UI Audit — navigation & information architecture

Audit performed against `staging` (baseline 359/359 tests green) ahead of the Phase 1
navigation reorganization. Governing sources: **Doc 21 — Master Dealer OS Architecture**
(§18 Global UI Shell, §26 Master Architecture Rules) and **Doc 22 — Master Build Roadmap**
(§4 Audit Deliverables, §11 Phase 4 Global UI Migration, §23 UI Migration Rules), plus
`docs/KERNEL_CONTRACT.md` (frozen — this audit touches **no** kernel surface).

Classification vocabulary is Doc 22 §3: **KEEP / FIX / MOVE / MERGE / DELETE / BUILD**.
Preference order KEEP > FIX > MOVE > MERGE > BUILD > DELETE.

---

## 1. Current global navigation entries

The live sidebar is rendered by `renderDeptNav()` from the `DEPARTMENTS` registry in
`marketplace-frontend/js/modules/dashboard-part2.js:607`. The `#nav-desktop` tree in
`dashboard.html` is **legacy and hidden** (carries a DO-NOT-EDIT banner) but its gating
classes are still read in places.

| # | Current department | Role gate | Pages |
|---|---|---|---|
| 1 | Daily Briefing (`executive`) | `mgr` | command |
| 2 | Sales | — (all) | insights, crm, appointments, tasks, inventory(manual), appraisal, equity, leads*, inv-intel*, market*, delivery*, reports* |
| 3 | F&I | roles: DEALER_ADMIN/OWNER/MANAGER/FNI | fni |
| 4 | Service | `mgr` | service-ros, service-appointments |
| 5 | Parts | `mgr` | service-parts |
| 6 | Detail / Cleanup | — (all) | recon |
| 7 | Accounting | `mgr` | accounting |
| 8 | Marketing | — (all) | inventory(facebook), website*, ai-home*, automation-builder*, email-marketing*, leaderboard* |
| 9 | Administration | `mgr` | sales-team, people-compliance, operations, taskboard, config, api-keys |

`*` = `mgr: true` (manager/owner/admin only).

Parallel registries that also drive navigation:

| Registry | Location | Purpose |
|---|---|---|
| `SAAS_DEPARTMENTS` | part2.js:824 | MarketSync HQ back office (own workspace) |
| `PRODUCT_PAGES` / `PRODUCT_HOME` | dashboard.js:~790 | Facebook Solo / Facebook Dealer / AI Chatbot tiers |
| `FB_ONLY_PAGES` | dashboard.js:769 | legacy `fb_only` accounts |
| `STAFF_ROLE_NAV` | dashboard.js:469 | narrow staff roles (FNI/SERVICE/ACCOUNTING/CLEANUP) |
| `restrictedNavPages()` | dashboard.js:1087 | flat page list for restricted tiers (desktop **and** mobile) |
| `MS_ALLOWED_PAGES` | dashboard.js:457 | MarketSync-mode page filter |

**Finding (good):** `applyMobileQuickRow()` (dashboard.js:1049) already derives the mobile
bottom row from the *same* registry as desktop (`__deptRegistry` / `restrictedNavPages()`).
The "one source of truth" property exists today and **must be preserved**, not re-invented.

---

## 2. Page inventory — all 49 `data-page-content` containers

30 are reachable from `DEPARTMENTS`, 10 from `SAAS_DEPARTMENTS`, **9 are orphans**.

### 2.1 Orphan pages (container exists, not in any visible registry)

| Page | How reached today | Verdict |
|---|---|---|
| `desk` | `openDeskForContact()` — contextual per customer | **KEEP standalone** (contextual launch, correct) |
| `vin-sticker` | contextual from inventory | **KEEP standalone** |
| `ai-vision` | contextual button (photo scoring) | **KEEP standalone** |
| `automation` | launched from inside `automation-builder` | **KEEP** (settings sub-page) |
| `service-settings` | legacy nav + header gear | **MOVE → Settings** |
| `website-settings` | legacy nav only | **MOVE → Settings** |
| `solo-home` | Facebook Solo product tier | **KEEP** (product tier) |
| `commissions` | **legacy nav only — legacy nav is hidden** | ⚠️ **UNREACHABLE — FIX** |
| `ai-inbox` | no `switchPage` call, no nav button | ⚠️ **UNREACHABLE — FIX/flag** |

**Defect confirmed:** `commissions` (a real, working page) and `ai-inbox` became unreachable
for every DealerOS user when the flat department nav replaced the legacy tree. No feature
was deleted — the *access point* was lost. Phase 1 restores both.

---

## 3. Target workspace map (Doc 21 §18 / project instructions §8)

Nine workspaces. System engines (Customer/CRM, Automation, AI, Integration, Analytics,
Communication, Configuration, Marketplace) are **not** primary departments — they power the
workspaces underneath, exactly as Doc 21 §10 (Shared Platform Services) requires.

| Workspace | Tab | Existing page | Module | Backend dependency | Class |
|---|---|---|---|---|---|
| **Executive** | Overview | `command` | part7 | `/dashboard/*` | KEEP |
| | Performance | `leaderboard` | part11 | `/dashboard/charts` | MOVE (from Marketing) |
| | Exceptions | — | — | Exception Engine (kernel) | **BUILD** (deferred) |
| | Operations | `operations` | part21 | `/workflow`, `/events` | MOVE (from Administration) |
| | Reports | `reports` | part18 | `/reports/*` | MOVE (shared with Sales) |
| **Sales** | Overview | `insights` | part7 | `/dashboard/*` | KEEP |
| | Pipeline | `leads` | part9 | `/leads/*` | KEEP (rename Opportunities→Pipeline) |
| | Customers | `crm` | part9/10 | `/crm/*` (Customer Engine) | KEEP |
| | Appointments | `appointments` | part12 | `/calendar/*` | KEEP |
| | Tasks | `tasks` | part12 | `/dealer-tasks` | KEEP |
| | Deals | `desk` (contextual) | part17 | `/reports/deal` | KEEP contextual |
| **Inventory** | Overview | `inventory` (manual) | part4/5 | `/inventory/*` | KEEP |
| | Vehicles | `inventory` (manual) | part4/5 | `/inventory/*` | KEEP |
| | Acquire | `appraisal` | part16 | `/ai/appraisals` | **MOVE** (from Sales) |
| | Acquire | `equity` | part16 | `/equity/*` | **MOVE** (from Sales) |
| | Recon | `recon` | part15 | `/recon/*` | **MOVE** (from Detail/Cleanup dept) |
| | Pricing | `inv-intel` | part6 | `/ai-pricing/*` | **MOVE** (from Sales) |
| | Pricing | `market` | part6 | `/ai/market` | **MOVE** (from Sales) |
| | Syndication | `inventory` (facebook) | part4/5 | `/syndication/*` | **MOVE** (from Marketing) |
| **F&I** | Deals | `fni` | part17 | `/fni/*` | KEEP |
| | Delivery | `delivery` | part17 | `/delivery/*` | **MOVE** (from Sales) |
| | Credit | — | — | `/credit/*` exists (Doc 23) | **BUILD** (deferred) |
| | Products / Contracts | — | — | `/fni-catalog` | **BUILD** (deferred) |
| **Service** | Schedule | `service-appointments` | part23 | `/service/*` | KEEP |
| | Repair Orders | `service-ros` | part23 | `/service-engine/*` | KEEP |
| | Technicians / Customers | — | — | — | **BUILD** (deferred) |
| **Parts** | Inventory | `service-parts` | part23 | `/service/parts` | KEEP |
| | Orders / Receiving / Requests | — | — | — | **BUILD** (deferred) |
| **Accounting** | Overview | `accounting` | part19/20 | `/accounting*` | KEEP (own internal menu) |
| | Payroll | `commissions` | part18 | `/commissions/*` | ⚠️ **FIX — restores unreachable page** |
| **Marketing** | Campaigns | `email-marketing` | part22 | `/dealer-email/*` | KEEP |
| | Website | `website` | part13 | `/site/*` | KEEP |
| | Content (AI chat) | `ai-home` | part13 | `/ai/*` | KEEP |
| | Content (AI inbox) | `ai-inbox` | part13 | `/ai/conversations` | ⚠️ **FIX — restores unreachable page** |
| | Advertising / Reputation / Attribution | — | — | `/adspend/*` partial | **BUILD** (deferred, Stage 0 doc) |
| **People** | Employees | `sales-team` | part14 | `/dealership/team` | **MOVE** (from Administration) |
| | Compliance | `people-compliance` | part24/26 | `/hr/*` (new People engine) | **MOVE** (from Administration) |
| | Time / Payroll / Training | — | — | `/hr/*` backend exists | **BUILD** (deferred) |
| **Settings** (system) | Settings | `profile` | part14 | `/profile` | KEEP |
| | Configuration | `config` | part21 | `/config/*` | **MOVE** (from Administration) |
| | Automation | `automation-builder`, `automation` | part22 | `/automation/*` | **MOVE** — Automation leaves primary nav |
| | API Keys | `api-keys` | part21 | `/public-api/*` | **MOVE** (from Administration) |
| | Service / Website settings | `service-settings`, `website-settings` | part23/13 | — | **MOVE** |
| **Executive→Ops** | Task Board | `taskboard` | part21 | `/workflow/*` | MOVE (from Administration) |

### 3.1 Departments that disappear as primary nav

| Removed department | Where it goes | Rationale |
|---|---|---|
| **Detail / Cleanup** | Inventory → Recon | Doc 21 §11: recon is vehicle lifecycle, not its own destination |
| **Administration** | split → People / Executive / Settings | not a dealership department |
| **Automation** (as Marketing tab) | Settings → Automation | project instructions §9: not an employee department |

---

## 4. Gating model (must be preserved byte-for-byte)

Four independent layers, all in `dashboard-part2.js` / `dashboard.js`:

1. **Role** — `deptRoleOk()`: explicit `roles[]` wins, else `mgr` → `DEPT_MGR_ROLES`.
2. **Entitlement** — `pageFeatureOk()` via `PAGE_FEATURE` (`os.*`) and `PAGE_PRODUCT`,
   with `DEALER_OS_PLAN_FEATURES` cold-start fallback. **Fails open** when
   `/access/context` is unavailable — deliberate, keeps legacy accounts working.
3. **Dealer feature flags** — `PAGE_DEALER_FLAG` → `__featureFlags`.
4. **Product / staff tiers** — `__productAllowedPages`, `__fbOnly`, `__staffAllowedPages`
   short-circuit before the department nav renders.

`switchPage()` re-applies every gate, so a stale deep link cannot escape a tier.

> **Phase 1 rule:** the workspace registry changes *grouping and labels only*. Every page
> keeps its existing `PAGE_FEATURE` / `PAGE_PRODUCT` / `PAGE_DEALER_FLAG` key, so
> entitlement behavior is unchanged. Backend RBAC/RLS is untouched.

**Facebook-only / AI-only tiers:** `deptNavEligible()` already returns `false` for
`__fbOnly`, `__productAllowedPages` and `__staffAllowedPages`, so those tiers never see the
DealerOS workspace nav. Phase 1 does not alter that branch.

---

## 5. Duplicate / dead UI

| Item | Finding | Action |
|---|---|---|
| `#nav-desktop` legacy tree | superseded by `renderDeptNav()`; hidden, DO-NOT-EDIT | KEEP hidden (still supplies `probe` + product gating hooks); do not delete in Phase 1 |
| `inventory` page, 2 modes | one page, `manual` + `facebook` via `__inventoryMode` | **MERGE conceptually**: Inventory→Vehicles vs Inventory→Syndication, one page (no duplicate inventory model — Doc 21 §3) |
| `reports` | referenced by Sales and Executive | single page, two entry points — acceptable |
| `crm` | 3 legacy nav leaves share `data-page="crm"` | already disambiguated by `__crmSearchAll` |
| `commissions`, `ai-inbox` | unreachable | **FIX** (§2.1) |
| `DEPARTMENTS_CONFIG` (part24.js:21) | unrelated HR/department config, not navigation | KEEP — do not confuse with nav registry |

---

## 6. Pages that must remain standalone (not workspace tabs)

`desk` (deal desk — launched per customer), `vin-sticker`, `ai-vision`, `automation`
(settings sub-page), `solo-home` (product tier), and all `saas-*` + `owner-users` +
`affiliates-admin` (separate MarketSync HQ workspace).

---

## 7. Missing workflows (BUILD — explicitly deferred past Phase 1)

Executive→Exceptions · F&I→Credit/Products/Contracts (Doc 23) · Service→Technicians/Customers ·
Parts→Orders/Receiving/Requests · Accounting→Transactions/Payables/Receivables/Bank ·
Marketing→Advertising/Reputation/Attribution · People→Time/Payroll/Training.

Backend for several already exists (`/hr/*`, `/credit/*`, `/fni-catalog`, `/adspend/*`) —
these are **UI gaps, not engine gaps**, consistent with Doc 22's "the backend has advanced
faster than the UX".

---

## 8. Routing reality (important)

There is **no page router today**. `switchPage()` toggles `.hidden` on
`[data-page-content]`. `history.replaceState` is used only to strip OAuth query params
(`?calendar=`, `?adspend=`) and the extension token (`#tk=`). Consequences:

- No deep link to a page, no back/forward between pages, no refresh-into-page.
- Existing query-param returns land via `switchPage()` and **must keep working**.

Phase 1 adds a **minimal additive hash router** (`#/w/<workspace>/<tab>`) that delegates to
the existing `switchPage()`. It runs *after* the `#tk=` bootstrap so token handling is
unaffected, and it is a no-op for restricted tiers.

---

## 9. Migration / build sequence

| Step | Scope | Risk |
|---|---|---|
| **1** | `docs/DEALEROS_UI_AUDIT.md` (this file) | none |
| **2** | `js/modules/workspace-registry.js` — one source of truth, pure data + selectors | low (additive) |
| **3** | Desktop nav renders from the registry (`renderDeptNav` reads workspaces) | medium — behind `deptNavEligible`, restricted tiers untouched |
| **4** | Local workspace tabs (`renderDeptTabbar` → workspace tabs) | low |
| **5** | Role-aware mobile nav from the same registry | low |
| **6** | Hash routing + navigation/access regression tests | low |

Phase 1 stops here. Department **page** rewrites (Doc 22 phases 5–11) are out of scope.

---

## 10. KEEP / FIX / MOVE / MERGE / DELETE / BUILD summary

- **KEEP** — all 49 page containers, every backend route, all four gating layers, the
  legacy hidden tree, `restrictedNavPages()`, `STAFF_ROLE_NAV`, `SAAS_DEPARTMENTS`,
  contextual launches (`desk`, `vin-sticker`, `ai-vision`).
- **FIX** — restore reachability of `commissions` (→ Accounting) and `ai-inbox` (→ Marketing).
- **MOVE** — appraisal/equity→Inventory·Acquire; recon→Inventory·Recon; inv-intel/market→
  Inventory·Pricing; inventory(facebook)→Inventory·Syndication; delivery→F&I·Delivery;
  sales-team/people-compliance→People; operations/taskboard/reports→Executive;
  config/api-keys/automation-builder→Settings; leaderboard→Executive·Performance.
- **MERGE** — Detail/Cleanup + Administration + Automation cease to be primary departments.
- **DELETE** — **nothing.** No page, route, function or gate is removed in Phase 1.
- **BUILD** — §7 tabs, deferred; plus the workspace registry itself (step 2).

---

## 11. Acceptance gates for Phase 1

Frontend syntax + no duplicate top-level declarations (`npm run check:frontend`) ·
every nav target resolves to a real `[data-page-content]` · role visibility (rep vs manager)
· Facebook Solo/Dealer + AI-only tiers unchanged · staff roles unchanged · dark mode ·
mobile row derives from the same registry · existing deep links (`?calendar=`, `?adspend=`,
`#tk=`) still work · backend suite stays **359/359**.
