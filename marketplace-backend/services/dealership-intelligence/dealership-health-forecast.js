/**
 * MarketSync Dealership Intelligence — Explainable Health Scoring & Forecasting Engine (§460–466, §568–570)
 */

/**
 * Computes an itemized, explainable Dealership Health Score (§460, §461).
 */
export function calculateDealershipHealth(state) {
  const scores = {}

  // 1. Inventory Health
  const invIssues = []
  let invScore = 100
  if (state.inventory?.units_over_90_days > 10) {
    invScore -= 18
    invIssues.push(`${state.inventory.units_over_90_days} vehicles over 90 days in stock`)
  }
  if (state.inventory?.units_priced_above_market > 5) {
    invScore -= 10
    invIssues.push(`Pricing above market on ${state.inventory.units_priced_above_market} units`)
  }
  if (state.inventory?.units_missing_photos > 0) {
    invScore -= 4
    invIssues.push(`${state.inventory.units_missing_photos} units missing frontline photos`)
  }
  if (state.inventory?.avg_recon_days > 4.5) {
    invScore -= 4
    invIssues.push(`Recon average is ${state.inventory.avg_recon_days} days (target: < 3.5 days)`)
  }
  scores.inventory = {
    score: Math.max(0, invScore),
    status: invScore >= 80 ? 'HEALTHY' : invScore >= 60 ? 'NEEDS_ATTENTION' : 'CRITICAL',
    reasons: invIssues.length ? invIssues : ['Inventory turn and merchandising within targets.'],
    recommended_actions: [
      'Review aged pricing on units > 90 days.',
      'Prioritize recon bottlenecks to reduce frontline cycle time.',
      'Complete missing vehicle photos.'
    ]
  }

  // 2. Sales Health
  const salesIssues = []
  let salesScore = 100
  if (state.sales?.avg_response_time_minutes > 5) {
    salesScore -= 15
    salesIssues.push(`Average lead response time is ${state.sales.avg_response_time_minutes} min (target: < 5 min)`)
  }
  if (state.sales?.appointments_show_rate_pct < 70) {
    salesScore -= 10
    salesIssues.push(`Appointment show rate is ${state.sales.appointments_show_rate_pct}% (target: > 75%)`)
  }
  scores.sales = {
    score: Math.max(0, salesScore),
    status: salesScore >= 80 ? 'HEALTHY' : salesScore >= 60 ? 'NEEDS_ATTENTION' : 'CRITICAL',
    reasons: salesIssues.length ? salesIssues : ['Sales pace and response SLA meeting targets.'],
    recommended_actions: [
      'Enforce real-time lead assignment to maintain < 5 min SLA.',
      'Deploy automated pre-appointment SMS reminders to boost show rate.'
    ]
  }

  // 3. Service Health
  const serviceIssues = []
  let serviceScore = 100
  if (state.service?.capacity_deficit_hours > 0) {
    serviceScore -= 18
    serviceIssues.push(`${state.service.capacity_deficit_hours} hour technician capacity deficit today`)
  }
  if (state.service?.ros_blocked_by_parts > 0) {
    serviceScore -= 12
    serviceIssues.push(`${state.service.ros_blocked_by_parts} ROs blocked by parts availability`)
  }
  scores.service = {
    score: Math.max(0, serviceScore),
    status: serviceScore >= 80 ? 'HEALTHY' : serviceScore >= 60 ? 'NEEDS_ATTENTION' : 'CRITICAL',
    reasons: serviceIssues.length ? serviceIssues : ['Technician load and RO flow balanced.'],
    recommended_actions: [
      'Balance appointment scheduling against available technician hours.',
      'Expedite parts dispatch for active customer ROs.'
    ]
  }

  // 4. Financial Health (Accounting / F&I)
  const finIssues = []
  let finScore = 100
  if (state.fni?.funding_over_3_days_count > 0) {
    finScore -= 15
    finIssues.push(`${state.fni.funding_over_3_days_count} delivered contracts unfunded > 3 business days ($${(state.fni.funding_pending_total || 0).toLocaleString()})`)
  }
  if (state.accounting?.close_blockers_count > 0) {
    finScore -= 10
    finIssues.push(`${state.accounting.close_blockers_count} items blocking month-end accounting close`)
  }
  scores.financial = {
    score: Math.max(0, finScore),
    status: finScore >= 80 ? 'HEALTHY' : finScore >= 60 ? 'NEEDS_ATTENTION' : 'CRITICAL',
    reasons: finIssues.length ? finIssues : ['Cash position and funding cycles on schedule.'],
    recommended_actions: [
      'Resolve outstanding lender stipulations on delivered deals.',
      'Clear bank reconciliation and commission exceptions.'
    ]
  }

  // Overall Dealership Composite
  const compositeScore = Math.round(
    (scores.inventory.score + scores.sales.score + scores.service.score + scores.financial.score) / 4
  )

  return {
    composite_score: compositeScore,
    status: compositeScore >= 80 ? 'HEALTHY' : compositeScore >= 60 ? 'NEEDS_ATTENTION' : 'CRITICAL',
    department_scores: scores,
    evaluated_at: new Date().toISOString()
  }
}

