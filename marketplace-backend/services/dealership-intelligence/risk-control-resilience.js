/**
 * MarketSync Dealership Intelligence — Risk Register, Control Effectiveness & Resilience (§658–670, §833–846)
 */

export const RISK_CATEGORIES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  FINANCIAL: 'FINANCIAL',
  COMPLIANCE: 'COMPLIANCE',
  STAFFING: 'STAFFING',
  INVENTORY: 'INVENTORY',
  TECHNOLOGY: 'TECHNOLOGY',
  VENDOR: 'VENDOR',
  REPUTATION: 'REPUTATION'
})

/**
 * Compiles the Structured Operational Risk Register with Blast Radius (§658–661, §835).
 */
export function evaluateOperationalRiskRegister(state) {
  const risks = []

  // 1. Financial Risk: Overdue Lender Funding
  if ((state.fni?.funding_over_3_days_count || 0) > 0) {
    risks.push({
      id: 'risk_fin_funding_delay',
      category: RISK_CATEGORIES.FINANCIAL,
      title: 'Delayed Contract-in-Transit Lender Funding',
      probability: 'HIGH',
      financial_impact_dollars: state.fni.funding_pending_total || 92000,
      confidence: 'HIGH',
      trend: 'STABLE',
      owner: 'fni_director',
      mitigation_plan: 'Direct upload of missing proof-of-income stips to lender portals.',
      blast_radius: {
        affected_departments: ['fni', 'accounting', 'sales'],
        affected_deals_count: state.fni.funding_over_3_days_count,
        customer_facing_risk: 'LOW'
      }
    })
  }

  // 2. Customer / Service Risk: Capacity Deficit & Promise Times
  if ((state.service?.capacity_deficit_hours || 0) > 0) {
    risks.push({
      id: 'risk_svc_promise_breach',
      category: RISK_CATEGORIES.CUSTOMER,
      title: 'Service Shop Capacity Overload & Promise-Time Breach',
      probability: 'HIGH',
      financial_impact_dollars: 18400,
      confidence: 'HIGH',
      trend: 'WORSENING',
      owner: 'service_manager',
      mitigation_plan: 'Authorize 4-hour technician overtime shift and offer courtesy loaners.',
      blast_radius: {
        affected_departments: ['service', 'customer_experience'],
        affected_ros_count: state.service.ros_at_promise_time_risk || 3,
        customer_facing_risk: 'HIGH'
      }
    })
  }

  // 3. Inventory Holding Risk: Aged Floorplan Exposure
  if ((state.inventory?.units_over_90_days || 0) > 10) {
    risks.push({
      id: 'risk_inv_aged_floorplan',
      category: RISK_CATEGORIES.INVENTORY,
      title: 'Excessive Floorplan Interest on Aged Units (>90 Days)',
      probability: 'MEDIUM',
      financial_impact_dollars: (state.inventory.units_over_90_days || 14) * 450,
      confidence: 'HIGH',
      trend: 'IMPROVING',
      owner: 'used_car_manager',
      mitigation_plan: 'Targeted pricing review and active customer demand matching.',
      blast_radius: {
        affected_departments: ['inventory', 'sales', 'accounting'],
        affected_units_count: state.inventory.units_over_90_days,
        customer_facing_risk: 'LOW'
      }
    })
  }

  return {
    total_active_risks: risks.length,
    risks,
    highest_severity_category: RISK_CATEGORIES.FINANCIAL
  }
}

/**
 * Financial Control Intelligence & Neutral Anomaly Signals (§662–666).
 * Strictly maintains non-accusatory, neutral language.
 */
export function evaluateControlExceptions(exceptions = []) {
  return exceptions.map(exc => {
    return {
      exception_id: exc.id || `exc_${Date.now()}`,
      control_area: exc.control_area || 'ACCOUNTS_RECEIVABLE',
      pattern_detected: exc.pattern || 'Duplicate receipt transaction recorded on Deal #D-802',
      neutral_review_statement: `Unusual pattern detected in ${exc.control_area || 'transaction processing'} and should be reviewed by an authorized controller.`,
      recommended_reviewer_role: 'controller',
      requires_escalation: true
    }
  })
}

/**
 * Translates Technical Degradation into Direct Business Impact (§668–670).
 */
export function translateTechnicalIncident(incident = {}) {
  const {
    service_name = 'Inventory Syndication Feed',
    duration_hours = 3.5,
    technical_error = 'FTP Timeout from third-party DMS portal'
  } = incident

  return {
    incident_name: service_name,
    duration_hours,
    technical_root_cause: technical_error,
    business_impact_translation: {
      affected_workflows: ['Frontline Web Merchandising', 'Third-Party Portal Syndication'],
      pending_records_count: 27,
      impact_summary: `Inventory feed delayed ${duration_hours} hours: 27 vehicle price and status updates pending. Web inventory availability may be temporarily stale.`,
      customer_risk_tier: 'MODERATE',
      mitigation_action: 'Trigger manual fallback inventory sync and notify sales desk of pending pricing changes.'
    }
  }
}
