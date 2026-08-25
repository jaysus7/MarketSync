/**
 * MarketSync Customer Intelligence — Canonical Customer Intelligence State.
 *
 * Implements a structured, tri-state data model where every factual dimension is:
 * - 'known': verified fact from customer or database
 * - 'inferred': reasonable interpretation with confidence (0..1) and evidence/source
 * - 'unknown': information not yet available (never filled with arbitrary guesses)
 */

export const FACT_STATUS = {
  KNOWN: 'known',
  INFERRED: 'inferred',
  UNKNOWN: 'unknown',
}

export const BUYING_STAGES = {
  DISCOVERY: 'DISCOVERY',
  INTEREST: 'INTEREST',
  EVALUATION: 'EVALUATION',
  FINANCIAL_EVALUATION: 'FINANCIAL_EVALUATION',
  DECISION: 'DECISION',
  ACTION_READY: 'ACTION_READY',
  POST_ACTION: 'POST_ACTION',
  NURTURE: 'NURTURE',
}

export const URGENCY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

export const SENTIMENT_TYPES = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  UNCERTAIN: 'uncertain',
  FRUSTRATED: 'frustrated',
  ANGRY: 'angry',
}

export const OBJECTION_LIFECYCLE = {
  DETECTED: 'detected',
  CLARIFIED: 'clarified',
  RESPONSED: 'responsed',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated',
}

/**
 * Creates a tri-state field wrapper.
 */
export function createField(value = null, status = null, confidence = 0, evidence = null, source = null) {
  const resolvedStatus = status || (value !== null && value !== undefined && value !== '' ? FACT_STATUS.KNOWN : FACT_STATUS.UNKNOWN)
  return {
    value: value ?? null,
    status: resolvedStatus,
    confidence: Math.max(0, Math.min(1, confidence || (value ? 1.0 : 0.0))),
    evidence: evidence || null,
    source: source || null,
  }
}

/**
 * Instantiates a fresh canonical Customer Intelligence State structure.
 */
export function createInitialCustomerIntelligenceState(overrides = {}) {
  return {
    identity: {
      customer_id: createField(overrides.customer_id || null, overrides.customer_id ? FACT_STATUS.KNOWN : FACT_STATUS.UNKNOWN, 1.0, null, 'database'),
      name: createField(overrides.name || null),
      first_name: createField(overrides.first_name || null),
      last_name: createField(overrides.last_name || null),
      phone: createField(overrides.phone || null),
      email: createField(overrides.email || null),
      preferred_name: createField(overrides.preferred_name || null),
      language: createField(overrides.language || 'en', FACT_STATUS.KNOWN, 1.0),
      preferred_contact_channel: createField(overrides.preferred_contact_channel || 'chat'),
      consent_state: createField(overrides.consent_state || null),
      timezone: createField(overrides.timezone || null),
    },
    session: {
      channel: overrides.channel || 'web',
      presence_status: 'online', // online | away | offline
      session_start: new Date().toISOString(),
      last_customer_message_at: null,
      last_business_response_at: null,
      assigned_employee_id: overrides.assigned_employee_id || null,
      ownership_mode: overrides.ownership_mode || 'ai', // ai | human | copilot
      entry_context: {
        page_type: overrides.page_type || 'homepage', // vdp | finance | trade | service | parts | homepage
        url: overrides.url || null,
        title: overrides.page_title || null,
        vehicle_id: overrides.vehicle_id || null,
        vin: overrides.vin || null,
        stock_number: overrides.stock_number || null,
        referrer: overrides.referrer || null,
      },
    },
    intent: {
      primary_intent: createField('general_inquiry', FACT_STATUS.INFERRED, 0.5, 'Session initialized'),
      secondary_intents: [],
      intent_confidence: 0.5,
      intent_history: [],
      buying_stage: BUYING_STAGES.DISCOVERY,
      stage_history: [{ stage: BUYING_STAGES.DISCOVERY, at: new Date().toISOString(), reason: 'Initial entry' }],
      urgency: URGENCY_LEVELS.MEDIUM,
      sentiment: SENTIMENT_TYPES.NEUTRAL,
      frustration_score: 0, // 0..100
      buying_signals: [],
    },
    vehicle_interest: {
      primary_vehicle: createField(overrides.primary_vehicle || null),
      stock_number: createField(overrides.stock_number || null),
      vin: createField(overrides.vin || null),
      body_style: createField(overrides.body_style || null),
      new_used: createField(overrides.new_used || null), // new | used | certified
      must_have_features: overrides.must_have_features || [],
      nice_to_have_features: overrides.nice_to_have_features || [],
      disliked_attributes: overrides.disliked_attributes || [],
      compared_vehicles: [],
      viewed_inventory: overrides.vehicle_id ? [overrides.vehicle_id] : [],
      alternatives_suggested: [],
    },
    purchase_state: {
      timeframe: createField(overrides.timeframe || null), // immediate | 1_2_weeks | 1_month | few_months | just_researching
      budget: createField(overrides.budget || null),
      payment_comfort: createField(overrides.payment_comfort || null),
      payment_type: createField(overrides.payment_type || null), // finance | lease | cash
      down_payment_preference: createField(overrides.down_payment_preference || null),
      trade_intent: createField(null), // has_trade | no_trade | considering
      appointment_intent: createField(false),
      appointment_preference: createField(null),
      decision_makers: createField(null), // sole | spouse | parent | partner
      purchase_barriers: [],
    },
    trade_state: {
      has_trade: createField(null),
      year: createField(null),
      make: createField(null),
      model: createField(null),
      trim: createField(null),
      mileage: createField(null),
      condition: createField(null), // excellent | good | fair | poor
      payoff: createField(null),
      appraisal_status: 'none', // none | requested | pending_review | appraised
      appraisal_id: null,
    },
    objections: {
      active_objections: [], // Array<{ id, type, label, lifecycle, detected_at, source_message, confidence, severity, notes }>
      resolved_objections: [],
      unresolved_questions: [],
    },
    engagement: {
      messages_exchanged: 0,
      customer_message_count: 0,
      assistant_message_count: 0,
      repeat_sessions: 1,
      return_visits: 0,
      pages_viewed: [],
      cta_clicks: [],
      response_latencies_ms: [],
    },
    handoff: {
      handoff_ready: false,
      handoff_reason: null,
      priority: 'normal', // normal | high | urgent
      best_department: 'Sales', // Sales | F&I | Service | Parts | Management
      best_employee_id: null,
      recommended_next_action: 'Understand customer vehicle preference and answer initial questions',
      suggested_opening_line: null,
    },
    memories: {
      facts: [],       // Verified durable facts
      inferences: [],  // Probabilistic observations
      temporary: [],   // Contextual to this session only
    },
  }
}

