/**
 * MarketSync Customer Intelligence — Action Utility Engine & Decision Tracing.
 *
 * Implements multi-dimensional utility scoring (customer_value, business_value, friction, trust, confidence, urgency)
 * to rank candidate actions and generates compact, non-CoT decision traces.
 */

export function scoreActionUtility(candidateAction, context = {}) {
  const cVal = candidateAction.customer_value || 0.8
  const bVal = candidateAction.business_value || 0.7
  const friction = candidateAction.friction_penalty || 0.1
  const trust = candidateAction.trust_score || 1.0
  const confidence = candidateAction.confidence || 0.85
  const urgency = candidateAction.urgency_weight || 0.5

  // Total utility formula
  const score = ((cVal * 0.35) + (bVal * 0.25) + (trust * 0.20) + (confidence * 0.10) + (urgency * 0.10)) - (friction * 0.30)

  return Math.max(0, Math.min(1.0, score))
}

/**
 * Ranks candidate actions and selects the highest-utility action with an operational decision trace.
 */
export function rankCandidateActions(candidateActions = [], context = {}) {
  if (!candidateActions.length) {
    return {
      selected_action: null,
      decision_trace: { decision: 'none', reason: 'No candidate actions supplied' },
    }
  }

  const scored = candidateActions.map(action => ({
    ...action,
    utility_score: scoreActionUtility(action, context),
  }))

  scored.sort((a, b) => b.utility_score - a.utility_score)
  const topAction = scored[0]

  // Counterfactual verification
  const counterfactualRisk = topAction.counterfactual_check ? topAction.counterfactual_check(context) : null

  return {
    selected_action: topAction,
    ranked_candidates: scored,
    counterfactual_risk: counterfactualRisk,
    decision_trace: {
      decision: topAction.action_type || topAction.name,
      utility_score: Math.round(topAction.utility_score * 100) / 100,
      reason: topAction.operational_reason || 'Highest balanced utility for customer and dealership',
      evidence: topAction.evidence || null,
      timestamp: new Date().toISOString(),
    },
  }
}
