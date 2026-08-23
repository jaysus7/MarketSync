import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { getPlan } from '../plan-catalog.js'

// Load the frontend public pricing config (a browser global) into a sandbox so the test
// reads the SAME object the public pages render, not a transcription of it.
function loadPublicPricing() {
  const src = readFileSync(new URL('../../marketplace-frontend/js/public-config.js', import.meta.url), 'utf8')
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(src, ctx)
  return ctx.window.MARKETSYNC_PRICING
}

const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')

// The one canonical answer for the four current DealerOS-era plans (CAD/month).
const CANONICAL = {
  'marketsync-digital': 1199,
  'dealer-os-core': 1499,
  'dealer-os-pro': 2499,
  'dealer-os-complete': 3999,
}

test('public-config.js prices the four plans exactly, and matches the backend plan catalog', () => {
  const pricing = loadPublicPricing()
  const byId = {}
  for (const group of [pricing.standalone, pricing.suites, pricing.dealerOS]) {
    for (const item of group) byId[item.id] = item.price
  }
  for (const [id, expected] of Object.entries(CANONICAL)) {
    assert.equal(byId[id], expected, `public-config.js ${id} price drift`)
    assert.equal(getPlan(id).monthly, expected, `plan-catalog ${id} price drift`)
  }
})

test('registration and billing resolve the four plans to real catalog ids at the canonical price', () => {
  // Registration (auth.js) and billing (billing.js) both resolve via getPlan() —
  // proving they resolve identically to the same catalog entry.
  for (const [id, expected] of Object.entries(CANONICAL)) {
    const plan = getPlan(id)
    assert.ok(plan, `registration/billing must resolve ${id}`)
    assert.equal(plan.id, id, `${id} must resolve to itself, not an alias mismatch`)
    assert.equal(plan.monthly, expected)
    assert.ok(plan.priceEnvCad && plan.priceEnvUsd, `${id} must declare CAD and USD price env keys for billing`)
  }
  // register.html's CTA plan map and pricing.html both quote the canonical CAD price.
  const register = read('marketplace-frontend/register.html')
  const pricing = read('marketplace-frontend/pricing.html')
  for (const [label, price] of [['MarketSync Digital', '1,199'], ['DealerOS Core', '1,499'], ['DealerOS Pro', '2,499'], ['DealerOS Complete', '3,999']]) {
    assert.ok(register.includes(price), `register.html should quote ${label} at $${price}`)
    assert.ok(pricing.includes(price), `pricing.html should quote ${label} at $${price}`)
  }
})

test('no public page claims Core includes a marketing suite or Pro includes MarketSync Digital', () => {
  const pages = ['marketplace-frontend/js/public-config.js', 'marketplace-frontend/pricing.html',
    'marketplace-frontend/index.html', 'marketplace-frontend/dealer-os.html', 'marketplace-frontend/register.html']
  const banned = [
    /Sales Marketing Suite Included/i,
    /MarketSync Digital [Ii]ncluded/,
    /adds? service,? parts,? (and )?F&(amp;)?I,? and MarketSync Digital/i,
    /advanced departments and MarketSync Digital/i,
  ]
  for (const page of pages) {
    const text = read(page)
    for (const rx of banned) {
      assert.ok(!rx.test(text), `${page} still carries a conflicting Core/Pro claim: ${rx}`)
    }
  }
})

test('DealerOS Complete public copy advertises the full MarketSync Digital bundle (incl. SEO)', () => {
  const pricing = read('marketplace-frontend/pricing.html')
  const index = read('marketplace-frontend/index.html')
  const config = read('marketplace-frontend/js/public-config.js')
  for (const [page, text] of [['pricing.html', pricing], ['index.html', index], ['public-config.js', config]]) {
    assert.match(text, /MarketSync Digital [Bb]undle/, `${page} should describe Complete's MarketSync Digital bundle`)
  }
})
