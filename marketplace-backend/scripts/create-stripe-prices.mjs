// One-shot setup: create the Stripe products + monthly CAD/USD prices for every plan in
// the catalog, then print the exact env-var lines to paste into Render. Idempotent-ish:
// re-running creates NEW prices (Stripe prices are immutable), so run once, paste the
// output, and keep it. To re-price a plan later, create a new price in Stripe and update
// the env var — the plan catalog + webhook map by env var, so nothing else changes.
//
// Usage (needs the LIVE or TEST secret key, whichever env you're wiring):
//   STRIPE_SECRET_KEY=sk_...  node scripts/create-stripe-prices.mjs
//   STRIPE_SECRET_KEY=sk_...  node scripts/create-stripe-prices.mjs --dry-run
//
// Dry-run prints what it WOULD create without calling Stripe.

import Stripe from 'stripe'
import { PLAN_CATALOG } from '../plan-catalog.js'

const DRY = process.argv.includes('--dry-run')
const key = process.env.STRIPE_SECRET_KEY
if (!key && !DRY) {
  console.error('✗ STRIPE_SECRET_KEY is required (or pass --dry-run). Aborting.')
  process.exit(1)
}
const stripe = key ? new Stripe(key) : null
const CURRENCIES = ['usd', 'cad'] // one price per currency; same headline amount per currency

const envLines = []

for (const plan of Object.values(PLAN_CATALOG)) {
  const amountCents = Math.round(plan.monthly * 100)
  console.log(`\n▶ ${plan.label}  ($${plan.monthly}/mo)`)

  let product
  if (DRY) {
    console.log(`   would create product "${plan.label}" (metadata.plan_id=${plan.id})`)
  } else {
    product = await stripe.products.create({
      name: `MarketSync — ${plan.label}`,
      metadata: { plan_id: plan.id, products: plan.products.join(',') },
    })
    console.log(`   product ${product.id}`)
  }

  for (const currency of CURRENCIES) {
    const envVar = currency === 'cad' ? plan.priceEnvCad : plan.priceEnvUsd
    if (DRY) {
      console.log(`   would create ${currency.toUpperCase()} price ${amountCents} → ${envVar}`)
      envLines.push(`${envVar}=price_...   # ${plan.label} ${currency.toUpperCase()} $${plan.monthly}/mo`)
      continue
    }
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountCents,
      currency,
      recurring: { interval: 'month' },
      metadata: { plan_id: plan.id },
    })
    console.log(`   ${currency.toUpperCase()} price ${price.id} → ${envVar}`)
    envLines.push(`${envVar}=${price.id}`)
  }
}

console.log('\n' + '─'.repeat(60))
console.log('Paste these into Render (Environment → Environment Variables):\n')
console.log(envLines.join('\n'))
console.log('\nThen redeploy the backend. The webhook maps each price → plan via these vars;')
console.log('nothing else needs to change. Verify with:  curl $API/billing/plans  (configured:true)')
