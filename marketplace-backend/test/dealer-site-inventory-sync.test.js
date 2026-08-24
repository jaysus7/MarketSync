import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8')
const feeds = read('../routes/feeds.js')
const engine = read('../sync/engine.js')
const extension = read('../../marketplace-extension/background.js')
const migration = read('../../supabase/migrations/20260824181034_scope_inventory_vin_to_dealership.sql')

test('extension and server pulls install current vehicles into canonical dealer inventory', () => {
  for (const source of [feeds, engine]) {
    assert.match(source, /source: 'dealer_site_sync'/)
    assert.match(source, /archived_at: null/)
    assert.match(source, /awaiting_possession: false/)
    assert.match(source, /upsertDealerInventory\(supabaseAdmin, record\)/)
  }
  assert.match(feeds, /stocknumber: mapped\.stocknumber \|\| null/)
  assert.doesNotMatch(feeds, /onConflict: 'vin'/)
  assert.doesNotMatch(engine, /onConflict: 'vin'/)
})

test('extension refreshes registered external inventory nightly with startup catch-up', () => {
  assert.match(extension, /next\.setHours\(3, 15, 0, 0\)/)
  assert.match(extension, /periodInMinutes: 24 \* 60/)
  assert.match(extension, /lastCapturedAt: Date\.now\(\)/)
  assert.match(extension, /runInventoryAutoCapture\(\{ force: true \}\)/)
})

test('VIN uniqueness is scoped to dealership ownership', () => {
  assert.match(migration, /drop constraint if exists inventory_vin_key/)
  assert.match(migration, /unique \(dealership_id, vin\)/)
})
