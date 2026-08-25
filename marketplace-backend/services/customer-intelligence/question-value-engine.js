/**
 * MarketSync Customer Intelligence — Question Value, Redundancy Detector & Confusion Handler.
 *
 * Estimates information value before asking questions, detects conversational loops and confusion ("what?", "doesn't make sense"),
 * and warns human reps if they draft questions already answered by the customer.
 */

export function checkRepQuestionRedundancy(repDraftMessage = '', customerState = {}) {
  const lower = String(repDraftMessage || '').toLowerCase()
  const warnings = []
  const t = customerState.trade_state || {}
  const p = customerState.purchase_state || {}

  // 1. Trade Redundancy Check
  if (/\b(do you have a trade|what (?:car|vehicle) do you (?:drive|have)|trade in)\b/i.test(lower)) {
    if (t.has_trade?.value && t.year?.value && t.make?.value) {
      warnings.push({
        field: 'trade_vehicle',
        warning: `Customer already provided: ${t.year.value} ${t.make.value} ${t.model?.value || ''}`,
      })
    }
  }

  // 2. Budget / Payment Redundancy Check
  if (/\b(what is your budget|monthly payment|how much are you looking to spend)\b/i.test(lower)) {
    if (p.payment_comfort?.value) {
      warnings.push({
        field: 'payment_comfort',
        warning: `Customer already provided payment target: ${p.payment_comfort.value}`,
      })
    }
  }

  return {
    is_redundant: warnings.length > 0,
    warnings,
  }
}

/**
 * Detects customer confusion signals to adapt explanation depth.
 */
export function detectCustomerConfusion(message = '') {
  const text = String(message || '').toLowerCase()
  const isConfused = /\b(what\?|i don't understand|i do not get it|that makes no sense|confused|what does that mean)\b/i.test(text)
  return {
    is_confused: isConfused,
    recommended_action: isConfused ? 'simplify_explanation_and_offer_clarification' : 'proceed_normally',
  }
}
