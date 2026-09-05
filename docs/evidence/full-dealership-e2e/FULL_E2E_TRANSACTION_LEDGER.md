# FULL_E2E_TRANSACTION_LEDGER

Every major transaction created during the operational certification —
its ID in every module it touches. This is the "single test customer"
proof the brief requires: given the customer_id from Phase 6, every
subsequent phase's IDs are recorded here so the whole chain can be
walked in Supabase after the run.

## Test-data namespace

All identifiers in this ledger begin with `E2E-` so they are trivially
distinguishable from real dealership data and can be swept out of
staging on demand.

- Test dealership: `E2E Test Dealership` (id: `TBD-on-first-run`)
- Test customer: `E2E Test Customer`
- Test vehicle VIN: `TBD-realistic-VIN`
- Test employees:
  - Sales Manager: `E2E Sales Manager`
  - Salesperson: `E2E Salesperson`
  - BDC Rep: `E2E BDC Rep`
  - F&I Manager: `E2E FnI Manager`
  - Service Advisor: `E2E Service Advisor`
  - Technician: `E2E Technician`
  - Parts Employee: `E2E Parts`
  - Controller: `E2E Controller`

## Chain of custody

Each phase adds one row. A row is only accepted when the linked entity
is verified in the database, not just displayed in the UI.

| Phase | Entity | Created ID | Linked to | Evidence |
|-------|--------|------------|-----------|----------|
| 3 — Employees | `employees.id` | ⏳ | dealership | ⏳ |
| 4 — Inventory | `vehicles.id` | ⏳ | dealership, stock# | ⏳ |
| 5 — Appraisal | `appraisals.id` | ⏳ | customer, vin | ⏳ |
| 6 — CRM | `contacts.id` | ⏳ | dealership | ⏳ |
| 6 — Opportunity | `opportunities.id` | ⏳ | contact | ⏳ |
| 7 — Communication events | `communications.id[]` | ⏳ | contact | ⏳ |
| 8 — Appointment | `appointments.id` | ⏳ | contact, salesperson | ⏳ |
| 9 — Deal | `deals.id` | ⏳ | contact, vehicle, salesperson | ⏳ |
| 10 — F&I | deal_id + `deal_documents.id[]` | ⏳ | deal | ⏳ |
| 11 — Delivery | delivery event on deal | ⏳ | deal, inventory removal | ⏳ |
| 12 — Follow-up | task IDs | ⏳ | contact, salesperson | ⏳ |
| 13 — Service appointment | `service_appointments.id` | ⏳ | contact, vehicle | ⏳ |
| 14 — RO | `repair_orders.id` | ⏳ | appointment, advisor | ⏳ |
| 15 — Technician job | `ro_labor.id[]` | ⏳ | RO, technician | ⏳ |
| 16 — Additional auth | `ro_estimates.id[]` versioned | ⏳ | RO | ⏳ |
| 17 — Parts | `ro_parts.id[]` | ⏳ | RO, part_id | ⏳ |
| 18 — Invoice + close | `ro_invoices.id`, close event | ⏳ | RO, payment | ⏳ |
| 19 — Accounting | `gl_entries.id[]`, `hq_vendor_expenses.id[]` | ⏳ | deal, RO, expense uploads | ⏳ |
| 20 — Commission | `commission_events.id[]` | ⏳ | employee, deal/RO | ⏳ |
| 21 — Reports | ⏳ | reconcile totals against gl_entries | ⏳ |

## PDFs / attachments generated

| Document | Phase | Attached to | URL/storage key |
|----------|-------|-------------|-----------------|
| ⏳ | | | |

## Verification query pack

The `marketplace-backend/e2e/queries/` directory holds the SQL used to
verify each row. When the E2E harness runs, it captures the query
output as evidence next to the trace.

## Certification hook

`FULL_E2E_CERTIFICATION.md` cannot advance from `NOT CERTIFIED` until
this ledger contains a verified row for every phase and the final
acceptance-test walk (single customer → every downstream module)
completes.
