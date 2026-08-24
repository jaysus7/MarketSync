import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildInventoryIntelligencePayload } from '../routes/submodules/ai-inventory-intel.js'

const DAY = 86400000
const NOW = Date.UTC(2026, 7, 24, 12)
const ago = days => new Date(NOW - days * DAY).toISOString()

test('Inventory Intelligence returns the exact connected dashboard contract', () => {
  const available = [
    {
      id: 'civic-good', vin: '2HGFC2F59MH000001', stocknumber: 'C-1',
      year: 2024, make: 'Honda', model: 'Civic', trim: 'Touring', condition: 'used',
      price: 30000, mileage: 20000,
      description: 'A complete retail description with enough useful detail for a customer listing.',
      image_urls: Array.from({ length: 10 }, (_, i) => `photo-${i}`),
      created_at: ago(200), lot_date: ago(10), photo_score: 88, photo_flags: [], photo_checked_at: ago(1),
    },
    {
      id: 'civic-poor', vin: '2hgfc2f59mh000001', stocknumber: 'C-2',
      year: 2024, make: 'honda', model: 'civic', trim: '', condition: null,
      price: null, mileage: null, description: '', image_urls: [], created_at: ago(100), lot_date: ago(100),
    },
    { id: 'ford-1', year: 2023, make: 'Ford', model: 'F-150', condition: 'used', price: 42000, mileage: 40000, description: '', image_urls: [], lot_date: ago(40) },
    { id: 'ford-2', year: 2022, make: 'Ford', model: 'F-150', condition: 'used', price: 38000, mileage: 60000, description: '', image_urls: [], lot_date: ago(70) },
  ]
  const sold = [
    { make: 'Honda', model: 'Civic', sold_at: ago(5) },
    { make: 'honda', model: 'civic', sold_at: ago(20) },
    { make: 'Honda', model: 'Civic', sold_at: ago(60) },
    { make: 'Honda', model: 'Civic', sold_at: ago(120), last_synced_at: ago(1) },
  ]

  const payload = buildInventoryIntelligencePayload({
    available,
    sold,
    marketMedians: { 'civic-good': 27000 },
    country: 'Canada',
    now: NOW,
  })

  assert.deepEqual(Object.keys(payload.summary).sort(), ['avg_score', 'duplicate_vins', 'needs_attention', 'total'])
  assert.equal(payload.summary.total, 4)
  assert.equal(payload.summary.duplicate_vins, 1)
  assert.equal(payload.duplicate_vins[0].vin, '2HGFC2F59MH000001')
  assert.equal(payload.duplicate_vins[0].units.length, 2)

  const civicVelocity = payload.velocity.find(row => row.make.toLowerCase() === 'honda')
  assert.equal(civicVelocity.sold_30d, 2)
  assert.equal(civicVelocity.sold_90d, 3)
  assert.equal(civicVelocity.current_stock, 2)
  assert.equal(civicVelocity.monthly_velocity, 1)
  assert.equal(civicVelocity.months_of_supply, 2)
  assert.ok(payload.hot_segments.some(row => row.make.toLowerCase() === 'honda'))
  assert.ok(payload.cold_segments.some(row => row.make === 'Ford'))

  const good = payload.vehicles.find(vehicle => vehicle.id === 'civic-good')
  assert.equal(good.days, 10, 'lot_date must win over record creation date')
  assert.equal(good.score, 100)
  assert.equal(good.price_vs_market_pct, 11)
  assert.equal(good.mileage_ratio, 0.5)
  assert.equal(good.score, Object.values(good.breakdown).reduce((sum, value) => sum + value, 0))

  const poor = payload.vehicles.find(vehicle => vehicle.id === 'civic-poor')
  assert.ok(poor.score < 50)
  assert.ok(payload.summary.needs_attention >= 1)
  assert.ok(poor.issues.includes('No photos'))
  assert.ok(poor.issues.includes('No price'))
})

test('empty lots report zero rather than a false perfect health score', () => {
  const payload = buildInventoryIntelligencePayload({ now: NOW })
  assert.equal(payload.summary.total, 0)
  assert.equal(payload.summary.avg_score, 0)
  assert.deepEqual(payload.vehicles, [])
  assert.deepEqual(payload.velocity, [])
})

test('the live route uses canonical schema fields for age and market position', () => {
  const source = readFileSync(new URL('../routes/submodules/ai-inventory-intel.js', import.meta.url), 'utf8')
  assert.match(source, /created_at, lot_date/)
  assert.match(source, /select\('inventory_id, price_median, created_at'\)/)
  assert.doesNotMatch(source, /market_median_price/)
  assert.match(source, /sold_at, state_changed_at, archived_at, last_synced_at/)
})

test('every Inventory Intelligence section is present and wired to a real endpoint', () => {
  const root = new URL('../../', import.meta.url)
  const html = readFileSync(new URL('marketplace-frontend/dashboard.html', root), 'utf8')
  const part20 = readFileSync(new URL('marketplace-frontend/js/modules/dashboard-part20.js', root), 'utf8')
  const part21 = readFileSync(new URL('marketplace-frontend/js/modules/dashboard-part21.js', root), 'utf8')
  const part22 = readFileSync(new URL('marketplace-frontend/js/modules/dashboard-part22.js', root), 'utf8')
  const pricing = readFileSync(new URL('marketplace-backend/routes/ai-pricing.js', root), 'utf8')
  const reports = readFileSync(new URL('marketplace-backend/routes/submodules/ai-reports-cron.js', root), 'utf8')

  for (const id of [
    'lot-ov-count', 'inv-scan-card', 'ai-sync-all-btn', 'ai-lot-report-btn',
    'inv-intel-stats', 'inv-intel-narrative', 'inv-intel-hot', 'inv-intel-cold',
    'inv-intel-dups', 'inv-intel-velocity-body', 'inv-intel-health-body',
    'repricing-save-btn', 'repricing-apply-btn', 'stocking-generate-btn',
    'daily-digest-toggle', 'weekly-report-btn', 'weekly-report-pdf-btn',
  ]) assert.match(html, new RegExp(`id="${id}"`), `${id} must exist`)

  assert.match(part20, /\/inventory\/all/)
  assert.match(part20, /\/ai\/activity/)
  assert.match(part20, /\/ai\/lot-report/)
  assert.match(part21, /\/ai\/sync-all/)
  assert.match(part22, /\/ai\/inventory-intelligence/)
  assert.match(part22, /\/ai\/inventory-narrative/)
  assert.match(part22, /\/ai\/repricing-rules/)
  assert.match(part22, /\/ai\/repricing-apply/)
  assert.match(part22, /\/ai\/stocking-recommendations/)
  assert.match(part22, /\/ai\/weekly-report/)
  assert.match(part22, /data\.sent_to \|\| data\.recipient/)

  for (const route of ['lot-report', 'repricing-rules', 'repricing-apply', 'stocking-recommendations']) {
    assert.match(pricing, new RegExp(`/ai/${route}`), `backend route ${route} must exist`)
  }
  assert.match(reports, /\/ai\/weekly-report/)
  assert.match(reports, /inv_intel_active/)
})

test('stocking recommendations use sold lifecycle dates and never invent generic demand', () => {
  const source = readFileSync(new URL('../routes/ai-pricing.js', import.meta.url), 'utf8')
  assert.match(source, /sold_at, state_changed_at, archived_at, last_synced_at/)
  assert.match(source, /Only recommend make\/model segments present in Recent sell-through/)
  assert.doesNotMatch(source, /highest-demand segment in Ontario/)
})
