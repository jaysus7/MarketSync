/**
 * MarketSync Customer Intelligence — Objection Root-Cause & Dependency Graph Engine.
 *
 * Dissects surface-level customer objections into underlying root causes (e.g. trade payoff -> negative equity -> payment),
 * evaluates objection dependency graphs, and manages resolution tracking.
 */

export function analyzeObjectionRootCause(objectionType, customerState = {}) {
  const p = customerState.purchase_state || {}
  const t = customerState.trade_state || {}

  if (objectionType === 'payment_too_high') {
    const hasNegativeEquity = t.has_trade?.value && t.payoff?.value && (!t.estimated_value || t.payoff.value > t.estimated_value)
    const hasZeroDown = p.down_payment_preference?.value === '0' || !p.down_payment_preference?.value

    let rootCause = 'vehicle_price_baseline'
    const dependencies = ['vehicle_selling_price']

    if (hasNegativeEquity) {
      rootCause = 'trade_negative_equity_rollover'
      dependencies.push('trade_payoff', 'negative_equity_amount')
    } else if (hasZeroDown) {
      rootCause = 'zero_down_payment_stretch'
      dependencies.push('down_payment_contribution')
    }

    return {
      surface_objection: 'payment_too_high',
      root_cause: rootCause,
      dependency_chain: dependencies,
      recommended_clarification: hasNegativeEquity
        ? 'Isolate trade equity by checking official appraisal before adjusting vehicle trim'
        : 'Explore down payment comfort or recommend lower entry trim level',
    }
  }

  return {
    surface_objection: objectionType,
    root_cause: objectionType,
    dependency_chain: [objectionType],
    recommended_clarification: 'Address objection directly using approved playbook guidelines',
  }
}
