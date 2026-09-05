# FULL_E2E_CERTIFICATION

**Status: NOT CERTIFIED**

_Last updated: 2026-09-05 (initial scaffold, source-only pass)._

## Certification decision

Per the finalization brief, MarketSync DealerOS is **NOT CERTIFIED**
until every one of the following is true:

- [ ] 100% of discovered critical routes tested against a live env
- [ ] 100% of P0 defects resolved
- [ ] 100% of P1 defects resolved
- [ ] Complete sales lifecycle passes end-to-end (Phases 3–12)
- [ ] Complete service lifecycle passes end-to-end (Phases 13–18)
- [ ] Complete accounting lifecycle reconciles (Phases 19–21)
- [ ] Employee / commission workflow passes (Phases 20 + role gating)
- [ ] Documents persist across sessions (Phase 22)
- [ ] Communication history persists (Phase 7 + 23)
- [ ] Reports reconcile with source transactions (Phase 21)
- [ ] Permissions proven via actual failed API attempts (role gating)
- [ ] No unexplained backend errors during golden-path (Phase 23)

Zero of those gates are currently green because none of the
environment-dependent execution passes have run — see "Environment
blockers" below.

## What the source-only pass established

- **91** dealer + HQ page slugs inventoried
  (`inventory/frontend-slugs.txt`).
- **1127** backend endpoints inventoried
  (`inventory/backend-endpoints.txt`).
- Route/loader dispatch cleaned up (commits `40d45ab`, `1fe22c9`).
- HQ shared UI primitives + Phase 5 state handling
  (commit `4cf1ef3`).
- Standalone apps foundation + shared-source iframe pattern
  (commits `fffb244`, `5d725a6`, this commit for fast-load preload).
- 20 apps-standalone contract tests + 9 HQ-UI contract tests all green.
- Baseline `npm test`: 2318 pass / 56 pre-existing fail (unchanged).

## Environment blockers (cannot certify from a repo container)

Certification requires all of:

1. **Live staging URL** exposing `dashboard.html` and `/apps/*.html`.
2. **Per-role test accounts** for the 12 dealership roles named in the
   brief plus HQ owner / HQ admin.
3. **Test Twilio destination** for SMS verification.
4. **Test email inbox** for delivery verification.
5. **Stripe test key** wired to backend for F&I payment path.
6. **Supabase branch DB or scratch project** so the harness can verify
   rows without touching production data.
7. **Playwright runtime** with browser binaries — the harness is
   installed in `marketplace-backend/e2e/` and runs
   `npx playwright test`.

When those are provisioned, the harness in
`marketplace-backend/e2e/` executes every phase and streams evidence
into `docs/evidence/full-dealership-e2e/traces/`.

## Ready to run

`marketplace-backend/e2e/playwright.config.ts` — reads the environment
variables listed above and points every spec at `E2E_BASE_URL`. Run:

```
cd marketplace-backend
E2E_BASE_URL=https://staging.marketsync.link \
E2E_MANAGER_EMAIL=... E2E_MANAGER_PASSWORD=... \
npx playwright test
```

Each spec updates `FULL_E2E_TRANSACTION_LEDGER.md` and appends findings
to `FULL_E2E_DEFECT_REGISTER.md`, then this document flips to CERTIFIED
once every check above is ticked.

## Scoring template (for the harness to populate)

| Metric | Discovered | Tested | % |
|--------|-----------:|-------:|--:|
| Frontend routes | 91 | 0 | 0% |
| Backend endpoints | 1127 | 0 | 0% |
| Roles | 14 target | 0 | 0% |
| E2E workflows | 25 phases | 0 | 0% |
| PDFs generated & verified | — | 0 | — |
| Defects P0 open | — | 0 | — |
| Defects P1 open | — | 0 | — |
| Defects P2 open | — | 0 | — |
| Defects P3 open | — | 0 | — |

**Operational readiness score: NOT MEASURED — awaiting execution.**
