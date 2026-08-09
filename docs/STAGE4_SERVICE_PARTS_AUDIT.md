# Stage 4A audit — Service & Parts (Fixed Operations), before code

Audit of `staging` @ `6916db2` per the Stage 4 brief, Parts A1–A31. Baseline at the
time of audit: **441/441 tests, all six `check:*` green**.

Evidence is drawn from three sources, in this order of authority:

1. the **live staging schema** (`information_schema`, project `hpxnjbdiaaoopxeayfen`)
2. the **executable source** (`routes/*.js`), not the design docs
3. the design docs (`docs/SERVICE_PARTS_ENGINE_STAGE0.md`), used only to state intent

Where a Stage 0 doc and the running code disagree, **the code and schema win** and the
disagreement is recorded as a finding.

> **Read §31 first if you are here to build.** Stage 4A ends at a STOP GATE. Nine
> G3–G6 gaps block dependent UI and need decisions before Stage 4B starts.

---

## 0. Executive summary

MarketSync has a **real but shallow** fixed-ops engine. `repair_orders`, `ro_lines`,
`parts` and `part_txns` exist, are tenant-scoped, emit events, and close through a
balanced journal. That is a genuine foundation and **nothing in it should be rebuilt**.

What it does not have is the *middle* of the dealership workflow. Of the 22 arrows in
the target Fixed Ops flow, **9 correspond to a real canonical transition**, 4 are
derivable, and **9 have no representation at all**. The missing ones cluster in exactly
the places money and liability live: authorization, parts demand/reservation, pay type,
payment, and the ready-vs-closed distinction.

Five findings are material enough to name up front:

| # | Finding | Class |
|---|---|---|
| F1 | **Service revenue posts pre-tax to AR, and sales tax is never credited.** `revenue` = subtotal *before* tax (`service-engine.js:194`), but the customer owes `total` (incl. tax). AR is understated by the tax on every RO and there is no tax liability line. | **G5** |
| F2 | **Parts inventory is only ever relieved, never capitalized.** `service_closed` credits `parts_inventory`; **no event debits it**. `parts.received` has no case in `routeFinancialEvent` (`accounting-engine.js:210-238`). Parts inventory drifts negative on the books, permanently. This is the Stage 3 dangling-producer pattern, inverted: a live consumer with no counterpart producer. | **G5** |
| F3 | **There is no payment.** `service_closed` debits `accounts_receivable` and nothing ever clears it. Every closed RO sits in AR forever, regardless of how the customer paid. | **G5** |
| F4 | **There is no customer authorization of any kind** — no table, no column, no route, no signature link. MarketSync cannot prove what a customer approved. | **G4/G6** |
| F5 | **There is no parts demand object.** Nothing represents "RO 123 needs part X, qty 2". Stock moves only at RO *close*, so a part is drawn from inventory **after** the work is already done, and `awaiting_parts` is a status with no data behind it. | **G3/G4** |

Two smaller findings are outright bugs rather than gaps, and are cheap to fix:

- **B1** — `GET /service/appointments` selects a column that does not exist
  (`crm_tasks.status`, `service.js:81`). Verified three ways: `crm_tasks` has no `status`
  column on staging; **no migration in the repo adds one**; and `service.js:81` is the
  only line in the entire backend that selects it. PostgREST errors, the route ignores
  the error (`const { data: rows } = await q`) and returns `rows || []`, so
  **the service appointment list is silently empty for every dealership.**
  `PUT /service/appointments/:id` writes the same non-existent column, but only when a
  caller supplies `status` — the dashboard sends `done`, so the write path fails only on
  the unused branch. → *Confirm against production before assuming the same there.*
- **B2** — `service.view` and `service.reopen_repair_order` are real permissions granted
  to real roles, referenced by **zero** lines of code. Every `/service-engine/*` route —
  including the reads — requires `service.write_repair_order`. Consequence:
  **`general_manager` and `accounting` cannot read a repair order at all**, and
  **`technician` can close ROs and trigger journal postings.**

---

## 1. Customer model (A1)

