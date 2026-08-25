/**
 * MarketSync Customer Intelligence — Service Multimodal Engine (§346–347, §426–428)
 * 
 * Handles service customer media intake (photos, audio recordings of vehicle noises, inspection videos),
 * pre-visit technician briefing packets, and interactive service approval cards.
 */

export const SERVICE_MEDIA_TYPES = Object.freeze({
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  AUDIO_RECORDING: 'AUDIO_RECORDING'
})

export const ACOUSTIC_NOISE_TYPES = Object.freeze({
  BRAKE_SQUEAL_GRIND: 'BRAKE_SQUEAL_GRIND',
  METALLIC_RATTLE: 'METALLIC_RATTLE',
  ENGINE_TICK_KNOCK: 'ENGINE_TICK_KNOCK',
  SUSPENSION_CLUNK: 'SUSPENSION_CLUNK',
  WHINE_HUM: 'WHINE_HUM',
  UNIDENTIFIED_NOISE: 'UNIDENTIFIED_NOISE'
})

/**
 * Summarizes customer-recorded vehicle noise / audio (§347).
 * Strictly emphasizes that acoustic observation is advisory and not a definitive diagnosis.
 */
export function summarizeAcousticServiceConcern(audioMetadata = {}, customerDescription = '') {
  const desc = String(customerDescription || '').toLowerCase()
  let noiseType = ACOUSTIC_NOISE_TYPES.UNIDENTIFIED_NOISE
  let generalSummary = 'Customer provided an audio recording of an abnormal vehicle noise.'

  if (desc.includes('brake') || desc.includes('squeak') || desc.includes('grind')) {
    noiseType = ACOUSTIC_NOISE_TYPES.BRAKE_SQUEAL_GRIND
    generalSummary = 'Customer reports high-pitched squeal or grinding when applying brakes.'
  } else if (desc.includes('turn') || desc.includes('rattle') || desc.includes('metallic')) {
    noiseType = ACOUSTIC_NOISE_TYPES.METALLIC_RATTLE
    generalSummary = 'Customer reports intermittent metallic rattle during turns or over bumps.'
  } else if (desc.includes('engine') || desc.includes('tick') || desc.includes('knock')) {
    noiseType = ACOUSTIC_NOISE_TYPES.ENGINE_TICK_KNOCK
    generalSummary = 'Customer reports repetitive clicking or ticking noise from engine compartment on startup.'
  }

  return {
    concern_id: `concern_${Date.now()}`,
    media_id: audioMetadata.attachment_id || null,
    noise_category: noiseType,
    customer_stated_description: customerDescription,
    ai_concern_summary: generalSummary,
    duration_seconds: audioMetadata.duration_seconds || null,
    is_definitive_diagnosis: false,
    truthfulness_guardrail: 'ADVISORY ACOUSTIC SUMMARY ONLY: Technicians must perform physical inspection; do not promise exact repair cause or parts remotely.',
    timestamp: new Date().toISOString()
  }
}

/**
 * Generates Service Pre-Visit Intelligence Payload for Advisors & Technicians (§426).
 */
export function generateServiceAdvisorBrief(appointment = {}, vehicle = {}, concerns = []) {
  return {
    advisor_packet_id: `adv_${Date.now()}`,
    appointment_time: appointment.scheduled_for || 'Scheduled Service Visit',
    customer: {
      name: appointment.customer_name || 'Customer',
      phone: appointment.customer_phone || 'On file',
      email: appointment.customer_email || 'On file'
    },
    vehicle: {
      year_make_model: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Customer Vehicle',
      vin: vehicle.vin || 'Not provided',
      mileage: vehicle.mileage || 'Not recorded'
    },
    intake_concerns: concerns.map(c => ({
      concern_type: c.noise_category || c.type || 'General Maintenance',
      summary: c.ai_concern_summary || c.description || 'Customer inquiry',
      attached_media_id: c.media_id || null
    })),
    prior_ro_history: appointment.prior_ros || [],
    advisor_checklist: [
      'Listen to attached customer audio clip before test drive',
      'Perform standard multi-point inspection',
      'Verify tire depth and brake pad millimeters'
    ]
  }
}

/**
 * Builds an interactive Service Estimate / Authorization Approval Card (§428).
 */
export function createServiceApprovalCard(roDetails = {}) {
  const lineItems = Array.isArray(roDetails.items) ? roDetails.items : [
    {
      item_id: 'svc_1',
      title: 'Front Brake Pads & Rotor Replacement',
      description: 'Pads measured at 2mm (critical wear). Replace front ceramic pads and resurface/replace rotors.',
      price: 349.99,
      status: 'RECOMMENDED',
      media_evidence_url: roDetails.brake_photo_url || null
    },
    {
      item_id: 'svc_2',
      title: 'Engine Air Filter & Cabin Microfilter',
      description: 'Heavy debris in cabin filter.',
      price: 89.95,
      status: 'RECOMMENDED'
    }
  ]

  const total = lineItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0)

  return {
    ro_number: roDetails.ro_number || 'RO-98214',
    advisor_name: roDetails.advisor_name || 'Service Department',
    vehicle: roDetails.vehicle_title || 'Your Vehicle',
    technician_inspection_video_url: roDetails.video_url || null,
    items: lineItems,
    estimated_total: Math.round(total * 100) / 100,
    status: 'AWAITING_CUSTOMER_APPROVAL',
    actions: {
      approve_all_url: `/service/ro/approve?id=${roDetails.ro_number || '98214'}`,
      decline_url: `/service/ro/decline?id=${roDetails.ro_number || '98214'}`
    },
    disclaimer: 'All repairs performed by certified technicians using OEM approved components. Taxes and shop supplies included in final invoice.'
  }
}
