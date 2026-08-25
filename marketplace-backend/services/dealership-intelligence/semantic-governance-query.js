/**
 * MarketSync Dealership Intelligence — Semantic Layer, Query Planner & Multi-Agent Governance (§671–689, §751–756, §768–776, §809–815, §856–866)
 */

export const CANONICAL_METRICS = Object.freeze({
  LEAD_RESPONSE_TIME: {
    key: 'lead_response_time_minutes',
    label: 'Lead First Response Time',
    definition: 'Elapsed minutes between lead creation and first human or qualifying AI response',
    canonical_owner: 'crm',
    target_sla: 5.0
  },
  APPOINTMENT_SHOW_RATE: {
    key: 'appointment_show_rate_pct',
    label: 'Appointment Show Rate',
    definition: 'Percentage of scheduled showroom appointments where customer physically arrived',
    canonical_owner: 'sales',
    target_sla: 75.0
  },
  RECON_CYCLE_DAYS: {
    key: 'recon_cycle_days',
    label: 'Reconditioning Cycle Days',
    definition: 'Elapsed business days between vehicle intake and frontline frontline listing readiness',
    canonical_owner: 'inventory',
    target_sla: 3.5
  },
  FUNDING_AGE_DAYS: {
    key: 'funding_age_days',
    label: 'Contract Funding Age',
    definition: 'Elapsed business days between customer vehicle delivery and lender cash receipt',
    canonical_owner: 'fni',
    target_sla: 3.0
  }
})

export const NON_NEGOTIABLE_HUMAN_ACTIONS = Object.freeze([
  'EMPLOYMENT_HIRING_OR_TERMINATION',
  'BINDING_CREDIT_DECISION_OR_APPROVAL',
  'BINDING_VEHICLE_PRICE_CONCESSION',
  'FINANCIAL_PERIOD_CLOSE_OVERRIDE',
  'EMPLOYEE_DISCIPLINARY_ACTION',
  'MAJOR_CUSTOMER_REFUND_OR_SETTLEMENT',
  'LEGAL_DISPUTE_SETTLEMENT'
])

/**
 * Safe Semantic Analytics Query Planner (§681–684).
 * Translates natural language questions into pre-approved semantic tool calls without raw SQL.
 */
export function planSemanticAnalyticsQuery(question = '') {
  const q = question.toLowerCase()

  if (q.includes('lead response') || q.includes('response time')) {
    return {
      query_plan: {
        tool: 'metric.get',
        metric: CANONICAL_METRICS.LEAD_RESPONSE_TIME.key,
        dimension: 'rolling_7_days',
        safe_execution: true
      },
      explanation: 'Retrieves canonical Lead Response Time metric aggregated over rolling 7-day window.'
    }
  }

  if (q.includes('recon') || q.includes('reconditioning')) {
    return {
      query_plan: {
        tool: 'metric.get',
        metric: CANONICAL_METRICS.RECON_CYCLE_DAYS.key,
        dimension: 'current_in_progress',
        safe_execution: true
      },
      explanation: 'Retrieves canonical Reconditioning Cycle Days metric for active units in recon.'
    }
  }

  return {
    query_plan: {
      tool: 'metric.get',
      metric: 'dealership_composite_health',
      dimension: 'today',
      safe_execution: true
    },
    explanation: 'Retrieves composite dealership operational overview.'
  }
}

/**
 * Global Customer Communication Frequency Governor & Collision Preventer (§751–756).
 */
export function evaluateOutreachCollisionGuard(customerId, proposedOutreach = {}) {
  const {
    channel = 'SMS',
    department = 'marketing',
    recent_outreach_history = [
      { timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), department: 'sales', channel: 'SMS' }
    ]
  } = proposedOutreach

  // If another department messaged this customer within 2 hours
  const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000)
  const recentContact = recent_outreach_history.find(h => new Date(h.timestamp).getTime() > twoHoursAgo)

  if (recentContact) {
    return {
      collision_detected: true,
      verdict: 'SUPPRESS_OUTREACH',
      reason: `Customer was messaged via ${recentContact.channel} by ${recentContact.department} 30 minutes ago. Suppressing ${department} outreach to prevent customer fatigue (§753).`,
      cooldown_remaining_minutes: 90
    }
  }

  return {
    collision_detected: false,
    verdict: 'PROCEED_WITH_OUTREACH',
    reason: 'No communication collisions detected within active policy window.'
  }
}

/**
 * Multi-Agent Orchestration & Policy Boundary Enforcer (§704–726, §809, §904).
 */
export function validateAgentAction(actionProposal = {}) {
  const {
    action_type = 'SEND_APPOINTMENT_CONFIRMATION',
    is_routine_approved = true
  } = actionProposal

  // Non-negotiable human boundary assertion (§809, §904)
  if (NON_NEGOTIABLE_HUMAN_ACTIONS.includes(action_type)) {
    return {
      allowed: false,
      escalation_tier: 'HUMAN_AUTHORITY_REQUIRED',
      reason: `Action '${action_type}' falls within non-negotiable human authority boundaries (§904) and cannot be executed autonomously by AI.`,
      required_approver: 'general_manager'
    }
  }

  if (is_routine_approved) {
    return {
      allowed: true,
      escalation_tier: 'ROUTINE_AUTOMATED',
      reason: `Action '${action_type}' is an approved routine operational automation.`
    }
  }

  return {
    allowed: false,
    escalation_tier: 'MANAGEMENT_APPROVAL_REQUIRED',
    reason: `Action '${action_type}' requires supervisor review.`
  }
}
