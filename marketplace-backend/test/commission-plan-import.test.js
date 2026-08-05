import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCommissionPlanConfig, normalizeCommissionImport, planHasPayRule, commissionImportSummary } from '../commission-plan-import.js'

test('normalizes imported commission fields to the engine schema', () => {
  const config = normalizeCommissionPlanConfig({
    front: { method: 'percent', percent: 25.126, flat: -10, min: 200, pack: 500, pack_type: 'flat' },
    back: { method: 'flat', flat: 150 }, back_to: 'split', back_fni_pct: 140,
    split_covers: { front: true, back: false }, spiff_per_deal: 75,
    bonuses: [{ basis: 'units', threshold: 10, amount: 500 }, { basis: 'bad', threshold: 0, amount: 2 }],
  })
  assert.deepEqual(config.front, { method: 'percent', percent: 25.13, flat: 0, min: 200, pack: 500, pack_type: 'flat' })
  assert.equal(config.back.flat, 150)
  assert.equal(config.back_fni_pct, 100)
  assert.deepEqual(config.split_covers, { front: true, back: false, spiff: true })
  assert.deepEqual(config.bonuses, [{ basis: 'units', threshold: 10, amount: 500 }])
})

test('asks only an essential question when no payable rule exists', () => {
  const imported = normalizeCommissionImport({ plans: [{ name: 'Sales plan', config: {} }] }, 'pay-plan.pdf')
  assert.equal(imported.plans.length, 1)
  assert.equal(imported.questions.length, 1)
  assert.match(imported.questions[0], /amount or percentage/i)
  assert.equal(planHasPayRule(imported.plans[0].config), false)
})

test('keeps a complete document import ready without extra questions', () => {
  const imported = normalizeCommissionImport({ plans: [{ name: 'Standard Sales', config: { front: { method: 'greater', percent: 25, flat: 250 } } }] }, 'plan.docx')
  assert.equal(imported.questions.length, 0)
  assert.equal(imported.plans[0].config.front.percent, 25)
  assert.equal(planHasPayRule(imported.plans[0].config), true)
})

test('summary makes inactive review status explicit', () => {
  const text = commissionImportSummary([{ name: 'Standard Sales' }], ['Quarterly contest was not imported.'])
  assert.match(text, /inactive/i)
  assert.match(text, /Nothing is active, assigned, or used for payroll/i)
  assert.match(text, /Quarterly contest/i)
})
