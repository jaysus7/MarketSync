/**
 * MarketSync Dealership Intelligence — Unified Attention Engine & Event Stream (§452, §453, §454, §584–586)
 */

export const ATTENTION_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
})

export const ROUTING_CHANNELS = Object.freeze({
  INTERRUPT: 'INTERRUPT',       // CRITICAL: immediate popup / SMS / push
  MY_DAY: 'MY_DAY',             // HIGH: surfaced prominently in role's My Day
  DIGEST: 'DIGEST',             // MEDIUM: summarized in morning/evening briefs
  REPORTING: 'REPORTING'        // LOW: background analytics table
})

/**
 * Calculates a reasoned multi-dimensional priority score (§454).
 * Returns { score: number, tier: ATTENTION_SEVERITY, dimensions: object }
 */
export function calculatePriorityScore(factors = {}) {
  const {
    customer_impact = 0.5,       // 0 to 1.0
    revenue_impact = 0.5,        // 0 to 1.0
    financial_risk = 0.5,        // 0 to 1.0
    compliance_risk = 0.1,       // 0 to 1.0
    time_sensitivity = 0.5,      // 0 to 1.0
    department_blockage = 0.5,   // 0 to 1.0
    confidence = 0.95            // 0 to 1.0
  } = factors

  // Weighted calculation (0 to 100)
  const rawScore = (
    customer_impact * 20 +
    revenue_impact * 20 +
    financial_risk * 20 +
    compliance_risk * 15 +
    time_sensitivity * 15 +
    department_blockage * 10
  ) * confidence

  let tier = ATTENTION_SEVERITY.LOW
  let routing = ROUTING_CHANNELS.REPORTING

  if (rawScore >= 75 || compliance_risk >= 0.9 || (financial_risk >= 0.8 && time_sensitivity >= 0.8)) {
    tier = ATTENTION_SEVERITY.CRITICAL
    routing = ROUTING_CHANNELS.INTERRUPT
  } else if (rawScore >= 50 || time_sensitivity >= 0.75) {
    tier = ATTENTION_SEVERITY.HIGH
    routing = ROUTING_CHANNELS.MY_DAY
  } else if (rawScore >= 25) {
    tier = ATTENTION_SEVERITY.MEDIUM
    routing = ROUTING_CHANNELS.DIGEST
  }

  return {
    score: Math.round(rawScore),
    tier,
    routing,
    dimensions: {
      customer_impact,
      revenue_impact,
      financial_risk,
      compliance_risk,
      time_sensitivity,
      department_blockage,
      confidence
    }
  }
}

/**
 * Evaluates the full dealership state and extracts prioritized attention items (§453).
 */
