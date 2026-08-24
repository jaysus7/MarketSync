import test from 'node:test'
import assert from 'node:assert/strict'
import { upsertDealerInventory } from '../sync/dealerInventory.js'

class Query {
  constructor(rows) {
    this.rows = rows
    this.filters = []
    this.action = 'select'
    this.payload = null
  }
  select() { return this }
  eq(field, value) { this.filters.push([field, value]); return this }
  limit() { return this }
  update(payload) { this.action = 'update'; this.payload = payload; return this }
  insert(payload) { this.action = 'insert'; this.payload = payload; return this }
  matches(row) { return this.filters.every(([field, value]) => row[field] === value) }
  async maybeSingle() {
    return { data: this.rows.find(row => this.matches(row)) || null, error: null }
  }
  async single() {
    if (this.action === 'insert') {
      const duplicate = this.rows.find(row => row.dealership_id === this.payload.dealership_id && row.vin === this.payload.vin)
      if (duplicate) return { data: null, error: { code: '23505', message: 'duplicate' } }
      const row = { id: `row-${this.rows.length + 1}`, ...this.payload }
      this.rows.push(row)
      return { data: { id: row.id }, error: null }
    }
    const row = this.rows.find(candidate => this.matches(candidate))
    if (!row) return { data: null, error: { code: 'PGRST116', message: 'not found' } }
    Object.assign(row, this.payload)
    return { data: { id: row.id }, error: null }
  }
}

const client = rows => ({ from: () => new Query(rows) })

test('canonical upsert updates only the matching dealership VIN', async () => {
  const rows = [
    { id: 'one', dealership_id: 'dealer-a', vin: 'SAMEVIN', price: 100 },
    { id: 'two', dealership_id: 'dealer-b', vin: 'SAMEVIN', price: 200 }
  ]

  const result = await upsertDealerInventory(client(rows), {
    dealership_id: 'dealer-b', vin: 'SAMEVIN', price: 250
  })

  assert.equal(result.error, null)
  assert.equal(rows[0].price, 100)
  assert.equal(rows[1].price, 250)
})

test('canonical upsert inserts a new dealership-owned vehicle', async () => {
  const rows = []
  const result = await upsertDealerInventory(client(rows), {
    dealership_id: 'dealer-a', vin: 'NEWVIN', source: 'dealer_site_sync'
  })

  assert.equal(result.error, null)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].dealership_id, 'dealer-a')
  assert.equal(rows[0].source, 'dealer_site_sync')
})
