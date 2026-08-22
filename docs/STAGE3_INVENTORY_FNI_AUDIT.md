# Stage 3 audit — Inventory & F&I (before code)

Audit of `staging` per the Stage 3 brief Step 1 and Doc 22 §3. Classification:
**KEEP · MOVE · COMPOSE · GAP · HANDOFF GAPS**.

> **Relationship to PR #69.** A partial Stage 3 is already implemented and green
> (`js/modules/inventory-workspace.js`, `js/modules/fni-workspace.js`, 406/406). It
> delivers the department skeletons — Today + Work tabs on the engine shell, basic
> attention queues, and the appraisal/deal id continuity. It does **not** yet deliver
> Acquisition, Merchandising, the Vehicle Record workspace, the lender abstraction or
> the Funding queue. This audit covers the full brief; the delta is §5.

---

## 1. KEEP — substantial functionality that already exists

### Inventory
| Capability | API | UI |
|---|---|---|
| Vehicle catalog | `/inventory`, `/inventory/all`, `/inventory/:id` | `inventory` page (part4/5) |
| Feeds / sync | `/inventory-feeds`, `/feeds/probe`, `/inventory/sync/progress` | feeds UI |
| Appraisals | `/ai/appraisals`, `/ai/appraisals/:id` | `appraisal` (part16) |
| Equity mining | `/equity/leases`, `/equity/radar`, `/equity/worksheet/:id` | `equity` |
| Recon | `/recon` (`stage`, `inventory_id`, `deal_id`, `salesperson_id`, `checklist`) | `recon` (part15) |
| Pricing intelligence | `/ai-pricing/*` | `inv-intel` |
| Market data | `/ai/market` | `market` |
| Listings / syndication | `/listings`, `/listings/fb-alerts`, `/listings/pending-fb-sync`, `/listings/:id/sold*`, `/syndication/config` | Facebook/marketplace UI |
| Window stickers / brochures | `/vinsticker/*`; `window_sticker_url`, `brochure_url` on inventory | `vin-sticker` |
| Vehicle history | `/inventory/:id/carfax`, `recalls`, `vin_data` | vehicle detail |

### F&I
| Capability | API | UI |
|---|---|---|
| Deal queue | `/fni/deals`, `/fni/deals/:id/approve`, `/fni/deals/:id/delivered` | `fni` (part15) |
| Desking | `/reports/deal`, `openDeskForContact()` | `desk` (part17) |
| **Credit applications** | `/credit/application` (GET/POST), `/submit`, `/export`, `/:id/reveal` | credit UI |
| **Lenders** | `/fni/lenders` (GET/POST), `/fni/lenders/:id` (PUT) | lender config |
| **F&I products** | `/fni/products` (GET/POST), `/:id` (PUT) | product catalogue |
| Deposits | `/deposits/config`, `/deposits/checkout`, `/deposits/connect` | deposits |
| **E-sign / documents** | `/esign`, `/esign/create`, `/esign/:token/sign`, `/:id/detail` | esign |
| Delivery | `/delivery/queue`, `/delivery/:id/checklist`, `/delivery/:id/deliver` | `delivery` |
| F&I reporting | `/fni/reports` | — |

**Nothing in the brief's Inventory or F&I feature list needs to be built from scratch
except Funding (§4).** This stage is overwhelmingly composition.

## 2. MOVE — already completed in Phase 1 / PR #69

Cleanup/Recon, Inventory Intelligence, Market, Appraisals and Equity Mining were moved
out of Sales into Inventory in Phase 1. Delivery sits under F&I. **No further moves
required**; the brief's "REMOVE/MOVE" list is satisfied.

## 3. COMPOSE — existing pieces to bring together

| Target | Composed from |
|---|---|
| Inventory → Acquisition | `/ai/appraisals` + `inventory.source_appraisal_id` + `awaiting_possession` |
| Inventory → Merchandising | `image_urls` + `/listings` + `/listings/fb-alerts` + `window_sticker_url` + `brochure_url` + `/syndication/config` |
| Inventory → Pricing | `/ai-pricing/*` + `/ai/market` + `price` + age |
| Vehicle Record workspace | existing vehicle detail + recon + listings + carfax/recalls + deals |
| F&I → Queue | `/fni/deals` (`deal_status`, `approved_at`, `credit_app_at`, `delivered_at`) |
| F&I → Credit | `/credit/application` opened from the deal |
| F&I → Menu | `/fni/products` + `deals.fni_products` |
| F&I → Contracts | `/esign` document/signature state |

