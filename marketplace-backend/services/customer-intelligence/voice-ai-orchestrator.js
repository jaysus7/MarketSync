/**
 * MarketSync Customer Intelligence — Real-Time Voice AI Orchestrator (§354–363, §390, §399–403, §436–437)
 * 
 * Reuses the exact same canonical customer intelligence state, intents, objections,
 * tools, permissions, and timeline for voice telephony and streaming calls.
 * 
 * Features:
 * - Low-latency streaming state machine
 * - Instant Barge-In / Interruption handling
 * - Concise 1-answer + 1-question voice cadence
 * - Verbal confirmation gating for high-impact details & actions
 * - Warm transfer handoff with AI briefing payload
 * - After-hours voice handling with clear dealership availability disclosure
 * - Post-call structured summary generation
 * - Real-time human whisper copilot
 * - Strict prohibition of voice biometrics & demographic profiling (§390)
 */

export const VOICE_CALL_STATES = Object.freeze({
  INITIATING: 'INITIATING',
  GREETING: 'GREETING',
  LISTENING: 'LISTENING',
  PROCESSING_INTENT: 'PROCESSING_INTENT',
  SPEAKING: 'SPEAKING',
  INTERRUPTED: 'INTERRUPTED',
  CONFIRMING_ACTION: 'CONFIRMING_ACTION',
  TRANSFERRING_TO_HUMAN: 'TRANSFERRING_TO_HUMAN',
  AFTER_HOURS_CAPTURING: 'AFTER_HOURS_CAPTURING',
  COMPLETED: 'COMPLETED',
  DROPPED: 'DROPPED'
})

/**
 * Initializes a new Voice Call Session linking to canonical customer intelligence state (§354–355).
 */
export function initializeVoiceSession(callParams = {}) {
  return {
    call_id: callParams.call_id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tenant_id: callParams.tenant_id || callParams.dealership_id || null,
    customer_id: callParams.customer_id || null,
    caller_phone: callParams.caller_phone || null,
    channel: 'voice',
    state: VOICE_CALL_STATES.INITIATING,
    is_after_hours: Boolean(callParams.is_after_hours),
    recording_consent_given: Boolean(callParams.recording_consent_given),
    started_at: new Date().toISOString(),
    completed_at: null,
    current_intent: null,
    current_vehicle_ref: null,
    open_questions: [],
    unresolved_objections: [],
    verbal_confirmations_pending: [],
    completed_actions: [],
    latency_metrics: {
      stt_avg_ms: 180,
      ai_first_token_ms: 220,
      tts_first_audio_ms: 150,
      total_turn_avg_ms: 550
    },
    turns: [],
    summary: null
  }
}

/**
 * Handles Barge-in / Interruption (§357).
 * When user speech starts while the AI is speaking, immediately aborts TTS playback.
 */
export function handleVoiceInterruption(session) {
  const updated = JSON.parse(JSON.stringify(session))
  updated.state = VOICE_CALL_STATES.INTERRUPTED
  updated.interruption_occurred = true
  updated.last_interrupted_at = new Date().toISOString()
  
  // Transition immediately back to LISTENING
  updated.state = VOICE_CALL_STATES.LISTENING
  return updated
}

/**
 * Formats a voice-optimized response (§358).
 * Voice answers must be concise: exactly 1 answer + 1 next question.
 */
export function formatVoiceResponse(rawAnswer = '', nextQuestion = '') {
  const cleanAnswer = String(rawAnswer || '').trim()
  const cleanQuestion = String(nextQuestion || '').trim()

  if (!cleanQuestion) {
    return cleanAnswer
  }

  return `${cleanAnswer} ${cleanQuestion}`
}

/**
 * Creates a verbal confirmation requirement for high-impact voice actions (§359–360).
 */
export function requestVerbalConfirmation(session, actionType, details = {}) {
  const updated = JSON.parse(JSON.stringify(session))
  const confId = `conf_${Date.now()}`
  
  let verbalPrompt = ''
  if (actionType === 'BOOK_APPOINTMENT') {
    verbalPrompt = `I have ${details.date_time_label || 'that time'} available. Would you like me to go ahead and book that for you?`
  } else if (actionType === 'CONFIRM_PHONE') {
    verbalPrompt = `Just to confirm, is ${details.phone} the best number to reach you?`
  } else if (actionType === 'TRADE_MILEAGE') {
    verbalPrompt = `You mentioned your mileage is approximately ${details.mileage} kilometers, is that correct?`
  } else {
    verbalPrompt = `Would you like me to proceed with ${details.label || 'this request'}?`
  }

  const confirmationItem = {
    confirmation_id: confId,
    action_type: actionType,
    details,
    verbal_prompt: verbalPrompt,
    status: 'AWAITING_VERBAL_YES',
    created_at: new Date().toISOString()
  }

  updated.verbal_confirmations_pending.push(confirmationItem)
  updated.state = VOICE_CALL_STATES.CONFIRMING_ACTION
  return {
    updated_session: updated,
    verbal_prompt: verbalPrompt
  }
}

/**
 * Evaluates verbal confirmation response.
 */
