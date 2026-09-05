# MarketSync DealerOS — Full End-to-End Dealership Certification

This directory holds every artifact produced by the operational
certification of MarketSync DealerOS as specified in the finalization
brief. The certification proves whether a real dealership could operate
from opening to closing entirely inside MarketSync, without leaving the
system.

## Living documents

| File | Purpose |
|------|---------|
| [`FULL_E2E_MASTER_MATRIX.md`](./FULL_E2E_MASTER_MATRIX.md) | Every route, page, modal, button, action + status |
| [`FULL_E2E_DEFECT_REGISTER.md`](./FULL_E2E_DEFECT_REGISTER.md) | All defects: severity, repro, root cause, fix, evidence |
| [`FULL_E2E_TRANSACTION_LEDGER.md`](./FULL_E2E_TRANSACTION_LEDGER.md) | Every major transaction created + its IDs |
| [`FULL_E2E_DATA_LINEAGE.md`](./FULL_E2E_DATA_LINEAGE.md) | Customer → Vehicle → Deal → Accounting → Service → Reporting chain |
| [`FULL_E2E_CERTIFICATION.md`](./FULL_E2E_CERTIFICATION.md) | Final certification decision |

## Two sources of truth

Every entry is tagged with one of:

- **SOURCE-VERIFIED** — established by reading the repository (routes,
  API endpoints, permission gates, migrations). Reliable without
  environment access.
- **ENVIRONMENT-DEPENDENT** — requires a running staging URL, per-role
  test accounts, browser automation, or an integration credential
  (Stripe test key, Twilio test destination, Supabase service role).
  Cannot be verified from a static repository check.

The initial pass populated everything that is SOURCE-VERIFIED. The
remaining ENVIRONMENT-DEPENDENT rows document exactly what must be
executed and against which URL/account to complete the certification.

## Running the E2E harness

The Playwright harness lives in
[`marketplace-backend/e2e/`](../../../marketplace-backend/e2e/). Once the
staging URL and per-role test accounts are provisioned:

```
cd marketplace-backend
E2E_BASE_URL=https://staging.marketsync.link \
E2E_MANAGER_EMAIL=... E2E_MANAGER_PASSWORD=... \
npx playwright test
```

Every spec streams into `docs/evidence/full-dealership-e2e/traces/` so
the run is independently reviewable.

## Certification status

**NOT CERTIFIED — awaiting environment execution.** See
`FULL_E2E_CERTIFICATION.md` for the exact blockers.
