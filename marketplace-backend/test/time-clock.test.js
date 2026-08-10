import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionMinutes, sessionHours, roundMinutes, overlaps, findOpenSession, summarize } from '../time-clock.js'

const T = (s) => `2026-08-03T${s}:00Z`

test('sessionMinutes: completed session minus breaks', () => {
  const e = { clock_in: T('09:00'), clock_out: T('17:30'), break_minutes: 30 }
  assert.equal(sessionMinutes(e), 8 * 60)          // 8.5h − 30m break = 8.0h
  assert.equal(sessionHours(e), 8)
})

test('sessionMinutes: active session accrues against now', () => {
  const now = Date.parse(T('12:00'))
  const e = { clock_in: T('09:00'), clock_out: null, break_minutes: 0 }
  assert.equal(sessionMinutes(e, now), 180)
})

test('sessionMinutes: never negative (breaks exceed span)', () => {
  const e = { clock_in: T('09:00'), clock_out: T('09:20'), break_minutes: 60 }
  assert.equal(sessionMinutes(e), 0)
})

test('sessionMinutes: bad/empty input → 0', () => {
  assert.equal(sessionMinutes(null), 0)
  assert.equal(sessionMinutes({ clock_in: 'nonsense' }), 0)
  assert.equal(sessionMinutes({ clock_in: T('10:00'), clock_out: T('09:00') }), 0) // out before in
})

test('roundMinutes: nearest increment (quarter hour)', () => {
  assert.equal(roundMinutes(7, 15), 0)
  assert.equal(roundMinutes(8, 15), 15)
  assert.equal(roundMinutes(52, 15), 45)
  assert.equal(roundMinutes(53, 15), 60)
  assert.equal(roundMinutes(53, 0), 53)   // no rounding
})

test('overlaps: detects double-counting, ignores adjacent', () => {
  const a = { clock_in: T('09:00'), clock_out: T('12:00') }
  const b = { clock_in: T('11:00'), clock_out: T('13:00') }
  const c = { clock_in: T('12:00'), clock_out: T('14:00') }  // starts exactly when a ends
  assert.equal(overlaps(a, b), true)
  assert.equal(overlaps(a, c), false)
})

test('findOpenSession: returns the active/unclosed entry', () => {
  const entries = [
    { id: '1', status: 'completed', clock_out: T('12:00') },
    { id: '2', status: 'active', clock_out: null },
  ]
  assert.equal(findOpenSession(entries)?.id, '2')
  assert.equal(findOpenSession([{ id: '1', status: 'completed', clock_out: T('12:00') }]), null)
})

test('summarize: totals + per-employee + per-day breakdowns', () => {
  const entries = [
    { employee_id: 'a', clock_in: T('09:00'), clock_out: T('12:00'), break_minutes: 0 }, // 180
    { employee_id: 'a', clock_in: '2026-08-04T09:00:00Z', clock_out: '2026-08-04T10:00:00Z', break_minutes: 0 }, // 60
    { employee_id: 'b', clock_in: T('10:00'), clock_out: T('14:00'), break_minutes: 60 }, // 180
  ]
  const s = summarize(entries)
  assert.equal(s.total_minutes, 420)
  assert.equal(s.total_hours, 7)
  assert.equal(s.by_employee.a.hours, 4)   // 240m
  assert.equal(s.by_employee.b.hours, 3)   // 180m
  assert.equal(s.by_day['2026-08-03'].minutes, 360)
  assert.equal(s.by_day['2026-08-04'].minutes, 60)
})

test('summarize: optional rounding applies per session', () => {
  const entries = [{ employee_id: 'a', clock_in: T('09:00'), clock_out: T('09:07'), break_minutes: 0 }] // 7m
  assert.equal(summarize(entries, { roundIncr: 15 }).total_minutes, 0)
  assert.equal(summarize(entries).total_minutes, 7)
})