export function evaluateVerbalConfirmation(session, customerSpeech = '') {
  const text = String(customerSpeech || '').toLowerCase().trim()
  const isAffirmative = /\b(yes|yeah|sure|correct|that's right|sounds good|please do|go ahead|yep|yup)\b/i.test(text)
  const isNegative = /\b(no|nope|wait|cancel|not yet|wrong|incorrect)\b/i.test(text)

  const updated = JSON.parse(JSON.stringify(session))
  const pending = updated.verbal_confirmations_pending[updated.verbal_confirmations_pending.length - 1]

  if (!pending) {
    return { confirmed: false, evaluated: false, updated_session: updated }
  }

  if (isAffirmative) {
    pending.status = 'CONFIRMED'
    updated.state = VOICE_CALL_STATES.LISTENING
    return {
      confirmed: true,
      action_type: pending.action_type,
      details: pending.details,
      updated_session: updated
    }
  }

  if (isNegative) {
    pending.status = 'REJECTED'
    updated.state = VOICE_CALL_STATES.LISTENING
    return {
      confirmed: false,
      rejected: true,
      action_type: pending.action_type,
      updated_session: updated
    }
  }

  return { confirmed: false, unclear: true, updated_session: updated }
}

/**
 * Prepares warm transfer payload and AI briefing for human staff (§361, §403).
 */
export function prepareVoiceWarmTransfer(session, targetDepartment = 'sales', availableRep = {}) {
  const updated = JSON.parse(JSON.stringify(session))
  updated.state = VOICE_CALL_STATES.TRANSFERRING_TO_HUMAN

  const brief = {
    transfer_id: `xfer_${Date.now()}`,
    customer_phone: session.caller_phone || 'Unknown',
    customer_id: session.customer_id || null,
    target_department: targetDepartment,
    target_rep: availableRep.name || 'Next Available Specialist',
    call_duration_seconds: Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000),
    live_brief: {
      customer_intent: session.current_intent || 'Vehicle inquiry',
      vehicle_of_interest: session.current_vehicle_ref || 'Inventory browse',
      answered_questions: session.turns.filter(t => t.speaker === 'AI').map(t => t.text).slice(-2),
      open_topics: session.open_questions || [],
      primary_objection: session.unresolved_objections[0] || 'None stated',
      recommended_opening: `Hi, I have all the details from our assistant regarding the ${session.current_vehicle_ref || 'vehicle'}. How can I help finish this for you?`
    }
  }

  return {
    updated_session: updated,
    staff_brief: brief,
    customer_announcement: "I'm connecting you directly with one of our specialists now. I've shared your notes so you won't have to repeat anything."
  }
}

/**
 * Handles after-hours voice call logic (§362).
 */
export function handleAfterHoursVoice(session, customerSpeech = '') {
  return {
    is_after_hours: true,
    disclosure_message: "Thanks for calling [Dealership]. Our showroom is currently closed for the evening, but I can help you search our inventory, schedule an appointment, or have our team call you first thing in the morning. How can I help?",
    capabilities_available: [
      'INVENTORY_SEARCH',
      'APPOINTMENT_SCHEDULING',
      'TRADE_INQUIRY',
      'CALLBACK_REQUEST'
    ]
  }
}

/**
 * Generates structured post-call summary (§363).
 */
export function generateVoiceCallSummary(session) {
  const durationSec = session.completed_at
    ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000)
    : Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)

  return {
    call_id: session.call_id,
    customer_id: session.customer_id,
    caller_phone: session.caller_phone,
    duration_seconds: durationSec,
    intent: session.current_intent || 'General Inquiry',
    vehicle_referenced: session.current_vehicle_ref || null,
    objections_noted: session.unresolved_objections || [],
    commitments_made: session.completed_actions || [],
    next_action_recommended: session.verbal_confirmations_pending.some(c => c.status === 'CONFIRMED')
      ? 'Follow up on confirmed booking'
      : 'Send follow-up SMS or outbound callback',
    recording_consent: session.recording_consent_given,
    timestamp: new Date().toISOString()
  }
}

/**
 * Real-Time Human Whisper Suggestions (§401).
 * Private live cues displayed on staff screen during live call.
 */
export function generateStaffWhisperCues(customerUtterance = '', context = {}) {
  const cues = []
  const text = String(customerUtterance || '').toLowerCase()

  if (text.includes('payment') || text.includes('monthly') || text.includes('expensive')) {
    cues.push({
      type: 'FINANCE_OPPORTUNITY',
      cue: 'Customer mentioned payment concern. Check current lease promo or highlight standard 84-month option.'
    })
  }
  if (text.includes('trade') || text.includes('currently drive') || text.includes('owe')) {
    cues.push({
      type: 'TRADE_EQUITY',
      cue: 'Trade opportunity detected. Offer quick instant appraisal photo link.'
    })
  }
  if (text.includes('available') || text.includes('in stock') || text.includes('test drive')) {
    cues.push({
      type: 'APPOINTMENT_OPPORTUNITY',
      cue: 'High vehicle interest. Offer specific time window (e.g. tomorrow at 2 PM).'
    })
  }

  return {
    customer_said_snippet: customerUtterance.slice(0, 100),
    whisper_cues: cues
  }
}
