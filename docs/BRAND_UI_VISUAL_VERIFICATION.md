# Brand UI visual verification (Phase 2)

Date: 2026-08-26
Origin: https://marketsync-staging-site.onrender.com/
Accounts: sales@marketsync.link = dealer switcher; admin@marketsync.link = HQ.
Auth: normal /login.html via headless Chrome. No production auth change. No clock-in/billing/user writes.

## Coverage

| Surface | 1440 light | 1440 dark | 768 | 390 light | 390 dark |
|---|---|---|---|---|---|
| Login | Yes | No | No | Yes | No |
| Pulse / My Day | Yes | No | No | No | No |
| Punch-clock modal | Yes | No | No | No | No |
| Other DealerOS departments | Hash stayed on Pulse | — | — | — | — |
| HQ | Capture timed out | — | — | — | — |

Evidence:
- docs/evidence/phase2/sales-pulse-1440-light-clear.png
- docs/evidence/phase2/sales-myday-1440-light.png

## Scores (inspected only)

| Route | Score | Status |
|---|---|---|
| Login 1440/390 light | 78 / 76 | NEEDS WORK |
| Pulse 1440 light | 71 | NEEDS WORK |
| Punch clock modal | 74 | NEEDS WORK |
| All other required routes | — | NEEDS WORK |

PASS 0. Average still 60.8.

## Classification

GLOBAL: indigo/violet Sign In, purple extension CTA, purple chat FAB, indigo Intelligence FAB, Demo chip, flat header/sidebar vs functional glass.

AREA: DealerOS hash routes did not leave Pulse in this session.

ROUTE: Pulse placeholder subtitle; purple Marketplace banner.

STATE: Punch-clock modal intercepts first load; #/w/{dept} did not activate departments.

## Queue (Phase 3 not started)

P0: Market Blue buttons/FABs; glass on header/sidebar/sheet; workspace routing.
P1: Pulse copy/banner; punch-clock icon tokens.
P2: department pages after routing works.
P3: HQ + remaining viewport/theme matrix.
