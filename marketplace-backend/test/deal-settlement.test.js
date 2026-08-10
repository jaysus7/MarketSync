import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { apportionSettlement } from '../routes/dashboard.js'

// Phase 5 PR 5.2 — financed deal posting semantics.
//
// THE DEFECT: `vehicle_delivered` debited the whole sale to Accounts Receivable while
// `funding_received` credited Contracts in Transit — an account nothing ever debited. A
// financed deal therefore overstated customer AR by the lender's share, and CIT went
// negative the moment funding arrived. A funded financed deal could never clear.
//
// These run the real apportionment, not assertions about it.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const eng = strip(read('routes/accounting-engine.js'))
const dash = strip(read('routes/dashboard.js'))
const fni = strip(read('routes/fni.js'))
const rule = read('migrations/2026-08-10-phase5-deal-settlement-rule.sql')

// ── The settlement itself ────────────────────────────────────────────────────

test('a financed deal puts the lender amount in CIT, never in customer AR', () => {
  // 30,000 vehicle + 1,500 F&I + 2,400 tax = 33,900, fully settled.
  const s = apportionSettlement({ settled: 33900, deposit: 500, trade: 1400, cash: 2000, financed: 30000 })
  assert.equal(s.financed, 30000, 'the lender amount is a lender receivable')
  assert.equal(s.customer_ar, 0, 'the customer owes nothing — this is the whole defect')
  assert.equal(s.deposit + s.trade + s.cash + s.financed + s.customer_ar, 33900)
  assert.ok(s.balanced)
})

test('a cash deal never touches Contracts in Transit', () => {
  const s = apportionSettlement({ settled: 33900, cash: 33900 })
  assert.equal(s.financed, 0, 'CIT is for a lender, and there is no lender')
  assert.equal(s.customer_ar, 0)
  assert.ok(s.balanced)
})

test('a cash deal the customer has not fully paid leaves a real receivable', () => {
  // "Cash deal" must not mean "customer AR forever", but a genuine unpaid balance is AR.
  const s = apportionSettlement({ settled: 33900, cash: 10000 })
  assert.equal(s.customer_ar, 23900)
  assert.equal(s.financed, 0)
  assert.ok(s.balanced)
})

test('a prior deposit settles exactly once', () => {
  const s = apportionSettlement({ settled: 33900, deposit: 1000 })
  assert.equal(s.deposit, 1000, 'applied once')
  assert.equal(s.customer_ar, 32900, 'and it reduces what the customer still owes')
  assert.equal(s.deposit + s.customer_ar, 33900, 'never counted twice')
  assert.ok(s.balanced)
})

test('trade equity settles once and only equity counts', () => {
  const s = apportionSettlement({ settled: 33900, trade: 8900, financed: 25000 })
  assert.equal(s.trade, 8900)
  assert.equal(s.financed, 25000)
  assert.equal(s.customer_ar, 0)
  assert.ok(s.balanced)
})

test('consideration is applied in a fixed order so the result is deterministic', () => {
  // Already-received money first, the lender's promise last: whatever remains unsettled
  // is what the lender is being asked to fund, not an arbitrary residue.
  const s = apportionSettlement({ settled: 1000, deposit: 400, trade: 300, cash: 200, financed: 500 })
  assert.deepEqual(
    { deposit: s.deposit, trade: s.trade, cash: s.cash, financed: s.financed },
    { deposit: 400, trade: 300, cash: 200, financed: 100 })
  assert.equal(s.customer_ar, 0)
  assert.ok(s.balanced)
})

test('over-settlement is reported, not absorbed into a fabricated liability', () => {
  const s = apportionSettlement({ settled: 1000, cash: 900, financed: 500 })
  assert.equal(s.over_settled, 400, 'the excess must be visible')
  assert.equal(s.customer_ar, 0, 'and must not become a negative receivable')
  assert.ok(s.balanced, 'the journal still balances')
})

test('no consideration at all is simply a receivable', () => {
  const s = apportionSettlement({ settled: 5000 })
  assert.equal(s.customer_ar, 5000)
  assert.ok(s.balanced)
})

