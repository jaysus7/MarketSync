/**
 * MarketSync Customer Intelligence — Multimodal Memory & Timeline Continuity (§371–377, §396–398, §413–415, §420, §422, §425)
 * 
 * Unifies all modalities (Text, Voice, Images, Documents, Videos, Tool Events)
 * into a single canonical customer memory and timeline.
 * 
 * Supports:
 * - Evidence-linked structured facts
 * - Cross-channel continuity (Voice <-> Chat <-> SMS <-> Email)
 * - Dropped-call SMS recovery
 * - Form pre-fill and abandonment recovery
 * - Comprehensive Pre-Appointment Multimodal Lead Brief for sales reps
 * - Contextual media search
 * - Scoped access and retention management
 */

export const MULTIMODAL_EVENT_TYPES = Object.freeze({
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_PROCESSED: 'media.processed',
  TRADE_PHOTO_RECEIVED: 'trade.photo_received',
  TRADE_PHOTO_SET_COMPLETE: 'trade.photo_set_complete',
  CUSTOMER_VIDEO_UPLOADED: 'customer.video_uploaded',
  CUSTOMER_DOCUMENT_UPLOADED: 'customer.document_uploaded',
  VIDEO_SENT: 'video.sent',
  VIDEO_VIEWED: 'video.viewed',
  VOICE_CALL_STARTED: 'voice.call_started',
  VOICE_CALL_COMPLETED: 'voice.call_completed',
  DROPPED_CALL_SMS_INITIATED: 'voice.dropped_call_sms_sent',
  FORM_ABANDONED: 'form.abandoned',
  SECURE_FORM_COMPLETED: 'form.secure_submitted'
})

/**
 * Adds an evidence-based multimodal observation to customer state (§371–372, §420).
 */
