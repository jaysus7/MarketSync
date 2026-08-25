/**
 * MarketSync Customer Intelligence — Smart Objection Engine & 25+ Playbooks.
 *
 * Implements a consultative reasoning framework across 25+ automotive & business objection categories.
 * Tracks objection lifecycle: DETECTED → CLARIFIED → RESPONSED → RESOLVED or ESCALATED.
 * Strictly respects financial boundaries — never uses manipulative or high-pressure closing tactics.
 */

import { OBJECTION_LIFECYCLE } from './customer-intelligence-state.js'

export const OBJECTION_PLAYBOOKS = {
  price_too_high: {
    type: 'price_too_high',
    label: 'Price Too High',
    principles: [
      'Acknowledge price concern with empathy without immediately cutting price or making unapproved discount promises.',
      'Clarify whether the overall vehicle sticker price or the monthly payment affordability is the core factor.',
      'Suggest exploring certified lower-priced in-stock trims or comparable models.',
    ],
    detectionPatterns: [/\b(price|sticker|cost|msrp)\b/i, /\b(too high|too much|expensive|overpriced|steep|drop the price|discount)\b/i],
    clarificationStrategy: 'Clarify if total purchase price or monthly budget is the driving factor.',
    factsAllowed: ['Live listed inventory price', 'Market check transparency', 'In-stock lower-priced alternatives'],
    factsForbidden: ['Inventing unapproved discounts', 'Claiming arbitrary price matching without verified manager policy'],
    suggestedNextAction: 'Suggest manager desk review or present comparable lower-priced inventory.',
    escalationThresholds: 'Customer demands a written price guarantee or manager discount before visiting.',
  },
  payment_too_high: {
    type: 'payment_too_high',
    label: 'Payment Too High',
    principles: [
      'Do not argue or defend price aggressively.',
      'Clarify monthly comfort zone, down payment flexibility, term length, and trade equity.',
      'Offer deterministic payment structuring options.',
    ],
    detectionPatterns: [/\b(payment|per month|monthly|a month)\b/i, /\b(too high|too much|steep|expensive|lower|out of budget|can't afford)\b/i],
    clarificationStrategy: 'Is the concern primarily monthly payment target, down payment amount, or loan term?',
    factsAllowed: ['Payment calculation formulas with disclaimers', 'Available term options (36-84 mo)'],
    factsForbidden: ['Promising specific interest rates', 'Guaranteeing lender approvals'],
    suggestedNextAction: 'Provide payment structuring scenarios or invite to confidential pre-qualification.',
    escalationThresholds: 'Customer has strict monthly ceiling that current vehicle cannot reach even with max term.',
  },
  trade_value_too_low: {
    type: 'trade_value_too_low',
    label: 'Trade Value Too Low',
    principles: [
      'Do not dispute customer perception.',
      'Gather vehicle specifics (year, make, model, exact mileage, condition, title/payoff).',
      'Explain that an on-site physical appraisal or live market desk appraisal unlocks top dollar.',
    ],
    detectionPatterns: [/\b(trade|trade-in|my car)\b/i, /\b(low|not enough|worth more|lowball|kbb is higher)\b/i],
    clarificationStrategy: 'Gather vehicle condition and recent maintenance details to build appraisal case.',
    factsAllowed: ['Need for physical/market condition review', 'Trade equity impact on sales tax savings'],
    factsForbidden: ['Quoting firm trade purchase values without appraisal tool or manager signoff'],
    suggestedNextAction: 'Stage trade appraisal workflow for Used Car Manager review.',
    escalationThresholds: 'Customer has an official competing written appraisal or active trade dispute.',
  },
  credit_concern: {
    type: 'credit_concern',
    label: 'Credit / Financing Concern',
    principles: [
      'Provide calm, non-judgmental reassurance.',
      'Explain that the dealership works with multiple prime and subprime lending institutions.',
      'Offer a secure, private online pre-qualification link.',
    ],
    detectionPatterns: [/\b(credit|bad credit|score|bankruptcy|repo|pre-?qual|approved|cosigner)\b/i],
    clarificationStrategy: 'Offer a private pre-qualification step to remove uncertainty.',
    factsAllowed: ['Access to multiple lending partners', 'Availability of confidential pre-qualification link'],
    factsForbidden: ['Guaranteeing credit approval', 'Stating exact approval interest rates'],
    suggestedNextAction: 'Provide secure finance application link and route to F&I specialist.',
    escalationThresholds: 'Customer mentions active Chapter 7/13 bankruptcy, repossession, or open tax lien.',
  },
  down_payment: {
    type: 'down_payment',
    label: 'Down Payment Constraint',
    principles: [
      'Clarify comfortable cash down range.',
      'Explain zero-down or low-down alternatives and trade equity rollover.',
    ],
    detectionPatterns: [/\b(down payment|cash down|out of pocket|money down|zero down|0 down)\b/i],
    clarificationStrategy: 'Understand available upfront cash or trade equity.',
    factsAllowed: ['Available low-down structuring options', 'Trade equity counting as down payment'],
    factsForbidden: ['Promising $0 down without lender pre-qualification'],
    suggestedNextAction: 'Calculate payment options with varying down payment tiers.',
    escalationThresholds: 'Customer requires zero down on subprime profile.',
  },
  interest_rate: {
    type: 'interest_rate',
    label: 'Interest Rate / APR Concern',
    principles: [
      'Explain current manufacturer promotional APR programs if applicable.',
      'Explain that exact APR is set by tier and lender underwriting.',
    ],
    detectionPatterns: [/\b(apr|interest rate|rates are too high|finance charge|percentage)\b/i],
    clarificationStrategy: 'Clarify if seeking manufacturer promotional rates or credit union financing.',
    factsAllowed: ['Published manufacturer APR specials', 'General market tier guidelines'],
    factsForbidden: ['Guaranteeing 0% APR without verifying program eligibility'],
    suggestedNextAction: 'Check current OEM promotional rate specials.',
    escalationThresholds: 'Customer demands binding rate lock over chat.',
  },
  vehicle_condition: {
    type: 'vehicle_condition',
    label: 'Vehicle Condition / Wear Concern',
    principles: [
      'Highlight dealership multipoint inspection process and certified standards.',
      'Offer Carfax report and walkaround video showing exact condition.',
    ],
    detectionPatterns: [/\b(condition|scratches|dents|smell|smoke|rust|wear and tear|clean|inspection)\b/i],
    clarificationStrategy: 'Ask what specific cosmetic or mechanical areas they want inspected.',
    factsAllowed: ['Dealership inspection standard', 'Carfax history report link'],
    factsForbidden: ['Guaranteeing cosmetic perfection on pre-owned units without physical check'],
    suggestedNextAction: 'Offer personalized walkaround video from sales specialist.',
    escalationThresholds: 'Customer requests warranty coverage for existing cosmetic blemish.',
  },
  warranty: {
    type: 'warranty',
    label: 'Warranty / Protection Plan Concern',
    principles: [
      'Provide exact remaining factory warranty balance.',
      'Explain certified pre-owned or extended protection coverage options.',
    ],
    detectionPatterns: [/\b(warranty|coverage|extended warranty|protection plan|break down|powertrain)\b/i],
    clarificationStrategy: 'Clarify whether looking for bumper-to-bumper or powertrain peace of mind.',
    factsAllowed: ['Remaining factory warranty years/mileage', 'CPO warranty terms'],
    factsForbidden: ['Making promises about non-covered wear-and-tear items'],
    suggestedNextAction: 'Provide warranty summary sheet.',
    escalationThresholds: 'Customer requires custom coverage rider.',
  },
  competitor_price: {
    type: 'competitor_price',
    label: 'Competitor Price / Lower Elsewhere',
    principles: [
      'Respect the customer’s research.',
      'Review package, trim, mileage, and condition differences objectively.',
      'Highlight dealership benefits (e.g. oil change perks, inspection, no hidden prep fees).',
    ],
    detectionPatterns: [/\b(found it cheaper|cheaper at|other store has it for|lower price at)\b/i],
    clarificationStrategy: 'Ask for the competing model trim or year to compare specifications fairly.',
    factsAllowed: ['Feature and mileage comparisons', 'Dealership value package'],
    factsForbidden: ['Disparaging competitor dealers', 'Unverified price matching promises'],
    suggestedNextAction: 'Alert sales manager with competing link/quote.',
    escalationThresholds: 'Customer provides verified written competing buyer order.',
  },
  other_dealers: {
    type: 'other_dealers',
    label: 'Shopping Other Dealers',
    principles: [
      'Validate their comparison process.',
      'Focus on vehicle availability and unique package attributes.',
    ],
    detectionPatterns: [/\b(other dealers?|another dealer|shopping around|checking other stores)\b/i],
    clarificationStrategy: 'Ask which other models are on their shortlist.',
    factsAllowed: ['In-stock vehicle advantages', 'Dealership customer satisfaction rating'],
    factsForbidden: ['Pressuring customer to stop shopping'],
    suggestedNextAction: 'Offer VIP test drive appointment.',
    escalationThresholds: 'Customer about to sign at competing store within hours.',
  },
  distance: {
    type: 'distance_from_dealership',
    label: 'Distance / Out of Town',
    principles: [
      'Explain remote paperwork and home delivery options if available.',
      'Offer comprehensive HD video walkaround before they make the drive.',
    ],
    detectionPatterns: [/\b(too far|far away|distance|hours away|out of town|live in|delivery|ship to me)\b/i],
    clarificationStrategy: 'Determine if customer prefers delivery or on-site pickup with staged keys.',
    factsAllowed: ['Home delivery options', 'Remote digital purchase flow'],
    factsForbidden: ['Promising free shipping without verifying distance policy'],
    suggestedNextAction: 'Offer video walkaround and remote deal structuring.',
    escalationThresholds: 'Customer located out of province/state with tax jurisdiction questions.',
  },
  timing: {
    type: 'timing_issue',
    label: 'Timing / Lease End / Wait for Bonus',
    principles: [
      'Capture specific milestone date (lease end, bonus, relocation).',
      'Check for early lease pull-ahead incentives.',
    ],
    detectionPatterns: [/\b(lease ends|lease is up|tax return|bonus|in a few months|waiting for|timing)\b/i],
    clarificationStrategy: 'Record exact target month in memory.',
    factsAllowed: ['Lease pull-ahead guidelines', 'Upcoming arrival schedule'],
    factsForbidden: ['Claiming current incentives will definitely remain active months ahead'],
    suggestedNextAction: 'Set automated CRM reminder task synced to customer target date.',
    escalationThresholds: 'Lease maturity within 60 days.',
  },
  spouse_approval: {
    type: 'spouse_approval',
    label: 'Spouse / Partner Approval',
    principles: [
      'Acknowledge shared household decision with complete respect.',
      'Offer shareable spec sheet, video, and a convenient joint test drive time.',
    ],
    detectionPatterns: [/\b(spouse|wife|husband|partner|fianc[eé]|ask my|talk to my|discuss with)\b/i],
    clarificationStrategy: 'Offer materials easy to share at home.',
    factsAllowed: ['Shareable digital window sticker', 'Joint test drive scheduling'],
    factsForbidden: ['Dismissive or sexist closing pressure'],
    suggestedNextAction: 'Send digital vehicle overview and suggest weekend joint drive.',
    escalationThresholds: 'Both decision makers present on chat.',
  },
  just_looking: {
    type: 'just_looking',
    label: 'Just Looking / Browsing',
    principles: [
      'Lower all pressure. Be welcoming, helpful, and non-intrusive.',
      'Offer high-level catalog guidance.',
    ],
    detectionPatterns: [/\b(just looking|just browsing|window shopping|not ready to buy|curious)\b/i],
    clarificationStrategy: 'Invite open exploration.',
    factsAllowed: ['Category overview', 'Popular in-stock models'],
    factsForbidden: ['Demanding immediate phone number or deposit on first message'],
    suggestedNextAction: 'Provide broad vehicle suggestions and invite questions.',
    escalationThresholds: 'Customer identifies a specific vehicle of interest.',
  },
  needs_to_think: {
    type: 'needs_to_think',
    label: 'Needs To Think About It',
    principles: [
      'Respect their consideration process.',
      'Identify what specific detail remains unresolved (payments, size, features, color).',
    ],
    detectionPatterns: [/\b(think about it|sleep on it|consider it|digest|take some time|mull it over)\b/i],
    clarificationStrategy: 'Ask if there is a specific question or comparison that would help.',
    factsAllowed: ['Vehicle availability timeframe', 'Promotional expiration dates'],
    factsForbidden: ['Creating false artificial urgency'],
    suggestedNextAction: 'Send vehicle spec summary and schedule gentle 24h follow-up.',
    escalationThresholds: 'Customer goes silent after extensive engagement.',
  },
  vehicle_unavailable: {
    type: 'vehicle_unavailable',
    label: 'Vehicle Sold / Unavailable',
    principles: [
      'Be transparent and honest immediately.',
      'Search live inventory for identical or closely matched alternatives.',
    ],
    detectionPatterns: [/\b(sold|still available|in stock|gone|already sold)\b/i, /\b(no|not available|unavailable)\b/i],
    clarificationStrategy: 'Present closest in-stock match by trim, price, and features.',
    factsAllowed: ['Live alternative inventory', 'Incoming inventory pipeline'],
    factsForbidden: ['Pretending a sold vehicle is on lot to lure customer in'],
    suggestedNextAction: 'Present 2 in-stock alternatives with comparable specs.',
    escalationThresholds: 'Customer only wants that specific sold VIN.',
  },
  feature_missing: {
    type: 'feature_missing',
    label: 'Required Feature Missing',
    principles: [
      'Check if dealer can install accessory (e.g. hitch, leather, roof rails) or find matching trim.',
    ],
    detectionPatterns: [/\b(doesn't have|missing|wish it had|need it to have|no sunroof|no leather|no awd)\b/i],
    clarificationStrategy: 'Check if dealer-installed option or step-up trim provides the feature.',
    factsAllowed: ['Available trim packages', 'Dealer-installed accessory catalog'],
    factsForbidden: ['Claiming impossible aftermarket retrofits'],
    suggestedNextAction: 'Suggest step-up trim or dealer-installed accessory option.',
    escalationThresholds: 'Core factory feature (e.g. AWD/Engine) missing.',
  },
  mileage: {
    type: 'mileage_concern',
    label: 'Mileage Too High',
    principles: [
      'Provide vehicle maintenance records, single-owner Carfax history, and certified warranty.',
      'Suggest lower-mileage in-stock alternatives.',
    ],
    detectionPatterns: [/\b(mileage is high|too many miles|high km|high mileage|too old)\b/i],
    clarificationStrategy: 'Explain highway mileage history or suggest lower-mileage sister units.',
    factsAllowed: ['Carfax service history', 'Lower-mileage comparable units'],
    factsForbidden: ['Dismissing customer mileage preference'],
    suggestedNextAction: 'Present lower-mileage inventory options.',
    escalationThresholds: 'Customer has strict ceiling below current vehicle mileage.',
  },
  accident_history: {
    type: 'accident_history',
    label: 'Accident / Damage History Concern',
    principles: [
      'Review Carfax details transparently (e.g. minor cosmetic vs structural).',
      'Explain post-repair safety inspection certification.',
    ],
    detectionPatterns: [/\b(accident|damage|carfax shows|claim|fender bender|repaired)\b/i],
    clarificationStrategy: 'Share exact claim amount, repaired panel, and safety inspection results.',
    factsAllowed: ['Full Carfax report', 'Dealership safety certification checklist'],
    factsForbidden: ['Hiding or downplaying documented accident records'],
    suggestedNextAction: 'Provide full Carfax PDF link and inspection report.',
    escalationThresholds: 'Customer rejects any prior insurance claim.',
  },
  monthly_budget: {
    type: 'monthly_budget_exceeded',
    label: 'Monthly Budget Exceeded',
    principles: [
      'Respect stated budget strictly.',
      'Filter inventory to vehicles strictly within monthly target.',
    ],
    detectionPatterns: [/\b(over my budget|exceeds budget|more than i want to spend|can't do more than)\b/i],
    clarificationStrategy: 'Filter inventory to match monthly parameters exactly.',
    factsAllowed: ['In-budget inventory matches', 'Payment calculations with varying down payments'],
    factsForbidden: ['Pressuring customer to stretch beyond stated budget'],
    suggestedNextAction: 'Search and recommend in-budget inventory alternatives.',
    escalationThresholds: 'No inventory in stock under budget.',
  },
  lease_vs_finance: {
    type: 'lease_vs_finance',
    label: 'Lease vs Finance Uncertainty',
    principles: [
      'Explain key lifestyle differences: low monthly payments / newer cars (lease) vs long-term equity / unlimited mileage (finance).',
    ],
    detectionPatterns: [/\b(better to lease|lease or buy|lease vs finance|difference between leasing)\b/i],
    clarificationStrategy: 'Ask annual mileage driving habits and vehicle ownership horizon.',
    factsAllowed: ['Comparative monthly payment estimates', 'Annual mileage allowances'],
    factsForbidden: ['Pushing one structure without understanding customer driving needs'],
    suggestedNextAction: 'Present side-by-side lease vs finance breakdown.',
    escalationThresholds: 'Customer ready to structure lease proposal.',
  },
  new_vs_used: {
    type: 'new_vs_used',
    label: 'New vs Certified Pre-Owned Comparison',
    principles: [
      'Compare full factory warranty and promotional APR of new vs lower depreciation of CPO.',
    ],
    detectionPatterns: [/\b(new or used|worth buying new|certified pre-owned vs new)\b/i],
    clarificationStrategy: 'Compare monthly payment and warranty balance across both.',
    factsAllowed: ['Side-by-side price/payment comparisons', 'CPO inspection standards'],
    factsForbidden: ['Claiming used vehicle has full new-car warranty without verification'],
    suggestedNextAction: 'Show side-by-side comparison of new vs 1-2 year old CPO unit.',
    escalationThresholds: 'Customer decides on path.',
  },
  service_cost: {
    type: 'service_cost',
    label: 'Service / Maintenance Cost Concern',
    principles: [
      'Explain transparent diagnostic pricing and available maintenance plans.',
    ],
    detectionPatterns: [/\b(service is expensive|how much for service|maintenance cost|diagnostic fee)\b/i],
    clarificationStrategy: 'Provide exact service quote for requested maintenance.',
    factsAllowed: ['Published service menu pricing', 'Service specials/coupons'],
    factsForbidden: ['Quoting complex repairs without technician diagnostic inspection'],
    suggestedNextAction: 'Provide service coupon and offer appointment booking.',
    escalationThresholds: 'Major engine/transmission repair.',
  },
  wait_time: {
    type: 'wait_time',
    label: 'Wait Time / Schedule Delay',
    principles: [
      'Offer early express appointment slots or loaner vehicle if eligible.',
    ],
    detectionPatterns: [/\b(how long will it take|wait time|too busy|waiting for hours|appointment delay)\b/i],
    clarificationStrategy: 'Check next available express drop-off window.',
    factsAllowed: ['Live service calendar slots', 'Express lane availability'],
    factsForbidden: ['Promising zero wait time without checking service lane load'],
    suggestedNextAction: 'Book express drop-off slot.',
    escalationThresholds: 'Customer stranded or broken down.',
  },
  parts_availability: {
    type: 'parts_availability',
    label: 'Parts Availability / Backorder Concern',
    principles: [
      'Check live OEM parts catalog inventory and typical arrival lead time.',
    ],
    detectionPatterns: [/\b(part in stock|how long to get the part|backorder|part availability)\b/i],
    clarificationStrategy: 'Request VIN or part number to verify exact compatibility.',
    factsAllowed: ['Live in-stock parts counts', 'Standard supplier shipping ETA'],
    factsForbidden: ['Promising same-day delivery on backordered components'],
    suggestedNextAction: 'Route to Parts Counter specialist with VIN.',
    escalationThresholds: 'Emergency vehicle down part.',
  },
}

/**
 * Classifies customer message into one of the 25+ playbooks.
 */
export function identifyObjection(message = '', conversationHistory = []) {
  const text = String(message || '').toLowerCase()
  if (!text) return null

  for (const [key, playbook] of Object.entries(OBJECTION_PLAYBOOKS)) {
    const matchesAllPatterns = playbook.detectionPatterns.every(pattern => pattern.test(text))
    if (matchesAllPatterns) {
      return {
        type: key,
        label: playbook.label,
        playbook,
        confidence: 0.90,
      }
    }
  }

  return null
}

/**
 * Manages the lifecycle transitions of active objections in intelligence state.
 */
export function updateObjectionLifecycle(intelligenceState, detectedObjection = null, responseAction = null) {
  const objections = intelligenceState.objections || { active_objections: [], resolved_objections: [], unresolved_questions: [] }

  if (detectedObjection) {
    const existing = objections.active_objections.find(o => o.type === detectedObjection.type)
    if (!existing) {
      objections.active_objections.push({
        id: `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: detectedObjection.type,
        label: detectedObjection.label,
        lifecycle: OBJECTION_LIFECYCLE.DETECTED,
        detected_at: new Date().toISOString(),
        confidence: detectedObjection.confidence || 0.85,
        severity: detectedObjection.type.includes('credit') || detectedObjection.type.includes('price') ? 'high' : 'medium',
        playbook: detectedObjection.playbook,
      })
    } else {
      existing.lifecycle = OBJECTION_LIFECYCLE.CLARIFIED
    }
  }

  intelligenceState.objections = objections
  return intelligenceState
}