**Canonical record: `contacts`.** Unified with Sales — the Stage 0 intent ("one record,
two relationships") is implemented and correct.

- `repair_orders.contact_id → contacts.id`
- `service.js:108` calls `findOrCreateContact(...)` with `source: 'Service'`, so a
  service-only walk-in becomes a normal contact and is deduplicated by the CRM's own
  matching. **Service works for a customer who was never a Sales lead.** (A1 Q4 ✅)
- `contacts.service_customer` is flipped `true` on booking (`service.js:119`, `:167`),
  which is a flag, not a second record. Correct.

`repair_orders.contact_id` is **nullable** — an RO can exist with no customer. No route
enforces it. Low severity, but it means "who owes this money" is optional.
→ **G2 (minor)**

## 2. Customer-owned vehicle model (A1)

**This is the most structurally significant finding in the audit, and it is not a bug —
it is an absence.**

There is **no vehicle entity other than `inventory`**, which models *dealer-owned stock*.
Confirmed against the live schema: the only vehicle-ish tables are `inventory`,
`vehicle_brochures`, `vehicle_history_reports`, `vehicle_model_specs`. There is no
`customer_vehicles`, no ownership join, nothing.

What an RO actually stores for vehicle identity (A1 Q5):

| Column | Type | Meaning |
|---|---|---|
| `inventory_id` | uuid, nullable | dealer-owned unit, when applicable |
| `vehicle_desc` | text, nullable | **free text** |
| `vin` | text, nullable | **free text, no uniqueness, no FK** |
| `odometer` | integer, nullable | point-in-time reading |

So, answering A1 precisely:

1. **How is a customer-owned vehicle represented today?** As *free text on the RO*
   (`vehicle_desc` + `vin`). It is not an entity. It has no history, no ownership link,
   no service history of its own.
2. **Can a sold vehicle stay recognizable after leaving inventory?** Partially. The
   `inventory` row survives (`archived_at`, shown as "sold" for 2 weeks then hidden —
   `routes/inventory.js:348`), so `inventory_id` on an old RO still resolves. But there
   is no "this customer owns this VIN" relationship, so nothing *connects* the customer
   to it after the sale.
3. **Can the same VIN return for service without creating duplicates?** There is
   nothing to duplicate — no vehicle row is created. The cost is the inverse problem:
   **the same VIN cannot be recognized across visits.** Two ROs for the same car are
   two unrelated free-text strings. No service history per vehicle is possible.
4. **Can Service operate for a non-Sales customer?** ✅ Yes (see §1).
5. **What does an RO reference for vehicle identity?** `inventory_id` **or** free text —
   and nothing forces either.

**Consequence.** Vehicle-centric fixed-ops work is impossible: no service history per
vehicle, no maintenance intervals, no mileage trend, no recall matching, no declined-work
follow-up tied to a car, no equity/retention signal from Service.

**Correct minimal fix (proposed, needs approval):** a `customer_vehicles` table —
`(dealership_id, vin)` unique, with `contact_id`, year/make/model/trim, plate,
`current_odometer`, and a **nullable** `origin_inventory_id` linking back to the
dealer-stock row it was sold from. `repair_orders` gains a nullable
`customer_vehicle_id`. Existing `inventory_id`/`vin`/`vehicle_desc` stay, so nothing
breaks and no backfill is required.

Explicitly **NOT** the fix: creating `inventory` rows for customer cars. That would
corrupt stock counts, merchandising, pricing, syndication and the Stage 3 acquisition
model. The brief forbids it and it is the right call.

→ **G3 (missing canonical state)** — blocks vehicle-centric UI, retention and history.

## 3. Service appointment model (A2)

**Appointments are `crm_tasks`, not a Service object.** `type='appointment'`,
`category='service'` (`service.js:113`).

| A2 field | Reality |
|---|---|
| canonical table | `crm_tasks` |
| customer link | `contact_id` ✅ |
| **vehicle link** | **none** — no column, no free text |
| service concern | packed into `title` + `service_type`; notes go to a `communications` row (`service.js:120`) |
| advisor | `assigned_to` ✅ |
| date/time | `due_at` ✅ |
| status | **`crm_tasks` has no `status` column** (verified). Only `done` / `done_at`. |
| arrival state | none |
| no-show / cancel | none — `done` is the only terminal state, and it cannot distinguish "serviced" from "no-showed" |
| conversion to RO | `repair_orders.appointment_task_id` exists ✅ but **no route sets it from an appointment** |
| reminders | none Service-specific; a `communications` note is written on booking |

**The state model is: scheduled (`done=false`) → done (`done=true`).** That is all.

**What exact transition converts an appointment into active Service work?** *None
exists.* `POST /service-engine/ros` accepts `appointment_task_id` in its body
(`service-engine.js:329`) but nothing in the product ever supplies it. There is no
check-in route, no arrival timestamp, no conversion endpoint. The link is a parameter
waiting for a caller.

→ **G3** (appointment status/arrival/no-show) and **G2** (appointment↔vehicle,
appointment↔RO conversion). Plus bug **B1** above.

## 4. Appointment → RO transition & idempotency (A3)

**Not implemented, therefore not idempotent.**

- No check-in endpoint exists.
- `POST /service-engine/ros` creates a **new RO unconditionally** every time it is
  called (`openRepairOrder`, `service-engine.js:101`). There is no lookup on
  `appointment_task_id`, no unique index, no conflict target.
- Therefore: **clicking check-in twice would create two ROs.** Customer continuity would
  hold (same `contact_id`), vehicle continuity would not (free text), concern continuity
  would not (`complaint` is retyped).
- `ro_number` is generated from `count(*) + 1` (`service-engine.js:93-96`) — a
  **race-prone, non-atomic** sequence. Two concurrent opens produce duplicate RO numbers.

**Minimum fix:** a `POST /service-engine/ros/from-appointment/:taskId` that is idempotent
on `appointment_task_id` (partial unique index `where appointment_task_id is not null`),
returning the existing RO on repeat — exactly the pattern Stage 3A used for
`funding.received`. Plus a real sequence for `ro_number`.

→ **G4 (missing business transaction)** + **G2**. Blocks the Drive/check-in UI.

## 5. Repair order state machine (A4)

Live schema (`repair_orders`, 33 columns). Present and meaningful:

`id · dealership_id · ro_number · contact_id · inventory_id · vehicle_desc · vin ·
odometer · advisor_id · technician_id · status · complaint · labor_total · parts_total ·
sublet_total · fee_total · discount · tax · total · labor_cost · parts_cost ·
appointment_task_id · opened_at · promised_at · closed_at · created_by · created_at ·
updated_at · version · deleted_at/by/reason · state_changed_at/by/reason · search_vector`

**Columns that exist but are never written by any code path** (verified: zero matches
across `routes/`): `technician_id`, `promised_at`, `state_changed_at`,
`state_changed_by`, `state_change_reason`, `ro_lines.tech_id`. The audit scaffolding is
in the schema and unused.

**Absent entirely:** `pay_type`, `ready_at`, `arrived_at`, any payment/receivable state,
`cause`, `correction`, authorization, QC.

**Runtime state machine** (`setRoStatus`, `service-engine.js:161-175`):

| From | To | Route / fn | Actor | Permission | Conditions | Event | Accounting |
|---|---|---|---|---|---|---|---|
| — | `open` | `POST /service-engine/ros` → `openRepairOrder` | any writer | `service.write_repair_order` | none | `service.ro_opened` | none |
| any | `in_progress` \| `awaiting_parts` \| `ready` \| `canceled` | `POST /ros/:id/status` → `setRoStatus` | any writer | same | **none** | `service.ro_status_changed` | none |
| any | `closed` | `POST /ros/:id/close` → `closeRepairOrder` | any writer | same | **none** | `service.closed` | **posts the journal** |
| `closed` | — | — | — | — | — | — | irreversible in code |

Findings:

- **The state machine is fully connected with no guards.** Any status may follow any
  other. An RO can go `open → ready → closed` with no lines, no technician, no
  authorization, no parts, and it will post a journal.
- **`status` defaults to `'appointment'` in the schema**, a value the valid-status list
  in `setRoStatus:162` does not include. `openRepairOrder` always overrides it to
  `'open'`, so the default is unreachable — a fossil of an earlier design.
- **Idempotency on close is correct** (`:182` short-circuits on already-closed, before
  any stock draw or emit). This is the one transition built to Stage 3A standards.
- Transitions do **not** stamp `state_changed_*`, so the RO row itself cannot say who
  moved it or why. The event bus has it; the record does not.

→ **G3** (no `ready_at`/`arrived_at`/`pay_type`), **G6** (state-change audit columns
unpopulated; no guards on transitions).

## 6. RO line / job model (A5)

`ro_lines`: `id · dealership_id · ro_id · line_type · part_id · description · qty ·
hours · rate · unit_cost · unit_price · total · tech_id · created_at · deleted_at/by`

`line_type ∈ {labor, part, sublet, fee}` (`service-engine.js:120`).

Against the A5 checklist:

| Concept | Supported? |
|---|---|
| customer concern | ❌ — only `repair_orders.complaint`, one per RO |
| technician finding / cause | ❌ |
| correction | ❌ — `description` is the *sold* description, written before the work |
| recommendation | ❌ |
| authorization status | ❌ |
| labor operation | ❌ — no op code, no catalog |
| part | ✅ `part_id` |
| technician assignment | **column exists (`tech_id`), never written** |
| sold hours | ⚠️ `hours` — sold hours only |
| actual hours | ❌ |
| price | ✅ |
| pay type | ❌ |
| completion state | ❌ |

**An `ro_lines` row is a billing line, not a job.** It answers "what do we charge for"
and nothing else. Soft delete (`deleted_at`) is correctly implemented and audited
(`service-engine.js:149`, `:342`).

→ **G3.** The smallest useful fix is to add job semantics to the *existing* table
(`cause`, `correction`, `authorization_status`, `completed_at`, `pay_type`, `tech_id`
actually written) rather than introducing a parallel `ro_jobs` table.

## 7. Concern / Cause / Correction (A6)

**Concern:** `repair_orders.complaint` — one free-text field for the whole RO.
**Cause:** absent. **Correction:** absent.

There is nowhere for a technician to record a finding, so in practice the diagnosis
either goes nowhere or overwrites the customer's own words — precisely what the brief
forbids. Multi-concern ROs ("noise in front end AND check engine light") cannot be
represented at all.

**Minimum fix:** three nullable text columns on `ro_lines` (`concern`, `cause`,
`correction`) so each job carries its own three-C record, leaving
`repair_orders.complaint` as the customer's original words at write-up, never
overwritten. No new table. → **G3**

## 8. Inspection / MPI model (A7)

**MarketSync has no digital vehicle inspection domain.** Stated plainly, as the brief
requires.

Searched the live schema for inspection/MPI/finding/severity structures. The only
matches are `workplace_inspections` and `workplace_inspection_items` — these are
**OH&S workplace safety inspections belonging to People/HR** (`inspector_staff_id`,
`location`, `findings_summary`). They are not vehicle MPI and **must not be relabelled
as such**.

No templates, no findings, no severity, no photo/video capture, no recommended service,
no technician signoff, no customer presentation.

→ **G3**, and explicitly **out of scope for Stage 4 unless approved separately.** A real
MPI is a platform, not a slice. If Stage 4B wants an "Inspections" tab, the honest
options are (a) defer it, or (b) build the smallest useful version: a findings list on
the RO with `severity ∈ {red, yellow, green}`, a note, and an optional recommended job
that can be quoted — roughly one table. **Do not ship an Inspections tab over RO notes.**

## 9. Authorization model (A8) — **critical**

> **Can MarketSync prove exactly what work a customer approved or declined?**
> **No. Not at all.**

Searched for authorization/consent/approval/signature structures tied to service work:

- **No authorization table.** None.
- **No approval columns** on `repair_orders` or `ro_lines`.
- `customer_consents` exists but is **privacy/marketing consent** (`consent_type`,
  `lawful_basis`, `policy_version`, `notice_text_hash`) — not work authorization. It is
  well-built and is the right *shape* to imitate, but it is not this.
- `esign_requests` exists and is genuinely capable (`doc_html`, `signature_image`,
  `consent_text`, `audit`, `signed_at/ip/ua`) — but it is keyed to `deal_id`. **There is
  no `ro_id`.** It cannot sign a repair order today.
- No estimate object, therefore **no estimate version**, therefore the system cannot
  distinguish an approved estimate from a later, larger one. If an RO grows from \$400
  to \$1,900 after approval, nothing records that the customer approved \$400.

There is not even a frontend checkbox to dismiss — the brief's "a frontend checkbox is
not authorization" is moot because no authorization UI exists either.

**Consequence.** Every repair is billed with zero provable consent. This is the single
largest legal/audit exposure in fixed ops, and it is also a *prerequisite for the
Estimate and Authorization attention items* the Stage 4B Service Today view is meant to
show. Those items cannot be built truthfully before this exists.

**Minimum fix (proposed, needs approval):** `ro_authorizations` —
`(dealership_id, ro_id, line_ids[], quoted_total, decision ∈ {approved, declined,
deferred}, method ∈ {in_person, phone, sms, email, esign}, authorized_party_name,
decided_at, captured_by, evidence jsonb, esign_request_id nullable)` — plus an
`estimate_version` integer on `repair_orders` that increments when priced lines change,
stamped onto each authorization. Reuse `esign_requests` by adding a nullable `ro_id`
rather than building a second signing system.

→ **G4 + G6. STOP-GATE ITEM.**

## 10. Pay types (A9)

**Service does not distinguish pay types.** There is no `pay_type` column on
`repair_orders` or `ro_lines`, and no route accepts one.

Every RO is implicitly Customer Pay. Consequences, all real:

| Pay type | Should | Actually does |
|---|---|---|
| Customer Pay | AR → customer, then payment | AR, never cleared |
| **Warranty** | warranty receivable from the manufacturer, different labor rate, claim submission | **posts as customer AR at retail** |
| **Internal** | dealership expense or capitalization to the vehicle (recon!) — no receivable | **posts as customer AR, inventing revenue and a receivable from nobody** |
| Goodwill/Policy | expense | not representable |

Internal ROs are the sharpest case: an internal RO on a dealer-owned unit should raise
that unit's cost basis — which is exactly what the Stage 3 `recon.cost` producer already
does for recon. Today it would instead create fictitious service revenue.

→ **G3 + G5.** Pay type must exist *before* Service Today shows profitability, and
before any RO close is trusted, because it changes the journal.

## 11. Labor model (A10)

| A10 question | Answer |
|---|---|
| 1. Multiple labor jobs per RO? | ✅ Yes — many `ro_lines` with `line_type='labor'` |
| 2. Different technicians per job? | ⚠️ **Schema yes** (`ro_lines.tech_id`), **code no** — never written |
| 3. Sold hours stored? | ✅ `ro_lines.hours` (sold) |
| 4. Actual technician hours stored? | ⚠️ Only indirectly — see below |
| 5. Clock times tied to jobs or shifts? | **Shifts, RO-level at best** |
| 6. Can technician productivity/efficiency be computed truthfully? | **No** |

The genuinely interesting find: **`time_entries` has an `ro_id` column**
(`id, dealership_id, employee_id, clock_in, clock_out, break_minutes, ro_id, note,
source, status, edited_by, approved_by, …`). It is the HR/payroll time clock, it has an
approval workflow, and it can already be attributed to a repair order. **Zero rows on
staging use it** and no Service route writes it.

So: actual hours are attributable to an RO but **not to a job**, and only through the
payroll clock. Efficiency (sold ÷ actual) is therefore computable **per RO** if the
clock were used, and **not** per job or per technician-per-job.

→ **G2** (write `tech_id`; wire `time_entries.ro_id`) rather than G3 — the pieces exist
and are not connected. **Do not display technician efficiency in Stage 4B until they
are.**

## 12. Technician & dispatch model (A11, A12)

**Dispatch does not exist.** There is no assignment route, no dispatch board, no
work-queue object.

- `repair_orders.technician_id` — single tech per RO, and never written.
- `ro_lines.tech_id` — **job-level assignment is representable**, and never written.

Answering A11 directly: the data model *can* express "Job A → Tech 1, Job B → Tech 2".
The limitation is not schema, it is that **no code assigns anyone.** This is a genuine
gap, not an intentional single-tech design — the schema clearly anticipated job-level
dispatch.

Technician workflow states (A12):

| Concept | Status |
|---|---|
| Unassigned | derivable (`tech_id is null`) once assignment exists |
| Assigned | representable, unwritten |
| Started | ❌ (could derive from `time_entries.clock_in` + `ro_id`) |
| Blocked | ❌ |
| Waiting parts | ⚠️ RO-level `awaiting_parts` status only — not per job, and backed by no parts data (§15) |
| Complete | ❌ no per-line completion |

**Safe technician actions today: none.** A technician has `service.write_repair_order`,
which means the only Service actions available are add/remove lines, change RO status,
and **close the RO** (posting a journal). That is an over-grant, not a workflow.

→ **G2** for assignment, **G3** for per-job progress states, **G6** for the permission
over-grant. Do not build a dispatch board before assignment writes exist.

## 13. Parts master (A13)

`parts`: `id · dealership_id · part_number · description · bin · qty_on_hand · cost ·
price · reorder_point · created_at · updated_at`. Unique on
`(dealership_id, part_number)` (`upsert onConflict`, `service-engine.js:213`).

| A13 field | Present |
|---|---|
| part number, description, bin | ✅ |
| **on hand** | ✅ `qty_on_hand` |
| **available** | ❌ |
| **reserved** | ❌ |
| **on order** | ❌ |
| cost, sell price | ✅ |
| reorder point | ✅ |
| manufacturer / vendor | ❌ |
| supersession | ❌ |
| active / inactive | ❌ |

`qty_on_hand` is `numeric` with **no non-negative constraint** — stock can go negative.

## 14. Part transaction model (A14)

`part_txns`: `id · dealership_id · part_id · txn_type · qty · unit_cost · ro_id ·
reference · note · created_by · created_at`.

Transaction types actually produced: **`receive`, `adjust`, `consume`** (only these
three — `moveStock` callers at `service-engine.js:237-254`). No `return`, no `transfer`,
no `sale`.

| A14 question | Answer |
|---|---|
| What changes stock? | `moveStock` (`:218`) — inserts the txn, then updates `qty_on_hand` |
| Audit history? | ✅ `part_txns` is append-only in practice |
| **Can quantity change bypass a transaction?** | ✅ **Yes** — `moveStock` is the only *code* path, but `parts.qty_on_hand` has no trigger, no constraint and no guard. Any future writer, migration or manual fix can move stock invisibly. |
| Tenant-scoped? | ✅ `dealership_id` on both tables; RLS enabled service-role-only |
| Retry / idempotency? | ❌ **None.** No natural key, no idempotency token. A retried receive double-counts. |

**Critical: the ledger and the balance are not atomic.** `moveStock` does an insert and
then a separate update (`:221`, `:226`), with **no transaction and no row lock**, and it
computes the new quantity in JavaScript from a value it read earlier (`:225`). Two
concurrent moves interleave and one is lost — a classic read-modify-write race. There is
no `select … for update`, no atomic `qty_on_hand = qty_on_hand + :delta`.

→ **G4 + G6.** Even without reservations, **stock arithmetic is already unsafe under
concurrency.**

## 15. Parts request / demand model (A15) — **critical**

> **What canonical object means "RO 123 / Job 2 requires part X, qty 2"?**
> **None exists.**

Searched for request/allocation/demand structures: nothing. Not a table, not a status,
not a task type.

What actually happens: an advisor adds a `part` line to the RO (`addRoLine`), which is a
**billing line**. Stock is not touched. Then — only at **RO close** — `closeRepairOrder`
loops the part lines and calls `consumePart` (`service-engine.js:186-190`).

The consequences are worth stating precisely:

1. **Parts are consumed after the work is finished.** Inventory shows a part as on-hand
   throughout the entire repair, including while it is physically in the technician's
   hand.
2. **Two ROs can both "have" the last part.** Neither is told.
3. **`awaiting_parts` is a status with nothing behind it.** Nothing records *which* part
   is awaited, *how many*, *for which job*, or *whether it was ordered*. A "Waiting
   Parts" attention item cannot say what it is waiting for.
4. **A part line for a part not in stock still closes the RO** — `consumePart` happily
   drives `qty_on_hand` negative.

→ **G3 + G4. STOP-GATE ITEM.** This blocks the Parts Request, Waiting Parts and Dispatch
surfaces in Stage 4B; all three would be fiction.

## 16. Reservation model (A16) & concurrency (A17)

**No reservation exists.** There is no `reserved` quantity, so `available` cannot be
computed — the system cannot distinguish On Hand from Available.

The A16 scenario is exactly the failure mode: on hand = 1, RO 100 takes it, RO 101 is
still told one is available — and today *both* would be told, because nothing decrements
until close.

Is reservation required for Stage 4 correctness? **Yes, if Stage 4B ships a Parts
Request or Waiting-Parts view**, because both are claims about future availability that
would be false. If Stage 4B defers parts demand entirely, reservation can defer with it.
It cannot be half-built.

**A17 concurrency test — cannot be run today** (nothing to test), and per §14 the
*existing* stock path would already fail it. Any implementation must be enforced in the
database — an atomic conditional update or `select … for update` inside a transaction,
plus a `qty_on_hand >= 0` check constraint — **not** by the UI checking first, and not by
JavaScript arithmetic on a stale read.

→ **G3 + G4. STOP-GATE ITEM.**

## 17. Ordering / procurement model (A18)

**No procurement exists.** No purchase order, no order header/lines, no vendor entity,
no quantity ordered/received, no ETA, no backorder, no special order, no link to an RO.

`POST /service-engine/parts/:id/receive` increments stock against *nothing*. It is a
receipt with no expectation — which, per the brief, must not be called ordering.

Stage 4 does **not** need a procurement suite. The smallest honest requirement, *if*
parts demand is built: a minimal `parts_orders` + `parts_order_lines` with vendor name,
qty ordered, qty received, ETA, and a link to the originating request — enough to answer
"is it ordered, and when does it land". A full PO/AP integration is explicitly out of
scope.

→ **G3** (deferrable if §15 is deferred).

## 18. Receiving model (A19)

`receiveParts` (`service-engine.js:237`) → `moveStock(+qty, 'receive')` → emits
`parts.received`.

Against the correct conceptual flow:

| Step | Status |
|---|---|
| Order / expected part | ❌ nothing to receive *against* |
| Receive | ✅ |
| Inventory increases | ✅ |
| Stock transaction created | ✅ |
| Related request/order updated | ❌ nothing to update |
| **Blocked RO becomes actionable** | ❌ no link exists, so nothing unblocks |

Receiving is auditable (a `part_txns` row with `created_by`) but **not idempotent** and
**not concurrency-safe** (§14), and it **posts nothing to Accounting** (§20, F2).

→ **G4 + G5.**

## 19. Issue part to RO (A20) & returns (A21)

**Issue.** There is no issue operation. Consumption is a side effect of closing the RO.
Against the A20 checklist: stock decreases ✅ (late), transaction recorded ✅,
**RO/job knows the part was supplied** ⚠️ (the *line* is on the RO but nothing marks it
fulfilled), quantity/value preserved ✅ (`unit_cost` snapshotted), **duplicate issue
prevented** ✅ *only* because close is idempotent — there is no protection on the
operation itself, **Service sees fulfilment** ❌, Accounting correct ⚠️ (see §20).

**Returns.** No return path of any kind: no unused-part-back-to-stock, no vendor return,
no customer retail return. `txn_type` has no `'return'` producer. Today every correction
is an anonymous `adjust` with an optional free-text note — exactly the normalization the
brief warns against. `adjustPart` requires only `service.write_repair_order`, so any
technician can silently write off stock.

→ **G4 + G6.** Returns may be deferred in Stage 4, but the `adjust`-as-catch-all must be
recorded as a known audit weakness.

## 20. Parts financial truth (A22)

| Transaction | Event emitted | Reaches Accounting? | Should |
|---|---|---|---|
| Receipt | `parts.received` | ❌ **no case in `routeFinancialEvent`** | DR `parts_inventory` / CR `accounts_payable` |
| Issue to RO | `parts.consumed` | ❌ **explicitly skipped** — payload carries `engine: true` (`service-engine.js:252`) and `onFinancialEvent` returns early on `payload.engine` (`accounting-engine.js:244`) | (correctly deferred to RO close) |
| Adjustment | `parts.adjusted` | ❌ no case | DR/CR inventory shrinkage |
| Return | — | n/a | — |
| Retail counter sale | — | not supported | — |
| **RO close** | `service.closed` | ✅ CR `parts_inventory` for `parts_cost` | ✅ correct as far as it goes |

**F2 restated with the evidence:** `parts_inventory` is **credited** on every RO close
and **debited by nothing**. Receiving parts increases physical stock and the ledger never
learns. The balance sheet drifts negative by the full value of every part ever received.
The skip of `parts.consumed` is *deliberate and correct* (close does the relief); the
absence of a receipt posting is not deliberate — it is simply missing.

Per the brief: **this financial change is stopped and documented, not made.**

→ **G5. STOP-GATE ITEM.**

## 21. Service financial truth (A23)

**`service.closed` is genuinely emitted** — `closeRepairOrder`, `service-engine.js:198`,
guarded by the already-closed short-circuit at `:182`. Idempotency is real.

Consumer: `accounting-engine.js:235` → `postByRule(did, 'service_closed', …)`.
Rule (`migrations/2026-07-23-accounting-engine-a5-events.sql:40`):

```
DR accounts_receivable   revenue
CR service_revenue       revenue
DR parts_cost            cost
CR parts_inventory       cost
```

with `revenue = labor + parts + sublet + fee − discount` (`service-engine.js:194`) and
`cost = parts_cost` (`:197`).

| Element | Handled correctly? |
|---|---|
| Labor revenue | ⚠️ folded into one `service_revenue` credit — labor and parts revenue are not split, though `parts_revenue` (4300) exists in the chart |
| Parts revenue | ⚠️ same |
| Parts cost | ✅ DR `parts_cost` / CR `parts_inventory` |
| **Tax** | ❌ **`revenue` is the pre-tax subtotal. AR is debited pre-tax; the customer owes `total`. No tax liability is ever credited.** |
| Discounts | ✅ netted into revenue |
| **Receivable** | ⚠️ created and **never cleared** |
| Cash / card | ❌ no payment path at all |
| Warranty receivable | ❌ no pay type, so warranty posts as customer AR |
| Internal expense | ❌ internal posts as revenue + AR |
| Inventory | ✅ for parts; correctly excludes labor (tech payroll is not COGS — the comment at `:195` is right) |

→ **F1 + F3: G5. STOP-GATE ITEM.**

## 22. Payment / financial disposition (A24)

There is **no financial disposition concept at all** — no payment record, no receivable
state, no pay-type-specific completion.

The valid completion paths the brief describes:

| Pay type | Correct disposition | Available today |
|---|---|---|
| Customer Pay | payment collected **or** an explicit receivable | ❌ AR only, never resolved |
| Warranty | warranty receivable + claim | ❌ |
| Internal | internal expense / capitalize to the unit | ❌ |
| Goodwill/Policy | expense | ❌ |

The brief's principle — **close means "financial disposition resolved", not "cash
collected"** — is the right target, and MarketSync currently satisfies neither reading:
`closed` means only "someone pressed Close."

→ **G3 + G5. STOP-GATE ITEM.**

## 23. Ready vs Closed (A25)

`ready` **is** a valid status (`setRoStatus:162`), so operational completion is
*nominally* distinct from close. But:

- there is **no `ready_at`** timestamp — time-in-state for "ready awaiting customer"
  cannot be measured, so the Stage 4B attention item cannot age;
- there is **no QC state** between complete and ready;
- there is **no customer-contacted state**;
- nothing prevents `open → closed` directly, skipping ready entirely;
- because there is no payment (§22), `closed` **is** in practice synonymous with paid —
  the exact conflation the brief prohibits.

The chain `Repair Complete → QC/Ready → Customer Contacted → Pickup/Disposition →
Closed` has **one** of its five steps represented.

→ **G3.**

## 24. Reopen semantics (A26)

`repair_order_reopen_requests` exists and is **well designed**:
`repair_order_id · reason · status (default 'requested') · requested_by/at ·
reviewed_by/at · executed_at · correlation_id`. A permission
`service.reopen_repair_order` exists and is granted to `dealer_owner`,
`dealer_group_owner`, `general_manager`, `service_manager`, `platform_owner`.

**And none of it is used.** Zero code references — verified across the whole backend
(`.js` and `.sql`). There is no request route, no approval route, no execution path.

So: a closed RO is **not** silently editable (`addRoLine` refuses on closed,
`service-engine.js:118`) — which is good — but there is also **no sanctioned way to
reopen one.** The control is designed, provisioned, permissioned… and unreachable. The
only escape hatch is a direct database write.

Accounting implications of a future reopen are undefined: `closeRepairOrder` would
short-circuit on re-close (`:182`), so **a reopened-and-reclosed RO would never
re-post**, and any changed amounts would silently never reach the ledger.

→ **G6 (control exists but is unreachable) + G5 (re-close would not re-post).**

## 25. CRM / customer timeline continuity (A27)

**Good news, and the strongest part of the current implementation.** Service events go
onto the same event bus as everything else, with `entity_type: 'repair_order'` and
`department: 'Service'` — so `service.ro_opened`, `service.ro_status_changed` and
`service.closed` are already timeline-capable, on the same contact Sales works.

`service.js` additionally writes a `communications` row on booking (`:120`, `:172`), so
the appointment shows in the customer's communication history.

Against the A27 list: appointment ✅, RO opened ✅, status changes ✅, close ✅.
Missing because the underlying state is missing: check-in, estimate, authorization,
waiting-parts detail, ready, declined work.

**No second Service customer-history system exists, and none should be built.** ✅

→ **G0 only** — the timeline is fed; the UI does not yet surface it in Service.

## 26. Communication (A28)

Service correctly reuses the shared infrastructure: `communications` rows, `resend` for
email (`service.js:179-184`), `createNotification` (`:177`), and calendar sync via
`syncAppointmentOut` (`:125`, `:140`). Consent lives in `customer_consents`.

**No second messaging subsystem exists.** ✅ Service-specific templates and reminders
(appointment reminder, ready-for-pickup, declined-work follow-up) do not exist, but they
are template gaps on working rails, not architecture gaps.

→ **G0.**

## 27. Retention (A29)

What survives an RO close today: the `repair_orders` row (with totals and `closed_at`),
its `ro_lines`, the `part_txns`, the event trail, and the `contacts.service_customer`
flag. That is enough to know *that* a customer was served and for how much.

What is **not** captured, and therefore cannot be recovered later:

- **declined work** — nothing records a decline (§9), so the single highest-value
  retention list in fixed ops is unbuildable;
- **the vehicle** — no `customer_vehicles` (§2), so no next-service interval, no mileage
  trend, no maintenance schedule, no recall matching;
- **recommendations** — no inspection findings (§8).

Stage 4 need not build the retention platform. It **must not discard** the data:
capturing declines and vehicle identity now is what makes retention possible later.

→ **G3** (consequential to §2 and §9).

## 28. Role ownership map (A30)

Actual permission model: `service.view`, `service.write_repair_order`,
`service.reopen_repair_order` (live in `public.permissions`). Grants:

| Role | view | write | reopen |
|---|---|---|---|
| `platform_owner` | ✅ | ✅ | ✅ |
| `dealer_group_owner` | ✅ | ✅ | ✅ |
| `dealer_owner` | ✅ | ✅ | ✅ |
| `service_manager` | ✅ | ✅ | ✅ |
| `general_manager` | ✅ | ❌ | ✅ |
| `technician` | ✅ | ✅ | ❌ |
| `accounting` | ✅ | ❌ | ❌ |

**Every `/service-engine/*` route — reads included — requires `write_repair_order`.**
Therefore `general_manager` and `accounting` **cannot read a repair order**, despite
holding `service.view`, which no code consults. And `technician` holds the same write
permission as the service manager, so a technician can close ROs and post journals.

Target ownership map (what Stage 4B must enforce; **none** of these is enforced today):

| Transition | Responsible actor | Enforced now? |
|---|---|---|
| Appointment booked / confirmed | Advisor or online customer | partially (any authed user) |
| Arrival / check-in | Advisor | ❌ no transition |
| RO opened | Advisor | ⚠️ any writer |
| Diagnosis / cause recorded | Technician | ❌ no field |
| Estimate priced | Advisor | ❌ no estimate object |
| **Authorization captured** | Customer; evidence captured by Advisor | ❌ nothing |
| Dispatch / job assignment | Service manager or dispatcher | ❌ no assignment |
| Part requested | Technician or Advisor | ❌ no request |
| Part reserved | Parts | ❌ no reservation |
| Part ordered / received | Parts | ⚠️ receive exists, any writer |
| Part issued to RO | Parts | ❌ implicit at close |
| Repair complete | Technician | ❌ no per-job completion |
| QC | Manager | ❌ |
| Ready / customer contacted | Advisor | ⚠️ `ready` status, any writer |
| Financial disposition | Cashier / Advisor / system by pay type | ❌ |
| RO closed | Advisor or cashier | ⚠️ any writer, incl. technician |
| RO reopen requested / approved | Requester / Manager | ❌ unreachable |
| Accounting posting | System (Accounting Engine) | ✅ correct |

**No transition should remain "generic user changes status" — today almost every one
is.** → **G6.**

## 29. Gap register (G0–G6)

### G0 — UI gap (backend exists, not exposed)
| # | Gap |
|---|---|
| G0-1 | Service RO worklist exists (`dashboard-part12.js`) but is not an `ENGINES` workspace; Service/Parts are two thin registry pages, not departments |
| G0-2 | Service events already feed the customer timeline; Service UI never shows it |
| G0-3 | `roSummary` read API exists; no Service Insights surface |
| G0-4 | Low-stock exceptions are raised (`service-engine.js:229`) but never surfaced in a Parts view |

### G1 — Read / aggregation gap
| # | Gap |
|---|---|
| G1-1 | No "shop status" aggregate: open ROs by state, with customer/vehicle/advisor/age, needs N+1 reads today |
| G1-2 | `listRepairOrders` returns bare rows — no customer or vehicle names, so any worklist must fan out |
| G1-3 | No parts-availability aggregate (on hand vs committed) — cannot exist before §15/§16 |

### G2 — Relationship gap
| # | Gap | Consequence | Smallest fix |
|---|---|---|---|
| G2-1 | Appointment ↔ RO never linked in practice | check-in cannot be built | idempotent from-appointment route + partial unique index |
| G2-2 | Appointment has no vehicle | advisor retypes the car | `crm_tasks` vehicle ref, or move service appointments onto a real object |
| G2-3 | `ro_lines.tech_id` never written | no dispatch, no per-job productivity | write it; add an assignment route |
| G2-4 | `time_entries.ro_id` never written | actual hours unknowable | write it at clock-in against the RO |
| G2-5 | `repair_orders.contact_id` nullable and unenforced | RO with no customer | require on open |
| G2-6 | `state_changed_*` never stamped | record cannot say who moved it | stamp in `setRoStatus` |

### G3 — Missing canonical state
| # | Gap | Consequence | Schema impact |
|---|---|---|---|
| **G3-1** | **Customer-owned vehicle** | no service history, retention, recalls, mileage | new `customer_vehicles` + nullable FK on RO |
| **G3-2** | **Pay type** | warranty/internal post as customer revenue | `pay_type` on RO (and ideally line) |
| G3-3 | Concern / cause / correction | technician findings unrecordable | 3 nullable text columns on `ro_lines` |
| G3-4 | Appointment status / arrival / no-show | no-show indistinguishable from served | status column on the appointment object |
| G3-5 | `ready_at` / `arrived_at` / QC / customer-contacted | ready cannot age; close ≡ paid | timestamps on RO |
| G3-6 | Per-job completion + authorization status | no job-level progress | columns on `ro_lines` |
| G3-7 | Parts `reserved` / `available` | over-promising stock | see G4-3 |
| G3-8 | Inspection / MPI domain | no findings, no recommendations | **defer — platform-sized** |
| G3-9 | Parts vendor / on-order / active / supersession | no procurement truth | columns + §17 |

### G4 — Missing business transaction
| # | Gap | Consequence |
|---|---|---|
| **G4-1** | **Customer authorization** (+ estimate version) | cannot prove consent for any repair |
| **G4-2** | **Parts request / demand** | `awaiting_parts` is empty; nothing to order against |
| **G4-3** | **Parts reservation** (concurrency-safe) | two ROs promised the same last part |
| G4-4 | Check-in (appointment → RO), idempotent | duplicate ROs; no arrival record |
| G4-5 | Issue-part-to-RO as its own operation | parts consumed only at close |
| G4-6 | Receiving against an order/request | receipts unblock nothing |
| G4-7 | Returns (RO → stock, vendor) | corrections hide in anonymous adjustments |
| G4-8 | Payment / financial disposition | AR never cleared |
| G4-9 | Reopen request/approve/execute | designed, permissioned, unreachable |

### G5 — Financial truth gap
| # | Gap | Evidence | Consequence |
|---|---|---|---|
| **G5-1** | **Tax never posted; AR debited pre-tax** | `service-engine.js:194` vs `total` | AR understated every RO; no tax liability |
| **G5-2** | **`parts_inventory` credited, never debited** | no `parts.received` case, `accounting-engine.js:210-238` | parts inventory drifts negative permanently |
| **G5-3** | **No payment posting** | no cash/card path | AR grows without bound |
| G5-4 | Pay type ignored in posting | one rule for all ROs | warranty/internal post as customer revenue |
| G5-5 | Labor and parts revenue not split | single `service_revenue` credit | `parts_revenue` (4300) unused; no gross split |
| G5-6 | Adjustments post nothing | `parts.adjusted` unhandled | shrinkage invisible to the ledger |
| G5-7 | Re-close after reopen would never re-post | `service-engine.js:182` | amended ROs silently unbooked |

### G6 — Audit / compliance gap
| # | Gap |
|---|---|
| **G6-1** | No authorization evidence — cannot prove who approved what, at what price, when, by what method |
| G6-2 | `state_changed_by/reason` never written; the RO record cannot explain its own history |
| G6-3 | Stock moves are read-modify-write with no lock/transaction and no idempotency key — lost updates, double receipts |
| G6-4 | `parts.qty_on_hand` can be changed without a `part_txns` row (no trigger/constraint) |
| G6-5 | `technician` holds `service.write_repair_order` → can close ROs and post journals |
| G6-6 | `service.view` consulted by zero routes → `general_manager` and `accounting` cannot read ROs |
| G6-7 | Reopen control unreachable; the only path is a direct DB write |
| G6-8 | `ro_number` from `count(*)+1` — races produce duplicate RO numbers |

## 30. Proposed minimum changes, files, and test plan

### Proposed minimum change set (for approval — **not implemented**)

Ordered so each tier is independently shippable and nothing depends on a later tier.

**Tier 0 — bugs and controls (no schema, no financial change).**
Fix B1 (`crm_tasks.status`); split `service.view` onto every `/service-engine/*` **read**
so GM/accounting can see ROs; introduce a narrower technician permission so closing an RO
is not a technician action; stamp `state_changed_*`; require `contact_id` on open;
replace `count(*)+1` with a real sequence. *Addresses G6-2/5/6/8, B1.*

**Tier 1 — stock integrity (no new concepts).**
Make `moveStock` atomic: one transaction, `qty_on_hand = qty_on_hand + :delta`, a
`qty_on_hand >= 0` check constraint, and an idempotency key on `part_txns`. Add the A17
concurrency test. *Addresses G6-3/4, part of G4-3's prerequisites.*

**Tier 2 — customer & vehicle identity.**
`customer_vehicles` + nullable `repair_orders.customer_vehicle_id`. No backfill.
*Addresses G3-1, unlocks retention and history.*

**Tier 3 — the three-C and job model.**
`ro_lines`: `concern`, `cause`, `correction`, `pay_type`, `completed_at`,
`authorization_status`; start writing `tech_id`; `repair_orders.pay_type`, `arrived_at`,
`ready_at`. *Addresses G3-2/3/5/6, G2-3.*

**Tier 4 — authorization.**
`ro_authorizations` + `repair_orders.estimate_version`; add nullable `ro_id` to
`esign_requests` rather than a second signing system. *Addresses G4-1, G6-1.*

**Tier 5 — parts demand.**
`parts_requests` (RO + line + part + qty + state) with concurrency-safe reservation;
`parts.reserved` derived from open requests; issue-to-RO as its own operation.
Optionally minimal `parts_orders` for ETA. *Addresses G3-7, G4-2/3/5/6.*

**Tier 6 — financial truth (each needs its own approval; see §31).**
Tax line and AR at `total`; a `parts.received` producer debiting `parts_inventory`;
payment/disposition with pay-type-aware posting; labor/parts revenue split; reopen
re-post semantics. *Addresses G5-1..7.*

### Files expected to change

| File | Change |
|---|---|
| `routes/service.js` | appointment status bug; appointment vehicle; check-in |
| `routes/service-engine.js` | atomic stock; assignment; three-C; pay type; authorization; requests; permissions |
| `routes/accounting-engine.js` | **only under approval** — tax, parts receipt, payment, pay-type routing |
| `routes/esign.js` | accept an `ro_id` |
| `migrations/2026-08-XX-stage4-*.sql` | one migration per tier, staging first |
| `js/modules/service-workspace.js` | **new** — `ENGINES['service-overview']` |
| `js/modules/parts-workspace.js` | **new** — `ENGINES['parts-overview']` |
| `js/modules/workspace-registry.js` | Service/Parts lead with their Today page |
| `js/modules/dashboard-part2.js` | `switchPage` + `PAGE_FEATURE` for the two new pages |
| `dashboard.html` | page containers, roots, script tags |
| `test/stage4-fixedops.test.js` | **new** |
| `test/parts-concurrency.test.js` | **new** — the A17 test |
| `test/service-accounting.test.js` | **new** — posting truth per pay type |

### Test plan

1. **Concurrency (A17):** two simultaneous reservations/issues of the last unit — exactly
   one succeeds; stock never negative; no duplicate issue. Must fail before the fix.
2. **Idempotency:** repeat check-in → one RO; repeat receive with the same key → one
   `part_txns` row; repeat close → one journal (already passing, keep it passing).
3. **Accounting truth:** per pay type, assert the exact journal lines — including that
   AR equals `total`, that tax is credited, and that a parts receipt debits
   `parts_inventory`.
4. **Authorization:** an RO whose priced lines change after approval must expose a
   different `estimate_version` than the one authorized.
5. **RBAC:** `general_manager` and `accounting` can read an RO; `technician` cannot close
   one; reopen requires `service.reopen_repair_order`.
6. **No duplicate canonical records:** a returning VIN resolves to the same
   `customer_vehicles` row; Service never creates an `inventory` row.
7. **Regression:** full suite + all six `check:*`; mobile ~390px for any new surface.

## 31. STOP GATE (A31)

Per the brief, Stage 4A stops here. **Nine G3–G6 gaps touch the protected areas** —
customer authorization, parts quantity, reservation, receiving, accounting, payment, RO
close, and customer/vehicle identity — so dependent UI must not be built on them yet.

**Blocking, needs a decision before Stage 4B:**

| Gap | Area | Decision needed |
|---|---|---|
| G5-1 | accounting | Post tax and debit AR at `total`? (changes every future RO journal) |
| G5-2 | accounting | Add a `parts.received` producer debiting `parts_inventory`? |
| G5-3 / G4-8 | payment | Introduce payment / financial disposition, and what closes an RO? |
| G3-2 / G5-4 | accounting | Add `pay_type` and route the journal by it? |
| G4-1 / G6-1 | authorization | Approve the `ro_authorizations` + `estimate_version` model? |
| G4-2 / G4-3 / G3-7 | parts | Approve parts requests + concurrency-safe reservation — or defer parts demand *and* the Waiting-Parts/Dispatch views together? |
| G3-1 | identity | Approve `customer_vehicles`? |
| G6-3 / G6-4 | parts | Make stock moves atomic + constrained (recommend yes regardless) |
| G4-9 / G5-7 | reopen | Implement reopen, and define whether re-close re-posts |

As in Stage 3, **no historical replay or backfill** is proposed or implied by any of the
above, and no financial behaviour will be changed without explicit approval.

**Safe to proceed without a decision (G0–G2):** registering Service and Parts as
`ENGINES` workspaces on the existing pattern, the shop-status aggregate read, surfacing
the timeline and low-stock exceptions, writing `tech_id`/`time_entries.ro_id`, stamping
`state_changed_*`, and the Tier 0 permission fixes.

**Honest consequence for Stage 4B as briefed:** of the six proposed Service Work views —
`Appointments | Drive | Repair Orders | Dispatch | Inspections | Ready` — only
**Repair Orders** is fully supported today. `Appointments` needs bug B1 fixed,
`Drive` needs check-in (G4-4), `Dispatch` needs assignment (G2-3), `Ready` needs
`ready_at` (G3-5), and `Inspections` has no domain at all (G3-8). Per the brief's own
rule — *do not ship hollow tabs* — those five must be earned, merged, or deferred
explicitly rather than rendered empty.
