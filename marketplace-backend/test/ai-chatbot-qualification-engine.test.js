import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractQualificationState,
  calculateExplainableLeadScore,
  generateAiLeadBrief,
  evaluateHandoffTriggers,
  classifyObjection,
  getNextBestQuestion,
  OBJECTION_TAXONOMY,
  PURCHASE_TIMEFRAMES,
  BUYING_INTENT_CATEGORIES,
  PAYMENT_PREFERENCES,
  TRADE_STATUSES,
} from '../services/chatbot-qualification-engine.js'
import '../routes/ai-runtime.js'
import { handoffBrief } from '../routes/conversations.js'

test('1. Multi-turn vehicle qualification extracts vehicle, body style, and features', () => {
  const messages = [
    { role: 'user', message: 'Hi, I am looking for a black 2024 Chevy Tahoe with leather seats and AWD' },
    { role: 'assistant', message: 'We have a great 2024 Tahoe Premier available!' },
    { role: 'user', message: 'I also need 3rd row seating for the kids' },
  ]
  const state = extractQualificationState(messages, [], {})
  assert.equal(state.body_style_interest, 'SUV')
  assert.ok(state.must_have_features.includes('Luxury / Comfort'))
  assert.ok(state.must_have_features.includes('AWD/4WD'))
  assert.ok(state.must_have_features.includes('3rd Row Seating'))
})

test('2. Timeframe extraction correctly maps immediate, near-term, and research timelines', () => {
  const immediate = extractQualificationState([{ role: 'user', message: 'I need a truck ASAP, ready to buy this weekend' }])
  assert.equal(immediate.purchase_timeframe, PURCHASE_TIMEFRAMES.IMMEDIATE)

  const twoWeeks = extractQualificationState([{ role: 'user', message: 'Looking to purchase in a couple of weeks' }])
  assert.equal(twoWeeks.purchase_timeframe, PURCHASE_TIMEFRAMES.ONE_TWO_WEEKS)

  const monthly = extractQualificationState([{ role: 'user', message: 'Probably looking to get something next month' }])
  assert.equal(monthly.purchase_timeframe, PURCHASE_TIMEFRAMES.ONE_MONTH)

  const researching = extractQualificationState([{ role: 'user', message: 'Just browsing and researching for now' }])
  assert.equal(researching.purchase_timeframe, PURCHASE_TIMEFRAMES.JUST_RESEARCHING)
})

test('3. Payment and budget comfort extraction parses monthly targets and total budgets', () => {
  const pmtState = extractQualificationState([{ role: 'user', message: 'I want to stay around $550/mo on financing' }])
  assert.equal(pmtState.comfortable_payment_range, '$550/mo')
  assert.equal(pmtState.cash_finance_lease_interest, PAYMENT_PREFERENCES.FINANCE)

  const leaseState = extractQualificationState([{ role: 'user', message: 'Interested in a 36 month lease under $450 a month' }])
  assert.equal(leaseState.comfortable_payment_range, '$450/mo')
  assert.equal(leaseState.cash_finance_lease_interest, PAYMENT_PREFERENCES.LEASE)

  const budgetState = extractQualificationState([{ role: 'user', message: 'My max price budget is $35,000' }])
  assert.ok(budgetState.budget_range.includes('35,000') || budgetState.budget_range.includes('35'))
})

test('4. Trade-in information capture extracts year, make, and trade status', () => {
  const tradeState = extractQualificationState([{ role: 'user', message: 'I have a 2019 Honda Civic to trade in' }])
  assert.equal(tradeState.trade_in_status, TRADE_STATUSES.HAS_TRADE)
  assert.equal(tradeState.trade_year, '2019')

  const noTradeState = extractQualificationState([{ role: 'user', message: 'No trade for me, this is a clean purchase' }])
  assert.equal(noTradeState.trade_in_status, TRADE_STATUSES.NO_TRADE)
})

test('5. Appointment intent captures test drive and showroom visit requests', () => {
  const apptState = extractQualificationState([{ role: 'user', message: 'Can I schedule a test drive for tomorrow afternoon?' }])
  assert.equal(apptState.appointment_intent, true)
})

test('6. Objection taxonomy contains all 18 structured automotive categories', () => {
  const categories = Object.keys(OBJECTION_TAXONOMY)
  assert.ok(categories.length >= 18)
  assert.ok(categories.includes('price_too_high'))
  assert.ok(categories.includes('payment_too_high'))
  assert.ok(categories.includes('trade_value_too_low'))
  assert.ok(categories.includes('credit_concern'))
  assert.ok(categories.includes('shopping_other_dealers'))
  assert.ok(categories.includes('spouse_approval'))
  assert.ok(categories.includes('distance_from_dealership'))
  assert.ok(categories.includes('wants_exact_numbers'))
  assert.ok(categories.includes('vehicle_unavailable'))
  assert.ok(categories.includes('used_condition_concern'))
})

