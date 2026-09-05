# MarketSync E2E harness

Playwright-based operational certification for MarketSync DealerOS.

## What this is

A structured harness that runs the full-dealership certification
described in `docs/evidence/full-dealership-e2e/README.md`. Each spec
mirrors one phase of the certification brief.

**Zero specs execute against production**. Every spec requires
`E2E_BASE_URL` pointed at a staging environment and per-role storage
state files under `auth/` (git-ignored).

## Layout

```
e2e/
├── playwright.config.ts    — projects (roles + devices), reporters, output dirs
├── specs/
│   ├── apps-shell.spec.ts               — /apps/*.html shared-shell contract (Phase 0)
│   ├── setup-employee.spec.ts           — Phase 3 (todo)
│   ├── setup-inventory.spec.ts          — Phase 4 (todo)
│   ├── crm-lead.spec.ts                 — Phase 6 (todo)
│   ├── desk-deal.spec.ts                — Phase 9 (todo)
│   ├── fni-and-delivery.spec.ts         — Phases 10–11 (todo)
│   ├── service-lifecycle.spec.ts        — Phases 13–18 (todo)
│   ├── accounting-and-payroll.spec.ts   — Phases 19–20 (todo)
│   ├── role-gating.spec.ts              — cross-role permission attempts (todo)
│   └── final-acceptance.spec.ts         — single-customer walk (todo)
├── auth/                   — per-role storageState.json files (git-ignored)
└── queries/                — SQL used to verify DB rows (todo)
```

## Running

Install once:

```
cd marketplace-backend
npm install --save-dev @playwright/test
npx playwright install chromium
```

Then run against a staging URL:

```
E2E_BASE_URL=https://staging.marketsync.link \
E2E_MANAGER_EMAIL=... E2E_MANAGER_PASSWORD=... \
npx playwright test
```

## Auth fixtures

Every role project in `playwright.config.ts` reads a
`storageState` JSON produced by a login helper. Generate them once,
then re-use across runs:

```
node scripts/mint-e2e-auth.mjs  # (todo — writes auth/*.json)
```

Storage state files carry session cookies — never commit them.
`.gitignore` at repo root already excludes `auth/*.json`.

## What runs today, what needs setup

- `apps-shell.spec.ts` — runs today against any URL that serves
  `/apps/*.html` and `/dashboard.html`. Public, no auth required.
- Everything else in `specs/` — stubbed, requires per-role auth
  fixtures and a Supabase branch DB. See
  `docs/evidence/full-dealership-e2e/FULL_E2E_CERTIFICATION.md` for
  the full blocker list.
