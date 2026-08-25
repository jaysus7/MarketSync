import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { featuresForPlan, productsForPlan, PLAN_CATALOG } from '../plan-catalog.js'

// plan-catalog.js and the DB plans/plan_products/plan_features tables are two
// separate sources of truth, and they drifted: the catalog said DealerOS Pro has
// no SEO while the database granted it all ten seo.* features for free, and said
// Complete bundles SEO while the database had never heard of it. Provisioning
// reads the DB, so the drift showed up as a paying Complete customer being told
// "Plan dealer-os-complete does not include product marketsync_seo".
//
// This replays every SEO grant and revoke the migrations express, in the order
// they apply, and holds the result against the catalog.

const MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url))
const SEO_PRODUCT = 'marketsync_seo'

const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()
const sql = files.map(f => ({ file: f, text: readFileSync(path.join(MIGRATIONS, f), 'utf8') }))

// Comments carry prose about SEO in files that grant nothing, so strip them
// before parsing or the parser reads intent as fact.
const stripComments = (text) => text.split('\n').map(l => l.replace(/--.*$/, '')).join('\n')

const quoted = (blob) => [...blob.matchAll(/'([^']+)'/g)].map(m => m[1])

function replaySeoGrants() {
  const products = new Map()   // plan -> Set(product)
  const features = new Map()   // plan -> Set(feature)
  const planRows = new Set()   // plan ids some migration actually creates
  const add = (map, plan, value) => { if (!map.has(plan)) map.set(plan, new Set()); map.get(plan).add(value) }
  let statements = 0

  for (const { text } of sql) {
    const body = stripComments(text)

    // insert into plans ... values ('id','product_id', ...), ...
    for (const m of body.matchAll(/insert\s+into\s+public\.plans[\s\S]*?values([\s\S]*?);/gi)) {
      statements++
      for (const row of m[1].matchAll(/\(\s*'([^']+)'/g)) planRows.add(row[1])
    }

    // insert into plan_products ... values ('plan','product'), ...
    for (const m of body.matchAll(/insert\s+into\s+public\.plan_products[\s\S]*?values([\s\S]*?);/gi)) {
      statements++
      for (const pair of m[1].matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)) {
        if (pair[2] === SEO_PRODUCT) add(products, pair[1], pair[2])
      }
    }

    // insert into plan_features ... (values (plans)) cross join (values (features))
    for (const m of body.matchAll(/insert\s+into\s+public\.plan_features[\s\S]*?from\s*\(values([\s\S]*?)\)\s*as\s+\w+\(plan_id\)[\s\S]*?cross\s+join\s*\(values([\s\S]*?)\)\s*as\s+\w+\(feature_id\)/gi)) {
      statements++
      const plans = quoted(m[1])
      const feats = quoted(m[2]).filter(f => f.startsWith('seo.'))
      for (const p of plans) for (const f of feats) add(features, p, f)
    }

    // delete from plan_features where plan_id = 'x' and feature_id in (...)
    for (const m of body.matchAll(/delete\s+from\s+public\.plan_features\s+where\s+plan_id\s*=\s*'([^']+)'[\s\S]*?feature_id\s+in\s*\(([\s\S]*?)\)\s*;/gi)) {
      statements++
      const set = features.get(m[1])
      if (set) for (const f of quoted(m[2])) set.delete(f)
    }

    // delete from plan_products where plan_id = 'x' and product_id = 'y'
    for (const m of body.matchAll(/delete\s+from\s+public\.plan_products\s+where\s+plan_id\s*=\s*'([^']+)'[\s\S]*?product_id\s*=\s*'([^']+)'\s*;/gi)) {
      statements++
      if (m[2] === SEO_PRODUCT) products.get(m[1])?.delete(m[2])
    }
  }
  return { products, features, planRows, statements }
}

const replay = replaySeoGrants()

// PLAN_CATALOG holds 'marketsync_seo' as a second entry for the same $149 plan the
// DB knows as 'marketsync-seo'. It is the only underscore alias in the catalog and
// the DB has no such plan row, so it is excluded from the DB comparison and
// asserted on its own below -- an alias should not read as a missing plan, and a
// second one appearing should not slip through silently.
const CATALOG_ALIASES = { marketsync_seo: 'marketsync-seo' }
const dbHasSeoProduct = (plan) => Boolean(replay.products.get(plan)?.has(SEO_PRODUCT))
const dbSeoFeatures = (plan) => [...(replay.features.get(plan) || [])].sort()
const jsHasSeoProduct = (plan) => productsForPlan(plan).includes(SEO_PRODUCT)
const jsSeoFeatures = (plan) => featuresForPlan(plan).filter(f => String(f).startsWith('seo.')).sort()

