/**
 * MarketSync Customer Intelligence — Conversation Understanding & Intent Engine.
 *
 * Extracts structured multi-intent, sentiment, frustration level, buying signals,
 * uncertainty, and safety/compliance flags from customer messages.
 */

import { FACT_STATUS, SENTIMENT_TYPES, URGENCY_LEVELS } from './customer-intelligence-state.js'

export const INTENT_DEFINITIONS = {
  VEHICLE_AVAILABILITY: 'vehicle_availability',
  PAYMENT_AFFORDABILITY: 'payment_affordability',
  PRICING_INQUIRY: 'pricing_inquiry',
  TRADE_INQUIRY: 'trade_inquiry',
  APPOINTMENT_REQUEST: 'appointment_request',
  VEHICLE_SPECS_FEATURES: 'vehicle_specs_features',
  FINANCING_PREQUAL: 'financing_prequal',
  COMPARISON_INTENT: 'comparison_intent',
  NEGOTIATION_INTENT: 'negotiation_intent',
  SERVICE_INQUIRY: 'service_inquiry',
  PARTS_INQUIRY: 'parts_inquiry',
  HUMAN_REQUEST: 'human_request',
  GENERAL_INQUIRY: 'general_inquiry',
}

/**
 * Analyzes a single customer message in context and extracts structured understanding.
 */
