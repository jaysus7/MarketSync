import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// `trade.received` producer guards. The transition is: the dealership takes
// POSSESSION of a customer's trade — reachable manually
// (POST /ai/appraisals/:id/take-possession) and automatically
// (releasePossessionForContact, when the customer's deal is delivered).
// See docs/STAGE3_INVENTORY_FNI_AUDIT.md §9.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const emitter = read('routes/trade-receipt.js')
const appraisal = read('routes/submodules/ai-appraisal-management.js')
const automation = read('routes/automation.js')
const acct = read('routes/accounting-engine.js')

test('there is ONE shared trade.received emitter', () => {
  assert.match(emitter, /eventName: 'trade\.received'/)
  // Both call sites use it rather than emitting inline (one semantics, one place).
  assert.match(appraisal, /emitTradeReceived\(/)
  assert.match(automation, /emitTradeReceived\(/)
  for (const src of [appraisal, automation]) {
    assert.doesNotMatch(src, /eventName: 'trade\.received'/, 'call sites must not emit inline')
  }
})

test('the event fires only for rows that ACTUALLY changed possession', () => {
  // Manual path: guarded update + select back the flipped rows.
  const takePossession = appraisal.match(/take-possession'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(takePossession, 'take-possession route must exist')
  assert.match(takePossession, /\.eq\('awaiting_possession', true\)/, 'must guard on the pre-state')
  assert.match(takePossession, /\.select\('id, invoice_amount, price'\)/, 'must select back what flipped')
  assert.match(takePossession, /if \(flipped && flipped\.length\)/, 'emit only when a row flipped')

  // Automatic path: same guard, one event per genuinely flipped vehicle.
  const release = automation.match(/async function releasePossessionForContact[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(release, 'releasePossessionForContact must exist')
  assert.match(release, /\.eq\('awaiting_possession', true\)/)
  assert.match(release, /\.select\('id, invoice_amount'\)/)
  assert.match(release, /for \(const v of flipped \|\| \[\]\)/, 'one event per flipped vehicle')
})

test('re-running either path cannot re-emit', () => {
  // The guard is the pre-state itself: once awaiting_possession is false the update
  // matches zero rows, so `flipped` is empty and nothing is emitted.
  const takePossession = appraisal.match(/take-possession'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(takePossession, /re-posting this endpoint is a no-op and cannot re-emit/)
  assert.match(automation, /a re-delivery or a retry emits no event/)
})

test('earlier trade states do NOT emit', () => {
  // /acquire creates the paper unit with awaiting_possession: true — it is NOT receipt.
  const acquire = appraisal.match(/appraisals\/:id\/acquire'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(acquire, 'acquire route must exist')
  assert.match(acquire, /awaiting_possession: true/, 'acquire must leave the unit awaiting possession')
  assert.doesNotMatch(acquire, /emitTradeReceived|trade\.received/, 'acquire must not emit receipt')
  // Appraisal creation / valuation must not emit either.
  const appraise = appraisal.match(/app\.post\('\/ai\/appraise'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.doesNotMatch(appraise, /emitTradeReceived|trade\.received/, 'valuation must not emit receipt')
})

test('the stable accounting reference is the vehicle', () => {
  // One receipt per vehicle, forever — this is the accounting dedupe key.
  assert.match(emitter, /entityId: inventoryId/)
  assert.match(emitter, /ref: inventoryId/)
  assert.match(acct, /case 'trade\.received':/)
  assert.match(acct, /__source: 'trade', __reference: p\.ref \|\| e/)
})

test('producers contain no ledger logic', () => {
  // Strip comments first — these files legitimately *describe* how Accounting dedupes;
  // what must not exist is ledger CODE.
  const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const [name, src] of [['emitter', emitter], ['appraisal', appraisal], ['automation', automation]]) {
    const code = codeOnly(src)
    for (const forbidden of ['journal_entries', 'postJournal', 'postByRule', 'contracts_in_transit']) {
      assert.ok(!code.includes(forbidden), `${name} must not touch the ledger (${forbidden})`)
    }
  }
})
