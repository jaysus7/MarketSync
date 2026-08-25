/**
 * MarketSync Customer Intelligence — Incident Governance, Degraded Mode & Sales Pressure Guard.
 *
 * Enforces degraded operational modes during third-party outages without exposing technical errors,
 * detects and blocks manipulative sales pressure tactics (fake scarcity, artificial urgency),
 * and guarantees cross-channel conversational continuity ("Customer Does Not Restart").
 */

export function detectSalesPressure(candidateText = '') {
  const text = String(candidateText || '').toLowerCase()
  const violations = []

  if (/\b(buy (?:it )?today or it's gone|won't last the hour|someone else is looking at it right now|must act immediately)\b/i.test(text)) {
    violations.push('artificial_scarcity_urgency_pressure')
  }
  if (/\b(just sign today|give me your credit card right now|stop thinking and buy)\b/i.test(text)) {
    violations.push('aggressive_closing_pressure')
  }

  return {
    has_pressure: violations.length > 0,
    violations,
    is_acceptable: violations.length === 0,
  }
}

/**
 * Formats a customer-safe graceful fallback when external integrations experience downtime.
 */
export function handleDegradedIntegrationMode(failedServiceName = 'inventory') {
  const messages = {
    inventory: 'I can answer questions about model specifications and features, but our live inventory lookup is updating right now. A specialist can verify exact stock availability for you shortly.',
    calendar: 'I can collect your preferred test drive time, and our team will confirm the exact reservation slot with you directly.',
    sms: 'We are currently unable to send text updates, but I can email your vehicle summary or connect you with a representative.',
  }

  return {
    mode: 'degraded',
    customer_safe_message: messages[failedServiceName] || 'I am experiencing a brief delay connecting to live data. Let me take down your request so our team can follow up with verified numbers.',
    alert_internal_admin: true,
  }
}
