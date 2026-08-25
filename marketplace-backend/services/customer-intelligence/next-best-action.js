/**
 * MarketSync Customer Intelligence — Next Best Action & Personalized Opening Script Engine.
 *
 * Translates customer state, buying stage, trade details, and objection status into a single
 * high-impact next operational move and tailored human communication script.
 */

import { BUYING_STAGES } from './customer-intelligence-state.js'

/**
 * Plans the next best operational action and creates the personalized human opening line.
 */
export function planNextBestAction(intelligenceState) {
  const s = intelligenceState || {}
  const id = s.identity || {}
  const v = s.vehicle_interest || {}
  const p = s.purchase_state || {}
  const t = s.trade_state || {}
  const obj = s.objections || {}
  const stage = s.intent?.buying_stage || BUYING_STAGES.DISCOVERY

  const customerName = id.first_name?.value || id.name?.value || 'Shopper'
  const vehicleName = v.primary_vehicle?.value || 'the vehicle you were looking at'
  const budget = p.payment_comfort?.value || p.budget?.value || 'your target budget'
  const tradeName = [t.year?.value, t.make?.value, t.model?.value].filter(Boolean).join(' ')

  let suggestedAction = 'Follow up with customer to confirm vehicle interest and answer questions'
  let suggestedOpening = `Hi ${customerName}, thanks for reaching out to us! I saw you were looking into ${vehicleName}. How can I assist you with your search today?`
  let channel = id.preferred_contact_channel?.value || (id.phone?.value ? 'sms' : 'email')
  let priority = 'normal'

  // 1. Appointment Requested / Action Ready
  if (p.appointment_intent?.value || stage === BUYING_STAGES.ACTION_READY) {
    suggestedAction = 'Confirm appointment date/time and stage vehicle in VIP demonstration bay'
    suggestedOpening = `Hi ${customerName}, this is your sales specialist at the dealership. Avery let me know you’re interested in test driving the ${vehicleName}. I would love to have the keys ready for you—what day and time works best for you?`
    priority = 'urgent'
  }
  // 2. Monthly Payment / Affordability Objection
  else if (obj.active_objections?.some(o => o.type === 'payment_too_high') || p.payment_comfort?.value) {
    suggestedAction = 'Prepare customized payment scenarios (varying down payment & term tiers) within stated budget'
    suggestedOpening = `Hi ${customerName}, I saw you were considering the ${vehicleName} and aiming for around ${budget}. I have put together a few flexible financing structures that fit right in that comfort zone—when is a good time to review them together?`
    priority = 'high'
  }
  // 3. Trade-in Valuation / Appraisal
  else if (t.has_trade?.value && tradeName) {
    suggestedAction = 'Prepare preliminary market valuation range for customer trade-in'
    suggestedOpening = `Hi ${customerName}, Avery mentioned you’re considering trading in your ${tradeName} towards the ${vehicleName}. We have strong buyer demand for pre-owned trades right now and would love to get you top market value for it.`
    priority = 'high'
  }
  // 4. Credit / Financing Concern
  else if (obj.active_objections?.some(o => o.type === 'credit_concern')) {
    suggestedAction = 'Send confidential pre-qualification link and connect with F&I Director'
    suggestedOpening = `Hi ${customerName}, I understand financing terms are top of mind. We work with over 20 prime and subprime lending partners—would it help to do a quick, confidential pre-qualification so you know your exact numbers upfront?`
    priority = 'high'
  }
  // 5. Distance / Out of Town
  else if (obj.active_objections?.some(o => o.type === 'distance_from_dealership')) {
    suggestedAction = 'Record and send HD personalized video walkaround and offer home delivery options'
    suggestedOpening = `Hi ${customerName}, I saw you’re checking out the ${vehicleName} from out of town. I would be happy to record a quick personalized video walkaround showing you every feature before you make the trip!`
    priority = 'normal'
  }

  return {
    suggested_action: suggestedAction,
    suggested_opening_line: suggestedOpening,
    recommended_channel: channel,
    priority,
  }
}
