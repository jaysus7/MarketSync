# Reporting & Intelligence — architecture map (R1)

Staging only. Canonical MarketSync entities remain source of truth.

## Existing surfaces reused (KEEP)

- `marketplace-backend/routes/reports.js` — department report endpoints on `deals`, `leads`, `contacts`, `inventory`, `crm_tasks`, `trade_appraisals`, `marketing_campaigns`
- `marketplace-backend/routes/submodules/dashboard-reports.js` — analytics summary
- `marketplace-backend/services/dealership-intelligence/*` — attention, briefs, semantic governance stubs
- Liquid Glass / workspace registry — do not add 1,400 sidebar items

## New layer (BUILD, additive)

`marketplace-backend/services/reporting/`

- metric-registry — deterministic formulas
- dimension-registry — approved slices including season
- query-engine — plan + fixture/canonical compute, aggregated transport only
- report-library — 1,400 seeded definitions
- report-lab — metric × ≤5 dimensions
- ai-query-layer — maps language onto registries only
- insights-engine — sample floors, correlation labels
- actions — handoff IDs to existing engines
- saved-reports — tenant-scoped definitions + schedule

HTTP: `/reporting/*` via `routes/reporting-intelligence.js`

Persistence: `migrations/2026-09-03-reporting-intelligence.sql` (defs/saved/audit only)

## Not done in this slice

- Live Supabase aggregation RPCs for every metric (engine executes fixtures + existing table names; production RPC materialization is R12 follow-on)
- Full Liquid Glass department hubs in dashboard.js (guardrail: do not feature-split dashboard)
- Applying the SQL migration to hosted staging (needs operator/supabase apply)