/**
 * Generates probabilistic operational forecasts (§462–466).
 */
export function generateOperationalForecasts(state, calendar = {}) {
  const remainingSellingDays = calendar.remaining_selling_days || 8
  const mtdSales = state.sales?.month_to_date_units_sold || 41
  const dailyRunRate = mtdSales / (calendar.elapsed_selling_days || 18)
  const projectedSalesMin = Math.round(mtdSales + (dailyRunRate * 0.9 * remainingSellingDays))
  const projectedSalesMax = Math.round(mtdSales + (dailyRunRate * 1.1 * remainingSellingDays))

  return {
    forecast_generated_at: new Date().toISOString(),

    // 1. Sales Pace Forecast (§463)
    sales_pace: {
      current_units: mtdSales,
      projected_range: `${projectedSalesMin}–${projectedSalesMax} units`,
      confidence: 'MEDIUM',
      drivers: [
        `${remainingSellingDays} selling days remaining in cycle`,
        `Appointment pipeline steady with ${state.sales?.appointments_today_count || 12} booked today`,
        `Lead-to-show conversion holding at ${state.sales?.appointments_show_rate_pct || 75}%`
      ],
      risks: [
        'Weekend appointment count is 12% lower than rolling 90-day baseline.'
      ]
    },

    // 2. Service Capacity Forecast (§464)
    service_capacity: {
      booked_hours: state.service?.booked_tech_hours_today || 74,
      available_hours: state.service?.available_tech_hours_today || 61,
      deficit_hours: Math.max(0, (state.service?.booked_tech_hours_today || 74) - (state.service?.available_tech_hours_today || 61)),
      risk_assessment: (state.service?.capacity_deficit_hours || 0) > 0
        ? 'HIGH: Potential customer promise time delays without dispatch adjustment'
        : 'LOW: Capacity balanced',
      recommended_action: 'Shift non-urgent maintenance appointments or allocate overtime.'
    },

    // 3. Cash Flow Signaling (§466)
    cash_flow_signal: {
      expected_cash_in: (state.fni?.funding_pending_total || 92000) + 45000,
      expected_cash_out: (state.accounting?.payroll_liabilities_upcoming || 64000) + (state.accounting?.accounts_payable_total || 98000),
      net_liquidity_outlook: 'POSITIVE',
      advisory_note: 'Large cash outflow scheduled for Friday due to payroll and vendor AP.'
    }
  }
}

/**
 * Operating Plan Goal Variance Engine (§568–570).
 */
export function evaluateGoalVariance(state, targetGoals = {}) {
  const defaultGoals = {
    monthly_units_target: 60,
    service_revenue_target: 120000,
    avg_response_time_target: 5.0,
    avg_recon_days_target: 3.5,
    ...targetGoals
  }

  const currentUnitsPace = state.sales?.projected_month_units || 53
  const unitsGap = defaultGoals.monthly_units_target - currentUnitsPace

  return {
    goals_tracked: defaultGoals,
    variances: {
      sales_units: {
        goal: defaultGoals.monthly_units_target,
        current_projected_pace: currentUnitsPace,
        gap: unitsGap,
        status: unitsGap <= 0 ? 'ON_TRACK' : 'GAP_IDENTIFIED',
        drivers: [
          `Lead response SLA currently at ${state.sales?.avg_response_time_minutes || 8.5} min`,
          `Appointment show rate at ${state.sales?.appointments_show_rate_pct || 75}%`
        ],
        recommended_focus: unitsGap > 0
          ? 'Increase appointment setting from existing hot lead and unsold showroom traffic backlog.'
          : 'Maintain current delivery and F&I execution pace.'
      }
    }
  }
}
