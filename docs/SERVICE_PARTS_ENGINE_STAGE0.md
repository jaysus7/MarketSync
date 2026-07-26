# Service & Parts Engine — Stage 0 (design)

Fixed-ops as a **kernel engine**, not a page. Repair orders (ROs) and parts stock
become first-class, event-driven objects on the same spine as sales, accounting, and
workflow — so a closed RO posts a balanced journal, ages on the Operations board, and
shows on the customer's One Record timeline automatically.

## 1. What already exists (coexistence — do not break)

- **`service.js`** — a light **appointment book**: service visits are `crm_tasks`
  (`type='appointment'`, `category='service'`) on the unified CRM contact, plus
  `dealerships.service_settings` (booking on/off, types, hours). This stays. The engine
  *consumes* an appointment as the front door to an RO; it does not replace booking.
- **Accounting is already wired.** `accounting-engine.js` handles `service.closed`
  (→ `service_closed` posting rule, which exists and is active) and the chart of
  accounts already has `parts_inventory` (1300), `parts_revenue` (4300),
  `parts_cost` (5200), plus labor revenue/cost. The engine's ONLY accounting duty is
  to **emit `service.closed`** with `{ ro_id, revenue, cost, inventory_id, contact_id }`.
  No new posting logic here.

## 2. Objects it owns (its tables)

| Table | Purpose |
|---|---|
| `repair_orders` | One RO: customer, vehicle, advisor/tech, status, dates, totals. |
| `ro_lines` | Line items on an RO: `labor` / `part` / `sublet` / `fee`. Qty, rate, cost, price. |
| `parts` | Parts catalog + on-hand stock per dealership (number, desc, bin, qty, cost, price). |
| `part_txns` | Immutable stock ledger: receive / consume / adjust / return (auditable qty moves). |

Service-role-only RLS (enable RLS, no policies) — the project's engine-internal pattern.
Every money/stock mutation is idempotent on a natural key so a bus replay is safe.

## 3. RO state machine

`open → in_progress → awaiting_parts → ready → closed` (plus `canceled`).
`state_ownership` gives each state a department (Service) so ROs surface on the
Operations Next-Action board and the exception scanner ages stale ones — for free, via
the existing workflow/exception engines. No bespoke aging code.

## 4. Events

**Emits** (every state change = one event = one timeline row):
- `service.ro_opened` — RO created (department Service).
- `service.ro_status_changed` — any transition (`toState`).
- `service.closed` — RO closed → **Accounting posts the journal** (revenue/cost split
  labor vs parts). Idempotent (dedupe on `ro_id`).
- `parts.received` / `parts.adjusted` / `parts.consumed` — stock ledger moves.

**Subscribes:**
- `appointment.created` (from service.js booking, when wired) → optionally pre-stage an
  RO draft. Kept optional in Stage 2; booking→RO stays a one-click advisor action first.

## 5. Read APIs (how other engines query it — contract §4)

`getRepairOrder(dealer, id)`, `listRepairOrders(dealer, filter)`,
`getPart(dealer, id)`, `searchParts(dealer, q)`, `roSummary(dealer, range)`.
Nothing reaches into `repair_orders`/`parts` directly — always through these.

## 6. Tools (agent surface — contract §5)

Registered into the shared **tool-registry** on a `service` surface (and select ones on
`sales_chat` so the customer bot can help):
- `check_part_availability` (sales_chat + service) — read `searchParts`.
- `book_service` (sales_chat) — create a service appointment via service.js.
- `open_repair_order`, `add_ro_line`, `close_repair_order` (service) — advisor/agent
  actions; each calls the engine's own write fn (which emits the event). Privileged →
  never on `sales_chat`.

## 7. Configuration (contract §6 — read, never hardcode)

`getConfig(dealer, 'service')` → `{ labor_rate, tax_rate, shop_supplies_pct,
part_markup_pct, ro_prefix }`. Seed a global default. Labor/markup math reads config.

## 8. Stages

1. **Schema** — the four tables + indexes + RLS + `service` config default + RO
   `state_ownership` rows. (migration)
2. **Engine core** — `service-engine.js`: RO lifecycle (open/status/close) with
   read/write fns, `service.closed` emit (idempotent), event subscriber registration.
3. **Parts** — catalog + `part_txns` stock ledger; consuming a `part` RO line draws
   stock and books COGS via the closed-RO journal; low-stock exception.
4. **Tools + UI** — register the service tools; a Service page (RO worklist by state,
   RO editor with labor/parts lines, parts stock table) + wire into the nav.

Kernel conformance is a ship gate (contract §8): the engine subscribes, emits, exposes
read APIs + tools, owns only its tables, and reads config. No step ships otherwise.
