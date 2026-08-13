import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, toCsv, buildPayrollRows, buildCsv, PAYROLL_COLUMNS } from '../payroll-export.js'

test('csvCell quotes only when needed and escapes inner quotes', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('he said "hi"'), '"he said ""hi"""')
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(0), '0')
})

test('toCsv emits a header even with no rows', () => {
  const csv = toCsv([{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }], [])
  assert.equal(csv, 'A,B\n')
})

const period = { name: 'Aug 2026', start_date: '2026-08-01', end_date: '2026-08-31' }
const reps = { r1: { name: 'Alex Rep', email: 'alex@x.com' }, r2: { name: 'Bo Sales', email: 'bo@x.com' } }

test('buildPayrollRows aggregates per rep and counts distinct deals', () => {
  const lines = [
    { rep_id: 'r1', deal_id: 'd1', front_amount: 500, back_amount: 100, spiff_amount: 50, total: 650, status: 'earned' },
    { rep_id: 'r1', deal_id: 'd2', front_amount: 300, back_amount: 0, spiff_amount: 0, total: 300, status: 'earned' },
    { rep_id: 'r2', deal_id: 'd3', front_amount: 200, back_amount: 200, spiff_amount: 0, total: 400, status: 'earned' },
  ]
  const rows = buildPayrollRows(period, lines, reps)
  const r1 = rows.find(r => r.employee_id === 'r1')
  assert.equal(r1.units, 2)
  assert.equal(r1.front, 800)
  assert.equal(r1.back, 100)
  assert.equal(r1.amount, 950)
  assert.equal(r1.employee_name, 'Alex Rep')
  // sorted by amount desc → r1 (950) before r2 (400)
  assert.equal(rows[0].employee_id, 'r1')
})

test('clawed-back lines are excluded from payroll totals', () => {
  const lines = [
    { rep_id: 'r1', deal_id: 'd1', front_amount: 500, back_amount: 0, spiff_amount: 0, total: 500, status: 'earned' },
    { rep_id: 'r1', deal_id: 'd2', front_amount: 400, back_amount: 0, spiff_amount: 0, total: 400, status: 'clawed_back' },
  ]
  const rows = buildPayrollRows(period, lines, reps)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].amount, 500)   // clawed-back 400 excluded
  assert.equal(rows[0].units, 1)
})

test('buildCsv produces a header + one line per rep with the period name', () => {
  const lines = [{ rep_id: 'r1', deal_id: 'd1', front_amount: 500, back_amount: 0, spiff_amount: 0, total: 500, status: 'earned' }]
  const csv = buildCsv(period, lines, reps)
  const rows = csv.trim().split('\n')
  assert.equal(rows[0], PAYROLL_COLUMNS.map(c => c.header).join(','))
  assert.equal(rows.length, 2)
  assert.ok(rows[1].includes('Alex Rep'))
  assert.ok(rows[1].includes('Aug 2026'))
})

test('empty period → header only, no throw', () => {
  const csv = buildCsv(period, [], {})
  assert.equal(csv, PAYROLL_COLUMNS.map(c => c.header).join(',') + '\n')
})
