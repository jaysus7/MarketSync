import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const entitlements = readFileSync(new URL('../entitlements.js', import.meta.url), 'utf8')
const demoControl = readFileSync(new URL('../routes/demo-control.js', import.meta.url), 'utf8')

test('SEO provisioning uses canonical products and never requires the retired dealerships.seo_active column', () => {
  assert.doesNotMatch(entitlements, /seo_active/)
  assert.doesNotMatch(demoControl, /seo_active/)
  assert.match(entitlements, /products\.includes\('marketsync_seo'\)|for \(const p of products\)/)
})
