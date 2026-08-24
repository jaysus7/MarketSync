import test from 'node:test'
import assert from 'node:assert/strict'
import { selectSiteInventory } from '../routes/site.js'

const marketplace = { id: 'm1', source: 'marketplace', make: 'Ford' }
const dealer = { id: 'd1', source: 'dealer_site_sync', make: 'Toyota' }

test('Digital site auto mode uses Marketplace inventory until dealer inventory exists', () => {
  assert.deepEqual(selectSiteInventory([marketplace], 'auto'), [marketplace])
  assert.deepEqual(selectSiteInventory([marketplace, dealer], 'auto'), [dealer])
})

test('Digital site inventory source modes are explicit and deterministic', () => {
  assert.deepEqual(selectSiteInventory([marketplace, dealer], 'marketplace'), [marketplace])
  assert.deepEqual(selectSiteInventory([marketplace, dealer], 'dealer'), [dealer])
  assert.deepEqual(selectSiteInventory([marketplace, dealer], 'merged'), [marketplace, dealer])
})
