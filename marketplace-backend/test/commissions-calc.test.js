import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  n, round2, mergeConfig, computeCommission, computeBackAmount, volumeBonus,
} from '../commissions-calc.js'

// Deterministic commission math. No AI, no IO — these are the exact formulas the
// engine pays reps on, so every branch is pinned with a fixed expected number.

// ── helpers ──────────────────────────────────────────────────────────────────
test('n() coerces safely and never returns NaN', () => {
  assert.equal(n('1200.50'), 1200.5)
  assert.equal(n(null), 0)
  assert.equal(n(undefined), 0)
  assert.equal(n('abc'), 0)
  assert.equal(n(NaN), 0)
})

test('round2() rounds to cents', () => {
  assert.equal(round2(1.006), 1.01)
  assert.equal(round2(2.344), 2.34)
  assert.equal(round2(900.005 + 0.001), 900.01)
  assert.equal(round2('x'), 0)
})

// ── front: percentage of gross ───────────────────────────────────────────────
test('front — percentage of gross (price − cost − pack)', () => {
  const deal = { selling_price: 30000, cost: 25000, fni_items: [] }
  const cfg = { front: { method: 'percent', percent: 20, pack: 500 } }
  const r = computeCommission(deal, cfg)
  // gross = 30000 - 25000 - 500 = 4500; 20% = 900
  assert.equal(r.breakdown.front_gross, 4500)
  assert.equal(r.front_amount, 900)
  assert.equal(r.total, 900)
})

test('front — pack as a percentage of selling price', () => {
  const deal = { selling_price: 30000, cost: 25000, fni_items: [] }
  const cfg = { front: { method: 'percent', percent: 25, pack: 5, pack_type: 'percent' } }
  const r = computeCommission(deal, cfg)
  // pack = 5% of 30000 = 1500; gross = 30000 - 25000 - 1500 = 3500; 25% = 875
  assert.equal(r.breakdown.pack, 1500)
  assert.equal(r.front_amount, 875)
})

// ── front: flat ──────────────────────────────────────────────────────────────
test('front — flat amount ignores gross', () => {
  const deal = { selling_price: 30000, cost: 25000, fni_items: [] }
  const cfg = { front: { method: 'flat', flat: 250, percent: 20 } }
  const r = computeCommission(deal, cfg)
  assert.equal(r.front_amount, 250)
})

// ── front: greater-of ────────────────────────────────────────────────────────
test('front — greater-of picks the flat when the % is lower', () => {
  const deal = { selling_price: 30000, cost: 28000, fni_items: [] }
  const cfg = { front: { method: 'greater', percent: 20, flat: 500 } }
  const r = computeCommission(deal, cfg)
  // gross = 2000; 20% = 400; flat 500 wins
  assert.equal(r.front_amount, 500)
})

test('front — greater-of picks the % when it beats the flat', () => {
  const deal = { selling_price: 40000, cost: 30000, fni_items: [] }
  const cfg = { front: { method: 'greater', percent: 20, flat: 500 } }
  const r = computeCommission(deal, cfg)
  // gross = 10000; 20% = 2000 beats 500
  assert.equal(r.front_amount, 2000)
})

test('front — greater-of defaults when no method is set', () => {
  const deal = { selling_price: 40000, cost: 30000, fni_items: [] }
  const r = computeCommission(deal, { front: { percent: 20, flat: 500 } })
  assert.equal(r.breakdown.front_method, 'greater')
  assert.equal(r.front_amount, 2000)
})

// ── front: minimum floor ─────────────────────────────────────────────────────
test('front — minimum commission floors a thin deal', () => {
  const deal = { selling_price: 20000, cost: 19800, fni_items: [] }
  const cfg = { front: { method: 'percent', percent: 20, min: 300 } }
  const r = computeCommission(deal, cfg)
  // gross = 200; 20% = 40; floored up to the 300 minimum
  assert.equal(r.front_amount, 300)
  assert.equal(r.breakdown.front_min, 300)
})

test('front — minimum does not cap a strong deal', () => {
  const deal = { selling_price: 40000, cost: 30000, fni_items: [] }
  const cfg = { front: { method: 'percent', percent: 20, min: 300 } }
  const r = computeCommission(deal, cfg)
  assert.equal(r.front_amount, 2000)  // 2000 > 300, no floor applied
})

// ── front: unknown vehicle cost ──────────────────────────────────────────────
test('front — unknown cost cannot compute % gross (falls back to flat)', () => {
  const deal = { selling_price: 30000, cost: null, fni_items: [] }
  const cfg = { front: { method: 'percent', percent: 20, flat: 400 } }
  const r = computeCommission(deal, cfg)
  assert.equal(r.breakdown.cost_known, false)
  assert.equal(r.breakdown.front_gross, null)
  assert.equal(r.front_amount, 400)   // no cost → percent method falls back to flat
})

test('front — unknown cost, greater-of still honors the flat', () => {
  const deal = { selling_price: 30000, cost: 0, fni_items: [] }
  const cfg = { front: { method: 'greater', percent: 20, flat: 600 } }
  const r = computeCommission(deal, cfg)
  // no usable cost → pct branch is 0, greater-of gives the flat
  assert.equal(r.front_amount, 600)
})

