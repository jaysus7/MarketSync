import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultTrialPlan, PRODUCTS, ACCOUNT_TYPES, mapStripeStatus } from '../entitlements-policy.js'

test('defaultTrialPlan picks the right plan per product/account type', () => {
  assert.equal(defaultTrialPlan('facebook', 'solo'), 'fb_solo')
  assert.equal(defaultTrialPlan('facebook', 'dealership'), 'fb_dealership')
  assert.equal(defaultTrialPlan('ai_dealer', 'solo'), 'ai_standard')
  assert.equal(defaultTrialPlan('dealer_os', 'dealership'), 'os_enterprise')
  assert.equal(defaultTrialPlan('dealer_os', 'solo'), 'os_enterprise')
})

test('catalog constants are the three products and two account types', () => {
  assert.deepEqual([...PRODUCTS].sort(), ['ai_dealer', 'dealer_os', 'facebook'])
  assert.deepEqual([...ACCOUNT_TYPES].sort(), ['dealership', 'solo'])
})

test('mapStripeStatus maps Stripe statuses onto our enum, defaulting to past_due', () => {
  assert.equal(mapStripeStatus('trialing'), 'trialing')
  assert.equal(mapStripeStatus('active'), 'active')
  assert.equal(mapStripeStatus('past_due'), 'past_due')
  assert.equal(mapStripeStatus('unpaid'), 'past_due')
  assert.equal(mapStripeStatus('canceled'), 'cancelled')
  assert.equal(mapStripeStatus('incomplete_expired'), 'expired')
  assert.equal(mapStripeStatus('something_new'), 'past_due')
})
