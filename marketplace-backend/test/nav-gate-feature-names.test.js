import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { featuresForPlan, productsForPlan } from '../plan-catalog.js'

const REPO = fileURLToPath(new URL('../..', import.meta.url))
const part2 = readFileSync(path.join(REPO, 'marketplace-frontend', 'js', 'modules', 'dashboard-part2.js'), 'utf8')
const part17 = readFileSync(path.join(REPO, 'marketplace-frontend', 'js', 'modules', 'dashboard-part17.js'), 'utf8')
const catalog = readFileSync(path.join(REPO, 'marketplace-backend', 'plan-catalog.js'), 'utf8')

const gateBlock = part2.slice(part2.indexOf('const PAGE_FEATURE = {'),
                              part2.indexOf('// The dealership record also carries'))

// ── A gate that names a feature nobody grants is a gate that is always shut ───
// This really happened: PAGE_ANY_FEATURE.seo listed `seo.intelligence` and
// `seo.standalone`, neither of which exists anywhere in the catalog. The gate
// therefore only ever asked `os.marketing` — the DealerOS marketing engine, which
// a customer who bought SEO on its own does not have. MarketSync SEO and
// MarketSync Digital both grant all ten seo.* features and both failed the gate:
// they owned the product and could not see the tab.
test('every feature name the nav gates ask for exists in the catalog', () => {
  const known = new Set([...catalog.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map(m => m[1]))
  const used = new Set([...gateBlock.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map(m => m[1]))
  assert.ok(used.size > 20, `expected the nav gates to reference many features, found ${used.size}`)
  const dead = [...used].filter(f => !known.has(f))
  assert.deepEqual(dead, [],
    `these gate features are granted by no plan, so the gate can never open for them: ${dead.join(', ')}`)
})

// ── The gate must agree with the thing being sold ────────────────────────────
// Whether a page is reachable has to track whether the plan actually includes the
// product. Anything else is either a customer paying for something they cannot
// reach, or a page reachable without buying it.
const seoAlternates = () => {
  const m = gateBlock.match(/\n  seo: \[([^\]]+)\]/)
  assert.ok(m, 'PAGE_ANY_FEATURE must define the SEO alternates')
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])
}

test('every plan that sells SEO can reach the SEO page, and no other plan can', () => {
  const alts = seoAlternates()
  const plans = ['marketsync-seo', 'dealer-os-complete', 'marketsync-digital',
                 'dealer-os-core', 'dealer-os-pro', 'complete-marketing-suite']
  for (const plan of plans) {
    const sells = productsForPlan(plan).includes('marketsync_seo')
    const reachable = alts.some(f => featuresForPlan(plan).includes(f))
    assert.equal(reachable, sells,
      sells
        ? `${plan} sells MarketSync SEO but cannot reach the SEO page`
        : `${plan} does not sell MarketSync SEO but can reach the SEO page`)
  }
})

// A standalone purchase is the case the old gate got wrong, so pin it by name.
test('a standalone MarketSync SEO customer is not gated behind the marketing engine', () => {
  const alts = seoAlternates()
  const standalone = featuresForPlan('marketsync-seo')
  assert.ok(!standalone.includes('os.marketing'),
    'the standalone plan deliberately does not include the DealerOS marketing engine')
  assert.ok(alts.some(f => standalone.includes(f)),
    'so the gate must accept a real seo.* feature, or the customer cannot open what they bought')
})

// ── The paywall must ask the same question as the gate ───────────────────────
// A page you can navigate to that then sells you what you already own is worse
// than one you cannot reach.
test('the SEO paywall reads features, not only the product list', () => {
  const fn = part17.slice(part17.indexOf('function isSeoOwned()'),
                          part17.indexOf('async function upgradeToSeo'))
  assert.match(fn, /access\.features/, 'ownership must consider the features the plan grants')
  assert.match(fn, /startsWith\('seo\.'\)/, 'any seo.* feature means the product is owned')
  assert.match(fn, /products\.includes\('marketsync_seo'\)/, 'the product check must stay too')
})

test('not knowing is not owning — the paywall still fails closed with no access context', () => {
  const fn = part17.slice(part17.indexOf('function isSeoOwned()'),
                          part17.indexOf('async function upgradeToSeo'))
  assert.match(fn, /return false;\s*\n\}/,
    'with no site config and no access context the answer must be "not owned", not a guess')
})
