# Brand UI visual verification (Phase 2)

Date: 2026-08-26  
Origin: `https://marketsync-staging-site.onrender.com/`  
Accounts used: staging QA identities supplied in-chat. Password not stored in this file.  
API check: `POST https://marketsync-staging-backend.onrender.com/auth/login` returned 200 for `admin@marketsync.link`. No dealership/customer/billing writes.

## What rendered

| Route | Viewport | Theme | Evidence | Score | Status |
|---|---|---|---|---|---|
| Login | ~1440 | Light | Live screenshot this pass | 78 | NEEDS WORK |
| Login | ~390 | Light | Live screenshot this pass | 76 | NEEDS WORK |
| Login | 768 / dark | — | Not captured | — | NEEDS WORK |
| My Day through HQ | 1440 / 768 / 390 × L/D | — | Browser tool did not execute page JS to persist the session or submit the form. Authenticated shell never appeared. | — | NEEDS WORK |

## Login defects (GLOBAL)

- STATE / GLOBAL: Sign In uses `bg-indigo-600` and reads purple-indigo, not Market Blue `#2563EB`. Recorded only; not fixed this phase.
- GLOBAL: focus ring `focus:border-indigo-500`.
- GLOBAL: dark login not verified in this browser (stayed light).
- Content card is opaque. Correct Liquid Glass (none on the form).

## Authenticated routes

Not visually opened in this environment after credentials were provided. Do not score them as PASS or as newly inspected.

## Classification

- GLOBAL: primary button token on auth.
- AREA / ROUTE / STATE for DealerOS+HQ: unchecked this pass.

## Not done

Phase 3. Data changes. Production.