export function recordMultimodalMemoryFact(state = {}, fact = {}) {
  const updated = JSON.parse(JSON.stringify(state))
  updated.multimodal_memory = updated.multimodal_memory || []

  const memoryItem = {
    fact_id: fact.id || `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category: fact.category || 'GENERAL', // 'TRADE_MILEAGE', 'CONDITION_DAMAGE', 'FINANCE_QUOTE', 'WARNING_LIGHT', etc.
    label: fact.label || 'Observation',
    value: fact.value,
    evidence_media_id: fact.evidence_media_id || null,
    source_type: fact.source_type || 'AI_OBSERVED', // 'CUSTOMER_STATED', 'AI_OBSERVED', 'SYSTEM_VERIFIED', 'HUMAN_VERIFIED'
    confidence: Number(fact.confidence || 0.85),
    verification_status: fact.verification_status || 'OBSERVED_UNCONFIRMED',
    is_stale: false,
    recorded_at: new Date().toISOString(),
    expires_at: fact.expires_at || null
  }

  // Update existing fact if matching category
  const existingIdx = updated.multimodal_memory.findIndex(m => m.category === memoryItem.category)
  if (existingIdx >= 0) {
    updated.multimodal_memory[existingIdx] = memoryItem
  } else {
    updated.multimodal_memory.push(memoryItem)
  }

  return updated
}

/**
 * Human Media Verification (§421).
 * Allows sales rep, appraiser, or tech to confirm or adjust an AI observation.
 */
export function verifyMultimodalFactByHuman(state = {}, factId, verification = {}) {
  const updated = JSON.parse(JSON.stringify(state))
  updated.multimodal_memory = updated.multimodal_memory || []

  const target = updated.multimodal_memory.find(f => f.fact_id === factId)
  if (target) {
    target.verification_status = verification.is_approved ? 'HUMAN_VERIFIED' : 'HUMAN_REJECTED'
    target.source_type = 'HUMAN_VERIFIED'
    target.verified_by_staff_id = verification.staff_id || null
    target.verified_at = new Date().toISOString()
    if (verification.adjusted_value !== undefined) {
      target.original_ai_value = target.value
      target.value = verification.adjusted_value
    }
  }

  return updated
}

/**
 * Appends a canonical multimodal event to the timeline (§415).
 */
export function appendMultimodalTimelineEvent(timeline = [], event = {}) {
  const newTimeline = Array.isArray(timeline) ? [...timeline] : []
  
  const timelineItem = {
    event_id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: event.type || MULTIMODAL_EVENT_TYPES.MEDIA_UPLOADED,
    channel: event.channel || 'web_chat',
    summary: event.summary || 'Customer interaction event',
    media_ref: event.media_id || null,
    actor: event.actor || 'CUSTOMER',
    payload: { ...event.payload },
    timestamp: event.timestamp || new Date().toISOString()
  }

  newTimeline.push(timelineItem)
  return newTimeline
}

/**
 * Generates Dropped-Call Continuity recovery message (§398).
 */
export function handleDroppedCallRecovery(session = {}, consentState = {}) {
  if (!session.caller_phone) {
    return { can_send_sms: false, reason: 'NO_PHONE_AVAILABLE' }
  }
  if (consentState.may_send_sms === false) {
    return { can_send_sms: false, reason: 'SMS_CONSENT_NOT_AVAILABLE' }
  }

  const vehicleContext = session.current_vehicle_ref ? ` regarding the ${session.current_vehicle_ref}` : ''
  const smsBody = `Hi, looks like our call was disconnected! I have our notes saved${vehicleContext}. Feel free to text me right here if that's easier, or let me know if you'd like a call back.`

  return {
    can_send_sms: true,
    target_phone: session.caller_phone,
    sms_body: smsBody,
    recovery_event: {
      type: MULTIMODAL_EVENT_TYPES.DROPPED_CALL_SMS_INITIATED,
      channel: 'sms',
      summary: 'Dropped call SMS continuity message sent'
    }
  }
}

/**
 * Generates Cross-Channel Context Recognition Greeting (§397).
 */
export function generateCrossChannelRecognitionGreeting(customer = {}, lastChannel = 'voice', relationshipContext = {}) {
  const customerName = customer.first_name || customer.name || ''
  const vehicle = relationshipContext.vehicle_of_interest || ''
  const trade = relationshipContext.trade_vehicle || ''

  if (vehicle && trade) {
    return `Hi ${customerName ? customerName + ', ' : ''}welcome back! Earlier you were asking about the ${vehicle} and your ${trade} trade. Would you like to pick up where we left off?`
  }
  if (vehicle) {
    return `Hi ${customerName ? customerName + ', ' : ''}welcome back! Would you like to continue looking at the ${vehicle}?`
  }

  return `Welcome back ${customerName ? customerName : ''}! How can I help you today?`
}

/**
 * Form Abandonment Context Generator (§413–414).
 */
export function generateFormAbandonmentAssistance(formContext = {}, customer = {}) {
  const formType = formContext.type || 'TRADE_APPRAISAL' // 'TRADE_APPRAISAL', 'FINANCE_APP', 'SERVICE_BOOKING'
  const filledFields = formContext.filled_fields || {}

  let assistanceMessage = ''
  if (formType === 'TRADE_APPRAISAL') {
    const car = filledFields.make && filledFields.model ? `${filledFields.year || ''} ${filledFields.make} ${filledFields.model}`.trim() : 'your vehicle'
    assistanceMessage = `I noticed you started a trade estimate for ${car}. Would you like me to help you complete that or answer any quick questions?`
  } else if (formType === 'FINANCE_APP') {
    assistanceMessage = 'Need any help with your finance application? I can answer questions about terms or rates whenever you are ready.'
  } else {
    assistanceMessage = 'Need help finishing your request? I can help you complete the details right here.'
  }

  return {
    form_type: formType,
    prefill_data: filledFields,
    assistance_message: assistanceMessage,
    abandoned_at: new Date().toISOString()
  }
}

/**
 * Pre-Appointment Multimodal Lead Brief for Sales Rep (§377, §422, §425).
 */
export function generateMultimodalLeadBrief(customer = {}, intelligenceState = {}) {
  const customerName = customer.name || customer.first_name || 'Customer'
  const tradePhotos = intelligenceState.trade_photo_workflow?.photo_slots || {}
  const tradePhotoCount = Object.values(tradePhotos).filter(s => s.status === 'RECEIVED').length

  const tradeObservation = intelligenceState.multimodal_memory?.find(m => m.category === 'TRADE_MILEAGE')
  const tradeMileage = tradeObservation ? tradeObservation.value : 'Not provided'

  const videoHistory = intelligenceState.videos || []
  const sentVideo = videoHistory.find(v => v.status === 'SENT' || v.status === 'VIEWED')

  const competitorQuote = intelligenceState.multimodal_memory?.find(m => m.category === 'COMPETITOR_QUOTE')

  const appointment = intelligenceState.appointment || { date: 'Saturday', time: '10:30 AM' }

  return {
    lead_id: customer.id || `lead_${Date.now()}`,
    customer_name: customerName,
    summary_header: `Pre-Appointment Multimodal Brief: ${customerName}`,
    trade_section: {
      vehicle: intelligenceState.trade_vehicle || 'Trade vehicle',
      verified_mileage: tradeMileage,
      photos_received_count: tradePhotoCount,
      advisory_condition: intelligenceState.multimodal_memory
        ?.filter(m => m.category.includes('CONDITION') || m.category.includes('DAMAGE'))
        .map(m => m.value) || ['No visible body damage reported']
    },
    video_section: {
      walkaround_sent: Boolean(sentVideo),
      viewed_by_customer: sentVideo?.status === 'VIEWED' || false,
      video_title: sentVideo?.vehicle_label || 'Vehicle Walkaround'
    },
    competitor_section: competitorQuote ? {
      uploaded: true,
      summary: competitorQuote.value,
      verification: competitorQuote.verification_status
    } : { uploaded: false },
    appointment_details: appointment,
    recommended_sales_opening: `Hi ${customerName}, thanks for coming in! I've reviewed your trade photos and have the ${intelligenceState.vehicle_of_interest || 'vehicle'} pulled up and ready for your test drive.`
  }
}

/**
 * Contextual Media Search (§376, §423).
 */
export function searchCustomerMedia(customerState = {}, query = '') {
  const memory = customerState.multimodal_memory || []
  const term = String(query || '').toLowerCase()

  const matches = memory.filter(item => {
    return String(item.category).toLowerCase().includes(term) ||
           String(item.label).toLowerCase().includes(term) ||
           String(item.value).toLowerCase().includes(term)
  })

  return {
    query,
    total_found: matches.length,
    results: matches
  }
}
