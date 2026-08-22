import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceAttentionItems, partsAttentionItems, inventoryAttentionItems, fniAttentionItems } from '../routes/operational-attention.js'
import { MY_DAY_GAPS, MY_DAY_SOURCES } from '../routes/my-day.js'

test('Service and Parts compose the same blocker without copying the repair order', () => {
  const ros = [{ id: 'ro-1', ro_number: 'RO-100', status: 'in_progress', updated_at: new Date().toISOString() }]
  const requests = [{ id: 'pr-1', ro_id: 'ro-1', status: 'backordered', part_number: 'PAD-1' }]
  assert.equal(serviceAttentionItems(ros, requests)[0].ref, 'ro-1')
  assert.equal(serviceAttentionItems(ros, requests)[0].kind, 'parts_blocker')
  assert.equal(partsAttentionItems(requests)[0].ref, 'pr-1')
  assert.equal(partsAttentionItems(requests)[0].kind, 'parts_shortage')
})

test('Inventory attention derives only from canonical vehicle readiness fields', () => {
  const rows = inventoryAttentionItems([{ id: 'v1', year: 2025, make: 'Ford', model: 'F-150', price: 0, image_urls: [], stocknumber: null }])
  assert.equal(rows.length, 1)
  assert.match(rows[0].reason, /price, photos, stock number/)
  assert.equal(inventoryAttentionItems([{ id: 'v2', price: 10, image_urls: ['photo'], stocknumber: 'S1' }]).length, 0)
})

test('F&I funding attention clears when the canonical deal is funded', () => {
  const delivered = { id: 'd1', deal_status: 'delivered', funding_status: 'submitted', delivered_at: new Date().toISOString() }
  assert.equal(fniAttentionItems([delivered])[0].kind, 'funding_outstanding')
  assert.equal(fniAttentionItems([{ ...delivered, funding_status: 'funded' }]).length, 0)
})

test('all previously named My Day gaps now have permissioned canonical producers', () => {
  assert.deepEqual(MY_DAY_GAPS, [])
  for (const key of ['service', 'parts', 'inventory', 'fni']) {
    const source = MY_DAY_SOURCES.find(item => item.key === key)
    assert.ok(source?.permission)
    assert.equal(typeof source?.load, 'function')
  }
})
