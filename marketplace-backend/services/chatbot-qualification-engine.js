/**
 * Customer-Facing AI Chatbot Qualification, Objection Handling, Lead Scoring & Brief Engine.
 *
 * Implements:
 * 1. Structured Qualification State Tracker
 * 2. 18-Category Automotive Objection Framework
 * 3. Explainable Lead Scoring with Explicit Reasons (HOT / WARM / NURTURE)
 * 4. Actionable AI Lead Brief Generator with Recommended Opening Line
 * 5. Autonomous & Triggered Human Handoff Evaluator
 * 6. Omnichannel Channel Routing & Presence Helpers
 * 7. Next Best Question / Next Best Action Strategy
 *
 * Grounded in canonical MarketSync records. Zero hallucinations, zero duplicate data models.
 */

// ── 1. Structured Qualification State Vocabulary ─────────────────────────────
export const PURCHASE_TIMEFRAMES = {
  IMMEDIATE: 'immediate',           // within 48-72h
  ONE_TWO_WEEKS: '1_2_weeks',       // 1-2 weeks
  ONE_MONTH: '1_month',             // ~30 days
  FEW_MONTHS: 'few_months',         // 2-3+ months
  JUST_RESEARCHING: 'just_researching',
  UNKNOWN: 'unknown',
}

export const BUYING_INTENT_CATEGORIES = {
  HOT: 'HOT',
  WARM: 'WARM',
  NURTURE: 'NURTURE',
}

export const PAYMENT_PREFERENCES = {
  FINANCE: 'finance',
  LEASE: 'lease',
  CASH: 'cash',
  UNDECIDED: 'undecided',
}

export const TRADE_STATUSES = {
  HAS_TRADE: 'has_trade',
  NO_TRADE: 'no_trade',
  CONSIDERING: 'considering',
  UNDECIDED: 'undecided',
}

