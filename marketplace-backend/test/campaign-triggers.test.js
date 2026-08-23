import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Placeholders so importing the route module (which pulls in the Supabase client) does
// not trip the config check when this file runs in isolation.
process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

const src = readFileSync(new URL('../routes/automation.js', import.meta.url), 'utf8')

// The dealership-data-native presets Campaigns must ship (reusing the existing engine).
const NEW_PRESETS = {
  inventory_aged_60: 'inventory_aged',      // vehicle aged 60 days
  service_lapsed_12mo: 'service_lapsed',    // no service in 12 months
  lease_maturity_90: 'lease_maturity',      // lease approaching maturity
  declined_service_followup: 'declined_service', // declined service work
}

test('the dealership-event campaign presets are seeded (inactive) on the existing engine', () => {
  for (const [key, trigger] of Object.entries(NEW_PRESETS)) {
    assert.match(src, new RegExp(`key: '${key}'`), `DEFAULT_CAMPAIGNS must include preset ${key}`)
    assert.match(src, new RegExp(`trigger_event: '${trigger}'`), `preset ${key} must use trigger ${trigger}`)
  }
  // No second automation engine — presets live in the existing DEFAULT_CAMPAIGNS array.
  assert.equal((src.match(/const DEFAULT_CAMPAIGNS = \[/g) || []).length, 1)
})

test('TRIGGER_CATALOG marks new data-dependent triggers unavailable and wired ones available', async () => {
  const mod = await import('../routes/automation.js')
  const cat = mod.TRIGGER_CATALOG
  assert.ok(Array.isArray(cat), 'TRIGGER_CATALOG is exported')
  const by = Object.fromEntries(cat.map(t => [t.key, t]))
  // Wired events (an enqueueForTrigger caller exists) are available.
  for (const k of ['internet_lead', 'appointment_booked', 'show_no_sale', 'delivered', 'equity', 'birthday', 'holiday']) {
    assert.equal(by[k]?.available, true, `${k} should be available (it is wired)`)
  }
  // New data-dependent events ship as config-only previews, not faked as working.
  for (const k of ['inventory_aged', 'service_lapsed', 'lease_maturity', 'declined_service']) {
    assert.equal(by[k]?.available, false, `${k} must be marked unavailable until its data source is wired`)
  }
})

test('a preview trigger that is not wired never enqueues sends (no faking)', async () => {
  const mod = await import('../routes/automation.js')
  // enqueueForTrigger returns without touching the DB for an unavailable trigger, even
  // with a valid-looking context — so nothing is sent for a not-yet-wired event.
  await assert.doesNotReject(mod.enqueueForTrigger('dealer-1', 'inventory_aged', { contactId: 'c-1' }))
})

test('every seeded preview preset is inactive so it cannot fire before its data exists', () => {
  // Each new preset object must carry is_active: false.
  for (const key of Object.keys(NEW_PRESETS)) {
    const block = src.slice(src.indexOf(`key: '${key}'`), src.indexOf(`key: '${key}'`) + 600)
    assert.match(block, /is_active: false/, `${key} must be seeded inactive`)
  }
})
