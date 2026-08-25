/**
 * MarketSync Customer Intelligence — Rich Response Orchestrator (§380–382, §404–407, §412)
 * 
 * Selects approved interactive UI presentation components, optimizes modality selection
 * (Video, Document, Chat, Voice, Appointment Picker, Trade Flow), and computes
 * Multimodal Next-Best-Action utility.
 */

export const APPROVED_COMPONENTS = Object.freeze({
  TEXT: 'TEXT',
  QUICK_REPLIES: 'QUICK_REPLIES',
  VEHICLE_CARD: 'VEHICLE_CARD',
  VEHICLE_COMPARISON: 'VEHICLE_COMPARISON',
  VIDEO_PLAYER: 'VIDEO_PLAYER',
  DOCUMENT_VIEWER: 'DOCUMENT_VIEWER',
  APPOINTMENT_PICKER: 'APPOINTMENT_PICKER',
  TRADE_PHOTO_REQUEST: 'TRADE_PHOTO_REQUEST',
  CONTACT_CAPTURE: 'CONTACT_CAPTURE',
  SECURE_LINK_CARD: 'SECURE_LINK_CARD',
  SERVICE_APPROVAL_CARD: 'SERVICE_APPROVAL_CARD'
})

export const MULTIMODAL_ACTIONS = Object.freeze({
  ANSWER_TEXT: 'ANSWER_TEXT',
  SHOW_VEHICLE_CARD: 'SHOW_VEHICLE_CARD',
  SHOW_COMPARISON: 'SHOW_COMPARISON',
  REQUEST_TRADE_PHOTOS: 'REQUEST_TRADE_PHOTOS',
  REQUEST_DOCUMENT: 'REQUEST_DOCUMENT',
  SEND_WALKAROUND_VIDEO: 'SEND_WALKAROUND_VIDEO',
  REQUEST_HUMAN_VIDEO: 'REQUEST_HUMAN_VIDEO',
  LAUNCH_APPOINTMENT_PICKER: 'LAUNCH_APPOINTMENT_PICKER',
  START_TRADE_FLOW: 'START_TRADE_FLOW',
  SEND_SECURE_LINK: 'SEND_SECURE_LINK',
  OFFER_VOICE_CALL: 'OFFER_VOICE_CALL',
  HUMAN_STAFF_HANDOFF: 'HUMAN_STAFF_HANDOFF'
})

/**
 * Builds a structured rich response container (§381).
 */
