/**
 * MarketSync Dealership Intelligence — Cross-Department Dependencies & Bottlenecks (§467–478, §548)
 */

/**
 * Traces downstream impact propagation from upstream departmental blockers (§467, §468).
 */
export function traceBlockerPropagation(blocker = {}) {
  const {
    source_department = 'parts',
    blocker_type = 'PART_BACKORDERED',
    entity_id = 'PART-10492',
    details = {}
  } = blocker

  const propagationChains = {
    PART_BACKORDERED: [
      { step: 1, department: 'parts', impact: `Part ${entity_id} on factory backorder (ETA: 2 business days)` },
      { step: 2, department: 'service', impact: `Repair Order #${details.ro_number || '1842'} stalled in bay 4` },
      { step: 3, department: 'service', impact: `Customer promise time (today at 2:00 PM) cannot be met` },
      { step: 4, department: 'accounting', impact: `$${details.ro_value || '1,420'} service revenue delayed until delivery` },
      { step: 5, department: 'customer_experience', impact: `Risk of customer dissatisfaction without proactive loaner/notification` }
    ],
    FNI_STIP_MISSING: [
      { step: 1, department: 'fni', impact: `Lender stipulation (Proof of Income) pending on Deal #${details.deal_number || 'D-802'}` },
      { step: 2, department: 'sales', impact: `Customer delivery held pending lender funding confirmation` },
      { step: 3, department: 'accounting', impact: `$${details.funding_amount || '34,500'} contract in transit remains unallocated` }
    ],
    RECON_BOTTLENECK: [
      { step: 1, department: 'inventory', impact: `Vehicle detail/recon cycle currently averaging 5.2 days` },
      { step: 2, department: 'marketing', impact: `Frontline syndication and photos delayed for 6 incoming units` },
      { step: 3, department: 'sales', impact: `Unrepresented units unavailable for immediate customer test drives` }
    ]
  }

  const chain = propagationChains[blocker_type] || [
    { step: 1, department: source_department, impact: `Operational blocker identified on ${entity_id}` }
  ]

  return {
    blocker_id: `blk_${Date.now()}`,
    source_department,
    blocker_type,
    propagation_depth: chain.length,
    downstream_impact_chain: chain,
    highest_severity_risk: chain[chain.length - 1].impact,
    recommended_mitigation: blocker_type === 'PART_BACKORDERED'
      ? 'Offer complimentary loaner vehicle and submit emergency dealer locator transfer request.'
      : 'Contact customer for electronic document submission via secure portal.'
  }
}

/**
 * Detects recurring bottlenecks and quantifies financial impact (§469, §470).
 */
export function detectDealershipBottlenecks(state) {
  const bottlenecks = []

  // 1. Recon Delay Bottleneck
  if ((state.inventory?.avg_recon_days || 0) > 4.0) {
    const affectedUnits = state.inventory?.units_in_recon || 6
    const avgCarValue = 32000
    const tiedUpCapital = affectedUnits * avgCarValue
    bottlenecks.push({
      id: 'btnk_recon_cycle',
      area: 'Reconditioning & Detail',
      metric_label: 'Average Recon Days',
      current_value: `${state.inventory.avg_recon_days} days`,
      target_baseline: '3.5 days',
      variance_days: +(state.inventory.avg_recon_days - 3.5).toFixed(1),
      affected_entities_count: affectedUnits,
      quantified_impact: `$${tiedUpCapital.toLocaleString()} in frontline inventory tied up off the lot`,
      recommended_action: 'Allocate secondary detail vendor or streamline mechanical inspection queue.'
    })
  }

  // 2. Service Authorization Lag
  if ((state.service?.pending_customer_approvals_count || 0) >= 4) {
    bottlenecks.push({
      id: 'btnk_service_approvals',
      area: 'Service Estimates & Customer Authorizations',
      metric_label: 'Pending Customer Authorizations',
      current_value: `${state.service.pending_customer_approvals_count} estimates pending`,
      target_baseline: '< 3 estimates',
      affected_entities_count: state.service.pending_customer_approvals_count,
      quantified_impact: `$${(state.service.pending_approvals_total_dollars || 18400).toLocaleString()} in authorized work awaiting sign-off`,
      recommended_action: 'Send interactive mobile authorization cards with technician video inspection.'
    })
  }

  return bottlenecks
}

/**
 * Process Mining & Step Duration Deviation Detection (§471, §472).
 */
export function analyzeProcessStepDurations(stepEvents = []) {
  // Analyzes timestamps between workflow transitions
  return stepEvents.map(event => {
    const elapsedMinutes = event.duration_minutes || 0
    const benchmarkMinutes = event.benchmark_minutes || 30
    const isDeviation = elapsedMinutes > (benchmarkMinutes * 1.5)

    return {
      process_name: event.process_name || 'Vehicle Inspection',
      entity_id: event.entity_id || 'RO-1842',
      elapsed_minutes: elapsedMinutes,
      benchmark_minutes: benchmarkMinutes,
      status: isDeviation ? 'DEVIATION_DETECTED' : 'NORMAL',
      explanation: isDeviation
        ? `Step took ${elapsedMinutes}m vs normal ${benchmarkMinutes}m baseline (${Math.round((elapsedMinutes / benchmarkMinutes) * 100 - 100)}% slower)`
        : 'Step completed within expected operational threshold.'
    }
  })
}

/**
 * Structured Root-Cause & Anomaly Explainer with Causal Caution (§475, §476, §478).
 */
export function explainDealershipAnomaly(anomaly = {}) {
  const {
    metric = 'Service Revenue',
    direction = 'DOWN',
    magnitude_pct = 18,
    observed_correlations = [
      '3 open ROs blocked by backordered parts',
      '1 senior technician absent today',
      'Showroom check-in volume was on schedule'
    ]
  } = anomaly

  return {
    anomaly_title: `${metric} is ${direction} by ${magnitude_pct}% compared to rolling 30-day baseline`,
    confidence: 'HIGH',
    causal_explanation: `${metric} decline appears associated with ${observed_correlations.slice(0, 2).join(' and ')}.`,
    evidence_factors: observed_correlations,
    cautionary_note: 'Correlation observed across operational events; avoid attributing sole causality to a single department without physical dispatch review.',
    investigation_steps: [
      'Review parts department inbound freight tracking.',
      'Check technician dispatch redistribution for remaining afternoon workload.'
    ]
  }
}

/**
 * Cross-Department Synergy Engine (§548).
 * Connects Sales demand, Inventory shortages, Marketing campaigns, and Acquisition sourcing.
 */
export function identifyCrossDepartmentSynergies(state, demandData = {}) {
  const synergies = []

  // High customer search demand for category with low stock
  if ((demandData.active_suv_requests || 7) > 5 && (state.inventory?.used_units_count || 0) >= 0) {
    synergies.push({
      id: 'syn_suv_acquisition_campaign',
      title: 'High SUV Customer Demand + Low Active Inventory + Marketing Source Synergy',
      connected_departments: ['sales', 'inventory', 'marketing', 'acquisition'],
      insight: `${demandData.active_suv_requests || 7} active customers requested AWD compact SUVs under $40k, but only 2 matching units in stock.`,
      actionable_plan: [
        'Marketing: Target ad campaigns for vehicle trade-ins and equity mining on compact SUVs.',
        'Acquisition: Prioritize 2021-2024 AWD SUVs at wholesale auctions and trade appraisal desks.',
        'Sales: Log prospective buyers onto automated Inventory Watch alerts.'
      ]
    })
  }

  return synergies
}
