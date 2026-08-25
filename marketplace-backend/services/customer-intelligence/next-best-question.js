/**
 * MarketSync Customer Intelligence — Information Gain & Next Best Question Engine.
 *
 * Evaluates the customer intelligence state, identifies key informational gaps,
 * ranks candidate questions by value, information gain, and low friction,
 * and selects the single most consultative next question.
 */

import { FACT_STATUS, BUYING_STAGES } from './customer-intelligence-state.js'

/**
 * Computes missing informational dimensions and generates ranked next-best-question candidates.
 */
export function determineNextBestQuestion(intelligenceState, latestUnderstanding = {}) {
  const s = intelligenceState
  const v = s.vehicle_interest
  const p = s.purchase_state
  const t = s.trade_state
  const id = s.identity
  const currentStage = s.intent?.buying_stage || BUYING_STAGES.DISCOVERY

  // If customer asked a direct question or is experiencing frustration, answering directly takes priority over questions!
  if (latestUnderstanding.frustration_score >= 40) {
    return {
      should_ask_question: false,
      recommended_question: null,
      reason: 'Customer frustration detected — prioritize immediate direct answer and empathy without interrogation',
    }
  }

  // Candidate Questions Pool with Scoring Metrics
  const candidates = []

  // 1. Vehicle Clarification (if vehicle is completely unknown and not on a VDP)
  if (v.primary_vehicle.status === FACT_STATUS.UNKNOWN && !s.session?.entry_context?.vehicle_id) {
    candidates.push({
      id: 'identify_vehicle',
      question: 'Are you looking for a specific model, or trying to narrow down body style and budget?',
      customer_value: 0.9,
      information_gain: 0.95,
      friction: 0.2, // very easy to answer
      relevance: 0.95,
      urgency: 0.8,
    })
  }

  // 2. Timeframe Clarification (if vehicle is known but timeframe is completely unknown)
  if (v.primary_vehicle.status !== FACT_STATUS.UNKNOWN && p.timeframe.status === FACT_STATUS.UNKNOWN) {
    candidates.push({
      id: 'clarify_timeframe',
      question: 'Are you looking to make a move in the next week or two, or mostly doing research for down the road?',
      customer_value: 0.85,
      information_gain: 0.9,
      friction: 0.25,
      relevance: 0.9,
      urgency: 0.75,
    })
  }

  // 3. Trade Specifics (if trade was mentioned but year/make/mileage is unknown)
  if (t.has_trade.status !== FACT_STATUS.UNKNOWN && t.has_trade.value && t.year.status === FACT_STATUS.UNKNOWN) {
    candidates.push({
      id: 'clarify_trade_vehicle',
      question: 'What year, make, model, and approximate mileage is your current vehicle?',
      customer_value: 0.9,
      information_gain: 0.95,
      friction: 0.3,
      relevance: 0.95,
      urgency: 0.85,
    })
  }

  // 4. Payment Comfort Zone (if financing mentioned but budget/payment is unknown)
  if (
    p.payment_type.value === 'finance' &&
    p.payment_comfort.status === FACT_STATUS.UNKNOWN &&
    p.budget.status === FACT_STATUS.UNKNOWN
  ) {
    candidates.push({
      id: 'clarify_payment_comfort',
      question: 'Do you have a monthly payment target in mind, or an amount down you’d like to stick to?',
      customer_value: 0.92,
      information_gain: 0.9,
      friction: 0.35,
      relevance: 0.95,
      urgency: 0.8,
    })
  }

  // 5. Test Drive / Appointment (if vehicle is known, timeframe is near-term, and contact is known)
  if (
    v.primary_vehicle.status !== FACT_STATUS.UNKNOWN &&
    (p.timeframe.value === 'immediate' || p.timeframe.value === '1_2_weeks') &&
    !p.appointment_intent.value
  ) {
    candidates.push({
      id: 'propose_test_drive',
      question: `Would you like to take the ${v.primary_vehicle.value} for a quick spin to see how it drives?`,
      customer_value: 0.95,
      information_gain: 0.85,
      friction: 0.3,
      relevance: 0.95,
      urgency: 0.9,
    })
  }

  // 6. Contact Verification (if appointment or trade quote was requested but no phone/email is known)
  if (
    (p.appointment_intent.value || t.appraisal_status === 'requested') &&
    id.phone.status === FACT_STATUS.UNKNOWN &&
    id.email.status === FACT_STATUS.UNKNOWN
  ) {
    candidates.push({
      id: 'capture_contact_for_confirmation',
      question: 'What is the best phone number or email to send your confirmation to?',
      customer_value: 0.95,
      information_gain: 0.99,
      friction: 0.4,
      relevance: 1.0,
      urgency: 0.95,
    })
  }

  // If no specific candidates emerge, default to open consultative assistance
  if (!candidates.length) {
    return {
      should_ask_question: true,
      recommended_question: 'What specific questions can I answer about the features, condition, or pricing?',
      selected_candidate: { id: 'general_assistance', customer_value: 0.7 },
      candidates_ranked: [],
    }
  }

  // Score candidate questions: Score = (customer_value * 0.3) + (information_gain * 0.3) + (relevance * 0.25) + (urgency * 0.15) - (friction * 0.1)
  const ranked = candidates.map(c => {
    const score = (c.customer_value * 0.3) + (c.information_gain * 0.3) + (c.relevance * 0.25) + (c.urgency * 0.15) - (c.friction * 0.1)
    return { ...c, score }
  }).sort((a, b) => b.score - a.score)

  const top = ranked[0]

  return {
    should_ask_question: true,
    recommended_question: top.question,
    selected_candidate: top,
    candidates_ranked: ranked,
  }
}
