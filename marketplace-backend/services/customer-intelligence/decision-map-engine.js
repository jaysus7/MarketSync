/**
 * MarketSync Customer Intelligence — Customer Decision Map & Open Loop Tracking Engine.
 *
 * Maintains a compact decision map (WANTS, NEEDS, CONCERNS, BLOCKERS, OPEN_QUESTIONS, NEXT_DECISION)
 * and tracks open commitments made by the AI (promises of callbacks, video walkarounds, vehicle checks).
 */

export function buildCustomerDecisionMap(intelligenceState = {}, conversationHistory = []) {
  const s = intelligenceState || {}
  const v = s.vehicle_interest || {}
  const p = s.purchase_state || {}
  const t = s.trade_state || {}
  const obj = s.objections || {}

  const wants = []
  const needs = []
  const concerns = []
  const blockers = []
  const openQuestions = []
  let nextDecision = 'Narrow down vehicle selection'

  // Wants
  if (v.primary_vehicle?.value) {
    wants.push(v.primary_vehicle.value)
  }
  if (Array.isArray(v.nice_to_have_features) && v.nice_to_have_features.length) {
    wants.push(...v.nice_to_have_features)
  }

  // Needs
  if (p.payment_comfort?.value) {
    needs.push(`Monthly payment near ${p.payment_comfort.value}`)
  } else if (p.budget?.value) {
    needs.push(`Budget under ${p.budget.value}`)
  }
  if (Array.isArray(v.must_have_features) && v.must_have_features.length) {
    needs.push(...v.must_have_features)
  }

  // Concerns
  if (obj.active_objections?.length) {
    for (const o of obj.active_objections) {
      concerns.push(o.label || o.type)
    }
  }
  if (t.has_trade?.value && t.payoff?.value) {
    concerns.push(`Trade payoff obligation ($${Number(t.payoff.value).toLocaleString()})`)
  }

  // Blockers
  if (t.has_trade?.value && t.appraisal_status !== 'appraised') {
    blockers.push('Pending trade market valuation')
    nextDecision = 'Complete trade appraisal to determine accurate monthly equity'
  }
  if (p.appointment_status !== 'booked' && (p.timeframe?.value === 'immediate' || p.timeframe?.value === '1_2_weeks')) {
    nextDecision = 'Schedule on-site VIP test drive and vehicle demonstration'
  }

  // Open Loops from AI messages
  const lastAssistantMsg = [...(conversationHistory || [])].reverse().find(m => m.role === 'assistant')?.message || ''
  if (/\b(i will check|let me check|i'll have someone call|let me see if|i'll send you)\b/i.test(lastAssistantMsg)) {
    openQuestions.push(lastAssistantMsg.slice(0, 120))
  }

  return {
    wants: wants.length ? wants : ['General vehicle options'],
    needs: needs.length ? needs : ['Reliable transportation'],
    concerns: concerns.length ? concerns : ['None stated'],
    blockers: blockers.length ? blockers : ['None'],
    open_questions: openQuestions,
    next_decision: nextDecision,
  }
}
