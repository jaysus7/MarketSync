import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// `vehicle.acquired` — the canonical NON-TRADE acquisition receipt.
// Mirrors the trade path using the same generic inventory possession fields.
// See docs/STAGE3_INVENTORY_FNI_AUDIT.md §9.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const inv = read('routes/inventory.js')
const acct = read('routes/accounting-engine.js')
const appraisal = read('routes/submodules/ai-appraisal-management.js')
const route = inv.match(/app\.post\('\/inventory\/:id\/take-possession'[\s\S]*?\n  \}\)/)?.[0] || ''

test('the non-trade possession endpoint exists and is gated', () => {
  assert.ok(route, 'POST /inventory/:id/take-possession must exist')
  assert.match(inv, /app\.post\('\/inventory\/:id\/take-possession', requireAuth, requireMfa, requirePermission\('inventory\.edit'\)/)
  assert.match(route, /eq\('dealership_id', req\.dealershipId\)/, 'must be dealership scoped')
})

test('it reuses the existing possession fields — no new model', () => {
  assert.match(route, /awaiting_possession: false, possession_at: at/)
  for (const invented of ['acquisitions', 'acquisition_events', 'lifecycle_state', 'ownership_status']) {
    assert.ok(!inv.includes(invented), `must not introduce ${invented}`)
  }
})

test('TRADE EXCLUSION is enforced server-side, not by hiding UI', () => {
  // A trade-origin unit carries source_appraisal_id and belongs to trade.received.
  assert.match(route, /if \(veh\.source_appraisal_id\)/, 'must reject a trade unit outright')
  assert.match(route, /TRADE_UNIT/)
  // Belt and braces: the UPDATE itself also filters, so a race cannot slip through.
  assert.match(route, /\.is\('source_appraisal_id', null\)/, 'the update must also exclude trade units')
  // And the trade path never emits the generic event.
  assert.doesNotMatch(appraisal, /vehicle\.acquired/, 'the trade path must not emit vehicle.acquired')
  assert.doesNotMatch(route, /trade\.received/, 'the non-trade path must not emit trade.received')
})

test('the event fires only on a genuine transition', () => {
  assert.match(route, /\.eq\('awaiting_possession', true\)/, 'guard on the pre-state')
  assert.match(route, /\.select\('id, invoice_amount'\)/, 'select back what actually flipped')
  assert.match(route, /if \(!flipped \|\| !flipped\.length\)/, 'no flip → no event')
  assert.match(route, /eventName: 'vehicle\.acquired'/)
})

test('repeat calls are idempotent and do not touch ownership timestamps', () => {
  assert.match(route, /if \(veh\.awaiting_possession === false\)/, 'already-possessed short-circuits')
  assert.match(route, /already: true/)
  // The early return happens BEFORE any update, so possession_at is never rewritten.
  const early = route.indexOf('already: true')
  const update = route.indexOf("update({ awaiting_possession: false")
  assert.ok(early < update, 'the idempotent return must precede the update')
})

test('accounting dedupe covers this event on (dealership, acquisition, vehicle, event)', () => {
  // entityId is the vehicle, and the accounting rule uses the entity as its reference.
  assert.match(route, /entityType: 'vehicle', entityId: veh\.id/)
  assert.match(route, /ref: veh\.id/)
  assert.match(acct, /case 'vehicle\.acquired':/)
  assert.match(acct, /__source: 'acquisition', __reference: e/)
  // The existing postJournal dedupe is authoritative — no second system.
  assert.match(acct, /Idempotent: one entry per \(source, reference, event\)/)
})

test('no ledger logic in the inventory route', () => {
  const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const forbidden of ['journal_entries', 'postJournal', 'postByRule', 'contracts_in_transit']) {
    assert.ok(!codeOnly(route).includes(forbidden), `route must not touch the ledger (${forbidden})`)
  }
})

test('non-business states stay silent', () => {
  // Only the possession route emits. Creation, feed import, VIN decode, pricing and
  // media/listing updates must not — proven by the event appearing exactly once in
  // this file, inside the possession route.
  const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const emits = (codeOnly(inv).match(/eventName: 'vehicle\.acquired'/g) || []).length
  assert.equal(emits, 1, 'vehicle.acquired must be emitted from exactly one place')
  assert.ok(route.includes("eventName: 'vehicle.acquired'"), 'and that place is the possession transition')
})
