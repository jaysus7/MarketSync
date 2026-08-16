import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Ownership history — a vehicle keeps EVERY owner and a customer keeps EVERY vehicle
// (current + former). Proven end-to-end against staging; these guard the wiring so a
// refactor can't silently go back to overwriting the owner and losing former owners.

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const eng = read('routes/service-engine.js')

test('service-engine exports the ownership-history helpers', () => {
  for (const fn of ['recordVehicleOwnership', 'getVehicleOwners', 'listCustomerVehiclesEver']) {
    assert.match(eng, new RegExp(`export (async )?function ${fn}\\b`), `missing export ${fn}`)
  }
})

test('changing a vehicle owner records a transition instead of overwriting', () => {
  // findOrCreateCustomerVehicle must run ownership recording for a known customer.
  assert.match(eng, /const finalize = async \(veh\) => \{[\s\S]*recordVehicleOwnership\(dealershipId, veh\.id, contactId\)/,
    'findOrCreateCustomerVehicle must record ownership via finalize()')
  // Every vehicle-resolving return path is finalized.
  assert.match(eng, /return finalize\(created\)/, 'create path must finalize ownership')
  assert.match(eng, /return finalize\(await patchExisting\(existing\)\)/, 'existing-VIN path must finalize ownership')
  assert.match(eng, /return finalize\(await patchExisting\(raced\)\)/, 'raced path must finalize ownership')
})

test('recordVehicleOwnership closes the prior period and opens a new current one', () => {
  const body = eng.slice(eng.indexOf('function recordVehicleOwnership'))
  // Closes the outgoing owner.
  assert.match(body, /is_current: false, owned_until: now/, 'must close the prior owner period')
  // Opens the new current owner.
  assert.match(body, /is_current: true, owned_from: now/, 'must open the new owner period')
  // No-op when already the current owner.
  assert.match(body, /current\.contact_id === contactId\) return/, 'must skip when owner is unchanged')
})

test('a migration establishes the ownership-history table with a single-current-owner guarantee', () => {
  const mig = read('migrations/2026-08-16-customer-vehicle-ownership-history.sql')
  assert.match(mig, /CREATE TABLE IF NOT EXISTS public\.customer_vehicle_owners/)
  assert.match(mig, /customer_vehicle_owners_current_uk[\s\S]*WHERE is_current/i,
    'must enforce exactly one current owner per vehicle')
  assert.match(mig, /REFERENCES public\.customer_vehicles\(id\)/, 'FK to the canonical vehicle')
  assert.match(mig, /REFERENCES public\.contacts\(id\)/, 'FK to the customer')
  // The dangling-link hardening on repair_orders.
  assert.match(mig, /repair_orders_customer_vehicle_id_fkey/, 'RO->customer_vehicle FK must be added')
})
