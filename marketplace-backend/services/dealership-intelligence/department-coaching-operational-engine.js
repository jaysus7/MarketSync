/**
 * MarketSync Dealership Intelligence — Department Operations & Coaching Engine (§490–522, §542–547)
 */

/**
 * Evaluates vehicle pricing position and listing media completeness (§490–493).
 */
export function evaluateVehicleMerchandising(vehicle = {}) {
  const {
    stock_number = 'STK-2025A',
    year = 2025,
    make = 'Chevrolet',
    model = 'Tahoe LT',
    days_in_stock = 71,
    market_price_position_pct = 4.8, // +4.8% above market
    leads_30d = 2,
    photos_count = 14,
    has_description = true,
    has_window_sticker = true,
    has_features = true
  } = vehicle

  // Calculate Media Quality Score (0 to 100)
  let mediaScore = 100
  if (photos_count < 12) mediaScore -= 25
  if (!has_description) mediaScore -= 25
  if (!has_window_sticker) mediaScore -= 15
  if (!has_features) mediaScore -= 15

  // Pricing Recommendation (Advisory only)
  let pricingRecommendation = 'Pricing aligned with local market index.'
  let priceReviewRequired = false

  if (days_in_stock > 60 && market_price_position_pct > 3.0 && leads_30d < 5) {
    priceReviewRequired = true
    pricingRecommendation = `Review pricing: Vehicle is +${market_price_position_pct}% above market with ${leads_30d} leads in 30 days and ${days_in_stock} days in stock. Human approval required for any adjustments.`
  }

  return {
    stock_number,
    vehicle_title: `${year} ${make} ${model}`,
    days_in_stock,
    market_price_position_pct,
    media_quality_score: Math.max(0, mediaScore),
    price_review_required: priceReviewRequired,
    pricing_recommendation: pricingRecommendation,
    media_audit: {
      photos_count,
      has_description,
      has_window_sticker,
      has_features
    }
  }
}

/**
 * Objective Sales Rep & Manager Process Coaching Engine (§494–496).
 * Zero psychological or demographic profiling.
 */
export function generateProcessCoachingInsights(repMetrics = {}) {
  const {
    rep_id = 'emp_401',
    rep_name = 'James Wilson',
    appointments_set_mtd = 28,
    appointments_show_rate_pct = 48, // low show rate despite high set count
    lead_response_avg_minutes = 4.2,
    overdue_promises_count = 1
  } = repMetrics

  const coachingSuggestions = []

  if (appointments_set_mtd >= 20 && appointments_show_rate_pct < 55) {
    coachingSuggestions.push({
      topic: 'Appointment Confirmation & Show Cadence',
      observation: `${rep_name} has strong appointment-setting performance (${appointments_set_mtd} set) but a below-target show rate (${appointments_show_rate_pct}%).`,
      suggested_action: 'Review same-day phone/SMS confirmation workflow and send video confirmations 2 hours prior to scheduled visits.',
      academy_module: 'Academy: High-Conversion Appointment Confirmation Workflows'
    })
  }

  if (overdue_promises_count > 0) {
    coachingSuggestions.push({
      topic: 'Customer Commitment Reliability',
      observation: `${rep_name} has ${overdue_promises_count} customer promise past due.`,
      suggested_action: 'Prioritize overdue customer callback/video delivery in My Day.',
      academy_module: null
    })
  }

  return {
    rep_id,
    rep_name,
    coaching_insights: coachingSuggestions
  }
}

/**
 * Service Promise Risk & Technician Dispatch Intelligence (§503–506).
 */
export function evaluateServicePromiseRisk(repairOrder = {}) {
  const {
    ro_number = '1842',
    customer_promise_time = '2026-08-25T16:00:00Z',
    remaining_labor_hours = 2.1,
    parts_status = 'BACKORDERED',
    is_ev_vehicle = false,
    assigned_tech = { id: 'tech_12', certified_ev: false }
  } = repairOrder

  const riskDrivers = []
  let riskScore = 0

  if (parts_status === 'BACKORDERED') {
    riskScore += 50
    riskDrivers.push('Required replacement part is currently backordered.')
  }
  if (remaining_labor_hours > 1.5) {
    riskScore += 25
    riskDrivers.push(`${remaining_labor_hours} labor hours remaining before promise time.`)
  }
  if (is_ev_vehicle && !assigned_tech.certified_ev) {
    riskScore += 30
    riskDrivers.push('Assigned technician is not certified for High-Voltage EV repairs.')
  }

  const isPromiseAtRisk = riskScore >= 50

  return {
    ro_number,
    is_at_risk: isPromiseAtRisk,
    risk_level: riskScore >= 70 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : 'LOW',
    estimated_risk_pct: Math.min(100, riskScore),
    drivers: riskDrivers,
    recommended_action: isPromiseAtRisk
      ? 'Contact customer to arrange courtesy vehicle and re-dispatch EV work to certified master technician.'
      : 'Maintain scheduled bay progression.'
  }
}

/**
 * Accounting Close Readiness & Exception Tracker (§512–514).
 */
export function evaluateAccountingCloseReadiness(accountingState = {}) {
  const {
    month_name = 'August',
    unmatched_bank_recs = 2,
    unfunded_deals_count = 3,
    commission_exceptions_count = 1,
    posting_failures_count = 0
  } = accountingState

  const blockers = []
  let readinessPct = 100

  if (unmatched_bank_recs > 0) {
    readinessPct -= (unmatched_bank_recs * 5)
    blockers.push(`${unmatched_bank_recs} un-reconciled bank activity lines`)
  }
  if (unfunded_deals_count > 0) {
    readinessPct -= (unfunded_deals_count * 4)
    blockers.push(`${unfunded_deals_count} delivered contracts pending lender funding`)
  }
  if (commission_exceptions_count > 0) {
    readinessPct -= 5
    blockers.push(`${commission_exceptions_count} salesperson commission rate exception pending manager sign-off`)
  }

  return {
    period: `${month_name} Close`,
    close_readiness_pct: Math.max(0, readinessPct),
    is_close_blocked: blockers.length > 0,
    blockers_count: blockers.length,
    hard_blockers: blockers,
    recommended_actions: [
      'Perform daily bank feed reconciliation.',
      'Clear outstanding lender funding stips with F&I department.'
    ]
  }
}
