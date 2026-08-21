import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../../supabase/migrations/20260821033130_repair_marketing_suite_plan_products.sql', import.meta.url), 'utf8')
const products = ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video']

test('suite entitlement repair restores every canonical product for Sales, Service, and Complete', () => {
  for (const plan of ['sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite']) {
    for (const product of products) assert.ok(sql.includes(`('${plan}', '${product}')`), `${plan} must include ${product}`)
  }
  assert.match(sql, /on conflict \(plan_id, product_id\) do nothing/)
})

test('suite feature repair derives features from canonical product ownership', () => {
  assert.match(sql, /join public\.features features/)
  for (const product of products) assert.ok(sql.includes(`'${product}'`))
  assert.match(sql, /on conflict \(plan_id, feature_id\) do nothing/)
})
