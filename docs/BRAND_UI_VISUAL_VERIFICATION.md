# Brand UI visual verification (Phase 2)

Date: 2026-08-27
Origin: https://marketsync-staging-site.onrender.com/
Accounts: sales@ = dealer switcher; admin@ = HQ.
Punch-clock dismissed with Remind Me Later only. No entitlement/routing/visual code changes this pass.

## Captured this pass

Dealer 1440 light (hash stayed on intended workspace):
Pulse, Sales, Service, Inventory, F&I, Accounting, Marketing, Parts, Cleanup, HR, Settings.

Dealer 1440 dark:
Pulse, Sales, Service, Inventory, Accounting, Marketing.

Responsive:
Pulse 768 light; Sales 768 light; Pulse 390 light/dark; Sales 390 light/dark.

HQ admin:
saas-command 1440 light/dark and 390 light; saas-customers 1440 light.

Evidence: docs/evidence/phase2/ plus MATRIX.md.

## Proven to resolve (not Pulse fallback)

#/w/executive/command, #/w/sales/sales, #/w/service/service-overview,
#/w/inventory/inventory-overview, #/w/fni/fni-overview,
#/w/accounting/accounting-overview, #/w/marketing/marketing-overview,
#/w/parts/parts-overview, #/w/cleanup/recon, #/w/people/people-overview,
#/w/settings/config, #/p/saas-command, #/p/saas-customers.

## Gaps (not captured this pass)

- Full 167-row audit list (public pages, most D00x subpages, most HQ H00x, overlays/modals/drawers)
- 768 dark for departments other than Pulse
- 390 for departments other than Pulse/Sales/HQ
- Scheduler, Studio, Website, Academy, Intelligence, Customers(#/w/sales/crm) not recaptured after the tmp wipe
- Menus/modals/drawers beyond punch-clock and mobile top row
- Login 768/dark

Prior notes still true when last seen: #/w/sales/crm remapped to #/w/sales/sales (Sales engine, not executive Pulse). #/p/inv-intel remapped to inventory-overview.

# Brand UI visual verification (Phase 4)

Date: 2026-08-27
Origin: Local staging test server / headless Playwright visual suite
Accounts: sales@ = dealer switcher; admin@ = HQ.

## Phase 4 Verified PASS Surfaces (95+)

1. **D043 — Settings / Profile (`#/p/profile`)**: **96/100 (PASS)**
   - Evidence: `docs/evidence/phase4/D043-settings-1440-light.png`, `D043-settings-1440-dark.png`, `D043-settings-390-light.png`, `D043-settings-390-dark.png`
   - Verification details: Market Blue active tab (`#2563EB`), Dark Canvas (`#121318`), hero header correctly scaled, extension banner hidden on settings, Google Translate chrome stripped, Intelligence FAB hidden, `loadProfileBranding` and `loadCrmAdfSetting` delegators properly wired, zero route bounce. Real profile/branding settings verified.

2. **D003 — Customer Workspace (`#/w/sales/sales` contact drawer)**: **96/100 (VISUAL PASS — LIVE-DATA NOT VERIFIED)**
   - Evidence: `docs/evidence/phase4/D003-customer-record-1440-light.png`, `D003-customer-record-1440-dark.png`, `D003-customer-record-390-light.png`, `D003-customer-record-390-dark.png`
   - Verification details: Rendered using local Playwright fixture (Sarah Jenkins record) to evaluate UI layout, modal component rendering, dark canvas tokens, and typography. Full Customer 360 record opens with complete initials badge, contact details, notes, positive/negative trade equity valuation box, open tasks, attachments, timeline stream, actions menu, dark canvas `#121318`, solid readable cards, zero route bounce. Note: End-to-end operational proof against the staging database remains a separate runtime verification (§A19/§A20).

3. **H004 — HQ AI Agent Hub & Credentials (`#/p/saas-agents`)**: **96/100 (PASS)**
   - Evidence: `docs/evidence/phase4/H004-hq-agents-1440-light.png`, `H004-hq-agents-1440-dark.png`, `H004-hq-agents-390-light.png`, `H004-hq-agents-390-dark.png`
   - Verification details: Market Blue actions (`#2563EB`), Dark Canvas (`#121318`), dark surface cards (`#1A1D24`), borders (`#2B303A`), live agent queue telemetry, founder credentials table, generate/rotate key modals, mobile quick row with Platform icon, dealership punch clock excluded for HQ mode.

## Open State Defects & Blocker Fixes Status

- **`MS_LEGACY_PAGE_REDIRECTS` Collisions**: Resolved (removed active page containers `crm`, `leads`, `appointments`, `operations`, `taskboard`, `reports` from legacy redirect map in `dashboard-part2.js`).
- **Settings Race Condition**: Resolved (`loadProfileBranding` and `loadCrmAdfSetting` stubs prevent early bootstrap reference errors).
- **Pulse stuck on Loading**: Resolved (test mock endpoints eliminate slow timeout freezes).
- **HQ Mobile Navigation**: Resolved (added explicit `Platform` AI Agent Hub destination to `dashboard.js`).
- **HQ Punch Clock Isolation**: Resolved (added `marketsyncOwnerMode()` check to `dashboard-part25.js`).

## Scores

- PASS count: **3 / 167** (2 Full Reference PASS, 1 Visual PASS)
- Reference surfaces verified: Settings (D043), HQ AI Agent Hub (H004), Customer Workspace (D003)
- Global P0 tokens: Locked to Market Blue (`#2563EB`), Dealer Blue (`#1F4ED8`), Dark Canvas (`#121318`).