/**
 * Updates a tri-state field safely.
 */
export function setField(fieldObj, value, status = FACT_STATUS.KNOWN, confidence = 1.0, evidence = null, source = null) {
  if (!fieldObj) return createField(value, status, confidence, evidence, source)
  fieldObj.value = value ?? null
  fieldObj.status = status || (value !== null ? FACT_STATUS.KNOWN : FACT_STATUS.UNKNOWN)
  fieldObj.confidence = Math.max(0, Math.min(1, confidence))
  if (evidence) fieldObj.evidence = evidence
  if (source) fieldObj.source = source
  return fieldObj
}

/**
 * Merges partial intelligence updates into the canonical state.
 */
export function mergeIntelligenceState(currentState, updates = {}) {
  if (!currentState) return createInitialCustomerIntelligenceState(updates)
  const state = { ...currentState }

  if (updates.identity) {
    for (const [k, v] of Object.entries(updates.identity)) {
      if (v && typeof v === 'object' && 'status' in v) {
        state.identity[k] = v
      } else if (v !== undefined) {
        setField(state.identity[k], v, FACT_STATUS.KNOWN, 1.0, 'merge', 'update')
      }
    }
  }

  if (updates.vehicle_interest) {
    for (const [k, v] of Object.entries(updates.vehicle_interest)) {
      if (Array.isArray(v)) {
        state.vehicle_interest[k] = [...new Set([...(state.vehicle_interest[k] || []), ...v])]
      } else if (v && typeof v === 'object' && 'status' in v) {
        state.vehicle_interest[k] = v
      } else if (v !== undefined) {
        setField(state.vehicle_interest[k], v, FACT_STATUS.KNOWN, 1.0)
      }
    }
  }

  if (updates.purchase_state) {
    for (const [k, v] of Object.entries(updates.purchase_state)) {
      if (Array.isArray(v)) {
        state.purchase_state[k] = [...new Set([...(state.purchase_state[k] || []), ...v])]
      } else if (v && typeof v === 'object' && 'status' in v) {
        state.purchase_state[k] = v
      } else if (v !== undefined) {
        setField(state.purchase_state[k], v, FACT_STATUS.KNOWN, 1.0)
      }
    }
  }

  if (updates.trade_state) {
    for (const [k, v] of Object.entries(updates.trade_state)) {
      if (v && typeof v === 'object' && 'status' in v) {
        state.trade_state[k] = v
      } else if (v !== undefined) {
        setField(state.trade_state[k], v, FACT_STATUS.KNOWN, 1.0)
      }
    }
  }

  if (updates.handoff) {
    state.handoff = { ...state.handoff, ...updates.handoff }
  }

  return state
}
