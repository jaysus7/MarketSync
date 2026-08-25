/**
 * MarketSync Customer Intelligence — Canonical Business Event Dispatcher.
 *
 * Emits structured business events into MarketSync's event engine to trigger
 * workflows, notifications, and automations across departments.
 */

import { emitEvent } from '../../routes/events.js'

export const CUSTOMER_INTELLIGENCE_EVENTS = {
  INTENT_DETECTED: 'customer.intent_detected',
  OBJECTION_DETECTED: 'customer.objection_detected',
  OBJECTION_RESOLVED: 'customer.objection_resolved',
  CONTACT_CAPTURED: 'customer.contact_captured',
  TRADE_IDENTIFIED: 'customer.trade_identified',
  APPOINTMENT_INTENT: 'customer.appointment_intent',
  HANDOFF_READY: 'customer.handoff_ready',
  HANDOFF_COMPLETED: 'customer.handoff_completed',
  SENTIMENT_CHANGED: 'customer.sentiment_changed',
}

export function emitCustomerIntelligenceEvent(dealershipId, eventType, entityId, summary, payload = {}, department = 'Sales') {
  if (!dealershipId || !eventType) return null
  return emitEvent({
    dealershipId,
    eventName: eventType,
    entityType: 'customer',
    entityId: entityId || 'unknown',
    summary,
    department,
    payload: {
      ...payload,
      emitted_at: new Date().toISOString(),
    },
  })
}
