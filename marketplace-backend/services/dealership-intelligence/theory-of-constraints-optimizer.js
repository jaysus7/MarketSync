/**
 * MarketSync Dealership Intelligence — Theory of Constraints & Multi-Objective Optimizer (§609–620, §795–798, §821–832)
 */

export const WAITING_STATES = Object.freeze({
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  WAITING_EMPLOYEE: 'WAITING_EMPLOYEE',
  WAITING_VENDOR: 'WAITING_VENDOR',
  WAITING_LENDER: 'WAITING_LENDER',
  WAITING_PART: 'WAITING_PART',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  WAITING_SYSTEM: 'WAITING_SYSTEM'
})

/**
 * Theory of Constraints Identification & Next Constraint Shift Engine (§613, §614).
 */
export function identifySystemConstraint(state) {
  // 1. Evaluate Sales Constraint
  const isSalesResponseConstrained = (state.sales?.avg_response_time_minutes || 0) > 8.0
  // 2. Evaluate Service Constraint
  const isServiceCapacityConstrained = (state.service?.capacity_deficit_hours || 0) > 8

  if (isSalesResponseConstrained) {
    return {
      current_constraint: 'SALES_LEAD_RESPONSE_CAPACITY',
      constraint_description: 'Sales lead response latency during peak inquiry hours is the active throughput limiter.',
      workload_hitting_constraint: `${state.sales.active_opportunities_count || 48} active opportunities with ${state.sales.hot_leads_count || 4} hot leads waiting`,
      downstream_effect: 'Suppressed appointment-set rate and reduced showroom show volume.',
      relief_options: [
        { id: 'opt_adjust_coverage', label: 'Adjust late-day shift coverage (4–7 PM)', risk: 'LOW', speed: 'FAST' },
        { id: 'opt_overflow_routing', label: 'Enable automatic overflow routing to secondary specialists', risk: 'LOW', speed: 'IMMEDIATE' },
        { id: 'opt_ai_handoff', label: 'Enable AI-assisted conversational qualification', risk: 'LOW', speed: 'IMMEDIATE' }
      ],
      expected_next_constraint: 'SHOWROOM_APPOINTMENT_CAPACITY'
    }
  }

  if (isServiceCapacityConstrained) {
    return {
      current_constraint: 'SERVICE_TECHNICIAN_CAPACITY',
      constraint_description: 'Booked labor hours exceed available certified technician capacity.',
      workload_hitting_constraint: `${state.service.booked_tech_hours_today} booked hours vs ${state.service.available_tech_hours_today} available hours (${state.service.capacity_deficit_hours}h deficit)`,
      downstream_effect: 'Promise-time risk on customer ROs and bay congestion.',
      relief_options: [
        { id: 'opt_reschedule_maintenance', label: 'Reschedule 4 non-critical maintenance appointments', risk: 'LOW', speed: 'FAST' },
        { id: 'opt_tech_overtime', label: 'Authorize technician overtime (+8 hours)', risk: 'MEDIUM', speed: 'IMMEDIATE' }
      ],
      expected_next_constraint: 'PARTS_AVAILABILITY'
    }
  }

  return {
    current_constraint: 'INVENTORY_RECON_CYCLE',
    constraint_description: 'Reconditioning speed is currently the primary constraint on frontline vehicle availability.',
    workload_hitting_constraint: `${state.inventory?.units_in_recon || 6} units averaging ${state.inventory?.avg_recon_days || 5.2} recon days`,
    downstream_effect: 'Delayed frontline syndication and extended holding costs.',
    relief_options: [
      { id: 'opt_detail_overflow', label: 'Engage secondary detail vendor', risk: 'LOW', speed: 'FAST' }
    ],
    expected_next_constraint: 'USED_VEHICLE_PRICING_ALIGNMENT'
  }
}

/**
 * Multi-Objective Decision Matrix Evaluator (§615–619).
 * Evaluates candidate options across multiple balanced dimensions.
 */
export function evaluateDecisionMatrix(issue = 'SERVICE_CAPACITY_DEFICIT', options = []) {
  const defaultOptions = [
    {
      id: 'option_a',
      title: 'Reschedule 4 non-urgent maintenance appointments',
      impact: 80,          // 0 to 100
      cost: 10,            // low cost
      risk: 20,            // low operational risk
      speed: 90,           // fast execution
      customer_effect: 70, // minor reschedule notification
      confidence: 95,
      reversibility: 'HIGHLY_REVERSIBLE',
      tradeoff_note: 'Lowest operational risk and avoids labor overtime, but slightly defers customer visit.'
    },
    {
      id: 'option_b',
      title: 'Authorize 2 technicians for 4 hours overtime',
      impact: 90,
      cost: 65,            // higher labor cost
      risk: 40,
      speed: 85,
      customer_effect: 95, // seamless customer delivery on time
      confidence: 90,
      reversibility: 'PARTIALLY_REVERSIBLE',
      tradeoff_note: 'Protects customer promise times 100%, but incurs ~$640 in additional overtime labor expense.'
    }
  ]

  const evaluated = (options.length ? options : defaultOptions).map(opt => {
    // Composite multi-objective score
    const compositeScore = Math.round(
      (opt.impact * 0.3) +
      ((100 - opt.cost) * 0.2) +
      ((100 - opt.risk) * 0.2) +
      (opt.speed * 0.15) +
      (opt.customer_effect * 0.15)
    )

    return {
      ...opt,
      composite_score: compositeScore,
      recommendation_tier: compositeScore >= 75 ? 'RECOMMENDED' : 'ACCEPTABLE_ALTERNATIVE'
    }
  }).sort((a, b) => b.composite_score - a.composite_score)

  return {
    issue,
    primary_tradeoff_summary: 'Balancing labor expense vs customer promise-time reliability.',
    evaluated_options: evaluated,
    recommended_option_id: evaluated[0].id
  }
}

/**
 * Waiting-On Model & Flow Efficiency Analytics (§821–826).
 */
export function analyzeWorkflowFlowEfficiency(activeWorkHours = 5.2, totalWaitHours = 18.6, waitingBreakdown = {}) {
  const totalCycleHours = activeWorkHours + totalWaitHours
  const flowEfficiencyPct = totalCycleHours > 0
    ? +((activeWorkHours / totalCycleHours) * 100).toFixed(1)
    : 100

  const defaultWaits = {
    [WAITING_STATES.WAITING_PART]: 12.4,
    [WAITING_STATES.WAITING_CUSTOMER]: 4.2,
    [WAITING_STATES.WAITING_APPROVAL]: 2.0,
    ...waitingBreakdown
  }

  return {
    active_work_hours: activeWorkHours,
    total_waiting_hours: totalWaitHours,
    total_lead_time_hours: +totalCycleHours.toFixed(1),
    flow_efficiency_pct: flowEfficiencyPct,
    efficiency_verdict: flowEfficiencyPct >= 40 ? 'HIGH_FLOW' : flowEfficiencyPct >= 20 ? 'MODERATE_FLOW' : 'EXCESSIVE_WAITING',
    primary_wait_bottleneck: Object.entries(defaultWaits).sort((a, b) => b[1] - a[1])[0][0],
    waiting_time_breakdown: defaultWaits,
    insight: `Work is active ${activeWorkHours}h and waiting ${totalWaitHours}h (${flowEfficiencyPct}% flow efficiency). Primary wait is ${Object.entries(defaultWaits).sort((a, b) => b[1] - a[1])[0][0]}.`
  }
}
