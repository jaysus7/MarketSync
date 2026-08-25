/**
 * MarketSync Customer Intelligence — AI Lead Brief 2.0 Generator.
 *
 * Assembles a comprehensive, structured briefing for sales representatives before handoff,
 * ensuring the customer never has to repeat their vehicle interest, trade specs, or budget.
 */

import { calculateExplainableLeadIntelligence } from './lead-scoring.js'
import { planNextBestAction } from './next-best-action.js'

/**
 * Generates the complete AI Lead Brief 2.0 payload.
 */
export function generateAiLeadBrief2(intelligenceState, conversationHistory = []) {
  const s = intelligenceState || {}
  const id = s.identity || {}
  const v = s.vehicle_interest || {}
  const p = s.purchase_state || {}
  const t = s.trade_state || {}
  const obj = s.objections || {}
  const eng = s.engagement || {}
  const leadIntel = calculateExplainableLeadIntelligence(s, conversationHistory)
  const actionPlan = planNextBestAction(s)

  const lastCustomerMsg = [...(conversationHistory || [])].reverse().find(m => m.role === 'user')?.message || 'None'
  const primaryObj = obj.active_objections?.[0]?.label || 'None identified'
  const resolvedList = (obj.resolved_objections || []).map(o => o.label || o.type)

  const tradeStr = t.has_trade?.value && t.year?.value
    ? [t.year.value, t.make?.value, t.model?.value, t.trim?.value, t.mileage?.value ? `(${t.mileage.value} mi/km)` : null].filter(Boolean).join(' ')
    : 'No trade disclosed'

  return {
    customer: {
      name: id.name?.value || 'Website Visitor',
      first_name: id.first_name?.value || null,
      last_name: id.last_name?.value || null,
      language: id.language?.value || 'en',
    },
    contact: {
      phone: id.phone?.value || 'Not captured',
      email: id.email?.value || 'Not captured',
      preferred_channel: id.preferred_contact_channel?.value || 'chat',
      consent_status: id.consent_state?.value || 'implicit_chat',
    },
    intent: {
      primary: s.intent?.primary_intent?.value || 'general_inquiry',
      buying_stage: s.intent?.buying_stage || 'DISCOVERY',
      urgency: s.intent?.urgency || 'medium',
      sentiment: s.intent?.sentiment || 'neutral',
    },
    vehicle: {
      target: v.primary_vehicle?.value || 'General inventory inquiry',
      stock_number: v.stock_number?.value || null,
      vin: v.vin?.value || null,
      alternatives: (v.alternatives_suggested || []).map(a => a.title || a).slice(0, 3),
    },
    purchase: {
      timeframe: p.timeframe?.value || 'Not disclosed',
      budget_or_payment: p.payment_comfort?.value || p.budget?.value || 'Not specified',
      finance_preference: p.payment_type?.value || 'Considering options',
      down_payment: p.down_payment_preference?.value || 'Standard',
      appointment_status: p.appointment_status || (p.appointment_intent?.value ? 'Requested' : 'None'),
    },
    trade: {
      vehicle: tradeStr,
      condition: t.condition?.value || 'Uninspected',
      payoff: t.payoff?.value ? `$${Number(t.payoff.value).toLocaleString()}` : 'Uncertain / none',
      appraisal_status: t.appraisal_status || 'none',
    },
    objections: {
      primary: primaryObj,
      active: (obj.active_objections || []).map(o => o.label || o.type),
      resolved: resolvedList.length ? resolvedList : ['Vehicle availability verified'],
      unresolved: obj.unresolved_questions?.length ? obj.unresolved_questions : ['Trade equity / final payment structure'],
    },
    engagement: {
      sessions_count: eng.repeat_sessions || 1,
      messages_exchanged: (conversationHistory || []).length || eng.messages_exchanged || 1,
      customer_messages: (conversationHistory || []).filter(m => m.role === 'user').length,
    },
    lead_intelligence: {
      score: leadIntel.score,
      temperature: leadIntel.temperature,
      confidence: leadIntel.confidence,
      positive_signals: leadIntel.positive_signals,
      barriers: leadIntel.barriers,
      sla_minutes: leadIntel.sla_minutes,
    },
    next_best_action: {
      suggested_action: actionPlan.suggested_action,
      suggested_opening_line: actionPlan.suggested_opening_line,
      recommended_channel: actionPlan.recommended_channel,
      priority: actionPlan.priority,
    },
    last_message: lastCustomerMsg,
    generated_at: new Date().toISOString(),
  }
}