// ── 2. The 18-Category Objection Taxonomy ────────────────────────────────────
export const OBJECTION_TAXONOMY = {
  price_too_high: {
    type: 'price_too_high',
    label: 'Price Too High',
    principles: [
      'Acknowledge price concern with empathy without immediately discounting.',
      'Clarify whether total vehicle price or monthly affordability is the core issue.',
      'Highlight market-based value or suggest comparable in-stock trims/alternatives.',
    ],
    factsAllowed: ['Live listed inventory price', 'Market check transparency', 'In-stock lower-priced alternatives'],
    factsForbidden: ['Inventing unapproved discounts', 'Claiming price matching without dealer policy'],
    bestNextQuestion: 'Are you comparing this to a specific vehicle you’ve seen elsewhere, or trying to stay under a specific budget?',
    escalationConditions: 'Customer demands a price commitment or manager discount before visiting.',
    suggestedNextAction: 'Suggest manager desk review or present comparable certified pre-owned options.',
  },
  payment_too_high: {
    type: 'payment_too_high',
    label: 'Payment Too High',
    principles: [
      'Do not immediately defend price.',
      'Clarify monthly target, down payment comfort, term preference, and trade equity.',
      'Offer deterministic payment structuring options.',
    ],
    factsAllowed: ['Standard payment estimation formulas with disclaimers', 'Available term ranges (36-84 mo)'],
    factsForbidden: ['Promising specific interest rates', 'Guaranteeing lender approvals'],
    bestNextQuestion: 'Is the issue mainly the monthly payment target, the amount down, or the loan term?',
    escalationConditions: 'Customer requests exact lender approval or subprime structure.',
    suggestedNextAction: 'Offer secure credit application or schedule finance desk consultation.',
  },
  trade_value_too_low: {
    type: 'trade_value_too_low',
    label: 'Trade Value Too Low',
    principles: [
      'Do not argue or promise a higher value blindly.',
      'Gather vehicle specifics (year, make, model, trim, exact mileage, condition, title/payoff).',
      'Explain that on-site physical appraisal or live market desk appraisal unlocks top dollar.',
    ],
    factsAllowed: ['Need for physical/market condition review', 'Trade equity impact on new tax savings'],
    factsForbidden: ['Quoting firm trade purchase values without appraisal tool or manager signoff'],
    bestNextQuestion: 'Do you know roughly what your current payoff is, and has the vehicle had any recent maintenance or title issues?',
    escalationConditions: 'Customer has an official competing written appraisal or trade dispute.',
    suggestedNextAction: 'Stage trade appraisal workflow and alert used car manager.',
  },
  needs_to_think: {
    type: 'needs_to_think',
    label: 'Needs To Think About It',
    principles: [
      'Do not pressure or use aggressive closing scripts.',
      'Identify what specific information gap remains unresolved.',
      'Offer helpful takeaway info (spec sheet, payment breakdown, video walkaround).',
    ],
    factsAllowed: ['Vehicle availability timeframe', 'Current promotional expiration dates'],
    factsForbidden: ['Fabricating false urgency (e.g. "someone else is buying it in 10 minutes" unless true)'],
    bestNextQuestion: 'Completely understand. Is there a specific detail on the vehicle, financing, or trade you’d like more clarity on while you consider it?',
    escalationConditions: 'Customer goes silent after extended engagement.',
    suggestedNextAction: 'Send digital vehicle brochure or video walkaround and schedule gentle 24h follow-up.',
  },
  shopping_other_dealers: {
    type: 'shopping_other_dealers',
    label: 'Shopping Other Dealers',
    principles: [
      'Respect the customer’s due diligence.',
      'Highlight dealership differentiators (warranty, inspection standard, transparent pricing, customer service).',
      'Focus on vehicle condition and package differences.',
    ],
    factsAllowed: ['Dealership warranty/service perks', 'Transparent vehicle inspection report / Carfax'],
    factsForbidden: ['Disparaging competing dealerships by name', 'False comparisons'],
    bestNextQuestion: 'Makes total sense to compare. Which other models or stores are on your shortlist so I can highlight the key package differences?',
    escalationConditions: 'Customer has competing quote in hand.',
    suggestedNextAction: 'Have sales manager review package comparison and offer VIP test drive.',
  },
  not_ready_yet: {
    type: 'not_ready_yet',
    label: 'Not Ready Yet / Early Stage',
    principles: [
      'Validate their early research timeline.',
      'Remove pressure; offer low-friction educational assistance.',
      'Keep door open for when timeframe moves forward.',
    ],
    factsAllowed: ['Upcoming model arrivals', 'General vehicle specifications'],
    factsForbidden: ['Demanding immediate showroom visit'],
    bestNextQuestion: 'Are you thinking more in the next month or two, or just starting to look at what’s out there?',
    escalationConditions: 'Timeframe moves from months to immediate.',
    suggestedNextAction: 'Enroll in low-frequency nurture stream and record timeframe memory.',
  },
  discount_before_visit: {
    type: 'discount_before_visit',
    label: 'Wants Discount Before Visiting',
    principles: [
      'Be transparent that pricing is market-calibrated.',
      'Offer to have the sales manager prepare a custom out-the-door proposal for their visit.',
      'Explain that trade-ins, incentives, and financing options can improve the total deal.',
    ],
    factsAllowed: ['Current advertised price', 'Applicable public manufacturer incentives'],
    factsForbidden: ['Inventing unauthorized discounts over chat'],
    bestNextQuestion: 'If we can put together an aggressive package that works for your budget, when would be the best time for you to take it for a spin?',
    escalationConditions: 'Customer refuses to visit without written price cut.',
    suggestedNextAction: 'Alert sales manager to review deal margins and send tailored proposal.',
  },
  credit_concern: {
    type: 'credit_concern',
    label: 'Credit / Financing Concern',
    principles: [
      'Provide calm, non-judgmental reassurance.',
      'Explain that the dealership works with multiple prime and subprime lending institutions.',
      'Guide them to a secure, private pre-qualification link.',
    ],
    factsAllowed: ['Access to multiple lending partners', 'Availability of confidential pre-qualification'],
    factsForbidden: ['Guaranteeing credit approval', 'Stating exact approval interest rates'],
    bestNextQuestion: 'Would it help to do a quick, confidential pre-qualification online so you know exactly where you stand before coming in?',
    escalationConditions: 'Customer mentions bankruptcy, repossession, or severe credit challenge.',
    suggestedNextAction: 'Route to F&I specialist with secure credit application link.',
  },
  spouse_approval: {
    type: 'spouse_approval',
    label: 'Needs Spouse / Partner Approval',
    principles: [
      'Respect joint decision-making.',
      'Offer shareable materials (specs, photos, pricing summary, window sticker PDF).',
      'Invite both partners for a joint test drive.',
    ],
    factsAllowed: ['Vehicle specs, safety ratings, family features'],
    factsForbidden: ['Pressuring customer to buy without partner'],
    bestNextQuestion: 'Would it be helpful if I texted or emailed you the window sticker and photos to review together?',
    escalationConditions: 'Both decision-makers have conflicting requirements.',
    suggestedNextAction: 'Provide shareable vehicle link and suggest a Saturday joint test drive.',
  },
  distance_from_dealership: {
    type: 'distance_from_dealership',
    label: 'Distance / Location Concern',
    principles: [
      'Acknowledge the travel distance.',
      'Highlight remote conveniences: digital walkaround video, online paperwork, home delivery options if offered.',
      'Ensure vehicle is held/prepped before they make the trip.',
    ],
    factsAllowed: ['Dealership address/directions', 'Virtual appointment/video walkaround availability'],
    factsForbidden: ['Promising free home delivery unless dealership explicitly configures it'],
    bestNextQuestion: 'We work with customers from out of town all the time. Would you like a personalized video walkaround sent to your phone before you decide to make the trip?',
    escalationConditions: 'Customer is out of province/state.',
    suggestedNextAction: 'Assign sales rep to film high-definition personalized walkaround video.',
  },
  wants_exact_numbers: {
    type: 'wants_exact_numbers',
    label: 'Wants Exact Numbers / Out-The-Door Price',
    principles: [
      'Provide itemized transparency where authorized (selling price, standard taxes/fees).',
      'Explain that exact title/registration/trade payoff requires official desk verification.',
      'Offer a complete written pencil from the desk.',
    ],
    factsAllowed: ['MSRP / Selling Price', 'Standard doc/prep fees if configured'],
    factsForbidden: ['Guessing out-of-province tax rates or unverified fees'],
    bestNextQuestion: 'I can have our desk put together an exact breakdown. Are you planning to register this locally, and will there be a trade-in involved?',
    escalationConditions: 'Customer requires signed quote.',
    suggestedNextAction: 'Request sales desk out-the-door breakdown and deliver via SMS/email.',
  },
  vehicle_unavailable: {
    type: 'vehicle_unavailable',
    label: 'Vehicle Sold / Unavailable',
    principles: [
      'Be 100% truthful immediately; never mislead a customer to visit for a sold unit.',
      'Identify exactly what features attracted them to that specific unit.',
      'Offer closest matching in-stock or incoming units.',
    ],
    factsAllowed: ['Live inventory status', 'Incoming pipeline units with expected dates'],
    factsForbidden: ['Claiming a sold unit is available to get them on the lot'],
    bestNextQuestion: 'That specific one just had a deposit placed, but I have two very similar trims with the same powertrain. What was the most important feature on that one for you?',
    escalationConditions: 'No matching in-stock inventory available.',
    suggestedNextAction: 'Log vehicle acquisition alert and suggest factory order or sister store search.',
  },
  warranty_concern: {
    type: 'warranty_concern',
    label: 'Warranty / Protection Concern',
    principles: [
      'Clarify remaining factory warranty coverage if applicable.',
      'Explain certified inspection standards and extended protection options.',
    ],
    factsAllowed: ['Original in-service warranty estimates', 'Inspection standard points'],
    factsForbidden: ['Inventing free lifetime powertrain warranties without store policy'],
    bestNextQuestion: 'Are you looking for remaining factory bumper-to-bumper coverage, or extended powertrain protection for peace of mind?',
    escalationConditions: 'Customer asks specific exclusion/inclusion terms.',
    suggestedNextAction: 'Provide warranty coverage documentation sheet.',
  },
  used_condition_concern: {
    type: 'used_condition_concern',
    label: 'Used Vehicle Condition / History',
    principles: [
      'Reassure with transparency: safety inspection, reconditioning report, Carfax/history report.',
      'Offer photos/video of specific areas (tires, interior, body).',
    ],
    factsAllowed: ['Reconditioning inspection standards', 'Carfax availability'],
    factsForbidden: ['Claiming a vehicle is in mint condition without verified data'],
    bestNextQuestion: 'Every pre-owned vehicle goes through a rigorous multi-point inspection. Would you like me to send you the full vehicle history report?',
    escalationConditions: 'Customer asks about prior accident or structural damage.',
    suggestedNextAction: 'Send Carfax report and detailed reconditioning inspection sheet.',
  },
  financing_concern: {
    type: 'financing_concern',
    label: 'Financing Rate / Loan Structure Concern',
    principles: [
      'Explain manufacturer special APR vs standard bank terms.',
      'Explain how down payment or term adjustments optimize interest costs.',
    ],
    factsAllowed: ['Active manufacturer promo rates if published', 'General auto financing education'],
    factsForbidden: ['Guaranteeing 0% APR or specific rates'],
    bestNextQuestion: 'Are you looking to take advantage of current manufacturer promo rates, or looking for flexible terms with low down payment?',
    escalationConditions: 'Customer requests rate comparison across tier 1-4 credit.',
    suggestedNextAction: 'Connect with F&I Director.',
  },
  just_looking: {
    type: 'just_looking',
    label: 'Just Looking / Casual Browsing',
    principles: [
      'Lower barriers completely. Be friendly and helpful without being salesy.',
      'Guide them gently based on broad lifestyle preferences.',
    ],
    factsAllowed: ['Category overviews (SUVs, Trucks, Sedans)', 'Top popular models'],
    factsForbidden: ['Pushing immediate contact capture or test drive on message 1'],
    bestNextQuestion: 'No problem at all! Are you narrowing down the body style, looking for a certain budget, or just seeing what’s new?',
    escalationConditions: 'None.',
    suggestedNextAction: 'Provide high-level catalog guidance and invite questions.',
  },
  timing_issue: {
    type: 'timing_issue',
    label: 'Timing / Lease End / Wait for Bonus',
    principles: [
      'Capture specific target date (e.g. tax return, lease maturity, relocation).',
      'Check for early lease pull-ahead incentives if applicable.',
    ],
    factsAllowed: ['Lease return options', 'Order lead times'],
    factsForbidden: ['Claiming incentives will remain identical months in advance'],
    bestNextQuestion: 'When does your current lease or vehicle arrangement wrap up? Often we can look at pull-ahead options up to a few months early.',
    escalationConditions: 'Lease maturity within 90 days.',
    suggestedNextAction: 'Set CRM reminder task synced to customer target date.',
  },
  payoff_concern: {
    type: 'payoff_concern',
    label: 'Negative Equity / Current Loan Payoff',
    principles: [
      'Explain that equity can frequently be rolled over or offset with rebates/down payment.',
      'Offer a complimentary trade appraisal to get the exact payoff gap.',
    ],
    factsAllowed: ['Concept of equity transfer', 'Trade appraisal process'],
    factsForbidden: ['Claiming the dealer will "pay off your loan regardless of what you owe" without context'],
    bestNextQuestion: 'Do you know roughly what the balance is on your current loan versus what you think the car is worth?',
    escalationConditions: 'Significant negative equity > $5,000.',
    suggestedNextAction: 'Schedule F&I trade equity review.',
  },
}

