import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const demo = readFileSync(new URL('../routes/demo.js', import.meta.url), 'utf8')
const automation = readFileSync(new URL('../routes/automation.js', import.meta.url), 'utf8')
const actionExecutor = readFileSync(new URL('../routes/action-executor.js', import.meta.url), 'utf8')
const billing = readFileSync(new URL('../routes/billing.js', import.meta.url), 'utf8')
const groups = readFileSync(new URL('../routes/groups.js', import.meta.url), 'utf8')
const deposits = readFileSync(new URL('../routes/deposits.js', import.meta.url), 'utf8')

test('isDemoDealershipId is cached and checks the same dedicated-demo-name rule as the rest of routes/demo.js', () => {
  assert.match(demo, /export async function isDemoDealershipId\(dealershipId\)/)
  const fn = demo.match(/export async function isDemoDealershipId[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /isDedicatedDemoName\(data\.name\)/)
  assert.match(fn, /!RETIRED_HQ_SANDBOXES\.has\(data\.name\)/)
  assert.match(fn, /__demoIdCache/, 'should be cached — this is called on every SMS/email/Stripe attempt')
})

test('blockDemoStripeAction short-circuits with a clearly-labeled simulated response, never silently swallows an error', () => {
  const fn = demo.match(/export async function blockDemoStripeAction[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /if \(!dealership\) return next\(\)/, 'a real dealership must fall through to the real Stripe call')
  assert.match(fn, /demo: true/)
  assert.match(fn, /simulated: true/)
  assert.match(fn, /catch \(e\) \{ next\(e\) \}/)
})

test('the one and only Twilio call site (sendSms in automation.js) is demo-gated', () => {
  assert.match(automation, /No other file imports the twilio package|verified: no other file/i, 'the "single chokepoint" claim should stay documented so it gets re-verified if that changes')
  const fn = automation.match(/async function sendSms\([\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /await isDemoDealershipId\(dealershipId\)/)
  assert.match(fn, /simulated: true, demo: true/)
  // Both callers must actually pass dealershipId through, or the guard is dead code.
  assert.match(automation, /return sendSms\(to, body, from, creds, dealershipId\)/)
  assert.match(automation, /result = await sendSms\(to, body, sender\.smsFrom, twilio, msg\.dealership_id\)/)
})

test('campaign/drip dispatch email branch is demo-gated before calling resend directly', () => {
  const fn = automation.match(/async function dispatch\(msg, campaign\)[\s\S]*?const sent = result\.ok \|\| result\.simulated/)?.[0] || ''
  assert.match(fn, /const isDemo = await isDemoDealershipId\(msg\.dealership_id\)/)
  assert.match(fn, /if \(isDemo\) \{[\s\S]*?result = \{ ok: false, simulated: true, demo: true \}/)
})

test('the action-executor email executor is demo-gated (previously had NO dealership check at all)', () => {
  const fn = actionExecutor.match(/async email\(p\) \{[\s\S]*?\n {2}\},/)?.[0] || ''
  assert.match(fn, /await isDemoDealershipId\(p\.dealershipId\)/)
  assert.match(fn, /reason: 'demo_simulated'/)
})

test('every Stripe checkout/portal/connect route requires blockDemoStripeAction in its middleware chain', () => {
  const checks = [
    [billing, "app.post('/billing/subscribe-ai-boost'"],
    [billing, "app.post('/billing/subscribe-ai-chatbot'"],
    [billing, "app.post('/billing/subscribe-inv-intel'"],
    [billing, "app.post('/billing/subscribe-package'"],
    [billing, "app.post('/billing/subscribe-plan'"],
    [billing, "app.post('/billing/portal'"],
    [billing, "app.post('/billing/checkout'"],
    [groups, "app.post('/groups/billing/checkout'"],
    [deposits, "app.post('/deposits/connect'"],
    [deposits, "app.post('/deposits/checkout'"],
  ]
  for (const [source, needle] of checks) {
    const line = source.split('\n').find(l => l.includes(needle))
    assert.ok(line, `route not found: ${needle}`)
    assert.match(line, /blockDemoStripeAction/, `${needle} is missing blockDemoStripeAction`)
  }
})