test('7. Objection classification correctly detects price, payment, and trade objections', () => {
  assert.equal(classifyObjection('The sticker price is too expensive for this trim'), 'price_too_high')
  assert.equal(classifyObjection('That monthly payment is way too high for my budget'), 'payment_too_high')
  assert.equal(classifyObjection('Your offer on my trade is way too low, KBB says more'), 'trade_value_too_low')
  assert.equal(classifyObjection('I need to talk to my wife before signing anything'), 'spouse_approval')
  assert.equal(classifyObjection('I have bad credit from a prior bankruptcy, will that work?'), 'credit_concern')
  assert.equal(classifyObjection('I live 3 hours away and the dealership is too far'), 'distance_from_dealership')
})

test('8. Explainable lead scoring assigns HOT, WARM, and NURTURE categories with reasons', () => {
  // Hot lead: vehicle + phone + immediate timeframe + appointment
  const hotQual = {
    vehicle_interest: '2024 Silverado 1500 RST',
    phone: '555-123-4567',
    purchase_timeframe: PURCHASE_TIMEFRAMES.IMMEDIATE,
    appointment_intent: true,
  }
  const hotScore = calculateExplainableLeadScore(
    [{ role: 'user', message: 'I want to come in today to buy the Silverado' }],
    [],
    hotQual
  )
  assert.ok(hotScore.score >= 75)
  assert.equal(hotScore.category, BUYING_INTENT_CATEGORIES.HOT)
  assert.ok(hotScore.reasons.length >= 2)
  assert.ok(hotScore.reasons.some(r => r.includes('vehicle') || r.includes('contact') || r.includes('urgency')))

  // Warm lead: vehicle + payment discussed
  const warmQual = {
    vehicle_interest: '2023 RAV4',
    comfortable_payment_range: '$400/mo',
    purchase_timeframe: PURCHASE_TIMEFRAMES.ONE_MONTH,
  }
  const warmScore = calculateExplainableLeadScore(
    [{ role: 'user', message: 'What would payments be on the RAV4?' }],
    [],
    warmQual
  )
  assert.ok(warmScore.score >= 40 && warmScore.score < 75)
  assert.equal(warmScore.category, BUYING_INTENT_CATEGORIES.WARM)

  // Nurture lead: casual browsing
  const nurtureQual = {
    purchase_timeframe: PURCHASE_TIMEFRAMES.JUST_RESEARCHING,
  }
  const nurtureScore = calculateExplainableLeadScore(
    [{ role: 'user', message: 'Just looking around' }],
    [],
    nurtureQual
  )
  assert.ok(nurtureScore.score < 45)
  assert.equal(nurtureScore.category, BUYING_INTENT_CATEGORIES.NURTURE)
})

test('9. AI Lead Brief generates structured JSON with all customer context and opening line', () => {
  const qual = {
    customer_name: 'Marcus Vance',
    phone: '555-987-6543',
    email: 'marcus@example.com',
    preferred_contact_channel: 'sms',
    vehicle_interest: '2024 GMC Sierra 1500 Elevation',
    purchase_timeframe: PURCHASE_TIMEFRAMES.ONE_TWO_WEEKS,
    comfortable_payment_range: '$650/mo',
    cash_finance_lease_interest: PAYMENT_PREFERENCES.FINANCE,
    trade_in_status: TRADE_STATUSES.HAS_TRADE,
    trade_year: '2018',
    trade_make: 'Ford',
    trade_model: 'F-150 XLT',
    main_objection: 'payment_too_high',
    appointment_intent: true,
    appointment_preference: 'Saturday at 11 AM',
  }
  const brief = generateAiLeadBrief({
    conversation: { channel: 'sms', summary: 'Shopper interested in Sierra' },
    contact: { full_name: 'Marcus Vance', phone: '555-987-6543' },
    qualificationState: qual,
    messages: [{ role: 'user', message: 'Can you have the Sierra prepped for Saturday at 11?' }],
  })

  assert.equal(brief.customer.name, 'Marcus Vance')
  assert.equal(brief.interest.vehicle_title, '2024 GMC Sierra 1500 Elevation')
  assert.equal(brief.trade.vehicle, '2018 Ford F-150 XLT')
  assert.equal(brief.objections.primary, 'Payment Too High')
  assert.ok(brief.next_best_action.suggested_action.includes('appointment') || brief.next_best_action.suggested_action.includes('VIP'))
  assert.ok(brief.next_best_action.suggested_opening_line.includes('Marcus'))
  assert.ok(brief.next_best_action.suggested_opening_line.includes('Sierra'))
})