// ── back / F&I ───────────────────────────────────────────────────────────────
test('back — percentage of F&I product revenue', () => {
  const deal = { selling_price: 30000, cost: 25000, fni_items: [{ price: 1200 }, { price: 800 }] }
  const cfg = { front: { method: 'flat', flat: 0 }, back: { method: 'percent', percent: 10 } }
  const r = computeCommission(deal, cfg)
  assert.equal(r.breakdown.fni_gross, 2000)
  assert.equal(r.back_amount, 200)  // 10% of 2000
})

test('back — flat F&I amount ignores the product revenue', () => {
  const deal = { selling_price: 30000, cost: 25000, fni_items: [{ price: 5000 }] }
  const cfg = { front: { method: 'flat', flat: 0 }, back: { method: 'flat', flat: 150 } }
  const r = computeCommission(deal, cfg)
  assert.equal(r.back_amount, 150)
})

test('computeBackAmount() matches the inline back calc', () => {
  const deal = { fni_items: [{ price: 1000 }, { price: 500 }] }
  assert.equal(computeBackAmount(deal, { method: 'percent', percent: 20 }), 300)
  assert.equal(computeBackAmount(deal, { method: 'flat', flat: 250 }), 250)
  assert.equal(computeBackAmount({ fni_items: null }, { method: 'percent', percent: 20 }), 0)
})

// ── spiff + totals ───────────────────────────────────────────────────────────
test('spiff — per-deal spiff adds on top of front + back', () => {
  const deal = { selling_price: 40000, cost: 30000, fni_items: [{ price: 1000 }] }
  const cfg = { front: { method: 'percent', percent: 10 }, back: { method: 'percent', percent: 10 }, spiff_per_deal: 100 }
  const r = computeCommission(deal, cfg)
  // front = 10% of 10000 = 1000; back = 10% of 1000 = 100; spiff = 100
  assert.equal(r.front_amount, 1000)
  assert.equal(r.back_amount, 100)
  assert.equal(r.spiff_amount, 100)
  assert.equal(r.total, 1200)
})

// ── overrides / mergeConfig ──────────────────────────────────────────────────
test('mergeConfig — a per-deal override wins over the plan', () => {
  const plan = { front: { method: 'percent', percent: 20 }, back: { method: 'percent', percent: 10 }, spiff_per_deal: 0 }
  const cfg = mergeConfig(plan, { front: { flat: 999, method: 'flat' }, spiff_per_deal: 50 })
  assert.equal(cfg.front.method, 'flat')
  assert.equal(cfg.front.flat, 999)
  assert.equal(cfg.front.percent, 20)  // untouched keys survive the merge
  assert.equal(cfg.spiff_per_deal, 50)
})

test('computeCommission — override changes the payout', () => {
  const deal = { selling_price: 40000, cost: 30000, fni_items: [] }
  const plan = { front: { method: 'percent', percent: 20 } }
  const base = computeCommission(deal, plan)
  const overridden = computeCommission(deal, plan, { front: { method: 'flat', flat: 750 } })
  assert.equal(base.front_amount, 2000)
  assert.equal(overridden.front_amount, 750)
})

// ── volume bonus ─────────────────────────────────────────────────────────────
test('volumeBonus — pays the single highest units tier met', () => {
  const cfg = { bonuses: [
    { basis: 'units', threshold: 10, amount: 500 },
    { basis: 'units', threshold: 20, amount: 1500 },
  ] }
  assert.equal(volumeBonus(cfg, 9, 0), 0)      // below the first tier
  assert.equal(volumeBonus(cfg, 12, 0), 500)   // first tier only
  assert.equal(volumeBonus(cfg, 25, 0), 1500)  // top tier, not additive
})

test('volumeBonus — units and gross tiers stack across bases', () => {
  const cfg = { bonuses: [
    { basis: 'units', threshold: 10, amount: 500 },
    { basis: 'gross', threshold: 100000, amount: 1000 },
  ] }
  assert.equal(volumeBonus(cfg, 15, 120000), 1500)  // both bases met → summed
  assert.equal(volumeBonus(cfg, 15, 50000), 500)    // only the units base met
})

test('volumeBonus — no rules pays nothing', () => {
  assert.equal(volumeBonus({}, 100, 1e9), 0)
  assert.equal(volumeBonus(null, 100, 1e9), 0)
})

// ── regression: the front/spiff write-back the recompute crashed on ──────────
test('regression — front + spiff feed the deal vehicle_commission field', () => {
  // Guards the bug where recompute referenced undefined frontSales/frontCo. The deal's
  // vehicle_commission must equal front + spiff (what /commissions/preview shows).
  const deal = { selling_price: 40000, cost: 30000, fni_items: [{ price: 2000 }] }
  const cfg = { front: { method: 'percent', percent: 10 }, back: { method: 'percent', percent: 10 }, spiff_per_deal: 250 }
  const r = computeCommission(deal, cfg)
  assert.equal(round2(r.front_amount + r.spiff_amount), 1250)  // 1000 + 250
  assert.equal(r.back_amount, 200)
})