test('the migration replay actually parsed the SEO statements', () => {
  // Without this the comparisons below all pass for free the day a regex stops
  // matching -- an empty parse would look exactly like perfect agreement.
  assert.ok(replay.statements >= 6, `only ${replay.statements} catalog statements parsed`)
  assert.ok(files.includes('2026-08-20-marketsync-digital-seo-entitlement.sql'))
  assert.ok(files.includes('2026-08-25-revoke-dealer-os-pro-seo.sql'))
  assert.ok(dbHasSeoProduct('marketsync-digital'), 'Digital should hold the SEO product after replay')
  assert.equal(dbSeoFeatures('marketsync-digital').length, 10)
})

test('DealerOS Pro does not include SEO, in the catalog or the database', () => {
  assert.equal(jsHasSeoProduct('dealer-os-pro'), false, 'plan-catalog.js must not give Pro the SEO product')
  assert.deepEqual(jsSeoFeatures('dealer-os-pro'), [], 'plan-catalog.js must not give Pro seo.* features')
  assert.equal(dbHasSeoProduct('dealer-os-pro'), false, 'migrations must not leave Pro holding the SEO product')
  assert.deepEqual(dbSeoFeatures('dealer-os-pro'), [], 'migrations must not leave Pro holding seo.* features')
})

test('every plan that sells SEO grants it in both places', () => {
  // Pro reaches SEO by buying the standalone plan; coverage is a union across a
  // dealership's subscriptions, so that path is unaffected by the revoke.
  for (const plan of ['dealer-os-complete', 'marketsync-digital', 'marketsync-seo']) {
    assert.equal(jsHasSeoProduct(plan), true, `${plan} should sell SEO in plan-catalog.js`)
    assert.equal(dbHasSeoProduct(plan), true, `${plan} should be granted SEO by the migrations`)
  }
})

test('SEO features agree between plan-catalog.js and the migrations, for every plan', () => {
  const plans = new Set([...Object.keys(PLAN_CATALOG), ...replay.features.keys(), ...replay.products.keys()])
  const mismatches = []
  for (const plan of [...plans].sort()) {
    // marketsync-seo grants the product; its feature list comes from the same
    // FEATURES_BY_PRODUCT block, so compare both sides the same way.
    if (CATALOG_ALIASES[plan]) continue
    const js = PLAN_CATALOG[plan] ? jsSeoFeatures(plan) : null
    const db = dbSeoFeatures(plan)
    if (js === null) { mismatches.push(`${plan}: granted SEO in SQL but absent from plan-catalog.js`); continue }
    if (js.join(',') !== db.join(',')) mismatches.push(`${plan}: catalog [${js}] vs migrations [${db}]`)
    if (jsHasSeoProduct(plan) !== dbHasSeoProduct(plan)) {
      mismatches.push(`${plan}: SEO product catalog=${jsHasSeoProduct(plan)} migrations=${dbHasSeoProduct(plan)}`)
    }
  }
  assert.deepEqual(mismatches, [])
})

test('every plan granted SEO by a migration is a plan the migrations create', () => {
  // plan_products.plan_id and plan_features.plan_id are both foreign keys to
  // plans(id). Granting to a plan row that was never inserted does not warn -- it
  // aborts the file, taking every other grant in it down too. marketsync-seo was
  // exactly this: the 2026-08-17 seed listed 15 SKUs and never included it.
  const granted = new Set([...replay.products.keys(), ...replay.features.keys()])
  const missing = [...granted].filter(p => !replay.planRows.has(p)).sort()
  assert.deepEqual(missing, [], 'these plans are granted SEO but no migration creates their plans row')
})

test('the catalog has exactly the one known plan-id alias', () => {
  const keys = Object.keys(PLAN_CATALOG)
  const aliases = keys.filter(k => k.includes('_') && keys.includes(k.replace(/_/g, '-')))
  assert.deepEqual(aliases.sort(), Object.keys(CATALOG_ALIASES).sort())
  for (const [alias, real] of Object.entries(CATALOG_ALIASES)) {
    // An alias that has drifted from what it aliases is worse than no alias.
    assert.deepEqual(jsSeoFeatures(alias), jsSeoFeatures(real), `${alias} should match ${real}`)
    assert.deepEqual(productsForPlan(alias), productsForPlan(real), `${alias} should match ${real}`)
    assert.equal(PLAN_CATALOG[alias].monthly, PLAN_CATALOG[real].monthly)
  }
})
