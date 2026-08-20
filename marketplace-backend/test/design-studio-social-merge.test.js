import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const publicConfig = readFileSync(new URL('../../marketplace-frontend/js/public-config.js', import.meta.url), 'utf8')
const createStripePrices = readFileSync(new URL('../scripts/create-stripe-prices.mjs', import.meta.url), 'utf8')

test('public-config.js no longer sells Social Scheduler as a standalone product, and Design Studio matches approved DB price', () => {
  assert.doesNotMatch(publicConfig, /id: 'social-scheduler'/)
  assert.doesNotMatch(publicConfig, /name: 'Social Scheduler'/)
  const designStudio = publicConfig.match(/\{\s*id: 'design-studio',[\s\S]*?\n {4}\},/)?.[0] || ''
  assert.ok(designStudio, 'design-studio entry must exist')
  assert.match(designStudio, /price: 19\.99,/)
  assert.match(designStudio, /priceFormatted: '\$19\.99'/)
  assert.match(designStudio, /AI-generated images, layouts & copy/)
  assert.match(designStudio, /Multi-platform social scheduler & calendar/)
})

test('create-stripe-prices.mjs rounds cents instead of letting floating point corrupt the amount', () => {
  // 19.99 * 100 === 1998.9999999999998 in JS float math — Stripe requires an integer
  // unit_amount, so an un-rounded multiply would send a bad amount (or Stripe would
  // reject it) the first time a plan ever had a fractional dollar price.
  assert.match(createStripePrices, /const amountCents = Math\.round\(plan\.monthly \* 100\)/)
})

test('a migration exists that folds Social Scheduler features into design-studio and retires the standalone plan', () => {
  const path = new URL('../../supabase/migrations/20260817200500_design_studio_social_merge.sql', import.meta.url)
  assert.ok(existsSync(path), 'the design-studio/social-scheduler merge migration must exist')
  const sql = readFileSync(path, 'utf8')
  assert.match(sql, /UPDATE public\.plans\s*\nSET monthly_price_cents = 1999\s*\nWHERE id = 'design-studio'/)
  assert.match(sql, /SELECT 'design-studio', id FROM public\.features\s*\nWHERE product_id = 'marketsync_social' AND id <> 'social\.studio'/)
  assert.match(sql, /UPDATE public\.plans\s*\nSET is_public = false\s*\nWHERE id = 'social-scheduler'/)
})
