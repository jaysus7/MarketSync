import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  periodBounds, periodLabel, canTransition, isAssignable, PERIOD_TYPES, PERIOD_STATUSES,
} from '../commission-periods.js'

test('monthly bounds = first..last day of the anchor month', () => {
  assert.deepEqual(periodBounds('monthly', '2026-08-14'), { start: '2026-08-01', end: '2026-08-31' })
  // February (non-leap) ends on the 28th
  assert.deepEqual(periodBounds('monthly', '2026-02-10'), { start: '2026-02-01', end: '2026-02-28' })
  // leap year February
  assert.deepEqual(periodBounds('monthly', '2024-02-10'), { start: '2024-02-01', end: '2024-02-29' })
})

test('semi_monthly splits at the 15th', () => {
  assert.deepEqual(periodBounds('semi_monthly', '2026-08-01'), { start: '2026-08-01', end: '2026-08-15' })
  assert.deepEqual(periodBounds('semi_monthly', '2026-08-15'), { start: '2026-08-01', end: '2026-08-15' })
  assert.deepEqual(periodBounds('semi_monthly', '2026-08-16'), { start: '2026-08-16', end: '2026-08-31' })
  assert.deepEqual(periodBounds('semi_monthly', '2026-08-31'), { start: '2026-08-16', end: '2026-08-31' })
})

test('weekly bounds = Monday..Sunday of the anchor week', () => {
  // 2026-08-05 is a Wednesday → week is Mon 2026-08-03 .. Sun 2026-08-09
  assert.deepEqual(periodBounds('weekly', '2026-08-05'), { start: '2026-08-03', end: '2026-08-09' })
  // a Monday anchors its own week
  assert.deepEqual(periodBounds('weekly', '2026-08-03'), { start: '2026-08-03', end: '2026-08-09' })
  // a Sunday belongs to the week that started the previous Monday
  assert.deepEqual(periodBounds('weekly', '2026-08-09'), { start: '2026-08-03', end: '2026-08-09' })
})

test('biweekly bounds are 14 days, aligned to the fixed epoch Monday (2024-01-01)', () => {
  const b = periodBounds('biweekly', '2026-08-05')
  // 14-day span, starts on a Monday
  const start = new Date(b.start + 'T00:00:00Z'), end = new Date(b.end + 'T00:00:00Z')
  assert.equal((end - start) / 86400000, 13)
  assert.equal(start.getUTCDay(), 1) // Monday
  // stable: any date inside the block returns the same bounds
  const b2 = periodBounds('biweekly', b.end)
  assert.deepEqual(b2, b)
})

test('custom has no computable bounds', () => {
  assert.throws(() => periodBounds('custom', '2026-08-01'), /Cannot auto-compute/)
})

test('periodLabel: monthly → YYYY-MM, else a range', () => {
  assert.equal(periodLabel('monthly', '2026-08-01', '2026-08-31'), '2026-08')
  assert.equal(periodLabel('weekly', '2026-08-03', '2026-08-09'), '2026-08-03 → 2026-08-09')
})

test('lifecycle transitions: open ⇄ locked → paid (paid terminal)', () => {
  assert.equal(canTransition('open', 'locked'), true)
  assert.equal(canTransition('locked', 'open'), true)
  assert.equal(canTransition('locked', 'paid'), true)
  assert.equal(canTransition('open', 'paid'), false)   // must lock first
  assert.equal(canTransition('paid', 'open'), false)   // terminal
  assert.equal(canTransition('paid', 'locked'), false)
  assert.equal(canTransition('open', 'nonsense'), false)
})

test('lines are assignable only while the period is open', () => {
  assert.equal(isAssignable('open'), true)
  assert.equal(isAssignable('locked'), false)
  assert.equal(isAssignable('paid'), false)
})

test('exported enums are the expected sets', () => {
  assert.deepEqual(PERIOD_TYPES, ['weekly', 'biweekly', 'semi_monthly', 'monthly', 'custom'])
  assert.deepEqual(PERIOD_STATUSES, ['open', 'locked', 'paid'])
})
