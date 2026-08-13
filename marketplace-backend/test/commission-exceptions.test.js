import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectExceptions, EXCEPTION_TYPES } from '../commission-exceptions.js'
import { canReview, canApprove, payReady } from '../commission-periods.js'

const types = (arr) => arr.map(e => e.type).sort()

test('clean line on a healthy deal → no exceptions', () => {
  const line = { plan_id: 'p1', total: 500, status: 'earned', breakdown: { cost_known: true } }
  const deal = { selling_price: 30000, deal_status: 'delivered' }
  assert.deepEqual(detectExceptions(line, deal), [])
})

test('no plan → error', () => {
  const out = detectExceptions({ total: 100, status: 'pending' }, { selling_price: 20000 })
  assert.ok(out.some(e => e.type === 'no_plan' && e.severity === 'error'))
})

test('negative total → error', () => {
  const out = detectExceptions({ plan_id: 'p', total: -50, status: 'earned' }, { selling_price: 20000 })
  assert.ok(out.some(e => e.type === 'negative_total' && e.severity === 'error'))
})

test('unwound deal but line not clawed back → error', () => {
  const out = detectExceptions({ plan_id: 'p', total: 500, status: 'earned' }, { selling_price: 20000, deal_status: 'working' })
  assert.ok(out.some(e => e.type === 'unwound_not_reversed'))
})

test('unwound deal WITH clawed-back line → no unwound exception', () => {
  const out = detectExceptions({ plan_id: 'p', total: 500, status: 'clawed_back' }, { selling_price: 20000, deal_status: 'dead' })
  assert.ok(!out.some(e => e.type === 'unwound_not_reversed'))
})

test('deal has price but zero commission → warning (unless clawed back)', () => {
  const out = detectExceptions({ plan_id: 'p', total: 0, status: 'earned' }, { selling_price: 25000, deal_status: 'delivered' })
  assert.ok(out.some(e => e.type === 'zero_commission' && e.severity === 'warning'))
  // clawed-back lines don't raise payout warnings
  const out2 = detectExceptions({ plan_id: 'p', total: 0, status: 'clawed_back' }, { selling_price: 25000 })
  assert.ok(!out2.some(e => e.type === 'zero_commission'))
})

test('missing vehicle cost → warning', () => {
  const out = detectExceptions({ plan_id: 'p', total: 300, status: 'earned', breakdown: { cost_known: false } }, { selling_price: 20000, deal_status: 'delivered' })
  assert.ok(out.some(e => e.type === 'missing_cost'))
})

test('stale pending: delivered >45 days ago and still pending → warning', () => {
  const now = Date.parse('2026-08-03T00:00:00Z')
  const old = { plan_id: 'p', total: 400, status: 'pending', breakdown: { cost_known: true } }
  const deal = { selling_price: 20000, deal_status: 'delivered', delivered_at: '2026-06-01T00:00:00Z' } // ~63 days
  assert.ok(detectExceptions(old, deal, now).some(e => e.type === 'stale_pending'))
  // recent pending is fine
  const recent = { ...deal, delivered_at: '2026-07-30T00:00:00Z' }
  assert.ok(!detectExceptions(old, recent, now).some(e => e.type === 'stale_pending'))
})

test('multiple anomalies stack on one line', () => {
  const out = detectExceptions({ total: -10, status: 'earned' }, { selling_price: 20000, deal_status: 'working' })
  assert.deepEqual(types(out), ['negative_total', 'no_plan', 'unwound_not_reversed'].sort())
})

test('every emitted exception type has a known severity', () => {
  const out = detectExceptions({ total: -1, status: 'pending', breakdown: { cost_known: false } }, { selling_price: 1, deal_status: 'lost' })
  for (const e of out) assert.ok(EXCEPTION_TYPES[e.type], `${e.type} should be a known type`)
})

// ── review / approval gates ──
test('review/approve/pay gates enforce lock → review → approve → pay', () => {
  const open = { status: 'open' }
  const locked = { status: 'locked' }
  const reviewed = { status: 'locked', reviewed_at: 't' }
  const approved = { status: 'locked', reviewed_at: 't', approved_at: 't' }

  assert.equal(canReview(open), false)      // must be locked first
  assert.equal(canReview(locked), true)
  assert.equal(canReview(reviewed), false)  // already reviewed

  assert.equal(canApprove(locked), false)   // not reviewed yet
  assert.equal(canApprove(reviewed), true)
  assert.equal(canApprove(approved), false) // already approved

  assert.equal(payReady(locked), false)     // not approved
  assert.equal(payReady(reviewed), false)
  assert.equal(payReady(approved), true)
})
