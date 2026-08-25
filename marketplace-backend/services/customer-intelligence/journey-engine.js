/**
 * MarketSync Customer Intelligence — Customer Journey & Buying Stage Engine.
 *
 * Tracks the shopper's evolving lifecycle stage based on verifiable behavioral and conversational evidence.
 * Stages never artificially jump forward without evidence.
 */

import { BUYING_STAGES } from './customer-intelligence-state.js'

/**
 * Determines whether the customer state should transition to a new stage.
 */
export function evaluateBuyingStage(currentState, latestUnderstanding = {}) {
  const currentStage = currentState.intent?.buying_stage || BUYING_STAGES.DISCOVERY
  const vehicle = currentState.vehicle_interest?.primary_vehicle?.value
  const timeframe = currentState.purchase_state?.timeframe?.value
  const pmt = currentState.purchase_state?.payment_comfort?.value || currentState.purchase_state?.budget?.value
  const trade = currentState.trade_state?.has_trade?.value
  const appointmentIntent = currentState.purchase_state?.appointment_intent?.value
  const handoffReady = currentState.handoff?.handoff_ready

  // 1. Post-Action: Appointment scheduled or application submitted
  if (currentState.purchase_state?.appointment_status === 'booked' || currentState.identity?.credit_app_started) {
    return {
      stage: BUYING_STAGES.POST_ACTION,
      reason: 'Appointment booked or application active',
      changed: currentStage !== BUYING_STAGES.POST_ACTION,
    }
  }

  // 2. Action Ready: Appointment requested, ready to buy, deposit offered, or rep requested
  if (
    appointmentIntent ||
    handoffReady ||
    latestUnderstanding.primary_intent === 'appointment_request' ||
    latestUnderstanding.primary_intent === 'human_request' ||
    timeframe === 'immediate'
  ) {
    return {
      stage: BUYING_STAGES.ACTION_READY,
      reason: 'Customer requested appointment, human rep, or is ready for immediate transaction',
      changed: currentStage !== BUYING_STAGES.ACTION_READY,
    }
  }

  // 3. Decision: Specific vehicle confirmed + resolving final objections/options
  if (vehicle && (timeframe === '1_2_weeks' || pmt) && currentState.objections?.active_objections?.length > 0) {
    return {
      stage: BUYING_STAGES.DECISION,
      reason: 'Target vehicle identified and resolving remaining buying barriers',
      changed: currentStage !== BUYING_STAGES.DECISION,
    }
  }

  // 4. Financial Evaluation: Actively discussing price, monthly payments, trade equity, credit
  if (
    pmt ||
    trade === 'has_trade' ||
    latestUnderstanding.primary_intent === 'payment_affordability' ||
    latestUnderstanding.primary_intent === 'trade_inquiry' ||
    latestUnderstanding.primary_intent === 'financing_prequal' ||
    latestUnderstanding.primary_intent === 'negotiation_intent'
  ) {
    return {
      stage: BUYING_STAGES.FINANCIAL_EVALUATION,
      reason: 'Evaluating monthly payment, pricing, financing pre-qual, or trade-in',
      changed: currentStage !== BUYING_STAGES.FINANCIAL_EVALUATION,
    }
  }

  // 5. Evaluation: Comparing models, features, vehicle condition
  if (
    latestUnderstanding.primary_intent === 'comparison_intent' ||
    latestUnderstanding.primary_intent === 'vehicle_specs_features' ||
    (currentState.vehicle_interest?.compared_vehicles || []).length > 1
  ) {
    return {
      stage: BUYING_STAGES.EVALUATION,
      reason: 'Comparing specifications, features, or alternative vehicle models',
      changed: currentStage !== BUYING_STAGES.EVALUATION,
    }
  }

  // 6. Interest: Identified a primary vehicle of interest
  if (vehicle || currentState.vehicle_interest?.stock_number?.value) {
    return {
      stage: BUYING_STAGES.INTEREST,
      reason: `Engaged with target vehicle: ${vehicle || 'Stock unit'}`,
      changed: currentStage !== BUYING_STAGES.INTEREST,
    }
  }

  // 7. Nurture: Stated they are just looking/researching for down the road
  if (timeframe === 'just_researching' || timeframe === 'few_months') {
    return {
      stage: BUYING_STAGES.NURTURE,
      reason: 'Longer-term research timeframe',
      changed: currentStage !== BUYING_STAGES.NURTURE,
    }
  }

  // 8. Discovery: Default browsing / initial entry
  return {
    stage: BUYING_STAGES.DISCOVERY,
    reason: 'Initial broad exploration',
    changed: currentStage !== BUYING_STAGES.DISCOVERY,
  }
}
