import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getPlan, stripePriceForPlanExact, planPricingStatus, stripePriceForPlan,
} from '../plan-catalog.js'

// The four current-architecture plans.
const CURRENT = ['marketsync-digital', 'dealer-os-core', 'dealer-os-pro', 'dealer-os-complete']

// The obsolete DealerOS USD price envs (legacy os_starter/os_growth/os_pro packages).
// The current plans must NOT resolve USD through any of these.
const OBSOLETE_USD_ENVS = ['STRIPE_PKG_STARTER_USD', 'STRIPE_PKG_GROWTH_USD', 'STRIPE_PKG_PRO_USD']

test('every current plan declares a dedicated CAD and USD price-env path', () => {
  for (const id of CURRENT) {
    const plan = getPlan(id)
    assert.ok(plan, `${id} must exist`)
    assert.ok(plan.priceEnvCad, `${id} must declare a CAD price env`)
    assert.ok(plan.priceEnvUsd, `${id} must declare a USD price env (defined USD path)`)
    // Not reusing an obsolete DealerOS USD price env, directly or via alias.
    assert.ok(!OBSOLETE_USD_ENVS.includes(plan.priceEnvUsd), `${id} must not reuse an obsolete USD env`)
    for (const alias of (plan.priceEnvUsdAliases || [])) {
      assert.ok(!OBSOLETE_USD_ENVS.includes(alias), `${id} USD alias must not be an obsolete DealerOS env`)
    }
  }
})

test('USD resolution is exact — no silent fallback to the CAD price', () => {
  for (const id of CURRENT) {
    const plan = getPlan(id)
    // Only CAD configured → CAD resolves, USD does NOT fall back to it.
    const cadOnly = { [plan.priceEnvCad]: `cad_${id}` }
    assert.equal(stripePriceForPlanExact(id, 'cad', cadOnly), `cad_${id}`)
    assert.equal(stripePriceForPlanExact(id, 'usd', cadOnly), null,
      `${id} USD must NOT fall back to the CAD price`)
    // Both configured → each resolves to its own price.
    const both = { [plan.priceEnvCad]: `cad_${id}`, [plan.priceEnvUsd]: `usd_${id}` }
    assert.equal(stripePriceForPlanExact(id, 'usd', both), `usd_${id}`)
    assert.equal(stripePriceForPlanExact(id, 'cad', both), `cad_${id}`)
  }
})

test('planPricingStatus reports CAD and USD independently (a missing USD is visible)', () => {
  const plan = getPlan('dealer-os-core')
  const cadOnly = { [plan.priceEnvCad]: 'cad_core' }
  assert.deepEqual(
    { cad: planPricingStatus('dealer-os-core', cadOnly).cad, usd: planPricingStatus('dealer-os-core', cadOnly).usd },
    { cad: true, usd: false },
  )
  const both = { [plan.priceEnvCad]: 'cad_core', [plan.priceEnvUsd]: 'usd_core' }
  const status = planPricingStatus('dealer-os-core', both)
  assert.deepEqual({ cad: status.cad, usd: status.usd }, { cad: true, usd: true })
  assert.equal(status.usdEnv, 'STRIPE_PKG_CORE_USD', 'reports the USD env key for ops')
})

test('every current plan can resolve CAD when its CAD price is configured', () => {
  for (const id of CURRENT) {
    const plan = getPlan(id)
    const env = { [plan.priceEnvCad]: `cad_${id}` }
    assert.equal(stripePriceForPlanExact(id, 'cad', env), `cad_${id}`, `${id} must resolve CAD`)
  }
})

test('the legacy fallback resolver is preserved for backward compatibility', () => {
  // stripePriceForPlan keeps its documented single-currency fallback (legacy callers).
  const env = { STRIPE_PKG_PRO_USD: 'usd_id' }
  assert.equal(stripePriceForPlan('os_pro', 'cad', env), 'usd_id', 'legacy fallback still works')
})
