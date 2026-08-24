// Permanent guard against MarketSync product/pricing drift. Fast, no DB — imports the
// pure plan-catalog and reads the public frontend files. If this suite fails, the public
// product architecture and the backend entitlements have diverged.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import vm from 'node:vm'
import { getPlan, productsForPlan, featuresForPlan } from '../plan-catalog.js'

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = rel => readFileSync(new URL(rel, FE), 'utf8')

// Canonical CAD prices for the four flagship plans.
const CANON = { 'marketsync-digital': 1199, 'dealer-os-core': 1499, 'dealer-os-pro': 2499, 'dealer-os-complete': 3999 }

// The MarketSync Digital bundle = the marketsync-digital plan's products/features.
const DIGITAL_PRODUCTS = productsForPlan('marketsync-digital')
const DIGITAL_FEATURES = featuresForPlan('marketsync-digital')

test('DealerOS Core does not grant MarketSync Digital', () => {
  const p = new Set(productsForPlan('dealer-os-core'))
  const f = new Set(featuresForPlan('dealer-os-core'))
  for (const x of DIGITAL_PRODUCTS) assert.ok(!p.has(x), `Core must not grant Digital product ${x}`)
  for (const x of DIGITAL_FEATURES) assert.ok(!f.has(x), `Core must not grant Digital feature ${x}`)
})

test('DealerOS Pro does not grant MarketSync Digital', () => {
  const p = new Set(productsForPlan('dealer-os-pro'))
  const f = new Set(featuresForPlan('dealer-os-pro'))
  for (const x of DIGITAL_PRODUCTS) assert.ok(!p.has(x), `Pro must not grant Digital product ${x}`)
  for (const x of DIGITAL_FEATURES) assert.ok(!f.has(x), `Pro must not grant Digital feature ${x}`)
})

test('DealerOS Complete grants the full MarketSync Digital bundle, including SEO', () => {
  const p = new Set(productsForPlan('dealer-os-complete'))
  const f = new Set(featuresForPlan('dealer-os-complete'))
  for (const x of DIGITAL_PRODUCTS) assert.ok(p.has(x), `Complete must grant Digital product ${x}`)
  for (const x of DIGITAL_FEATURES) assert.ok(f.has(x), `Complete must grant Digital feature ${x}`)
  assert.ok(p.has('marketsync_seo'), 'Complete must include MarketSync SEO')
  assert.ok(f.has('seo.overview'), 'Complete must grant SEO features')
})

test('the four flagship CAD prices agree between the backend catalog and public-config', () => {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(read('js/public-config.js'), ctx)
  const cfg = ctx.window.MARKETSYNC_PRICING
  const byId = {}
  for (const g of [cfg.standalone, cfg.suites, cfg.dealerOS]) for (const it of g) byId[it.id] = it.price
  for (const [id, price] of Object.entries(CANON)) {
    assert.equal(getPlan(id).monthly, price, `backend catalog ${id} price drift`)
    assert.equal(byId[id], price, `public-config ${id} price drift`)
  }
})

// Primary public marketing pages — obsolete positioning must not return here.
const CORE_PAGES = ['index.html', 'pricing.html', 'dealer-os.html', 'marketsync-digital.html',
  'intelligence.html', 'features.html', 'faq.html', 'compare.html', 'workflow.html', 'upgrade.html']

test('no obsolete "AI Boost" positioning returns on the primary public pages', () => {
  for (const pg of CORE_PAGES) assert.doesNotMatch(read(pg), /\bAI Boost\b/, `${pg} reintroduced AI Boost`)
})

test('the retired Starter/Growth public DealerOS pricing does not return', () => {
  for (const pg of ['pricing.html', 'index.html', 'dealer-os.html', 'compare.html']) {
    const t = read(pg)
    assert.doesNotMatch(t, /\$1,799/, `${pg} shows the retired Growth price`)
    assert.doesNotMatch(t, /DealerOS (Starter|Growth)|Dealer OS (Starter|Growth)/, `${pg} names a retired DealerOS tier`)
  }
})

test('no public page reasserts that Pro includes Digital or Core is bundled with every plan', () => {
  for (const pg of CORE_PAGES) {
    const t = read(pg)
    assert.doesNotMatch(t, /Core\s*[—-]\s*included with every plan/i, `${pg}: Core-included claim`)
    assert.doesNotMatch(t, /MarketSync Digital [Ii]ncluded/, `${pg}: Pro/Core-includes-Digital claim`)
  }
})

test('every public register CTA points at a real plan id', () => {
  const files = readdirSync(FE).filter(f => f.endsWith('.html') && f !== 'dashboard.html')
  const seen = new Set()
  for (const f of files) {
    const t = read(f)
    for (const m of t.matchAll(/register\.html\?plan=([a-z0-9_-]+)/g)) {
      const id = m[1]
      if (seen.has(id)) continue
      seen.add(id)
      assert.ok(getPlan(id), `${f}: register CTA references unknown plan id "${id}"`)
    }
  }
  assert.ok(seen.size > 0, 'expected to find at least one register CTA to validate')
})

// ── Frontend nav fallback must mirror the server entitlements ────────────────
// dashboard-part2.js carries a cold-start fallback (DEALER_OS_PLAN_FEATURES /
// dealerPlanFallback) OR'd with the live /access context to decide which tabs show.
// When that fallback grants a Digital work area (e.g. the Website builder) to a plan
// that lacks the backing product, the tab renders but the API answers 403
// PRODUCT_ACCESS_REQUIRED — the "Website page → access denied" defect. Core & Pro are
// operational-only, so their fallback must never advertise Digital website features.
test('Core/Pro nav fallback does not advertise the Website builder (no PRODUCT_ACCESS_REQUIRED tab)', () => {
  const src = read('js/modules/dashboard-part2.js')
  const grab = key => {
    const m = src.match(new RegExp(key + ":\\s*new Set\\(\\[([^\\]]*)\\]"))
    assert.ok(m, `DEALER_OS_PLAN_FEATURES.${key} not found`)
    return m[1]
  }
  for (const key of ['core', 'pro', 'dealeros_pro']) {
    const body = grab(key)
    for (const leak of ['website.builder', 'os.website', 'os.marketing', 'seo.overview', 'social.scheduler', 'video.library', 'design.canvas']) {
      assert.ok(!body.includes(leak), `${key} nav fallback must not grant Digital feature "${leak}"`)
    }
  }
  // Only Complete bundles the Digital products in the product fallback.
  assert.match(src, /const digital = plan === 'dealeros_complete'/, 'dealerPlanFallback must grant Digital products to Complete only')
  assert.doesNotMatch(src, /const digital = \['pro'/, 'stale Pro/Digital product fallback must be gone')
})
