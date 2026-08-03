import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statementTotals } from '../commission-statements.js'

test('statementTotals sums payable components and counts distinct deals', () => {
  const lines = [
    { deal_id: 'd1', front_amount: 500, back_amount: 100, spiff_amount: 50, total: 650, status: 'earned' },
    { deal_id: 'd2', front_amount: 300, back_amount: 0, spiff_amount: 0, total: 300, status: 'pending' },
  ]
  const t = statementTotals(lines)
  assert.equal(t.units, 2)
  assert.equal(t.front, 800)
  assert.equal(t.back, 100)
  assert.equal(t.spiff, 50)
  assert.equal(t.payable, 950)
  assert.equal(t.by_status.earned, 650)
  assert.equal(t.by_status.pending, 300)
})

test('clawed-back lines are excluded from payable + units but tracked separately', () => {
  const lines = [
    { deal_id: 'd1', front_amount: 500, back_amount: 0, spiff_amount: 0, total: 500, status: 'earned' },
    { deal_id: 'd2', front_amount: 400, back_amount: 0, spiff_amount: 0, total: 400, status: 'clawed_back' },
  ]
  const t = statementTotals(lines)
  assert.equal(t.units, 1)
  assert.equal(t.payable, 500)
  assert.equal(t.clawed_back, 400)
  assert.equal(t.by_status.clawed_back, 400)
})

test('empty statement → all zeros, no throw', () => {
  const t = statementTotals([])
  assert.equal(t.units, 0)
  assert.equal(t.payable, 0)
  assert.deepEqual(t.by_status, {})
})

test('keeps cent totals exact across many lines', () => {
  const t = statementTotals([
    { deal_id: 'd1', front_amount: 33.33, back_amount: 0, spiff_amount: 0, total: 33.33, status: 'earned' },
    { deal_id: 'd2', front_amount: 33.34, back_amount: 0, spiff_amount: 0, total: 33.34, status: 'earned' },
    { deal_id: 'd3', front_amount: 0.01, back_amount: 0, spiff_amount: 0, total: 0.01, status: 'earned' },
  ])
  assert.equal(t.front, 66.68)
  assert.equal(t.payable, 66.68)
})