## 4. GAP — genuinely missing

1. **Funding has no state.** `deals` carries `approved_at`, `credit_app_at`,
   `sold_at`, `delivered_at` — but **no funding field** and no funding endpoint. The
   brief's Funding queue (submitted / conditions / received / aging / chargeback) has
   nothing to read or write. See §6 — this needs a decision.
2. **Lender decisions are not persisted per deal.** `/fni/lenders` configures lenders;
   there is no record of *this deal was submitted to lender X, response Y, rate/term/
   conditions*. The brief's multi-decision lender workflow has no backing store.
3. Vehicle Record workspace does not exist as one surface (data all exists).
4. Acquisition and Merchandising have no composed view.
5. Inventory/F&I Insights, Automation and Settings tabs are thin or absent.

## 5. Delta still to implement (beyond PR #69)

Inventory: Acquisition view · Merchandising view · Vehicle Record workspace · richer
Today exceptions (feed failure, PDI/safety, sold-not-ready) · Insights/Automation/
Settings. F&I: rename Work views to Queue|Credit|Menu|Contracts|Funding · queue state
mapping · lender panel · Funding queue · Insights/Automation/Settings. Plus mobile
validation and the four E2E acceptance paths.

### 5.1 Status of that delta

| Item | Landed in | Note |
|---|---|---|
| F&I Queue/Credit/Menu/Contracts/Funding, lender panel, Funding queue | 3B.1 (PR #70) | reads canonical `funding_status` + `deal_lender_decisions` |
| Inventory Acquisition view | **3B.2** | grouped by pipeline step, trade vs purchased split by canonical transition |
| Inventory Merchandising view | **3B.2** | `invMerchChecks()` — photos · price · description · window sticker · AI copy |
| Vehicle Record workspace | **3B.2** | `js/modules/vehicle-record.js`, `vehicleOpen(id)`; pattern documented in `DEALER_OS_UX_ARCHITECTURE.md` §13 |
| Today exception: sold-not-ready | **3B.2** | highest-severity Inventory exception — it risks a booked delivery |
| Inventory/F&I Insights + Settings | 3B.1 / **3B.2** | Insights now shows frontline readiness and acquisition mix |
| Mobile ~390px + E2E acceptance paths | **3B.2** | all five paths exercised headless; see the handoff doc |

**Deliberately NOT built** (would need backend that does not exist, and the brief
forbids inventing it):

- *Feed-failure exceptions* — there is no per-dealership feed-health read. The only
  feed signals are `/inventory/sync/progress` (in-flight only, in-memory) and
  `last_synced_at`. A "feed failed" claim derived from a stale timestamp would be a
  guess, so nothing is shown rather than something wrong.
- *PDI / safety exceptions* — recon `stage` is dealer-configurable free text; there is
  no canonical PDI or safety flag to read. Recon owns that state and surfaces it.
- *Inventory/F&I Automation tabs* — no department-scoped automation read exists; the
  automation engine is global. Left off the tab order rather than shown empty.

## 6. ⚠️ HANDOFF GAPS — material findings

### 6.1 Three accounting rules have a consumer but **no producer**

`routes/accounting-engine.js` handles these events and posts real journals:

| Event | Accounting handler | Producer |
|---|---|---|
| `deal.status_changed` → delivered | `postDealDelivered` | ✅ emitted (delivery.js / fni.js) |
| `deposit.paid` | `deposit_received` | ✅ |
| `commission.*` | commission journals | ✅ |
| **`funding.received`** | `funding_received` (clears **Contracts in Transit**, acct 1150) | ❌ **nothing emits it** |
| **`trade.received`** | `trade_received` | ❌ **nothing emits it** |
| **`vehicle.acquired`** | `vehicle_acquired` | ❌ **nothing emits it** |

Verified by search: those three names appear **only** in `accounting-engine.js`.

Consequences today:
- **Funding never posts.** A financed delivery debits Contracts in Transit and nothing
  ever clears it — the balance grows indefinitely.
- **Acquisitions and trades never post**, so vehicle cost does not reach the ledger
  through this path.

This is not a UI problem and Stage 3 cannot "compose" its way around it. The fix is
small and architecturally correct — emit the existing canonical events from the
existing state transitions — but it is a **backend change with financial effect**, so
per AGENTS.md §A4/§A17 and Doc 22 §5 I am reporting it rather than folding it silently
into UI work.

### 6.2 Sales → Inventory (trade) — structurally sound
`inventory.source_appraisal_id` links a stocked vehicle to the originating appraisal;
one appraisal record, no duplicate. Verified in PR #69. Missing only the
`vehicle.acquired` / `trade.received` emission above.

### 6.3 Sales → F&I — structurally sound
A deal carries `contact_id` + `inventory_id`; F&I opens the same customer via
`crmOpenForm()` and the same desk via `openDeskForContact()`. No re-entry. Verified.

### 6.4 F&I → Delivery — partially computable
`/delivery/queue` derives readiness from `deal_status = 'sold'` + `delivery_checklist`.
Blockers for *credit incomplete*, *contract unsigned* and *lender condition outstanding*
are **not** currently computable — credit lives in `credit_applications`, signatures in
`esign`, and there is no lender-decision record (§4.2).

## 7. FILE PLAN (delta)

| File | Change |
|---|---|
| `js/modules/inventory-workspace.js` | Acquisition + Merchandising views, richer Today, Insights/Automation/Settings |
| `js/modules/vehicle-record.js` | **new** — Vehicle Record workspace |
| `js/modules/fni-workspace.js` | Queue/Credit/Menu/Contracts/Funding, lender panel, Insights/Automation/Settings |
| `dashboard.html` | vehicle-record container + script tags |
| `test/stage3-departments.test.js` | extend |
| `test/accounting-event-producers.test.js` | **new** — guard that every accounting rule has a producer |

## 8. BACKEND IMPACT

**UI work: zero.** Every Inventory/F&I view composes existing endpoints.

**Two items require a decision before I touch them:**

1. **Emit the three dangling events** (`funding.received`, `trade.received`,
   `vehicle.acquired`) from their existing transitions. Small, no new table, no schema
   change — but it starts posting journals that currently never post. Needs approval
   because it changes financial behaviour.
2. **Funding + lender decision state.** The Funding queue and lender workflow have no
   backing store. Options:
   - **(a)** Derive a minimal funding view from existing state (delivered + not yet
     reconciled). No schema change; limited fidelity — no conditions, no aging by
     submission, no chargebacks.
   - **(b)** Add `funding_status` / `funded_at` columns to `deals` plus a
     `deal_lender_decisions` table. This is genuinely new business state — a deal *can*
     receive several lender decisions, which no existing record can represent — so it
     passes the "why can the canonical record not represent this?" test. Still a schema
     change requiring approval.

I have not implemented either. Recommendation: **(b)** for lender decisions (the data
genuinely does not exist anywhere), and emit the three events — but both on your
explicit approval, applied to **staging Supabase only**.


---

## 9. Canonical event semantics (Part A result)

Documented here because Inventory, Accounting, Management and automation must all use
the same semantics.

### `trade.received` — IMPLEMENTED

| | |
|---|---|
| **Emitter** | `routes/trade-receipt.js` → `emitTradeReceived()` (one shared producer) |
| **Trigger 1 (manual)** | `POST /ai/appraisals/:id/take-possession` — `routes/submodules/ai-appraisal-management.js` |
| **Trigger 2 (automatic)** | `releasePossessionForContact()` — `routes/automation.js`, fired when the customer's deal is delivered |
| **Previous state** | `inventory.awaiting_possession = true`, `possession_at = null`, `trade_appraisals.acquired_at = null` |
| **Resulting state** | `inventory.awaiting_possession = false`, `possession_at = now`, `trade_appraisals.acquired_at = now` |
| **Real dealership event** | The dealership physically/legally takes possession of the customer's trade |
| **Entity / dedupe ref** | the **vehicle** (`inventory.id`) — one receipt per vehicle, forever |

**Why this transition is financially correct.** `POST /ai/appraisals/:id/acquire`
deliberately creates the inventory row with `awaiting_possession: true` — the unit
exists on paper but the dealership does not control it, and it is excluded from the
website and syndication feeds (`site.js`, `syndication.js` both filter on
`awaiting_possession`). Possession is the moment the asset genuinely belongs to the
dealership, so it is the moment the trade should hit the books. The codebase already
made this distinction; we only attached the event to it.

**Why it is safe to emit.** Both triggers guard the UPDATE on
`awaiting_possession = true` and `.select()` back the rows that actually flipped,
emitting one event per genuinely changed vehicle. An already-possessed unit matches
zero rows, so retries, re-saves and re-deliveries emit nothing. Accounting's
`postJournal()` then dedupes on `(dealership_id, 'trade', inventory_id,
'trade.received')`, so even a duplicate emit posts exactly one journal.

**Explicitly does NOT emit from:** appraisal creation, valuation, appraisal approval,
`/acquire`, attaching a trade to a deal, or any generic deal save — all pinned by test.

### `vehicle.acquired` — IMPLEMENTED (was a domain gap; approved and closed)

**No canonical non-trade acquisition transition exists.** Evidence:

- Every writer of `awaiting_possession` / `possession_at` is trade-specific — both go
  through `trade_appraisals` (`ai-appraisal-management.js`, `automation.js`).
- `inventory.source` values (`manual`, `import`, `website`, `ai_assistant`,
  `appraisal`, `cached`, `fallback`) record **data provenance, not a business event**.
- Nothing marks an auction, wholesale, dealer-trade or direct purchase as having
  entered dealership ownership. An inventory row is simply created — which the brief
  explicitly rules out as an acquisition signal.

**Smallest domain-safe fix (proposed, not built).** Reuse the possession semantics that
already exist generically on `inventory` rather than inventing an acquisition system:
one endpoint `POST /inventory/:id/take-possession` that flips the same
`awaiting_possession → false` + `possession_at` pair for a non-trade unit, records the
acquisition cost in the existing `invoice_amount` column, and emits `vehicle.acquired`
with the vehicle as the dedupe reference — mirroring the trade path exactly. It needs
no new table and no new state model.

This was **not** implemented because it creates a new business transition with
financial effect, and the brief requires the transition to be proven rather than
guessed. It is a small, well-understood next step.


### `vehicle.acquired` — final semantics

| | |
|---|---|
| **Endpoint** | `POST /inventory/:id/take-possession` |
| **Source** | `routes/inventory.js` |
| **Eligibility** | `source_appraisal_id IS NULL` (non-trade only) **and** `awaiting_possession = true` |
| **Previous state** | `awaiting_possession = true`, `possession_at = null` |
| **Resulting state** | `awaiting_possession = false`, `possession_at = now` |
| **Payload / ref** | `entityType: 'vehicle'`, `entityId: inventory.id`, `amount` from `invoice_amount`, `ref: inventory.id` |
| **Accounting dedupe** | `(dealership_id, 'acquisition', inventory_id, 'vehicle.acquired')` — the existing `postJournal()` convention; no second dedupe system |

**Why this is the correct financial event.** It mirrors the trade path exactly: the
vehicle becomes a dealership asset at *possession*, not when a row is created. Row
creation, feed import, VIN decode, pricing and media/listing updates all leave
`awaiting_possession` untouched and emit nothing — the event is emitted from exactly
one place in the file (test-enforced).

**How trade units are excluded — server-side, twice.** A unit created from a trade
appraisal carries `source_appraisal_id`, and its canonical lifecycle is
`trade.received`. This route (a) rejects such a unit with `409 TRADE_UNIT`, and (b)
also filters `source_appraisal_id IS NULL` in the UPDATE itself, so even a race
cannot let one vehicle emit both acquisition events. The trade path likewise never
mentions `vehicle.acquired`. Both directions are pinned by test.

**Idempotency — three layers.** (1) An already-possessed unit short-circuits *before*
any write, so ownership timestamps are never rewritten and no event fires. (2) The
UPDATE is guarded on `awaiting_possession = true` and `.select()`s back only rows that
actually flipped, so a concurrent double-call transitions and emits once. (3)
Accounting's `postJournal()` dedupes on the key above, so even a duplicate emit posts
exactly one journal.

**Part A is complete.** Both acquisition events now have proven canonical producers
that cannot collide.