test('10. Autonomous handoff evaluator detects urgent triggers and rep requests', () => {
  const reqHuman = evaluateHandoffTriggers({ message: 'I need to speak to a real person please' })
  assert.equal(reqHuman.should_handoff, true)
  assert.equal(reqHuman.priority, 'urgent')

  const readyToBuy = evaluateHandoffTriggers({ message: 'I am ready to buy it today, take my deposit' })
  assert.equal(readyToBuy.should_handoff, true)
  assert.equal(readyToBuy.priority, 'urgent')

  const frustrated = evaluateHandoffTriggers({ message: 'This is terrible service, give me a manager' })
  assert.equal(frustrated.should_handoff, true)
  assert.equal(frustrated.priority, 'urgent')

  const regularMsg = evaluateHandoffTriggers({ message: 'Does this car have bluetooth?' })
  assert.equal(regularMsg.should_handoff, false)
})

test('11. Next best question selector recommends smart progressive qualification questions', () => {
  // Vehicle known, timeframe missing
  const q2 = getNextBestQuestion({ vehicle_interest: 'Toyota Camry' })
  assert.ok(q2.includes('week') || q2.includes('research'))

  // Missing vehicle & contact
  const q1 = getNextBestQuestion({})
  assert.ok(q1.includes('body style') || q1.includes('specific model'))

  // Financing mentioned, comfort zone missing
  const q3 = getNextBestQuestion({ vehicle_interest: 'Toyota Camry', cash_finance_lease_interest: PAYMENT_PREFERENCES.FINANCE })
  assert.ok(q3.includes('monthly payment') || q3.includes('down'))
})

test('12. Grounded sales tools definitions match MCP specification and safety rules', async () => {
  const { toolDefs } = await import('../routes/tool-registry.js')
  const tools = toolDefs('sales_chat')
  const names = tools.map(t => t.name)
  assert.ok(names.includes('search_inventory'))
  assert.ok(names.includes('lookup_vehicle_details'))
  assert.ok(names.includes('get_similar_vehicles'))
  assert.ok(names.includes('capture_qualification'))
  assert.ok(names.includes('create_trade_request'))
  assert.ok(names.includes('calculate_payment'))
  assert.ok(names.includes('book_appointment'))
  assert.ok(names.includes('request_human'))
  assert.ok(names.includes('dealership_info'))
})

test('13. calculate_payment tool outputs disclaimers and deterministic mathematical amortization', async () => {
  const { callTool } = await import('../routes/tool-registry.js')
  const res = await callTool('calculate_payment', {
    price: 36000,
    down_payment: 4000,
    term_months: 60,
    estimated_apr: 6.9,
    trade_allowance: 2000,
  }, { dealershipId: 'd_test' }, { surface: 'sales_chat' })

  assert.ok(res.estimated_monthly_payment > 0)
  assert.equal(res.amount_financed, 30000)
  assert.equal(res.term_months, 60)
  assert.ok(res.disclaimer.toLowerCase().includes('estimate') || res.disclaimer.toLowerCase().includes('pre-approval'))
  assert.ok(res.disclaimer.toLowerCase().includes('taxes') || res.disclaimer.toLowerCase().includes('credit'))
})

test('14. capture_qualification tool merges progressive shopper data in context', async () => {
  const { callTool } = await import('../routes/tool-registry.js')
  const ctx = {
    dealershipId: 'd_test',
    conversation: { id: 'c_test' },
    contactRef: { id: null },
    qualification: {},
  }
  const res = await callTool('capture_qualification', {
    vehicle_interest: '2024 Tahoe',
    purchase_timeframe: '1_2_weeks',
    comfortable_monthly_payment: '$700/mo',
    trade_year: '2019',
    trade_make: 'Ford',
    trade_model: 'Explorer',
    main_objection: 'price_too_high',
  }, ctx, { surface: 'sales_chat' })

  assert.equal(res.ok, true)
  assert.equal(ctx.qualification.vehicle_interest, '2024 Tahoe')
  assert.equal(ctx.qualification.comfortable_payment_range, '$700/mo')
  assert.equal(ctx.qualification.trade_make, 'Ford')
})

test('15. Security & Grounding Policy prohibits fabricated approvals and discounts', () => {
  const priceObj = OBJECTION_TAXONOMY.price_too_high
  assert.ok(priceObj.factsForbidden.some(f => f.includes('unapproved discounts')))

  const creditObj = OBJECTION_TAXONOMY.credit_concern
  assert.ok(creditObj.factsForbidden.some(f => f.includes('Guaranteeing credit approval')))

  const tradeObj = OBJECTION_TAXONOMY.trade_value_too_low
  assert.ok(tradeObj.factsForbidden.some(f => f.includes('Quoting firm trade purchase values without appraisal')))
})

