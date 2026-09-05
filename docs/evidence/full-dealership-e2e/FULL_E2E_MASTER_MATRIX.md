# FULL_E2E_MASTER_MATRIX

Every route, page, modal, button, action discovered in the MarketSync
DealerOS codebase. Each row is tagged with its verification status.

**Discovery pass (source-derived):**
- **91** unique frontend page slugs found via `switchPage()` and
  `data-page-content=` in `marketplace-frontend/dashboard.html` +
  `marketplace-frontend/js/modules/dashboard-part*.js`.
- **1127** unique backend endpoints (`app.get/post/patch/put/delete`)
  across `marketplace-backend/routes/`.
- **12** SaaS/system roles referenced in `routes/profile.js`.

Full raw dumps: [`inventory/frontend-slugs.txt`](./inventory/frontend-slugs.txt),
[`inventory/backend-endpoints.txt`](./inventory/backend-endpoints.txt).

## Legend

| Tag | Meaning |
|-----|---------|
| **SRC** | Route exists in the codebase (source-verified). |
| **NAV** | Route reachable from the current desktop or mobile navigation. |
| **HQ** | Route is HQ (SaaS admin) only — not a dealer surface. |
| **APP** | Route is exposed as a standalone `/apps/*.html` launcher. |
| **RUN** | Route was actually executed against a live environment (requires E2E harness pass). |

## Dealer OS pages (37)

The dealer-facing routes an actual dealership employee would touch.
Populated from source; RUN column will be filled by the Playwright
harness on each E2E pass.

| Dept | Slug | Notes | Src | Nav | Run |
|------|------|-------|-----|-----|-----|
| Home / My Day | `command` | Executive command center | ✅ | ✅ | ⏳ |
| Home / My Day | `solo-home` | Single-user home | ✅ | ✅ | ⏳ |
| Home / My Day | `ai-home` | AI-orchestrated home | ✅ | ✅ | ⏳ |
| Sales | `crm` | Customer & lead directory | ✅ | ✅ | ⏳ |
| Sales | `leads` | Lead queue | ✅ | ✅ | ⏳ |
| Sales | `customers` | Customer index | ✅ | ✅ | ⏳ |
| Sales | `sales` | Sales workspace | ✅ | ✅ | ⏳ |
| Sales | `sales-team` | Sales team management | ✅ | ✅ | ⏳ |
| Sales | `desk` / `desk-a-deal` | Desking a deal | ✅ | ✅ | ⏳ |
| Sales | `appraisal` / `appraisals` | Trade appraisal | ✅ | ✅ | ⏳ |
| Sales | `appointments` | Appointment calendar | ✅ | ✅ | ⏳ |
| F&I | `fni` / `fni-overview` | F&I dashboard | ✅ | ✅ | ⏳ |
| Inventory | `inventory` / `inventory-overview` | Vehicle inventory | ✅ | ✅ | ⏳ |
| Inventory | `inv-intel` | Inventory intelligence | ✅ | ✅ | ⏳ |
| Inventory | `recon` | Recon board | ✅ | ✅ | ⏳ |
| Inventory | `equity` | Equity mining | ✅ | ✅ | ⏳ |
| Service | `service` / `service-overview` | Service dashboard | ✅ | ✅ | ⏳ |
| Service | `service-appointments` | Service scheduling | ✅ | ✅ | ⏳ |
| Service | `service-ros` | Repair orders | ✅ | ✅ | ⏳ |
| Service | `service-parts` | Parts counter | ✅ | ✅ | ⏳ |
| Service | `service-settings` | Service configuration | ✅ | ✅ | ⏳ |
| Accounting | `accounting` / `accounting-overview` | Accounting workspace | ✅ | ✅ | ⏳ |
| Accounting | `acct-settings` | Accounting config | ✅ | ✅ | ⏳ |
| Accounting | `commissions` | Commissions | ✅ | ✅ | ⏳ |
| Marketing | `marketing-overview` | Marketing home | ✅ | ✅ | ⏳ |
| Marketing | `email-marketing` / `email-sms` | Email + SMS | ✅ | ✅ | ⏳ |
| Marketing | `automation` / `automation-builder` | Automations | ✅ | ✅ | ⏳ |
| Marketing | `studio` / `video-studio` | Studios | ✅ | ✅ | ⏳ |
| Marketing | `discoverability` / `seo` | SEO / discoverability | ✅ | ✅ | ⏳ |
| Marketing | `social-scheduler` | Social scheduler | ✅ | ✅ | ⏳ |
| Marketing | `facebook-poster` | Facebook auto-poster | ✅ | ✅ | ⏳ |
| Marketing | `blog` | Blog authoring | ✅ | ✅ | ⏳ |
| Marketing | `vin-sticker` | VIN stickers | ✅ | ✅ | ⏳ |
| Website | `website` / `website-settings` | Website builder | ✅ | ✅ | ⏳ |
| People | `people-overview` / `people-compliance` | HR / people | ✅ | ✅ | ⏳ |
| People | `academy` | Academy / training | ✅ | ✅ | ⏳ |
| Ops | `operations` | Operations workspace | ✅ | ✅ | ⏳ |
| Ops | `parts` / `parts-overview` | Parts inventory | ✅ | ✅ | ⏳ |
| Ops | `tasks` / `taskboard` | Task management | ✅ | ✅ | ⏳ |
| Ops | `reports` / `insights` | Reporting | ✅ | ✅ | ⏳ |
| Ops | `leaderboard` | Team leaderboard | ✅ | ✅ | ⏳ |
| Ops | `delivery` | Delivery workflow | ✅ | ✅ | ⏳ |
| Ops | `market` | Marketplace / launch | ✅ | ✅ | ⏳ |
| Ops | `launch` | Launch center | ✅ | ✅ | ⏳ |
| Ops | `api-keys` | API keys | ✅ | ✅ | ⏳ |
| Ops | `ai-vision` / `ai-inbox` | AI vision + inbox | ✅ | ✅ | ⏳ |
| Settings | `config` | Settings hub | ✅ | ✅ | ⏳ |
| Settings | `profile` | User profile | ✅ | ✅ | ⏳ |

