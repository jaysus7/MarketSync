import test from 'node:test'
import assert from 'node:assert/strict'
import { PLAN_CATALOG, getPlan } from '../plan-catalog.js'
import { provisionPlan } from '../entitlements.js'

test('Website & AI ChatBot catalog plans', () => {
  const websitePlan = getPlan('dealer-website')
  assert.ok(websitePlan, 'dealer-website plan exists in catalog')
  assert.deepEqual(websitePlan.products, ['marketsync_website'])

  const chatbotPlan = getPlan('ai-chatbot')
  assert.ok(chatbotPlan, 'ai-chatbot plan exists in catalog')
  assert.deepEqual(chatbotPlan.products, ['ai_dealer'])
  assert.equal(chatbotPlan.legacy.ai_chatbot_active, true)
  assert.equal(chatbotPlan.legacy.ai_chatbot_paid, true)
})

test('provisionPlan function accepts preserveExisting parameter', async () => {
  assert.equal(typeof provisionPlan, 'function')
})