// ── 3. Structured Qualification State Extractor ──────────────────────────────
export function extractQualificationState(messages = [], memory = [], previousState = {}, profile = null) {
  const userText = (messages || []).filter(m => m.role === 'user').map(m => m.message).join(' ').toLowerCase()
  const lastUserMsg = (messages || []).filter(m => m.role === 'user').slice(-1)[0]?.message || ''
  
  const state = {
    customer_name: previousState.customer_name || profile?.full_name || profile?.name || null,
    phone: previousState.phone || profile?.phone_mobile || profile?.phone || null,
    email: previousState.email || profile?.email || null,
    preferred_contact_channel: previousState.preferred_contact_channel || 'chat',
    communication_consent: previousState.communication_consent ?? null,
    vehicle_interest: previousState.vehicle_interest || null,
    stock_number: previousState.stock_number || null,
    vin: previousState.vin || null,
    new_used_preference: previousState.new_used_preference || null,
    body_style_interest: previousState.body_style_interest || null,
    must_have_features: Array.isArray(previousState.must_have_features) ? [...previousState.must_have_features] : [],
    purchase_timeframe: previousState.purchase_timeframe || PURCHASE_TIMEFRAMES.UNKNOWN,
    budget_range: previousState.budget_range || null,
    comfortable_payment_range: previousState.comfortable_payment_range || null,
    cash_finance_lease_interest: previousState.cash_finance_lease_interest || PAYMENT_PREFERENCES.UNDECIDED,
    trade_in_status: previousState.trade_in_status || TRADE_STATUSES.UNDECIDED,
    trade_year: previousState.trade_year || null,
    trade_make: previousState.trade_make || null,
    trade_model: previousState.trade_model || null,
    approximate_trade_mileage: previousState.approximate_trade_mileage || null,
    trade_payoff_known: previousState.trade_payoff_known || null,
    appointment_intent: previousState.appointment_intent || false,
    appointment_preference: previousState.appointment_preference || null,
    appointment_status: previousState.appointment_status || 'none',
    main_objection: previousState.main_objection || null,
    secondary_objection: previousState.secondary_objection || null,
    buying_intent: previousState.buying_intent || BUYING_INTENT_CATEGORIES.NURTURE,
    handoff_ready: previousState.handoff_ready || false,
    handoff_reason: previousState.handoff_reason || null,
    assigned_rep: previousState.assigned_rep || profile?.assigned_rep || null,
    last_meaningful_customer_intent: lastUserMsg ? String(lastUserMsg).slice(0, 300) : (previousState.last_meaningful_customer_intent || null),
  }

  // 1. Ingest from durable memory
  for (const m of memory || []) {
    const v = String(m.value || '').trim()
    if (!v) continue
    if (m.memory_type === 'vehicle_interest' && !state.vehicle_interest) state.vehicle_interest = v
    if (m.memory_type === 'budget' && !state.budget_range) state.budget_range = v
    if (m.memory_type === 'trade' && state.trade_in_status === TRADE_STATUSES.UNDECIDED) {
      state.trade_in_status = TRADE_STATUSES.HAS_TRADE
      const tradeParts = v.split(/\s+/)
      if (tradeParts.length >= 3) {
        state.trade_year = tradeParts[0]
        state.trade_make = tradeParts[1]
        state.trade_model = tradeParts.slice(2).join(' ')
      }
    }
    if (m.memory_type === 'financing' && state.cash_finance_lease_interest === PAYMENT_PREFERENCES.UNDECIDED) {
      if (/lease/i.test(v)) state.cash_finance_lease_interest = PAYMENT_PREFERENCES.LEASE
      else if (/finance|loan/i.test(v)) state.cash_finance_lease_interest = PAYMENT_PREFERENCES.FINANCE
      else if (/cash/i.test(v)) state.cash_finance_lease_interest = PAYMENT_PREFERENCES.CASH
    }
  }

  // 2. Ingest from text cues
  if (!state.new_used_preference) {
    if (/\bnew\b/i.test(userText)) state.new_used_preference = 'new'
    else if (/\b(used|pre-?owned|certified)\b/i.test(userText)) state.new_used_preference = 'used'
  }

  if (!state.body_style_interest) {
    if (/\b(suv|crossover|tahoe|suburban|escalade|yukon|explorer|cherokee|cr-v|rav4|rogue|highlander|pilot|telluride|palisade|wrangler)\b/i.test(userText)) state.body_style_interest = 'SUV'
    else if (/\b(truck|pickup|f-?150|silverado|sierra|ram 1500|tundra|tacoma|colorado|ranger|canyon|gladiator)\b/i.test(userText)) state.body_style_interest = 'Truck'
    else if (/\b(sedan|camry|accord|civic|corolla|altima|malibu|sonata|elantra|charger)\b/i.test(userText)) state.body_style_interest = 'Sedan'
    else if (/\b(van|minivan|odyssey|pacifica|sienna|transit)\b/i.test(userText)) state.body_style_interest = 'Van'
    else if (/\b(coupe|convertible|mustang|camaro|corvette)\b/i.test(userText)) state.body_style_interest = 'Coupe'
  }

  // Features
  const featureMatches = [
    { pattern: /\b(leather|heated seats|sunroof|moonroof|panoramic)\b/gi, name: 'Luxury / Comfort' },
    { pattern: /\b(awd|4wd|4x4|all-?wheel drive|four-?wheel drive)\b/gi, name: 'AWD/4WD' },
    { pattern: /\b(tow|towing|trailer|hitch)\b/gi, name: 'Towing Package' },
    { pattern: /\b(apple carplay|android auto|navigation|bluetooth)\b/gi, name: 'Tech / Connectivity' },
    { pattern: /\b(blind spot|adaptive cruise|lane assist|backup camera)\b/gi, name: 'Safety Tech' },
    { pattern: /\b(3rd row|third row|7 passenger|8 passenger)\b/gi, name: '3rd Row Seating' },
  ]
  for (const fm of featureMatches) {
    if (fm.pattern.test(userText) && !state.must_have_features.includes(fm.name)) {
      state.must_have_features.push(fm.name)
    }
  }

  // Timeframe
  if (state.purchase_timeframe === PURCHASE_TIMEFRAMES.UNKNOWN) {
    if (/\b(just looking|just browsing|researching|curious|looking around|no rush)\b/i.test(userText)) {
      state.purchase_timeframe = PURCHASE_TIMEFRAMES.JUST_RESEARCHING
    } else if (/\b(today|tomorrow|this weekend|asap|ready to buy|immediately|(?:right\s+)?now)\b/i.test(userText) && !/\bfor now\b/i.test(userText)) {
      state.purchase_timeframe = PURCHASE_TIMEFRAMES.IMMEDIATE
    } else if (/\b(this week|next week|in a week|couple of weeks|2 weeks|1-2 weeks|1 to 2 weeks)\b/i.test(userText)) {
      state.purchase_timeframe = PURCHASE_TIMEFRAMES.ONE_TWO_WEEKS
    } else if (/\b(this month|next month|in 30 days|few weeks|1 month)\b/i.test(userText)) {
      state.purchase_timeframe = PURCHASE_TIMEFRAMES.ONE_MONTH
    } else if (/\b(summer|fall|spring|winter|few months|end of year|later this year)\b/i.test(userText)) {
      state.purchase_timeframe = PURCHASE_TIMEFRAMES.FEW_MONTHS
    }
  }

  // Financing / Cash / Lease
  if (state.cash_finance_lease_interest === PAYMENT_PREFERENCES.UNDECIDED) {
    if (/\blease|leasing\b/i.test(userText)) state.cash_finance_lease_interest = PAYMENT_PREFERENCES.LEASE
    else if (/\bfinance|financing|loan|monthly payment|apr\b/i.test(userText)) state.cash_finance_lease_interest = PAYMENT_PREFERENCES.FINANCE
    else if (/\bcash|wire|full amount|write a check\b/i.test(userText)) state.cash_finance_lease_interest = PAYMENT_PREFERENCES.CASH
  }

  // Payment budget capture
  const pmtMatch = userText.match(/\$(\d{2,4})\s*(?:\/|\s*a\s*|\s*per\s*)?(?:mo|month|pmt)/i)
  if (pmtMatch && !state.comfortable_payment_range) {
    state.comfortable_payment_range = `$${pmtMatch[1]}/mo`
  }

  // Total budget capture
  const budMatch = userText.match(/(?:budget|under|around|max|price\s+(?:range|limit|of|is)?)\s*(?:of|is|around|under)?\s*\$?([\d,]+k?)/i) || userText.match(/\$(\d{2,3}(?:,\d{3})+|\d{2,3}k)\b/i)
  if (budMatch && !state.budget_range) {
    state.budget_range = String(budMatch[1]).startsWith('$') ? String(budMatch[1]) : `$${budMatch[1]}`
  }

  // Trade detection
  if (state.trade_in_status === TRADE_STATUSES.UNDECIDED) {
    if (/\b(no trade|don't have a trade|no car to trade|clean purchase|without a trade|not trading)\b/i.test(userText)) {
      state.trade_in_status = TRADE_STATUSES.NO_TRADE
    } else if (/\b(trade|trade-in|trading in|my car is a|currently drive a|worth for my|trade value)\b/i.test(userText)) {
      state.trade_in_status = TRADE_STATUSES.HAS_TRADE
      const tradeYr = userText.match(/\b(19\d{2}|20\d{2})\b/)
      if (tradeYr) state.trade_year = tradeYr[1]
    }
  }

  // Appointment intent
  if (/\b(appointment|test drive|schedule a visit|come see|come in|stop by|see it in person|book a time)\b/i.test(userText)) {
    state.appointment_intent = true
  }

  // Objection Classification
  const detectedObjection = classifyObjection(userText, messages)
  if (detectedObjection) {
    if (!state.main_objection) {
      state.main_objection = detectedObjection
    } else if (state.main_objection !== detectedObjection && !state.secondary_objection) {
      state.secondary_objection = detectedObjection
    }
  }

  // Buying Intent Category
  if (
    state.purchase_timeframe === PURCHASE_TIMEFRAMES.IMMEDIATE ||
    state.appointment_intent ||
    (state.phone && state.vehicle_interest && state.purchase_timeframe === PURCHASE_TIMEFRAMES.ONE_TWO_WEEKS)
  ) {
    state.buying_intent = BUYING_INTENT_CATEGORIES.HOT
  } else if (
    state.vehicle_interest ||
    state.phone ||
    state.trade_in_status === TRADE_STATUSES.HAS_TRADE ||
    state.comfortable_payment_range ||
    state.purchase_timeframe === PURCHASE_TIMEFRAMES.ONE_MONTH
  ) {
    state.buying_intent = BUYING_INTENT_CATEGORIES.WARM
  } else {
    state.buying_intent = BUYING_INTENT_CATEGORIES.NURTURE
  }

  return state
}

// ── 4. Deterministic Objection Classifier ─────────────────────────────────────
export function classifyObjection(text = '', messages = []) {
  const t = String(text || '').toLowerCase()
  if (!t) return null

  if (/\b(payment|per month|monthly|a month)\b/.test(t) && /\b(too high|too much|steep|expensive|lower|out of budget|can't afford)\b/.test(t)) return 'payment_too_high'
  if (/\b(price|sticker|cost|msrp)\b/.test(t) && /\b(too high|too much|expensive|overpriced|steep|drop the price|discount)\b/.test(t)) return 'price_too_high'
  if (/\b(trade|trade-in|my car)\b/.test(t) && /\b(low|not enough|worth more|lowball|kbb is higher)\b/.test(t)) return 'trade_value_too_low'
  if (/\b(credit|bad credit|score|bankruptcy|repo|pre-?qual|approved|cosigner)\b/.test(t)) return 'credit_concern'
  if (/\b(spouse|wife|husband|partner|fianc[eé]|ask my|talk to my)\b/.test(t)) return 'spouse_approval'
  if (/\b(too far|far away|distance|drive over|hours away|out of town|delivery|ship)\b/.test(t)) return 'distance_from_dealership'
  if (/\b(think about it|sleep on it|consider it|digest|take some time|mull it over)\b/.test(t)) return 'needs_to_think'
  if (/\b(other dealer|another dealer|shopping around|checking other|cheaper at|across town)\b/.test(t)) return 'shopping_other_dealers'
  if (/\b(discount before|best price|bottom dollar|rock bottom|out the door price|best you can do)\b/.test(t)) return 'discount_before_visit'
  if (/\b(exact numbers|itemized|fees|breakdown|out-?of-?pocket|total out the door)\b/.test(t)) return 'wants_exact_numbers'
  if (/\b(not ready|just looking|just browsing|window shopping|not buying today|early stages)\b/.test(t)) return 'just_looking'
  if (/\b(warranty|coverage|extended warranty|protection plan|break down)\b/.test(t)) return 'warranty_concern'
  if (/\b(accident|carfax|history|damage|scratch|dent|rust|clean title|certified)\b/.test(t)) return 'used_condition_concern'
  if (/\b(owe on my|payoff|underwater|negative equity|upside down)\b/.test(t)) return 'payoff_concern'
  if (/\b(sold|still available|in stock|gone|already sold)\b/.test(t) && /\b(no|not available|unavailable)\b/.test(t)) return 'vehicle_unavailable'

  return null
}

// ── 5. Explainable Lead Scoring Engine ────────────────────────────────────────
export function calculateExplainableLeadScore(messages = [], memory = [], qualificationState = {}) {
  const userMessages = (messages || []).filter(m => m.role === 'user')
  const text = userMessages.map(m => m.message).join(' ').toLowerCase()
  
  let score = 0
  const reasons = []
  const breakdown = {}

  // 1. Engagement depth
  const engPoints = Math.min(15, userMessages.length * 3)
  if (engPoints > 0) {
    score += engPoints
    breakdown.engagement = engPoints
    if (userMessages.length >= 4) reasons.push('High conversation engagement (4+ messages exchanged)')
  }

  // 2. Specific Vehicle Selected
  if (qualificationState.vehicle_interest || qualificationState.stock_number || qualificationState.vin) {
    score += 20
    breakdown.vehicle_identified = 20
    reasons.push(`Specific vehicle identified (${qualificationState.vehicle_interest || qualificationState.stock_number || 'VIN linked'})`)
  }

  // 3. Contact Info Captured
  if (qualificationState.phone || qualificationState.email) {
    score += 20
    breakdown.contact_captured = 20
    const channelNote = qualificationState.phone ? 'Phone/SMS' : 'Email'
    reasons.push(`Verified customer contact captured (${channelNote})`)
  }

  // 4. Purchase Timeframe Urgency
  if (qualificationState.purchase_timeframe === PURCHASE_TIMEFRAMES.IMMEDIATE) {
    score += 20
    breakdown.urgency = 20
    reasons.push('High purchase urgency (ready to buy within 48-72h)')
  } else if (qualificationState.purchase_timeframe === PURCHASE_TIMEFRAMES.ONE_TWO_WEEKS) {
    score += 15
    breakdown.urgency = 15
    reasons.push('Near-term purchase timeframe (1-2 weeks)')
  } else if (qualificationState.purchase_timeframe === PURCHASE_TIMEFRAMES.ONE_MONTH) {
    score += 10
    breakdown.urgency = 10
    reasons.push('Active monthly research timeframe (~30 days)')
  }

  // 5. Appointment Intent / Booking
  if (qualificationState.appointment_intent || qualificationState.appointment_status === 'booked') {
    score += 20
    breakdown.appointment = 20
    reasons.push('Requested test drive or showroom visit')
  }

  // 6. Payment / Financing Discussion
  if (qualificationState.comfortable_payment_range || qualificationState.cash_finance_lease_interest !== PAYMENT_PREFERENCES.UNDECIDED) {
    score += 15
    breakdown.finance_target = 15
    reasons.push(`Budget/Financing parameters disclosed (${qualificationState.comfortable_payment_range || qualificationState.cash_finance_lease_interest})`)
  }

  // 7. Trade-in Details Provided
  if (qualificationState.trade_in_status === TRADE_STATUSES.HAS_TRADE) {
    score += 10
    breakdown.trade = 10
    const tradeLabel = [qualificationState.trade_year, qualificationState.trade_make, qualificationState.trade_model].filter(Boolean).join(' ')
    reasons.push(`Trade-in vehicle disclosed (${tradeLabel || 'Trade owner'})`)
  }

  // 8. Explicit Rep Request / Manager Escalation
  if (/\b(speak to someone|talk to a person|call me|manager|human)\b/i.test(text)) {
    score += 10
    breakdown.rep_request = 10
    reasons.push('Customer explicitly requested representative contact')
  }

  // Cap score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)))
  
  let category = BUYING_INTENT_CATEGORIES.NURTURE
  if (finalScore >= 75) category = BUYING_INTENT_CATEGORIES.HOT
  else if (finalScore >= 45) category = BUYING_INTENT_CATEGORIES.WARM

  return {
    score: finalScore,
    category,
    reasons: reasons.length ? reasons : ['Early stage casual inquiry'],
    breakdown,
  }
}

// ── 6. Actionable AI Lead Brief Generator ─────────────────────────────────────
export function generateAiLeadBrief({ conversation, contact, qualificationState, messages = [] }) {
  const q = qualificationState || {}
  const name = q.customer_name || contact?.full_name || contact?.first_name || 'Shopper'
  const phone = q.phone || contact?.phone_mobile || contact?.phone || 'Not provided'
  const email = q.email || contact?.email || 'Not provided'
  const channel = q.preferred_contact_channel || conversation?.channel || 'chat'
  
  const vehicle = q.vehicle_interest || (q.stock_number ? `Stock #${q.stock_number}` : 'Undecided / Open')
  const timeframe = q.purchase_timeframe && q.purchase_timeframe !== PURCHASE_TIMEFRAMES.UNKNOWN ? q.purchase_timeframe.replace(/_/g, ' ') : 'Not specified'
  const budget = q.comfortable_payment_range || q.budget_range || 'Flexible'
  const financeType = q.cash_finance_lease_interest !== PAYMENT_PREFERENCES.UNDECIDED ? q.cash_finance_lease_interest : 'Undecided'
  
  const trade = q.trade_in_status === TRADE_STATUSES.HAS_TRADE
    ? [q.trade_year, q.trade_make, q.trade_model].filter(Boolean).join(' ') || 'Has trade (details pending)'
    : (q.trade_in_status === TRADE_STATUSES.NO_TRADE ? 'None' : 'Not discussed')

  const mainObj = q.main_objection ? (OBJECTION_TAXONOMY[q.main_objection]?.label || q.main_objection) : 'None identified'
  const secObj = q.secondary_objection ? (OBJECTION_TAXONOMY[q.secondary_objection]?.label || q.secondary_objection) : null

  const appointment = q.appointment_intent
    ? (q.appointment_preference ? `Requested for ${q.appointment_preference}` : 'Wants to schedule visit')
    : 'Not yet scheduled'

  const lastCustomerMsg = (messages || []).filter(m => m.role === 'user').slice(-1)[0]?.message || 'None'

  // Generate Suggested Next Best Action & Personalized Opening Script
  let nextAction = 'Call or text to introduce yourself and confirm vehicle availability'
  let suggestedOpening = `Hi ${name}, this is your sales specialist at the dealership. Avery let me know you were looking into the ${vehicle}. How can I assist you with your search today?`

  if (q.appointment_intent) {
    nextAction = 'Confirm appointment date/time and stage vehicle in VIP staging bay'
    suggestedOpening = `Hi ${name}, thank you for connecting with us! I see you’re interested in test driving the ${vehicle}. I’d love to have the keys ready for you—does ${q.appointment_preference || 'this Saturday'} work best?`
  } else if (q.main_objection === 'payment_too_high' || q.comfortable_payment_range) {
    nextAction = 'Prepare custom payment options with multiple term/down scenarios'
    suggestedOpening = `Hi ${name}, I saw you were looking at the ${vehicle} and aiming for around ${budget}. I have a few financing structures that fit right in that range—when is a good time to review them?`
  } else if (q.trade_in_status === TRADE_STATUSES.HAS_TRADE) {
    nextAction = 'Prepare preliminary market valuation for customer trade-in'
    suggestedOpening = `Hi ${name}, Avery mentioned you’re considering trading in your ${trade} towards the ${vehicle}. We have strong demand for pre-owned inventory right now and would love to get you top dollar.`
  }

  const structuredBrief = {
    customer: {
      name,
      phone,
      email,
      preferred_channel: channel,
    },
    interest: {
      vehicle_title: vehicle,
      stock_number: q.stock_number || null,
      vin: q.vin || null,
      body_style: q.body_style_interest || null,
      must_have_features: q.must_have_features || [],
    },
    purchase: {
      timeframe,
      budget_or_payment: budget,
      finance_preference: financeType,
    },
    trade: {
      status: q.trade_in_status,
      vehicle: trade,
      mileage: q.approximate_trade_mileage || null,
      payoff_known: q.trade_payoff_known || null,
    },
    objections: {
      primary: mainObj,
      secondary: secObj,
      unresolved: q.main_objection != null,
    },
    appointment: {
      intent: q.appointment_intent,
      status: appointment,
    },
    conversation: {
      last_customer_message: lastCustomerMsg,
      summary: conversation?.summary || 'Ongoing qualification conversation',
    },
    next_best_action: {
      suggested_action: nextAction,
      suggested_opening_line: suggestedOpening,
    },
  }

  return structuredBrief
}

// ── 7. Autonomous & Triggered Human Handoff Evaluator ─────────────────────────
export function evaluateHandoffTriggers({ message = '', qualificationState = {}, score = 0, conversation = {} }) {
  const t = String(message || '').toLowerCase()
  
  // 1. Explicit human request
  if (/\b(speak to (?:a )?human|talk to (?:a )?person|call me|real person|manager|salesperson|agent|representative)\b/i.test(t)) {
    return { should_handoff: true, reason: 'Customer explicitly requested a human representative', priority: 'urgent' }
  }

  // 2. Ready to buy / negotiate now
  if (/\b(ready to buy|take my deposit|sign papers|come in right now|buy it today|write it up)\b/i.test(t)) {
    return { should_handoff: true, reason: 'High-intent buyer ready to transact immediately', priority: 'urgent' }
  }

  // 3. Frustration or dispute
  if (/\b(frustrated|annoyed|terrible service|waste of time|bot is useless|give me a manager)\b/i.test(t)) {
    return { should_handoff: true, reason: 'Customer frustration detected in chat', priority: 'urgent' }
  }

  // 4. Complex subprime or credit issue
  if (/\b(chapter 7|chapter 13|bankruptcy|repossession|foreclosure|collections)\b/i.test(t)) {
    return { should_handoff: true, reason: 'Specialized finance / credit consultation required', priority: 'high' }
  }

  // 5. Hot Lead Score Threshold Reached with Appointment Intent
  if (score >= 80 && qualificationState.appointment_intent) {
    return { should_handoff: true, reason: 'Hot qualified lead with test drive intent', priority: 'high' }
  }

  return { should_handoff: false, reason: null, priority: 'normal' }
}

// ── 8. Next Best Question Selector ────────────────────────────────────────────
export function getNextBestQuestion(state = {}, previousQuestions = []) {
  // If vehicle is known but timeframe is unknown
  if (state.vehicle_interest && (!state.purchase_timeframe || state.purchase_timeframe === PURCHASE_TIMEFRAMES.UNKNOWN)) {
    return "Are you looking to make a move in the next week or two, or mostly doing research for down the road?"
  }

  // If vehicle is not yet identified
  if (!state.vehicle_interest && !state.stock_number) {
    return "Are you looking for a specific model, or trying to narrow down body style and budget?"
  }

  // If payments were brought up but comfort zone not specified
  if (state.cash_finance_lease_interest === PAYMENT_PREFERENCES.FINANCE && !state.comfortable_payment_range) {
    return "Do you have a specific monthly payment comfort zone in mind, or an amount down you'd like to stick to?"
  }

  // If trade was mentioned but details missing
  if (state.trade_in_status === TRADE_STATUSES.HAS_TRADE && !state.trade_year) {
    return "What year, make, and model are you thinking of trading in?"
  }

  // If hot and ready for next step
  if (state.vehicle_interest && (state.phone || state.email) && !state.appointment_intent) {
    return "Would you like to set up a quick 15-minute test drive to see how it feels on the road?"
  }

  return "What questions can I answer about features, pricing, or vehicle history?"
}