## HQ (SaaS admin) pages (20)

Owner/admin-only pages after the Phase 1 IA freeze. RBAC is enforced by
`need('permission')` in `routes/saas-admin.js` — permission gate tests
live in `test/hq-pulse-command-center.test.js`.

| Group | Slug | Src | Nav | Run |
|-------|------|-----|-----|-----|
| Home | `saas-command` | ✅ | ✅ HQ | ⏳ |
| Home | `saas-intelligence` | ✅ | ✅ HQ | ⏳ |
| Customers | `saas-customers` | ✅ | ✅ HQ | ⏳ |
| Customers | `saas-trials` | ✅ | ✅ HQ | ⏳ |
| Customers | `saas-onboarding` | ✅ | ✅ HQ | ⏳ |
| Customers | `saas-health` | ✅ | ✅ HQ | ⏳ |
| Customers | `owner-users` | ✅ | ✅ HQ | ⏳ |
| Customers | `saas-product-usage` | ✅ | ✅ HQ | ⏳ |
| Revenue | `saas-billing` | ✅ | ✅ HQ | ⏳ |
| Revenue | `saas-entitlements` | ✅ | ✅ HQ | ⏳ |
| Revenue | `saas-funnel` | ✅ | ✅ HQ | ⏳ |
| Revenue | `saas-followups` | ✅ | ✅ HQ | ⏳ |
| Revenue | `saas-affiliates` | ✅ | ✅ HQ | ⏳ |
| Finance | `saas-accounting` | ✅ | ✅ HQ | ⏳ |
| People | `saas-employees` | ✅ | ✅ HQ | ⏳ |
| Marketing | `saas-website` / `saas-studio` / `saas-email-marketing` / `saas-automation` / `saas-announcements` | ✅ | ✅ HQ | ⏳ |
| AI Workforce | `saas-agents` | ✅ | ✅ HQ | ⏳ |
| Platform | `saas-integrations` / `saas-security` / `saas-audit` / `saas-usage` | ✅ | ✅ HQ | ⏳ |

## Standalone apps (8)

Every launcher iframes `/dashboard.html?embedded=<slug>` — one source of
truth, so a change in DealerOS automatically ships to the app.

| App | URL | Iframe target | Preload | Run |
|-----|-----|---------------|---------|-----|
| Appraisals | `/apps/appraisals.html` | `?embedded=appraisal` | ✅ | ⏳ |
| Video Studio | `/apps/video-studio.html` | `?embedded=video-studio` | ✅ | ⏳ |
| Design Studio | `/apps/design-studio.html` | `?embedded=design-studio` | ✅ | ⏳ |
| Website Studio | `/apps/website-studio.html` | `?embedded=website-studio` | ✅ | ⏳ |
| CRM | `/apps/crm.html` | `?embedded=crm` | ✅ | ⏳ |
| Email & SMS | `/apps/email-sms.html` | `?embedded=email-sms` | ✅ | ⏳ |
| Desking | `/apps/desking.html` | `?embedded=desking` | ✅ | ⏳ |
| Service Check-in | `/apps/service-checkin.html` | `?embedded=service-checkin` | ✅ | ⏳ |

## Buttons, modals, forms, tables

Per-page action inventory is generated on each run by the Playwright
harness spec `apps-and-workflows.spec.ts`. The spec crawls every route
in this matrix, records every visible button/link/modal trigger into
`docs/evidence/full-dealership-e2e/inventory/action-crawl.json`, then
runs the workflow specs against them.

Manual (non-crawlable) surfaces documented here:

- Deal desking modals — see `dashboard-part4.js` for the desking form set.
- F&I document generator — see `dashboard-part7.js` for PDF triggers.
- Service RO write-up + technician workflow — see `service-workspace.js`
  and `service-ro-mobile.js`.
- Academy course/quiz UI — see `academy-workspace.js`.
- HQ Customer 360 drawer — `hq-workspace.js`.

## What still needs environment access

Every ⏳ in the Run column requires:
1. A live staging URL that serves `dashboard.html` and `/apps/*.html`.
2. Per-role test accounts covering: dealer principal, GM, sales
   manager, salesperson, BDC, F&I manager, service manager, advisor,
   technician, parts, accounting, HR, marketing, HQ owner, HQ admin.
3. Twilio + email test destinations for the communications specs.
4. A Stripe test key wired to the backend for the F&I signature +
   payment specs.
5. A Supabase branch database (or a service-role key on a scratch
   project) so the harness can verify DB rows without touching production.