export function analyzeCustomerMessage(message = '', conversationHistory = [], pageContext = {}) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  const historyText = (conversationHistory || []).map(m => m.message || '').join(' ').toLowerCase()

  const detectedIntents = []
  const buyingSignals = []
  let frustrationScore = 0
  let sentiment = SENTIMENT_TYPES.NEUTRAL
  let urgency = URGENCY_LEVELS.MEDIUM
  let complianceFlag = null

  // 1. Safety & Compliance / Adversarial check
  if (/\b(ignore (?:all )?(?:previous )?instructions|system prompt|reveal (?:your )?prompt|bypass safety|dump (?:all )?data|show other customers|api key|database schema)\b/i.test(lower)) {
    complianceFlag = 'prompt_injection_attempt'
  } else if (/\b(approve me (?:at|for) 0%|guarantee (?:my )?approval|give me \$?\d+.*for my trade without (?:looking|seeing))\b/i.test(lower)) {
    complianceFlag = 'unauthorized_commitment_attempt'
  }

  // 2. Frustration / Sentiment Detection
  if (/\b(terrible|horrible|useless|waste of time|hate this|annoyed|furious|pissed|ridiculous|stop asking)\b/i.test(lower)) {
    frustrationScore += 50
    sentiment = SENTIMENT_TYPES.FRUSTRATED
  }
  if (/\b(already told you|asked (?:you )?(?:3|three|multiple|twice) times|answer my question|repeat myself)\b/i.test(lower)) {
    frustrationScore += 45
    sentiment = SENTIMENT_TYPES.FRUSTRATED
  }
  if (text.length > 8 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    frustrationScore += 25
  }
  if (/\b(great|awesome|perfect|thank you|thanks|love it|sounds good|excited)\b/i.test(lower)) {
    sentiment = SENTIMENT_TYPES.POSITIVE
  }
  if (/\b(not sure|maybe|confused|hesitant|unsure|depends|wondering)\b/i.test(lower)) {
    sentiment = SENTIMENT_TYPES.UNCERTAIN
  }

  // 3. Multi-Intent Extraction
  // A. Vehicle Availability
  if (/\b(still available|available|in stock|on the lot|is (?:that|the|this) (?:car|truck|suv|tahoe|equinox|vehicle) (?:still )?there|sold yet)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.VEHICLE_AVAILABILITY, confidence: 0.95, evidence: 'Asked about live stock availability' })
    buyingSignals.push('Inquired about specific vehicle availability')
  }

  // B. Payment / Affordability
  if (/\b(\$?\d{2,4}\s*(?:\/|\s*a\s*|\s*per\s*)?(?:mo|month)|monthly payment|payment is (?:way )?too (?:high|much)|payments?|what would (?:my )?payments? be|paying \$?\d+)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.PAYMENT_AFFORDABILITY, confidence: 0.92, evidence: 'Discussed monthly payment target or payment concern' })
    buyingSignals.push('Requested or evaluated monthly payment structure')
  }

  // C. Pricing & Out the Door
  if (/\b(how much|price|cost|msrp|sticker|out the door|best price|fees|discounts?|rebates?)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.PRICING_INQUIRY, confidence: 0.90, evidence: 'Asked for vehicle pricing or out-the-door costs' })
  }

  // D. Trade-in & Equity
  if (/\b(trade|trade-in|trading|my current (?:car|truck|vehicle)|worth for my|owe (?:about )?(?:\$?\d+k? )?(?:on|for) my|payoff|terrain|f-150|civic|silverado|rav4)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.TRADE_INQUIRY, confidence: 0.93, evidence: 'Mentioned trade-in vehicle or current vehicle equity' })
    buyingSignals.push('Disclosed trade-in vehicle or equity situation')
  }

  // E. Appointment / Visit / Test Drive
  if (/\b(test drive|appointment|come in|stop by|see it (?:today|tomorrow|this weekend|in person)|schedule|visit)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.APPOINTMENT_REQUEST, confidence: 0.95, evidence: 'Requested showroom appointment or test drive' })
    buyingSignals.push('Requested on-site test drive or showroom visit')
    urgency = URGENCY_LEVELS.HIGH
  }

  // F. Specs & Features
  if (/\b(leather|sunroof|awd|4wd|4x4|towing|3rd row|third row|engine|mpg|features?|packages?|carfax|history)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.VEHICLE_SPECS_FEATURES, confidence: 0.88, evidence: 'Inquired about specific equipment, features, or vehicle history' })
  }

  // G. Financing & Pre-qualification
  if (/\b(finance|financing|credit|bad credit|bankruptcy|pre-?qual|pre-?approved|apr|interest rate|loan)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.FINANCING_PREQUAL, confidence: 0.92, evidence: 'Asked about financing options, pre-qualification, or credit terms' })
  }

  // H. Comparison Intent
  if (/\b(compare|difference between|versus|vs\.?|or the|better than|shortlist)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.COMPARISON_INTENT, confidence: 0.85, evidence: 'Comparing two vehicles or trims' })
  }

  // I. Negotiation Intent
  if (/\b(take \$\d+|accept \$\d+|lower the price|deal on this|rock bottom|best you can do|negotiate)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.NEGOTIATION_INTENT, confidence: 0.89, evidence: 'Attempting price or deal negotiation' })
  }

  // J. Human / Manager Escalation Request
  if (/\b(speak to (?:a )?(?:human|person|rep|salesperson|agent)|talk to someone|call me|manager|real person)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.HUMAN_REQUEST, confidence: 0.99, evidence: 'Explicit request for human staff' })
    urgency = URGENCY_LEVELS.CRITICAL
  }

  // K. Service / Parts
  if (/\b(service|oil change|brakes|repair|recall|mechanic|schedule service)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.SERVICE_INQUIRY, confidence: 0.92, evidence: 'Service department inquiry' })
  }
  if (/\b(parts?|accessories|tires?|wipers?|battery|part number)\b/i.test(lower)) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.PARTS_INQUIRY, confidence: 0.90, evidence: 'Parts department inquiry' })
  }

  // Fallback if empty
  if (!detectedIntents.length) {
    detectedIntents.push({ intent: INTENT_DEFINITIONS.GENERAL_INQUIRY, confidence: 0.60, evidence: 'General conversational turn' })
  }

  // Urgency check
  if (/\b(today|now|asap|this afternoon|ready to buy|holding deposit)\b/i.test(lower)) {
    urgency = URGENCY_LEVELS.HIGH
    buyingSignals.push('Expressed immediate transaction readiness')
  }

  const primary = detectedIntents[0]
  const secondary = detectedIntents.slice(1)

  return {
    primary_intent: primary.intent,
    primary_confidence: primary.confidence,
    secondary_intents: secondary.map(s => s.intent),
    all_intents: detectedIntents,
    sentiment,
    frustration_score: Math.min(100, frustrationScore),
    urgency,
    buying_signals: buyingSignals,
    compliance_flag: complianceFlag,
    raw_message: text,
  }
}
