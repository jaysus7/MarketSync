# MarketSync Kernel Contract (v1 — frozen)

This is the ruler. Every engine — existing or future — conforms to this. If a change
would violate this contract, the design is wrong, not the contract.

The kernel is stable and frozen at v1:
**Event Bus · Workflow Engine · Action Executor · Timeline · Accounting Engine ·
Exception Engine · Retry Engine · Configuration · Audit.**
Everything else is an engine plugged into it.

---

## 1. The four laws

1. **State changes flow through events.** When something happens (deal delivered,
   deposit paid, RO closed), the owning engine calls `emitEvent(...)`. It does **not**
   call other engines to tell them.
2. **Queries flow through published read APIs.** When engine A needs engine B's data,
   it calls B's exported `getX()` function. It **never** reads B's tables directly and
   **never** reaches into B's private helpers.
3. **An engine owns its tables.** Only the owning engine writes its tables. Others get
   data through its read API or react to its events. The five core objects
   (`contacts`, `inventory`, `deals`, `profiles`, `dealerships`) are owned by their
   engines (Customer, Inventory, Deal, Identity, Core) and read-API'd to everyone else.
4. **Side effects go through the Action Executor.** Anything external (email, SMS, VIN,
   Carfax, webhook, accounting post) is a registered executor with a retry ledger —
   never an ad-hoc call in a request handler.

Events are for **write/notify**. Read APIs are for **query**. Do not route reads
through the event bus (that buys eventual-consistency pain a single-Postgres app does
not need). Do not route writes through direct calls (that recouples engines).

---

## 2. Event schema (the `events` table — do not change shape)

```
dealership_id  uuid    — tenant
event_name     text    — dotted machine name: <domain>.<thing>[ _changed ]
entity_type    text    — customer | vehicle | deal | task | ...
entity_id      uuid
summary        text    — human line (the timeline entry)
from_state     text    — on transitions
to_state       text    — on transitions
department     text    — owning department
payload        jsonb   — event-specific data (amounts, refs, ids)
created_by     uuid
created_at     timestamptz
```

Rules:
- `event_name` is stable and namespaced (`deal.status_changed`, `deposit.paid`,
  `ai.conversation`). Add new names; never repurpose an old one.
- `payload.engine = true` marks an engine-originated note (timeline-only) so the bus
  does not re-trigger workflows. Consumers must ignore `payload.engine` events for
  business logic.
- Every meaningful state change emits exactly one event. That row **is** the timeline
  entry — there is no separate activity log.

## 3. Emitting + subscribing

- **Emit:** `emitEvent({...})` from `routes/events.js`. Non-throwing — a failed emit
  never breaks the business action.
- **Subscribe:** `onEvent(handlerFn)` at engine registration. Handlers run detached;
  errors are swallowed and logged, never propagated to the emitter.
- A subscriber that produces financial or external effects must be **idempotent**
  (dedupe on a natural key) so replay is safe.

### Known kernel debt (tracked, not hidden)
The bus is **in-process** (`onEvent` subscribers in one Node process). The `events`
row persists and accounting has a replay log, but a non-accounting subscriber that
had not run when the process restarts is not retried. Accepted for v1. The frozen
upgrade path (does not change the contract above): a durable outbox/poller over the
`events` table, or a queue, feeding the same `onEvent` handlers. Engines must not
assume in-memory delivery guarantees beyond "best effort + replay for money."

## 4. Read APIs (how engines query each other)

Each engine exports read functions from its module. Naming: `get<Entity>()`,
`list<Entity>()`, `<entity>Summary()`. Examples an engine may rely on:
- Customer Engine → `getContact(id)`, `getCustomerTimeline(id)`
- Inventory Engine → `getVehicle(id)`, `searchInventory(q)`
- Deal Engine → `getDeal(id)`
- Commission Engine → `getCommissionResult(dealId)` (never read `deal_commissions` raw)
- Configuration Engine → `getConfig(dealer, key)` (see §6)

If a read API you need does not exist, **add it to the owning engine** — do not reach
into its tables. This is the single most important conformance rule to enforce on the
existing code.

## 5. Tool registry (how the AI and external agents act)

Every engine capability that an agent should be able to invoke is registered as a
**tool**: `{ name, description, input_schema, handler }`. The handler calls the
engine's own read/write functions (which emit events). The AI never touches the DB;
it only calls tools. Same shape as the Action Executor registry. Design tools
MCP-compatible so any LLM (Anthropic/OpenAI/Gemini) or external agent uses the same
backend. Every tool call is auditable (emits an event / writes the audit log).

## 6. Configuration (every engine reads config, never hardcodes)

Dealer-specific behavior comes from the **Configuration Engine**, not code:
`getConfig(dealershipId, key)` returns the dealer's value or the global default.
Config domains include departments, commission/bonus plans, accounting rules,
workflow templates, vehicle statuses, lead sources, sales process, required forms,
tax rules, deal types, permissions, notification rules, AI personality, branding.
Existing config-as-data (`accounting_rules`, `workflow_templates`, `state_ownership`,
`commission_plans`, `dealerships.*_settings`) is unified behind this API.

## 7. Audit

Sensitive or money-moving actions write the `audit_log` (actor, action, before/after,
reason, timestamp) in addition to emitting an event. Manager overrides, period locks,
config changes, and payroll posts are always audited.

---

## 8. Definition of "an engine"

A module is a conforming engine when it:
1. **Subscribes** to the events it reacts to (`onEvent`).
2. **Emits** events for every state change it owns.
3. **Exposes read APIs** for its data and **tools** where an agent should act.
4. **Owns only its tables** and reads everything else through other engines' APIs.
5. **Reads configuration** instead of hardcoding dealer-specific behavior.

New feature? First question: **which engine owns this, and what event does it emit?**
If unclear, the architecture — not the feature — needs refinement.

---

## 9. Current conformance gaps (the punch-list this contract creates)

Honest state of the code vs. this contract:
- ✅ Events, workflow, executor, timeline, accounting, exceptions, retry, replay.
- ✅ **Configuration Engine** built (`config-engine.js`, `getConfig`/`setConfig`,
  catalog) — first consumer wired (site chat default tone).
- ✅ **Commission Engine decoupled:** it now SUBSCRIBES to `deal.status_changed`
  (recompute/clawback + emit `commission.calculated`) instead of being called by the
  deal desk. `dashboard.js` no longer calls `recomputeDealCommission`/clawback on the
  status path.
- ◑ **Remaining direct calls to retire:** `dashboard.js` `/reports/deal` (create path)
  still calls `recomputeDealCommission()` on save (data-freshness, not a transition) —
  route via a `deal.updated` event later; `syncDealToAccounting()` (external
  integration, fire-and-forget) → move to an integration-engine subscriber. The
  accounting engine still reads `deals`/`deal_commissions`/`inventory` directly →
  wrap in read APIs.
- ◑ **Tool registry** not yet formalized (executor registry is the template).
- ◑ **Durable bus** (see §3 debt).

Conformance work closes ◑ items. No new engine ships until it meets §8.
