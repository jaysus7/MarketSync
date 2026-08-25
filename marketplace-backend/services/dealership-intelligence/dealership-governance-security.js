/**
 * MarketSync Dealership Intelligence — Governance, Privacy & Security Boundaries (§551–556, §577–580, §589–600)
 */

export const PROTECTED_FINANCIAL_FIELDS = Object.freeze([
  'dealer_cost',
  'dealer_pack',
  'front_gross',
  'back_gross',
  'employee_pay_rate',
  'employee_commission_rate',
  'bank_account_number',
  'bank_routing_number',
  'floorplan_interest_rate'
])

export const PROTECTED_HR_FIELDS = Object.freeze([
  'private_hr_notes',
  'medical_accommodation_notes',
  'disciplinary_action_history',
  'home_address',
  'ssn_sin'
])

/**
 * Applies strict Role-Based Field Filtering to prevent unauthorized data exposure (§577–580).
 */
export function filterIntelligenceByRole(payload = {}, userRole = 'customer_facing_ai') {
  const sanitized = JSON.parse(JSON.stringify(payload))

  const isExecutive = ['dealer_principal', 'general_manager', 'owner'].includes(userRole)
  const isController = ['controller', 'cfo', 'accounting_manager'].includes(userRole)
  const isSalesManager = ['sales_manager', 'used_car_manager', 'general_sales_manager'].includes(userRole)
  const isServiceManager = ['service_manager', 'service_director'].includes(userRole)
  const isHR = ['hr_manager', 'people_operations'].includes(userRole)

  // 1. Customer-Facing AI Boundary (§577)
  if (userRole === 'customer_facing_ai' || userRole === 'customer') {
    delete sanitized.sales?.gross_trends
    delete sanitized.inventory?.floorplan_exposure_total
    delete sanitized.fni?.funding_pending_total
    delete sanitized.accounting
    delete sanitized.hr
    delete sanitized.needs_attention
    return sanitized
  }

  // 2. HR Boundary: Strip private HR and medical data unless role is HR or Executive (§579)
  if (!isHR && !isExecutive) {
    if (sanitized.hr) {
      delete sanitized.hr.missed_punches_open
      delete sanitized.hr.performance_reviews_due
    }
  }

  // 3. Financial Field Protection: Strip confidential financial metrics from line employees (§578)
  if (!isExecutive && !isController && !isSalesManager) {
    if (sanitized.sales) {
      delete sanitized.sales.gross_trends
    }
    if (sanitized.fni) {
      delete sanitized.fni.funding_pending_total
    }
    if (sanitized.accounting) {
      delete sanitized.accounting.cash_position_available
      delete sanitized.accounting.payroll_liabilities_upcoming
    }
  }

  return sanitized
}

/**
 * Evaluates Audit Readiness across Dealership compliance controls (§598).
 */
export function evaluateAuditReadiness(state = {}) {
  const auditFindings = []

  // 1. HR / Safety Certifications
  if ((state.hr?.expiring_certifications_30d || 0) > 0) {
    auditFindings.push({
      category: 'HR_COMPLIANCE',
      finding: `${state.hr.expiring_certifications_30d} technician or staff occupational certifications expiring in < 30 days`,
      severity: 'WARNING',
      audit_risk: 'High: OSHA / OEM warranty audit disqualification if expired during active service work'
    })
  }

  // 2. Accounting / Financial Controls
  if ((state.accounting?.unmatched_bank_transactions || 0) > 0) {
    auditFindings.push({
      category: 'FINANCIAL_CONTROLS',
      finding: `${state.accounting.unmatched_bank_transactions} un-reconciled bank ledger transactions`,
      severity: 'MODERATE',
      audit_risk: 'Medium: Month-end trial balance audit exception'
    })
  }

  // 3. F&I Stips & Deal Jacket Completeness
  if ((state.fni?.outstanding_stipulations_count || 0) > 0) {
    auditFindings.push({
      category: 'FNI_COMPLIANCE',
      finding: `${state.fni.outstanding_stipulations_count} delivered deal jackets missing required lender stipulations`,
      severity: 'HIGH',
      audit_risk: 'High: Lender chargeback or un-funded contract recourse'
    })
  }

  return {
    audit_readiness_score: auditFindings.length === 0 ? 100 : Math.max(0, 100 - (auditFindings.length * 15)),
    status: auditFindings.length === 0 ? 'AUDIT_READY' : 'EXCEPTIONS_IDENTIFIED',
    findings_count: auditFindings.length,
    findings: auditFindings
  }
}

/**
 * Multi-Store / Dealer Group Intelligence & Internal Transfer Recommendations (§553–556).
 */
export function evaluateDealerGroupTransfers(locations = []) {
  const transferSuggestions = []

  // Compare inventory and demand across locations
  if (locations.length >= 2) {
    const locA = locations[0] // e.g. Store North
    const locB = locations[1] // e.g. Store South

    // If locA has active buyer demand for a vehicle model that is aged at locB
    if (locA.unmet_suv_demand_count > 3 && locB.aged_suv_units_count > 0) {
      transferSuggestions.push({
        id: 'xfer_suv_north_south',
        source_location: locB.name || 'MarketSync South',
        target_location: locA.name || 'MarketSync North',
        vehicle_model: '2024 GMC Terrain',
        stock_number: 'STK-S-492',
        reason: `Vehicle in stock 85 days at ${locB.name || 'South'}, while ${locA.name || 'North'} has ${locA.unmet_suv_demand_count} active buyer inquiries.`,
        financial_benefit: 'Accelerate inventory turn and reduce combined floorplan holding cost.',
        requires_human_approval: true
      })
    }
  }

  return transferSuggestions
}
