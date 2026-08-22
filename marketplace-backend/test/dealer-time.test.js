import test from 'node:test'
import assert from 'node:assert/strict'
import { dealerLocalToUtc, validTimeZone } from '../utils/dealerTime.js'

test('dealer local schedule resolves in the dealership timezone, not the browser timezone', () => {
  assert.deepEqual(dealerLocalToUtc('2026-08-18T10:30', 'America/Toronto'), {
    utc: '2026-08-18T14:30:00.000Z', ambiguous: false,
  })
})

test('DST spring-forward wall time is refused instead of silently shifted', () => {
  assert.throws(() => dealerLocalToUtc('2026-03-08T02:30', 'America/Toronto'), /does not exist/)
})

test('DST overlap resolves deterministically and reports ambiguity', () => {
  assert.deepEqual(dealerLocalToUtc('2026-11-01T01:30', 'America/Toronto'), {
    utc: '2026-11-01T05:30:00.000Z', ambiguous: true,
  })
})

test('invalid timezone and malformed local values are refused', () => {
  assert.equal(validTimeZone('America/Toronto'), true)
  assert.equal(validTimeZone('Not/A_Zone'), false)
  assert.throws(() => dealerLocalToUtc('tomorrow', 'America/Toronto'), /YYYY-MM-DD/)
})