export function buildRichResponse(type, data = {}, messageText = '') {
  const componentType = APPROVED_COMPONENTS[type] || APPROVED_COMPONENTS.TEXT

  return {
    response_id: `resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    component_type: componentType,
    text_content: messageText || data.text || '',
    component_payload: { ...data },
    created_at: new Date().toISOString()
  }
}

/**
 * Multimodal Next-Best-Action Utility Scorer (§404).
 * 
 * Utility = (CustomerValue * 0.3) + (BusinessValue * 0.3) + (Trust * 0.2) + (Confidence * 0.2) - (Friction * 0.3)
 */
export function scoreMultimodalAction(actionType, context = {}) {
  let customerValue = 50
  let businessValue = 50
  let friction = 20
  let trust = 80
  let confidence = context.confidence || 0.85

  switch (actionType) {
    case MULTIMODAL_ACTIONS.SEND_WALKAROUND_VIDEO:
      if (context.has_condition_concern || context.customer_distance_high) {
        customerValue = 95
        businessValue = 90
        friction = 10
        trust = 95
      } else {
        customerValue = 60
        businessValue = 65
        friction = 25
      }
      break

    case MULTIMODAL_ACTIONS.REQUEST_TRADE_PHOTOS:
      if (context.customer_stated_trade) {
        customerValue = 85
        businessValue = 90
        friction = 35 // Taking photos has some friction, so only suggest when helpful
        trust = 85
      } else {
        customerValue = 20
        businessValue = 40
        friction = 75
      }
      break

    case MULTIMODAL_ACTIONS.LAUNCH_APPOINTMENT_PICKER:
      if (context.has_high_purchase_intent || context.asked_for_test_drive) {
        customerValue = 95
        businessValue = 98
        friction = 15
        trust = 90
      } else {
        customerValue = 40
        businessValue = 60
        friction = 40
      }
      break

    case MULTIMODAL_ACTIONS.SHOW_COMPARISON:
      if (context.uploaded_competitor_quote || context.comparing_vehicles) {
        customerValue = 90
        businessValue = 85
        friction = 10
        trust = 92
      } else {
        customerValue = 40
        businessValue = 40
        friction = 20
      }
      break

    case MULTIMODAL_ACTIONS.SEND_SECURE_LINK:
      if (context.requires_credit_or_sensitive_info) {
        customerValue = 90
        businessValue = 90
        friction = 20
        trust = 98
      } else {
        customerValue = 30
        businessValue = 30
        friction = 50
      }
      break

    default: // ANSWER_TEXT
      customerValue = 70
      businessValue = 60
      friction = 5
      trust = 80
      break
  }

  const netScore = (customerValue * 0.30) + (businessValue * 0.30) + (trust * 0.20) + (confidence * 100 * 0.20) - (friction * 0.30)

  return {
    action: actionType,
    score: Math.round(netScore * 10) / 10,
    dimensions: {
      customer_value: customerValue,
      business_value: businessValue,
      trust,
      confidence,
      friction
    }
  }
}

/**
 * Optimizes Modality & Channel Selection (§405–407).
 */
export function selectOptimalModality(customerNeed = '', context = {}) {
  const need = String(customerNeed).toLowerCase()

  // 1. Condition concern -> Personalized Video
  if (need.includes('condition') || need.includes('scratch') || need.includes('cargo space') || need.includes('walkaround')) {
    return {
      optimal_modality: 'VIDEO',
      recommended_action: MULTIMODAL_ACTIONS.SEND_WALKAROUND_VIDEO,
      rationale: 'Customer expressed visual or vehicle condition concern; a personalized walkaround video provides the highest trust and clarity.'
    }
  }

  // 2. Complex numeric details or competitor quote -> Structured comparison / Document
  if (need.includes('competitor') || need.includes('quote') || need.includes('numbers') || need.includes('breakdown')) {
    return {
      optimal_modality: 'COMPARISON_CARD',
      recommended_action: MULTIMODAL_ACTIONS.SHOW_COMPARISON,
      rationale: 'Customer is analyzing pricing and equipment differences; a structured comparison card reduces cognitive load.'
    }
  }

  // 3. Trade valuation -> Guided Trade Photo Flow
  if (need.includes('trade') || need.includes('appraisal')) {
    return {
      optimal_modality: 'TRADE_PHOTO_FLOW',
      recommended_action: MULTIMODAL_ACTIONS.REQUEST_TRADE_PHOTOS,
      rationale: 'Customer wants trade value; guided photo collection accelerates real appraiser valuation.'
    }
  }

  // 4. Test drive or showroom visit -> Interactive Appointment Picker
  if (need.includes('test drive') || need.includes('visit') || need.includes('appointment') || need.includes('see it in person')) {
    return {
      optimal_modality: 'APPOINTMENT_PICKER',
      recommended_action: MULTIMODAL_ACTIONS.LAUNCH_APPOINTMENT_PICKER,
      rationale: 'Customer has visit intent; interactive slot picker lets them select live available time.'
    }
  }

  // Default: Instant Interactive Chat
  return {
    optimal_modality: 'TEXT_CHAT',
    recommended_action: MULTIMODAL_ACTIONS.ANSWER_TEXT,
    rationale: 'Standard conversational resolution.'
  }
}

/**
 * Visual Website Context Adapter (§412).
 * Formats initial conversation context based on which website component triggered the AI.
 */
export function adaptWebsiteLauncherContext(launcher = {}) {
  const component = launcher.component_type || 'default_fab' // 'inventory_vdp_card', 'finance_calc', 'service_banner', 'trade_cta'
  const payload = launcher.payload || {}

  switch (component) {
    case 'inventory_vdp_card':
      return {
        initial_topic: 'VEHICLE_INQUIRY',
        referenced_vehicle: {
          stock_number: payload.stock_number || null,
          year_make_model: payload.vehicle_title || null,
          price: payload.price || null
        },
        suggested_welcome: `Hi there! I see you are looking at the ${payload.vehicle_title || 'vehicle'}. Would you like to check its availability, see options, or schedule a test drive?`
      }

    case 'finance_calculator':
      return {
        initial_topic: 'FINANCE_ESTIMATION',
        calc_inputs: {
          down_payment: payload.down_payment || null,
          term_months: payload.term || null,
          estimated_monthly: payload.monthly_estimate || null
        },
        suggested_welcome: 'Hi! I can help answer questions about lease or finance payment options, current manufacturer rates, or available rebates.'
      }

    case 'trade_cta':
      return {
        initial_topic: 'TRADE_APPRAISAL',
        suggested_welcome: "Hi! Looking to see what your current vehicle is worth? What year, make, and model are you driving?"
      }

    case 'service_banner':
      return {
        initial_topic: 'SERVICE_BOOKING',
        suggested_welcome: 'Hello! I can help you schedule maintenance, check tire offers, or connect with our service team.'
      }

    default:
      return {
        initial_topic: 'GENERAL_ASSISTANCE',
        suggested_welcome: 'Hi! Welcome to our dealership. How can I assist you today?'
      }
  }
}
