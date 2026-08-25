/**
 * MarketSync Customer Intelligence — Explainable Lead Intelligence & Scoring Engine.
 *
 * Computes deterministic 0–100 lead score, temperature (HOT / WARM / NURTURE),
 * explicit positive buying signals, active purchase barriers, and recommended action with SLA.
 */

import { FACT_STATUS } from './customer-intelligence-state.js'

export const LEAD_TEMPERATURES = {
  HOT: 'HOT',
  WARM: 'WARM',
  NURTURE: 'NURTURE',
}

/**
 * Calculates complete explainable lead intelligence from customer state.
 */
export function calculateExplainableLeadIntelligence(intelligenceState, messageHistory = []) {
  const s = intelligenceState || {}
  const id = s.identity || {}
  const v = s.vehicle_interest || {}
  const p = s.purchase_state || {}
  const t = s.trade_state || {}
  const eng = s.engagement || {}
  const obj = s.objections || {}

  let score = 0
  const positiveSignals = []
  const barriers = []
  const breakdown = {}

  // 1. Engagement & Recency
  const msgCount = (messageHistory || []).filter(m => m.role === 'user').length || eng.customer_message_count || 1
  const engPoints = Math.min(15, msgCount * 3)
  score += engPoints
  breakdown.engagement = engPoints
  if (msgCount >= 3) {
    positiveSignals.push(`High conversational engagement (${msgCount} messages exchanged)`)
  }

  // 2. Specific Vehicle Identified
  if (v.primary_vehicle?.status !== FACT_STATUS.UNKNOWN && v.primary_vehicle?.value) {
    score += 20
    breakdown.vehicle = 20
    positiveSignals.push(`Target vehicle identified (${v.primary_vehicle.value})`)
  }

  // 3. Contact Captured / Verified
  if (id.phone?.status !== FACT_STATUS.UNKNOWN && id.phone?.value) {
    score += 20
    breakdown.contact = 20
    positiveSignals.push(`Verified phone/SMS contact captured (${id.phone.value})`)
  } else if (id.email?.status !== FACT_STATUS.UNKNOWN && id.email?.value) {
    score += 15
    breakdown.contact = 15
    positiveSignals.push(`Verified email contact captured (${id.email.value})`)
  }

  // 4. Purchase Timeframe Urgency
  const tf = p.timeframe?.value
  if (tf === 'immediate') {
    score += 20
    breakdown.urgency = 20
    positiveSignals.push('High purchase urgency (ready to buy within 48-72 hours)')
  } else if (tf === '1_2_weeks') {
    score += 15
    breakdown.urgency = 15
    positiveSignals.push('Near-term purchase timeframe (1-2 weeks)')
  } else if (tf === '1_month') {
    score += 10
    breakdown.urgency = 10
    positiveSignals.push('Active monthly buying timeframe (~30 days)')
  } else if (tf === 'just_researching' || tf === 'few_months') {
    barriers.push('Early research timeframe (no immediate purchase deadline)')
  }

  // 5. Appointment Intent
  if (p.appointment_intent?.value || p.appointment_status === 'booked') {
    score += 20
    breakdown.appointment = 20
    positiveSignals.push('Requested or booked on-site test drive / showroom appointment')
  }

  // 6. Payment & Budget Parameters Disclosed
  if (p.payment_comfort?.status !== FACT_STATUS.UNKNOWN && p.payment_comfort?.value) {
    score += 10
    breakdown.finance_target = 10
    positiveSignals.push(`Disclosed target monthly payment (${p.payment_comfort.value})`)
  } else if (p.budget?.status !== FACT_STATUS.UNKNOWN && p.budget?.value) {
    score += 10
    breakdown.finance_target = 10
    positiveSignals.push(`Disclosed total budget limit (${p.budget.value})`)
  }

  // 7. Trade-in Details Provided
  if (t.has_trade?.value && t.year?.value) {
    score += 10
    breakdown.trade = 10
    const tradeLabel = [t.year.value, t.make?.value, t.model?.value].filter(Boolean).join(' ')
    positiveSignals.push(`Trade-in vehicle disclosed (${tradeLabel})`)
  }

  // 8. Active Objections / Barriers
  if (obj.active_objections?.length > 0) {
    for (const o of obj.active_objections) {
      barriers.push(`Active objection: ${o.label || o.type}`)
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)))

  let temperature = LEAD_TEMPERATURES.NURTURE
  let slaMinutes = 120
  let recommendedAction = 'Continue consultative nurturing in chat'

  if (finalScore >= 75) {
    temperature = LEAD_TEMPERATURES.HOT
    slaMinutes = 5
    recommendedAction = 'Sales specialist immediate outreach (Call/SMS within 5 mins) with payment structuring & staged keys'
  } else if (finalScore >= 45) {
    temperature = LEAD_TEMPERATURES.WARM
    slaMinutes = 30
    recommendedAction = 'Sales follow-up within 30 mins with tailored inventory options and trade appraisal estimate'
  }

  return {
    score: finalScore,
    temperature,
    confidence: finalScore >= 75 ? 0.95 : finalScore >= 45 ? 0.85 : 0.70,
    positive_signals: positiveSignals.length ? positiveSignals : ['Early inquiry / browsing'],
    barriers: barriers.length ? barriers : ['None identified'],
    breakdown,
    sla_minutes: slaMinutes,
    recommended_action: recommendedAction,
  }
}
