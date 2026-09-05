# FULL_E2E_DATA_LINEAGE

The single "cross-module rule" from the certification brief: one
customer's data flows Customer → Vehicle → Lead → Appointment →
Appraisal → Deal → F&I → Delivery → Commission → Accounting → Service
Appointment → RO → Technician Work → Parts → Invoice → Payment →
Reporting — **and stays connected**.

This document reasons about that connection from source, table by
table, so the E2E harness has a spec to write regression queries
against.

## Cross-module dependency map

```
                   ┌─────────────┐
                   │  contacts   │  (CRM)
                   └──────┬──────┘
                          │ contact_id
        ┌─────────────────┼─────────────────┬────────────────┐
        ▼                 ▼                 ▼                ▼
 ┌────────────┐   ┌──────────────┐   ┌────────────┐   ┌─────────────┐
 │appointments│   │opportunities │   │appraisals  │   │communications│
 └─────┬──────┘   └──────┬───────┘   └──────┬─────┘   └──────┬───────┘
       │ appt_id         │ opp_id           │ appr_id        │ event_id
       ▼                 ▼                  ▼                ▼
  (calendar)      ┌────────────┐      (vehicle intake)   (timeline)
                  │   deals    │◄─── vehicle_id
                  └─────┬──────┘        │
                        │ deal_id       │
     ┌──────────────────┼───────────────┴──────────────┐
     ▼                  ▼                              ▼
┌──────────────┐  ┌──────────────┐              ┌────────────┐
│deal_documents│  │commission_events│           │  vehicles  │
└──────────────┘  └──────┬───────┘              └─────┬──────┘
                         │                            │ vin
                         ▼                            ▼
                  ┌──────────────┐            ┌────────────────────┐
                  │  gl_entries  │            │  service_appointments │
                  └──────────────┘            └─────┬──────────────┘
                                                    │ svc_appt_id
                                                    ▼
                                              ┌────────────┐
                                              │repair_orders│
                                              └─────┬──────┘
                                        ┌──────────┼──────────┐
                                        ▼          ▼          ▼
                                 ┌──────────┐┌─────────┐┌───────────┐
                                 │ ro_labor ││ro_parts ││ro_estimates│
                                 └──────────┘└─────────┘└───────────┘
```

## Reference-integrity spec

Every arrow above is a foreign key. The E2E harness verifies each edge:

1. **`opportunities.contact_id` → `contacts.id`** — a delivered deal
   must trace back to the CRM contact.
2. **`appraisals.contact_id` → `contacts.id`** and
   **`appraisals.vin`** — trade appraisal must match the appointment's
   customer.
3. **`deals.contact_id` → `contacts.id`**, **`deals.vehicle_id` →
   `vehicles.id`**, **`deals.salesperson_id` → `employees.id`**.
4. **`deal_documents.deal_id` → `deals.id`** — every generated PDF
   attaches to its deal.
5. **`commission_events.deal_id` → `deals.id`** and
   **`.employee_id` → `employees.id`** — commissions actually post for
   the salesperson.
6. **`gl_entries.source_id` → `deals.id` OR `repair_orders.id`** —
   revenue is recognized against a real transaction.
7. **`service_appointments.contact_id` → `contacts.id`** and
   **`.vehicle_id` → `vehicles.id`** — the returning service customer
   is the same person who bought the car.
8. **`repair_orders.service_appointment_id`**,
   **`.advisor_id`**, **`.vehicle_id`**, **`.contact_id`** — RO carries
   the full context.
9. **`ro_labor.technician_id` → `employees.id`** and
   **`ro_labor.ro_id` → `repair_orders.id`**.
10. **`ro_estimates` versioning** — additional-authorization workflow
    keeps immutable prior versions.
11. **`ro_invoices.ro_id` → `repair_orders.id`** and payment records
    reconcile with `gl_entries`.

## Final acceptance query

The brief's final acceptance walks one customer end-to-end. The
harness's `final-acceptance.spec.ts` runs this exact question set:

- Where did the lead come from? (`contacts.source`, `communications` first event)
- Who contacted them? (`communications.actor_id` for the first outbound)
- What messages were sent? (`communications` where `contact_id = X`)
- What appointment did they attend? (`appointments` where completed = true)
- What vehicle were they interested in? (`opportunities.vehicle_of_interest_id`)
- What vehicle did they trade? (`appraisals.vin`)
- Who approved it? (`appraisals.approved_by`)
- What deal was desked? (`deals` where `contact_id = X`)
- What products did F&I sell? (`deal_products` join)
- What PDFs were generated? (`deal_documents` where `deal_id = X`)
- Who sold it? (`deals.salesperson_id`)
- How much commission? (`commission_events` where `deal_id = X`)
- What GL entries resulted? (`gl_entries` where `source_id in (deal_id, ro_id)`)
- When did the vehicle leave inventory? (`vehicles.sold_at`)
- When did they return for service? (`service_appointments.first_visit`)
- Who checked them in? (`service_appointments.advisor_id`)
- Which technician worked on it? (`ro_labor.technician_id`)
- What parts? (`ro_parts` where `ro_id = X`)
- What additional work was authorized? (`ro_estimates.version > 1`)
- What invoice? (`ro_invoices` where `ro_id = X`)
- What did they pay? (`ro_invoices.total_paid`)
- What profit? (`gl_entries.gross` computed for deal + RO)
- Where are the documents? (`deal_documents` + `ro_attachments` URLs)
- Where are the audit logs? (`audit_log` where `subject_id in (...)`)
- Do the management reports reconcile? (`reports_sales_overview` totals
  vs `gl_entries` sums for the same period)

If any one of these can't be answered from stored data, the
certification fails.
