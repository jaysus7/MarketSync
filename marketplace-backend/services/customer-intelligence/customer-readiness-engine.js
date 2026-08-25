/**
 * MarketSync Customer Intelligence — Customer Readiness, Goal Alignment & Interaction Modes.
 *
 * Tracks multi-dimensional readiness (contact, trade, finance, appointment, handoff, purchase)
 * and classifies interaction modes (EXPLORATION, TRANSACTION, SUPPORT, COMPLAINT, SAFETY).
 */

export const INTERACTION_MODES = {
  EXPLORATION: 'EXPLORATION',
  TRANSACTION: 'TRANSACTION',
  SUPPORT: 'SUPPORT',
  COMPLAINT: 'COMPLAINT',
  SAFETY: 'SAFETY',
}

export function evaluateCustomerReadiness(customerState = {}, latestMessage = '') {
  const text = String(latestMessage || '').toLowerCase()
  const s = customerState || {}
  const id = s.identity || {}
  const p = s.purchase_state || {}
  const t = s.trade_state || {}

  // 1. Interaction Mode
  let mode = INTERACTION_MODES.EXPLORATION
  if (/\b(brakes failed|smoke|overheating|hazard|stalling on highway|warning light flashing)\b/i.test(text)) {
    mode = INTERACTION_MODES.SAFETY
  } else if (/\b(unacceptable|angry|lawyer|manager|ripped off|scam|terrible service)\b/i.test(text)) {
    mode = INTERACTION_MODES.COMPLAINT
  } else if (/\b(warranty claim|my current car|service bill|repair status)\b/i.test(text)) {
    mode = INTERACTION_MODES.SUPPORT
  } else if (/\b(ready to buy|take it home|write it up|put deposit|send paperwork)\b/i.test(text)) {
    mode = INTERACTION_MODES.TRANSACTION
  }

  // 2. Multi-Dimensional Readiness
  const readiness = {
    contact: id.phone?.value || id.email?.value ? 'HIGH' : (/\b(text me|email me|call me)\b/i.test(text) ? 'HIGH' : 'MEDIUM'),
    trade: t.has_trade?.value ? (t.year?.value && t.make?.value ? 'HIGH' : 'MEDIUM') : 'LOW',
    finance: p.payment_comfort?.value || p.budget?.value ? 'HIGH' : 'MEDIUM',
    appointment: p.appointment_intent?.value || /\b(test drive|come in|visit|saturday|tomorrow)\b/i.test(text) ? 'HIGH' : 'LOW',
    handoff: /\b(human|salesperson|agent|manager)\b/i.test(text) || mode === INTERACTION_MODES.COMPLAINT ? 'HIGH' : 'LOW',
    purchase: p.timeframe?.value === 'immediate' || mode === INTERACTION_MODES.TRANSACTION ? 'HIGH' : 'MEDIUM',
  }

  // 3. Customer Goal vs Business Goal Conflict Check
  const isResearchOnly = /\b(just browsing|only researching|not ready to buy|just looking)\b/i.test(text)
  const goalConflict = isResearchOnly ? {
    conflict_detected: true,
    guidance: 'Customer is purely in research mode. Do not push for appointments or contact forms; provide consultative information.',
  } : { conflict_detected: false }

  return {
    interaction_mode: mode,
    readiness,
    goal_conflict: goalConflict,
  }
}
