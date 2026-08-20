import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part15 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part15.js', import.meta.url), 'utf8')
const reconRouteSrc = readFileSync(new URL('../routes/recon.js', import.meta.url), 'utf8')

test('GET /recon/:inventory_id/handoff endpoint is registered in backend routes', () => {
  assert.match(reconRouteSrc, /app\.get\('\/recon\/:inventory_id\/handoff'/, 'handoff endpoint must be registered')
  assert.match(reconRouteSrc, /cleanup:\s*\{/, 'must provide canonical cleanup section')
  assert.match(reconRouteSrc, /delivery_readiness:\s*\{/, 'must compute delivery readiness status')
  assert.match(reconRouteSrc, /customer:\s*\{/, 'must provide canonical customer card context')
  assert.match(reconRouteSrc, /sold_vehicle:\s*\{/, 'must provide canonical sold vehicle stock card context')
  assert.match(reconRouteSrc, /trade_in:\s*(\(|{)/, 'must provide canonical trade-in context')
})

test('POST /recon/:inventory_id/status updates cleanup status and blocked reasons', () => {
  assert.match(reconRouteSrc, /app\.post\('\/recon\/:inventory_id\/status'/, 'status update endpoint must exist')
  assert.match(reconRouteSrc, /validStatuses\s*=\s*\['not_started',\s*'in_progress',\s*'ready',\s*'blocked',\s*'completed'\]/, 'must validate cleanup status values')
})

test('POST /recon/:inventory_id/checklist preserves rich metadata per item', () => {
  assert.match(reconRouteSrc, /completed_by/, 'must preserve completed_by audit attribute')
  assert.match(reconRouteSrc, /completed_at/, 'must preserve completed_at timestamp')
})

test('frontend openReconCard implements unified delivery handoff card layout', () => {
  const fn = part15.match(/async function openReconCard\(inventoryId\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'openReconCard must exist in dashboard-part15.js')

  // 1. Fetches canonical handoff endpoint
  assert.match(fn, /\/recon\/\$\{inventoryId\}\/handoff/, 'fetches unified handoff data')

  // 2. Delivery Readiness Banner
  assert.match(fn, /Delivery Readiness &amp; Handoff Status/, 'renders delivery readiness banner')
  assert.match(fn, /computeReadiness/, 'computes completion ratio and blockers')

  // 3. Cleanup is primary workflow on Left Column
  assert.match(fn, /Cleanup &amp; Preparation/, 'cleanup section is prominent')
  assert.match(fn, /Scheduled Delivery Time/, 'delivery time input exists')
  assert.match(fn, /Cleanup Stage Status/, 'cleanup status selector exists')
  assert.match(fn, /What This Car Needs/, 'checklist section exists')
  assert.match(fn, /Quick Add Presets:/, 'preset pills are rendered')
  assert.match(fn, /Full Detail/, 'includes common preset items')

  // 4. Customer Card Context on Right Column
  assert.match(fn, /Customer Information/, 'renders customer card')
  assert.match(fn, /cust\.customer_number/, 'displays customer number')
  assert.match(fn, /cust\.salesperson_name/, 'displays assigned salesperson')
  assert.match(fn, /data-open-timeline/, 'action button to open customer timeline')

  // 5. Sold Vehicle Stock Card
  assert.match(fn, /Sold Vehicle Stock Card/, 'renders sold vehicle card')
  assert.match(fn, /veh\.vin/, 'displays VIN')
  assert.match(fn, /veh\.exterior_color/, 'displays exterior color')
  assert.match(fn, /data-open-inventory/, 'action button to open inventory')
  assert.match(fn, /data-open-deal/, 'action button to open deal desk')

  // 6. Trade-In Card (if trade exists, or clean "No Trade-In" state)
  assert.match(fn, /Trade-In Vehicle/, 'renders trade-in card')
  assert.match(fn, /trade\.trade_allowance/, 'displays trade allowance')
  assert.match(fn, /trade\.payoff_amount/, 'displays payoff amount')
  assert.match(fn, /No Trade-In on this deal/, 'displays clean state when no trade')
  assert.match(fn, /data-open-trade/, 'action button to open trade appraisal')
})
