// Canonical `trade.received` producer.
//
// ONE business transition — the dealership takes possession of a customer's trade —
// reachable two ways, so the emit lives here rather than being duplicated:
//   1. manually:      POST /ai/appraisals/:id/take-possession
//   2. automatically: releasePossessionForContact() when the customer's deal is
//                     delivered (the trade they gave us is now ours)
//
// Both callers guard on `awaiting_possession = true` and emit only for rows that
// ACTUALLY flipped, so re-running either path emits nothing. Accounting's
// postJournal() additionally dedupes on (dealership, source, reference, event), so
// even a duplicate emit posts exactly one journal.
//
// This is deliberately NOT emitted from appraisal creation, valuation, approval,
// attaching a trade to a deal, or `/acquire` — none of those transfer control.
import { emitEvent } from './events.js'

export function emitTradeReceived(dealershipId, { inventoryId, appraisalId, contactId, dealId, amount, actorId } = {}) {
  if (!dealershipId || !inventoryId) return
  emitEvent({
    dealershipId,
    eventName: 'trade.received',
    entityType: 'vehicle',
    entityId: inventoryId,
    summary: 'Trade received into inventory',
    department: 'inventory',
    // `ref` is the accounting dedupe key: one receipt per vehicle, forever.
    payload: {
      inventory_id: inventoryId, appraisal_id: appraisalId || null,
      contact_id: contactId || null, deal_id: dealId || null,
      amount: Number(amount) || 0, ref: inventoryId,
    },
    createdBy: actorId || null,
  })
}