test('the settlement always balances, across a range of shapes', () => {
  // The invariant the correction rests on: components equal the amount being settled.
  const shapes = [
    { settled: 0 }, { settled: 100, cash: 100 }, { settled: 100, financed: 250 },
    { settled: 19999.99, deposit: 0.01, trade: 5000, cash: 1, financed: 14000 },
    { settled: 33900, deposit: 500, trade: 1400, cash: 2000, financed: 30000 },
    { settled: 750.55, cash: 250.25, financed: 500.30 },
  ]
  for (const shape of shapes) {
    const s = apportionSettlement(shape)
    const sum = Math.round((s.deposit + s.trade + s.cash + s.financed + s.customer_ar) * 100) / 100
    assert.equal(sum, Math.round((shape.settled || 0) * 100) / 100, `unbalanced for ${JSON.stringify(shape)}`)
    assert.ok(s.balanced, `balanced flag wrong for ${JSON.stringify(shape)}`)
    assert.ok(s.customer_ar >= 0, `negative receivable for ${JSON.stringify(shape)}`)
  }
})

// ── How the ledger uses it ───────────────────────────────────────────────────

test('the delivered-deal rule debits settlement components, not one lump of AR', () => {
  const lines = rule.match(/\(null, 'vehicle_delivered', true, '\[([\s\S]*?)\]'/)?.[1] || ''
  assert.ok(lines, 'the corrected rule must exist')
  const debits = Object.fromEntries(
    [...lines.matchAll(/"account_key":"([a-z_]+)","side":"debit","source":"([a-z_]+)"/g)].map(m => [m[1], m[2]]))
  assert.equal(debits.contracts_in_transit, 'cit_amount', 'the lender share is a lender receivable')
  assert.equal(debits.accounts_receivable, 'customer_ar', 'AR carries ONLY the customer balance')
  assert.equal(debits.cash, 'cash_received')
  assert.equal(debits.customer_deposits, 'deposit_applied', 'applying a deposit clears its liability')
  assert.equal(debits.trade_allowance, 'trade_applied', 'applying a trade clears its liability')
  // The credit side must be untouched — this correction changes what the debit means,
  // not how revenue is recognised.
  const credits = Object.fromEntries(
    [...lines.matchAll(/"account_key":"([a-z_]+)","side":"credit","source":"([a-z_]+)"/g)].map(m => [m[1], m[2]]))
  assert.equal(credits.vehicle_sales, 'selling_price')
  assert.equal(credits.fni_income, 'fni_gross')
  assert.equal(credits.tax_collected, 'tax')
  assert.equal(credits.inventory, 'cost')
})

test('AR no longer receives the whole sale', () => {
  // The exact shape of the old defect, pinned so it cannot come back.
  assert.doesNotMatch(rule, /"account_key":"accounts_receivable","side":"debit","source":"ar_total"/)
  assert.doesNotMatch(eng, /ar_total:/, 'the ar_total token is gone from the delivery context')
})

test('Accounting reads the settlement from the Deal Engine, not its own arithmetic', () => {
  assert.match(eng, /import \{ getDeal, dealSettlement \} from '\.\/dashboard\.js'/)
  const fn = eng.match(/async function postDealDelivered[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /await dealSettlement\(dealershipId, deal\)/)
  // No second deal-calculation engine inside Accounting.
  assert.doesNotMatch(fn, /amount_financed|down_payment|trade_value|deposit_amount/,
    'Accounting must not re-derive deal figures itself')
})

test('funding clears CIT by the same figure delivery debited', () => {
  // If these two ever diverge, CIT keeps a permanent residue that nothing explains.
  const route = fni.match(/app\.put\('\/fni\/deals\/:id\/funding'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the funding endpoint must exist')
  assert.match(route, /await dealSettlement\(req\.dealershipId, deal\.id\)/)
  assert.match(route, /settlement\?\.cit/)
  // The old fallback debited nothing at delivery but credited selling_price on funding.
  assert.doesNotMatch(route, /deal\.selling_price \?\? 0|approved_amount \?\? deal\.selling_price/,
    'falling back to selling_price would leave CIT permanently unbalanced')
})

test('the lender amount has one canonical source', () => {
  const fn = dash.match(/export async function dealLenderAmount[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /deal_lender_decisions/, 'the selected lender decision is authoritative')
  assert.match(fn, /\.eq\('selected', true\)/)
  assert.match(fn, /deal\.amount_financed/, 'with the deal figure as the fallback')
  assert.match(fn, /deal\.deal_type === 'cash'/, 'a cash deal has no lender amount')
})

test('an over-settled deal raises a visible exception', () => {
  const fn = eng.match(/async function postDealDelivered[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(s\.over_settled > 0\)/)
  assert.match(fn, /kind: 'deal_over_settled'/)
  assert.match(fn, /department: 'Accounting'/)
})