export function evaluateDealershipAttention(state) {
  const items = []

  // 1. Hot leads waiting too long (Sales)
  if (state.sales?.hot_leads_count > 0 && state.sales?.avg_response_time_minutes > 5) {
    const priority = calculatePriorityScore({
      customer_impact: 0.9,
      revenue_impact: 0.85,
      time_sensitivity: 0.95,
      confidence: 1.0
    })
    items.push({
      id: 'att_sales_hot_leads',
      title: `${state.sales.hot_leads_count} hot leads waiting over SLA`,
      department: 'sales',
      severity: priority.tier,
      routing: priority.routing,
      priority_score: priority.score,
      entity_type: 'lead',
      financial_impact_estimate: state.sales.hot_leads_count * 1800,
      owner_role: 'sales_manager',
      recommended_action: 'Assign hot leads immediately to on-duty sales specialists.',
      status: 'OPEN'
    })
  }

  // 2. Delivered Deals Unfunded > 3 days (F&I / Accounting)
  if (state.fni?.funding_over_3_days_count > 0) {
    const priority = calculatePriorityScore({
      financial_risk: 0.85,
      revenue_impact: 0.75,
      time_sensitivity: 0.8,
      confidence: 1.0
    })
    items.push({
      id: 'att_fni_unfunded_deals',
      title: `${state.fni.funding_over_3_days_count} delivered deals remain unfunded > 3 days`,
      department: 'fni',
      severity: priority.tier,
      routing: priority.routing,
      priority_score: priority.score,
      entity_type: 'deal',
      financial_impact_estimate: state.fni.funding_pending_total || 92000,
      owner_role: 'fni_manager',
      recommended_action: 'Review lender stipulations and submit missing funding documentation.',
      status: 'OPEN'
    })
  }

  // 3. Service ROs at Promise-Time Risk (Service)
  if (state.service?.ros_at_promise_time_risk > 0) {
    const priority = calculatePriorityScore({
      customer_impact: 0.9,
      department_blockage: 0.85,
      time_sensitivity: 0.9,
      confidence: 0.9
    })
    items.push({
      id: 'att_service_promise_risk',
      title: `${state.service.ros_at_promise_time_risk} ROs at risk of missing customer promise time`,
      department: 'service',
      severity: priority.tier,
      routing: priority.routing,
      priority_score: priority.score,
      entity_type: 'repair_order',
      financial_impact_estimate: state.service.ros_at_promise_time_risk * 450,
      owner_role: 'service_manager',
      recommended_action: 'Expedite technician dispatch or notify customers proactively.',
      status: 'OPEN'
    })
  }

  // 4. ROs Blocked by Parts (Cross-Department)
  if (state.service?.ros_blocked_by_parts > 0) {
    const priority = calculatePriorityScore({
      customer_impact: 0.8,
      department_blockage: 0.9,
      time_sensitivity: 0.75,
      confidence: 1.0
    })
    items.push({
      id: 'att_service_parts_blockers',
      title: `${state.service.ros_blocked_by_parts} ROs blocked waiting on parts`,
      department: 'parts',
      severity: priority.tier,
      routing: priority.routing,
      priority_score: priority.score,
      entity_type: 'part',
      financial_impact_estimate: state.service.ros_blocked_by_parts * 650,
      owner_role: 'parts_manager',
      recommended_action: 'Check parts receiving and coordinate rush delivery or dealer transfer.',
      status: 'OPEN'
    })
  }

  // 5. Aged Inventory with Above-Market Pricing (Inventory)
  if (state.inventory?.units_over_90_days > 10) {
    const priority = calculatePriorityScore({
      financial_risk: 0.7,
      revenue_impact: 0.65,
      time_sensitivity: 0.5,
      confidence: 0.95
    })
    items.push({
      id: 'att_inv_aged_units',
      title: `${state.inventory.units_over_90_days} inventory units aged over 90 days`,
      department: 'inventory',
      severity: priority.tier,
      routing: priority.routing,
      priority_score: priority.score,
      entity_type: 'vehicle',
      financial_impact_estimate: state.inventory.units_over_90_days * 1200,
      owner_role: 'used_car_manager',
      recommended_action: 'Conduct price alignment review and inspect merchandising media.',
      status: 'OPEN'
    })
  }

  // 6. Expiring Certifications or Training (HR)
  if (state.hr?.expiring_certifications_30d > 0) {
    const priority = calculatePriorityScore({
      compliance_risk: 0.85,
      time_sensitivity: 0.6,
      confidence: 1.0
    })
    items.push({
      id: 'att_hr_expiring_certs',
      title: `${state.hr.expiring_certifications_30d} technician/staff certifications expiring within 30 days`,
      department: 'hr',
      severity: priority.tier,
      routing: priority.routing,
      priority_score: priority.score,
      entity_type: 'employee',
      owner_role: 'hr_manager',
      recommended_action: 'Assign required Academy renewal courses.',
      status: 'OPEN'
    })
  }

  // Sort descending by priority score
  return items.sort((a, b) => b.priority_score - a.priority_score)
}

/**
 * Event-Driven State Mutation Handler (§452).
 */
export function processDealershipEvent(currentState, event) {
  const state = JSON.parse(JSON.stringify(currentState))
  const { type, payload = {} } = event

  switch (type) {
    case 'lead.created':
      state.sales.active_opportunities_count = (state.sales.active_opportunities_count || 0) + 1
      if (payload.is_hot) {
        state.sales.hot_leads_count = (state.sales.hot_leads_count || 0) + 1
      }
      break

    case 'lead.responded':
      if (payload.was_hot && state.sales.hot_leads_count > 0) {
        state.sales.hot_leads_count -= 1
      }
      break

    case 'deal.closed':
      state.sales.month_to_date_units_sold = (state.sales.month_to_date_units_sold || 0) + 1
      state.sales.deliveries_today_count = (state.sales.deliveries_today_count || 0) + 1
      break

    case 'funding.received':
      if (state.fni.funding_over_3_days_count > 0) {
        state.fni.funding_over_3_days_count -= 1
      }
      if (payload.amount && state.fni.funding_pending_total) {
        state.fni.funding_pending_total = Math.max(0, state.fni.funding_pending_total - payload.amount)
      }
      break

    case 'ro.opened':
      state.service.open_ros_count = (state.service.open_ros_count || 0) + 1
      break

    case 'ro.closed':
      if (state.service.open_ros_count > 0) {
        state.service.open_ros_count -= 1
      }
      break

    default:
      break
  }

  state.last_updated_at = new Date().toISOString()
  return state
}
