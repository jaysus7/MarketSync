import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEventContract } from '../event-contract.js'

test('accepts versioned dotted event names', () => {
  assert.deepEqual(validateEventContract('sales.lead.created', 2), { ok: true, version: 2 })
  assert.deepEqual(validateEventContract('deal.status_changed'), { ok: true, version: 1 })
})

test('rejects malformed event names', () => {
  for (const name of ['', 'lead_created', 'Sales.lead.created', 'sales..created', 'sales.lead.created!']) {
    assert.equal(validateEventContract(name).ok, false)
  }
})

test('rejects invalid event versions', () => {
  for (const version of [0, -1, 1.5, 'two']) {
    assert.equal(validateEventContract('sales.lead.created', version).ok, false)
  }
})
