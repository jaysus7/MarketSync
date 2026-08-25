/**
 * MarketSync Customer Intelligence — Intelligent Human Escalation & Live Rep Co-Pilot Engine.
 *
 * Evaluates complex escalation triggers, determines target department and representative,
 * and powers the private in-CRM Live Rep Co-Pilot for sales reps taking over conversations.
 */

import { BUYING_STAGES } from './customer-intelligence-state.js'

/**
 * Evaluates whether a conversation should trigger autonomous human handoff.
 */
export function evaluateHumanEscalationTriggers(intelligenceState, latestUnderstanding = {}) {
  const s = intelligenceState || {}
  const id = s.identity || {}
  const v = s.vehicle_interest || {}
  const p = s.purchase_state || {}
  const obj = s.objections || {}
  const pri = latestUnderstanding.primary_intent

  // 1. Explicit Human / Manager Request
  if (pri === 'human_request') {
    return {
      should_escalate: true,
      reason: 'Customer explicitly requested to speak with a human team member',
      target_department: 'Sales',
      priority: 'urgent',
    }
  }

  // 2. High Urgency Purchase / Appointment Ready with Contact
  if ((p.timeframe?.value === 'immediate' || p.appointment_intent?.value) && (id.phone?.value || id.email?.value)) {
    return {
      should_escalate: true,
      reason: 'Immediate purchase urgency and contact verified — ready for human closing',
      target_department: 'Sales',
      priority: 'high',
    }
  }

  // 3. F&I / Complex Credit & Financing Escalation
  if (pri === 'financing_prequal' && obj.active_objections?.some(o => o.type === 'credit_concern')) {
    return {
      should_escalate: true,
      reason: 'Credit pre-qualification inquiry requires F&I specialist review',
      target_department: 'F&I',
      priority: 'high',
    }
  }

  // 4. Service / Parts Escalation
  if (pri === 'service_inquiry') {
    return {
      should_escalate: true,
      reason: 'Service department inquiry and booking',
      target_department: 'Service',
      priority: 'normal',
    }
  }
  if (pri === 'parts_inquiry') {
    return {
      should_escalate: true,
      reason: 'Parts inquiry and compatibility check',
      target_department: 'Parts',
      priority: 'normal',
    }
  }

  // 5. Severe Frustration / Complaint Escalation
  if (latestUnderstanding.frustration_score >= 50) {
    return {
      should_escalate: true,
      reason: 'Customer expressing high frustration or repeated difficulty — management takeover recommended',
      target_department: 'Management',
      priority: 'urgent',
    }
  }

  return {
    should_escalate: false,
    reason: null,
    target_department: 'Sales',
    priority: 'normal',
  }
}

/**
 * Generates live co-pilot assistance suggestions for the sales rep.
 */
export function generateRepCopilotSuggestion(style = 'draft', intelligenceState = {}, conversationHistory = []) {
  const s = intelligenceState || {}
  const id = s.identity || {}
  const v = s.vehicle_interest || {}
  const p = s.purchase_state || {}
  const t = s.trade_state || {}
  const obj = s.objections || {}

  const customerName = id.first_name?.value || id.name?.value || 'there'
  const vehicle = v.primary_vehicle?.value || 'the vehicle'
  const tradeStr = [t.year?.value, t.make?.value, t.model?.value].filter(Boolean).join(' ')

  switch (style) {
    case 'shorter':
      return {
        text: `Hi ${customerName}, I have the keys to the ${vehicle}. What time today or tomorrow works best for you to come by?`,
        type: 'shorter_draft',
      }
    case 'warmer':
      return {
        text: `Hi ${customerName}! It's a pleasure to connect with you. I would love to help you check out the ${vehicle}${tradeStr ? ` and take a look at your ${tradeStr}` : ''}. We will make everything super easy and comfortable for you!`,
        type: 'warmer_draft',
      }
    case 'direct':
      return {
        text: `Hi ${customerName}. The ${vehicle} is in stock and available. Are you available for a 15-minute test drive this afternoon?`,
        type: 'direct_draft',
      }
    case 'explain_objection': {
      const active = obj.active_objections?.[0]
      if (!active) return { text: 'No active objections detected. Customer appears engaged.', type: 'explanation' }
      return {
        text: `Customer concern: "${active.label}". Strategy: ${active.playbook?.clarificationStrategy || 'Clarify budget target without pushing.'}`,
        type: 'explanation',
      }
    }
    case 'suggest_alternative': {
      const alts = v.alternatives_suggested || []
      if (!alts.length) return { text: 'Search inventory for similar body style and price points.', type: 'alternative' }
      return {
        text: `Recommended alternatives: ${alts.map(a => a.title || a).join(', ')}`,
        type: 'alternative',
      }
    }
    case 'next_step':
    default:
      return {
        text: `Hi ${customerName}, I'm following up regarding the ${vehicle}. I reviewed your notes with Avery and have all the details ready. Would you prefer a quick phone call or text to go over options?`,
        type: 'standard_draft',
      }
  }
}
