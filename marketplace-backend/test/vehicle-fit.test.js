import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAffordability, rankAvailableInventory } from '../routes/vehicle-fit.js'
import { readFileSync } from 'node:fs'

test('affordability reuses selected lender approval and actual customer inputs', () => {
  const a = buildAffordability({ applicant: { employment: { income_monthly: 7000 }, address: { payment: 1800 } }, financing: { down_payment: 5000, trade_value: 10000, trade_payoff: 4000 } },
    { decision: 'approved', approved_amount: 40000, rate: 6, term_months: 60 }, { desired_payment: 700 })
  assert.equal(a.approved_amount, 40000)
  assert.equal(a.trade_equity, 6000)
  assert.equal(a.source, 'selected_lender_decision')
  assert.ok(a.max_vehicle_price > 0)
})

test('vehicle fit returns only canonical available inventory', () => {
  const affordability = { max_vehicle_price: 50000, down_payment: 5000, trade_equity: 0, apr: 6, term_months: 60 }
  const matches = rankAvailableInventory([
    { id: 'live', status: 'available', price: 45000, body_style: 'SUV', image_urls: ['p.jpg'], stocknumber: 'A1' },
    { id: 'sold', status: 'sold', price: 30000 },
    { id: 'archived', status: 'available', archived_at: '2026-01-01', price: 30000 },
    { id: 'not-owned', status: 'available', awaiting_possession: true, price: 30000 },
    { id: 'over', status: 'available', price: 80000 },
  ], affordability, { body_style: 'SUV' })
  assert.deepEqual(matches.map(x => x.inventory_id), ['live'])
  assert.equal(matches[0].stock_number, 'A1')
  assert.ok(matches[0].estimated_payment > 0)
  assert.ok(matches[0].fit_score >= 0 && matches[0].fit_score <= 100)
})

test('no lender or payment assumptions means no fabricated payment', () => {
  const a = buildAffordability(null, null, { down_payment: 1000 })
  const [m] = rankAvailableInventory([{ id: 'v', status: 'available', price: 20000 }], a, {})
  assert.equal(a.max_vehicle_price, null)
  assert.equal(m.estimated_payment, null)
})

test('Customer Card consumes the canonical fit endpoint and renders real inventory identifiers', () => {
  const ui = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part4.js', import.meta.url), 'utf8')
  assert.match(ui, /customers\/\$\{encodeURIComponent\(contactId\)\}\/vehicle-fit/)
  assert.match(ui, /v\.inventory_id/)
  assert.match(ui, /v\.stock_number/)
  assert.match(ui, /v\.fit_score/)
})
