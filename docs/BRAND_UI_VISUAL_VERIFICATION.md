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

## Scores

No PASS. Average remains **60.8**. 95+ = **0**.
Visual routing success does not raise brand/token/glass scores.

GLOBAL defects unchanged (record-only): indigo/violet actions, flat chrome, Demo chip, purple extension/chat, indigo Intelligence, Pulse placeholder subtitle, punch-clock intercept.

Phase 3 not started.
