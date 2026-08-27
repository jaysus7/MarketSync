# Phase 3 P0 — global shared system

Commits: `72cb559`, `716c1ac`

## Files
- marketplace-frontend/css/ms-phase3-global.css (new)
- marketplace-frontend/css/dashboard-nav.css (indigo→violet remaps removed)
- marketplace-frontend/dashboard.html (link + header.ms-chrome-glass)
- marketplace-frontend/login.html (shared Sign In token)

## Tokens removed/replaced
- `.bg-indigo-500` remap `#8b5cf6` → `#1F4ED8`
- `.bg-indigo-700` remap `#6d28d9` → `#153AA6`
- lavender canvases `#faf8ff` / `#0f0a1e` → `#F8FAFC` / `#0B1220`
- `.bg-violet-600`, `.bg-purple-600` action utilities → `#2563EB`
- staff-chat FAB `from-indigo-600 to-violet-600` overridden to Market Blue

Status green/amber/red untouched. Department wayfinding tokens in ms-design-system.css left as-is.

## Glass
Header and `#dashboard-nav` use Layer-2 glass. Content cards unchanged.

## Evidence
docs/evidence/phase3/ Pulse, Sales, Service, Inventory, Accounting, Marketing, HQ.

## Scores
No route at 95+. Shell color improved on captured routes. Average remains **60.8** until a full re-score pass. Phase 4 not started.


## Follow-up `64f4217`

Staff-chat FAB source + CSS kill gradient. Login Sign In confirmed Market Blue.
Chat FAB confirmed Market Blue on Pulse light and Sales dark.
Evidence: docs/evidence/phase3/A001-login-*.png, R-pulse-1440-light.png, R-sales-1440-dark.png.

## Phase 3 P0 closed `9dbdded`

Shared system work for this phase is complete:
- Market Blue token lock on actions/FABs/Sign In
- indigo→violet remaps removed
- header/sidebar/mobile sheet glass
- dark canvas #0B1220
- chat FAB Market Blue

Not in Phase 3 (deferred to Phase 4):
- department cards/tables/copy
- route-by-route 95+ scoring
- full 167-route matrix

PASS 0. Average ~61. Do not treat Phase 3 close as product-complete.
