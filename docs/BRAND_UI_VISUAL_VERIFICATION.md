# Brand UI visual verification (Phase 2)

Date: 2026-08-26
Origin: https://marketsync-staging-site.onrender.com/
Accounts: sales = dealer switcher; admin = HQ.

## Routing blocker resolved

Not an entitlement miss. sales@ is DEALER_ADMIN on dealer-os-complete with os.crm.

Bugs:
1. `#/w/sales` ignored (parser required `#/w/{ws}/{page}`). Commit 1d2ab54.
2. Post-auth boot used `msRouteFromHash().page` while the helper returns a string, so bootPage was null and DEALER_ADMIN fell back to Pulse. Commit 67e7c79.

Live check: `#/w/sales/sales` remains Sales. Sidebar Sales active. Sales Pulse visible.
Evidence: docs/evidence/phase2/sales-workspace-1440-light.png

## Scores

Login 76-78. Pulse 71. SalesOS 1440 light 72. Punch modal 74. PASS 0. Average 60.8.

Remaining required routes/viewports not fully captured after the fix (headless timeouts). Phase 3 not started.

GLOBAL defects remain record-only (indigo Sign In, purple extension/chat, indigo Intelligence, Demo chip, flat chrome, Pulse subtitle, punch-clock intercept).
