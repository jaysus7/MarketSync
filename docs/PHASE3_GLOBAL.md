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
