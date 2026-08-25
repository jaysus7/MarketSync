/**
 * MarketSync Customer Intelligence — Conversation Goal Engine.
 *
 * Determines the single primary conversational goal for the current turn,
 * preventing multi-objective confusion (e.g. attempting to answer, qualify, sell,
 * book, and capture contact all in one message).
 */

export const CONVERSATION_GOALS = {
  ANSWER_QUESTION: 'ANSWER_QUESTION',
  DISCOVER_NEED: 'DISCOVER_NEED',
  VERIFY_AVAILABILITY: 'VERIFY_AVAILABILITY',
  COMPARE_OPTIONS: 'COMPARE_OPTIONS',
  QUALIFY_LEAD: 'QUALIFY_LEAD',
  RESOLVE_OBJECTION: 'RESOLVE_OBJECTION',
  CAPTURE_CONTACT: 'CAPTURE_CONTACT',
  START_TRADE: 'START_TRADE',
  BOOK_APPOINTMENT: 'BOOK_APPOINTMENT',
  START_FINANCE: 'START_FINANCE',
  HAND_OFF: 'HAND_OFF',
  SUPPORT_CUSTOMER: 'SUPPORT_CUSTOMER',
  RETAIN_NURTURE: 'RETAIN_NURTURE',
}

/**
 * Evaluates customer intelligence state and latest message understanding to select the single best primary goal.
 */
export function evaluateConversationGoal(intelligenceState = {}, latestUnderstanding = {}) {
  const pri = latestUnderstanding.primary_intent
  const s = intelligenceState || {}
  const id = s.identity || {}
  const p = s.purchase_state || {}
  const t = s.trade_state || {}
  const obj = s.objections || {}
  const fr = latestUnderstanding.frustration_score || 0

  // 1. Frustration / Human Escalation
  if (fr >= 50 || pri === 'human_request') {
    return {
      primary_goal: CONVERSATION_GOALS.HAND_OFF,
      reason: 'Frustration or explicit representative request requires direct handoff',
    }
  }

  // 2. Appointment Booking
  if (pri === 'appointment_request' || p.appointment_intent?.value) {
    if (id.phone?.value || id.email?.value) {
      return {
        primary_goal: CONVERSATION_GOALS.BOOK_APPOINTMENT,
        reason: 'Customer requested test drive/visit and contact is known',
      }
    }
    return {
      primary_goal: CONVERSATION_GOALS.CAPTURE_CONTACT,
      reason: 'Appointment requested — collect contact for scheduling confirmation',
    }
  }

  // 3. Active Unresolved Objection
  if (obj.active_objections?.length > 0 && latestUnderstanding.all_intents?.some(i => i.intent.includes('affordability') || i.intent.includes('negotiation'))) {
    return {
      primary_goal: CONVERSATION_GOALS.RESOLVE_OBJECTION,
      reason: `Address active objection: ${obj.active_objections[0].label}`,
    }
  }

  // 4. Trade Valuation
  if (pri === 'trade_inquiry' || (t.has_trade?.value && t.year?.status === 'unknown')) {
    return {
      primary_goal: CONVERSATION_GOALS.START_TRADE,
      reason: 'Customer mentioned trade-in — collect vehicle details for appraisal',
    }
  }

  // 5. Vehicle Availability & Verification
  if (pri === 'vehicle_availability') {
    return {
      primary_goal: CONVERSATION_GOALS.VERIFY_AVAILABILITY,
      reason: 'Verify live stock availability of target vehicle',
    }
  }

  // 6. Comparison
  if (pri === 'comparison_intent') {
    return {
      primary_goal: CONVERSATION_GOALS.COMPARE_OPTIONS,
      reason: 'Customer is comparing two models or trims',
    }
  }

  // 7. Financing / Credit Pre-qual
  if (pri === 'financing_prequal') {
    return {
      primary_goal: CONVERSATION_GOALS.START_FINANCE,
      reason: 'Customer inquired about financing pre-qualification options',
    }
  }

  // 8. Specific Question Asked
  if (pri === 'vehicle_specs_features' || pri === 'pricing_inquiry' || pri === 'service_inquiry' || pri === 'parts_inquiry') {
    return {
      primary_goal: CONVERSATION_GOALS.ANSWER_QUESTION,
      reason: 'Provide direct factual answer to customer inquiry',
    }
  }

  // 9. Early Discovery
  if (!s.vehicle_interest?.primary_vehicle?.value) {
    return {
      primary_goal: CONVERSATION_GOALS.DISCOVER_NEED,
      reason: 'Discover customer vehicle preferences, body style, or budget',
    }
  }

  // 10. Default Qualification
  return {
    primary_goal: CONVERSATION_GOALS.QUALIFY_LEAD,
    reason: 'Progressively qualify purchase timeframe and parameters',
  }
}
