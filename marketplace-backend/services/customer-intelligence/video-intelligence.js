/**
 * MarketSync Customer Intelligence — Video Intelligence Engine (§364–370, §387–388)
 * 
 * Manages customer-uploaded videos, MarketSync Video lifecycle tracking (sent, viewed),
 * AI-generated video recording briefs for sales reps, and chapter indexing.
 */

export const VIDEO_CHAPTER_TYPES = Object.freeze([
  'EXTERIOR_WALKAROUND',
  'INTERIOR_CABIN',
  'FEATURES_TECH',
  'CONDITION_CLOSEUP',
  'CARGO_TRUNK',
  'ENGINE_STARTUP',
  'PERSONALIZED_GREETING',
  'CLOSING_MESSAGE'
])

/**
 * Generates an AI-assisted video recording brief for a dealership sales rep (§368, §387).
 * 
 * Provides a concise, personalized checklist highlighting exactly what the customer
 * wants to see before visiting the showroom.
 */
export function generateRepVideoBrief(customer = {}, vehicle = {}, intelligenceState = {}) {
  const customerName = customer.name || customer.first_name || 'Customer'
  const vehicleName = vehicle.year && vehicle.make && vehicle.model
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim()
    : 'Requested Vehicle'

  const focusPoints = []
  const concerns = []

  // Extract customer feature/condition inquiries from intelligence state
  if (intelligenceState.inquiries?.cargo || intelligenceState.inquiries?.trunk) {
    focusPoints.push('Rear cargo area / folding seat operation')
  }
  if (intelligenceState.inquiries?.sunroof || intelligenceState.inquiries?.panoramic_roof) {
    focusPoints.push('Panoramic sunroof & headliner condition')
  }
  if (intelligenceState.inquiries?.wheels_tires || intelligenceState.inquiries?.tires) {
    focusPoints.push('Tire tread depth & alloy wheel condition')
  }
  if (intelligenceState.inquiries?.infotainment || intelligenceState.inquiries?.screen) {
    focusPoints.push('Infotainment screen, Apple CarPlay / Android Auto, and backup camera')
  }

  // Default focus points if none explicitly requested
  if (focusPoints.length === 0) {
    focusPoints.push('General exterior walkaround (all 4 panels)')
    focusPoints.push('Interior front & rear seating condition')
    focusPoints.push('Odometer startup & instrument cluster')
  }

  // Main customer concern / objection context
  const primaryObjection = intelligenceState.primary_objection || intelligenceState.objections?.[0]
  if (primaryObjection) {
    concerns.push(`Customer concern: ${primaryObjection.label || primaryObjection.type} (${primaryObjection.details || 'pre-visit reassurance'})`)
  }
  if (intelligenceState.travel_distance_minutes) {
    concerns.push(`Customer driving ${intelligenceState.travel_distance_minutes} minutes — emphasize verified condition so trip is confident`)
  }

  const checklist = focusPoints.map((item, idx) => ({
    step: idx + 1,
    title: item,
    suggested_duration_sec: 10,
    status: 'PENDING'
  }))

  return {
    brief_id: `brief_${Date.now()}`,
    customer: {
      name: customerName,
      id: customer.id || null
    },
    vehicle: {
      label: vehicleName,
      stock_number: vehicle.stock_number || null,
      vin: vehicle.vin || null
    },
    recommended_duration_seconds: '60–90 seconds',
    key_focus_areas: focusPoints,
    customer_context_notes: concerns.length > 0 ? concerns : ['Customer requested a personalized walkthrough video before their appointment.'],
    recording_checklist: checklist,
    suggested_opening: `Hi ${customerName}, this is [Your Name] from [Dealership]. Here is a quick personalized walkaround of the ${vehicleName} you were looking at...`,
    created_at: new Date().toISOString()
  }
}

/**
 * Indexes chapters/metadata for a recorded or customer video (§369).
 */
export function indexVideoChapters(videoMetadata = {}) {
  const rawChapters = Array.isArray(videoMetadata.chapters) ? videoMetadata.chapters : []

  const indexedChapters = rawChapters.map(chap => ({
    chapter_id: chap.id || `chap_${Math.random().toString(36).slice(2, 7)}`,
    type: chap.type || 'EXTERIOR_WALKAROUND',
    title: chap.title || 'Walkaround',
    start_time_seconds: Number(chap.start_time || 0),
    end_time_seconds: Number(chap.end_time || 0),
    key_features_shown: Array.isArray(chap.features) ? chap.features : [],
    condition_notes: chap.notes || null
  }))

  return {
    video_id: videoMetadata.video_id || `vid_${Date.now()}`,
    total_duration_seconds: Number(videoMetadata.duration || 0),
    chapters: indexedChapters,
    indexed_at: new Date().toISOString()
  }
}

/**
 * Tracks MarketSync Video lifecycle events (§366, §370).
 */
export function trackVideoLifecycle(currentState = {}, event = {}) {
  const state = JSON.parse(JSON.stringify(currentState))
  state.videos = state.videos || []

  const eventType = event.type // 'REQUESTED', 'SENT', 'VIEWED'
  const videoId = event.video_id

  let existing = state.videos.find(v => v.video_id === videoId)
  if (!existing) {
    existing = {
      video_id: videoId,
      vehicle_id: event.vehicle_id || null,
      vehicle_label: event.vehicle_label || null,
      sender_staff_id: event.sender_staff_id || null,
      status: 'CREATED',
      requested_at: null,
      sent_at: null,
      viewed_at: null,
      view_count: 0
    }
    state.videos.push(existing)
  }

  if (eventType === 'REQUESTED') {
    existing.status = 'REQUESTED'
    existing.requested_at = event.timestamp || new Date().toISOString()
  } else if (eventType === 'SENT') {
    existing.status = 'SENT'
    existing.sent_at = event.timestamp || new Date().toISOString()
  } else if (eventType === 'VIEWED') {
    existing.status = 'VIEWED'
    existing.viewed_at = event.timestamp || new Date().toISOString()
    existing.view_count = (existing.view_count || 0) + 1
  }

  return state
}

/**
 * Drafts accompanying SMS/Email for sales rep after video is recorded (§388).
 */
export function draftVideoResponseNotification(customer = {}, vehicle = {}, videoDetails = {}) {
  const customerName = customer.first_name || customer.name || 'there'
  const vehicleName = vehicle.year && vehicle.model ? `${vehicle.year} ${vehicle.model}` : 'the vehicle'

  const smsText = `Hi ${customerName}, here is the personalized video walkaround of the ${vehicleName} you asked to see: ${videoDetails.watch_url || 'https://marketsync.link/v/demo'}. Let me know what you think!`

  const emailSubject = `Personalized Video Walkaround: ${vehicleName}`
  const emailBody = `Hi ${customerName},\n\nI just recorded a quick walkthrough of the ${vehicleName} showing the key features and condition you asked about.\n\nYou can view the video here: ${videoDetails.watch_url || 'https://marketsync.link/v/demo'}\n\nPlease let me know if you have any questions or if you'd like to arrange a test drive!\n\nBest regards,\n[Sales Team]`

  return {
    customer_id: customer.id || null,
    vehicle_label: vehicleName,
    draft_sms: smsText,
    draft_email: {
      subject: emailSubject,
      body: emailBody
    },
    requires_rep_approval: true
  }
}
