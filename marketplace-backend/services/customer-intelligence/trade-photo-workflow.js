/**
 * MarketSync Customer Intelligence — Trade Photo Workflow Engine (§340–342, §383–384)
 * 
 * Guides conversational trade-in photo collection, tracks required vs received angles,
 * evaluates image quality, and records advisory condition notes without generating
 * unauthorized binding appraisal numbers.
 */

export const REQUIRED_TRADE_ANGLES = Object.freeze([
  'front',
  'rear',
  'driver_side',
  'passenger_side',
  'interior',
  'odometer'
])

export const OPTIONAL_TRADE_ANGLES = Object.freeze([
  'visible_damage',
  'tires_wheels',
  'cargo_trunk',
  'engine_bay'
])

export const QUALITY_FLAGS = Object.freeze({
  USABLE: 'USABLE',
  TOO_DARK: 'TOO_DARK',
  BLURRY: 'BLURRY',
  OBSTRUCTED: 'OBSTRUCTED',
  INCOMPLETE_VEHICLE: 'INCOMPLETE_VEHICLE',
  PLATE_DOC_COVERING: 'PLATE_DOC_COVERING'
})

/**
 * Initializes a new trade photo collection state for a customer.
 */
export function initializeTradePhotoState(customerVehicle = {}) {
  const photoSlots = {}
  for (const angle of REQUIRED_TRADE_ANGLES) {
    photoSlots[angle] = {
      status: 'MISSING', // 'MISSING', 'RECEIVED', 'REJECTED'
      media_id: null,
      received_at: null,
      quality: null,
      notes: null
    }
  }

  return {
    vehicle_info: {
      year: customerVehicle.year || null,
      make: customerVehicle.make || null,
      model: customerVehicle.model || null,
      vin: customerVehicle.vin || null,
      estimated_mileage: customerVehicle.mileage || null
    },
    photo_slots: photoSlots,
    additional_photos: [], // For visible damage or extra angles
    condition_observations: [],
    is_complete: false,
    started_at: new Date().toISOString(),
    completed_at: null
  }
}

/**
 * Evaluates photo quality (§341).
 */
export function evaluatePhotoQuality(mediaMetadata = {}) {
  const flags = []
  
  if (mediaMetadata.brightness !== undefined && mediaMetadata.brightness < 0.25) {
    flags.push(QUALITY_FLAGS.TOO_DARK)
  }
  if (mediaMetadata.blur_score !== undefined && mediaMetadata.blur_score > 0.65) {
    flags.push(QUALITY_FLAGS.BLURRY)
  }
  if (mediaMetadata.is_obstructed) {
    flags.push(QUALITY_FLAGS.OBSTRUCTED)
  }
  if (mediaMetadata.crop_ratio !== undefined && mediaMetadata.crop_ratio < 0.6) {
    flags.push(QUALITY_FLAGS.INCOMPLETE_VEHICLE)
  }

  const isUsable = flags.length === 0

  let recommendation = null
  if (!isUsable) {
    if (flags.includes(QUALITY_FLAGS.TOO_DARK)) {
      recommendation = "That photo appears a bit dark. If possible, taking one in daylight or with flash will help our appraiser get you the best valuation."
    } else if (flags.includes(QUALITY_FLAGS.BLURRY)) {
      recommendation = "That photo came through a little blurry. Could you snap a clearer shot of that angle?"
    } else {
      recommendation = "That photo seems a bit close up or cut off. A wider view of the vehicle will work best."
    }
  }

  return {
    is_usable: isUsable,
    primary_quality: isUsable ? QUALITY_FLAGS.USABLE : flags[0],
    all_flags: flags,
    recommendation
  }
}

/**
 * Records an uploaded photo into the trade photo collection (§340).
 */
export function recordTradePhoto(state, angle, mediaItem = {}, qualityEvaluation = {}) {
  const normAngle = String(angle || '').toLowerCase().replace(/[\s-]+/g, '_')
  const newState = JSON.parse(JSON.stringify(state))

  const isRequired = REQUIRED_TRADE_ANGLES.includes(normAngle)

  const photoRecord = {
    media_id: mediaItem.attachment_id || mediaItem.id || `media_${Date.now()}`,
    storage_url: mediaItem.storage_url || null,
    received_at: new Date().toISOString(),
    quality: qualityEvaluation.primary_quality || QUALITY_FLAGS.USABLE,
    is_usable: qualityEvaluation.is_usable !== false,
    notes: mediaItem.notes || null
  }

  if (isRequired) {
    newState.photo_slots[normAngle] = {
      status: photoRecord.is_usable ? 'RECEIVED' : 'REJECTED',
      ...photoRecord
    }
  } else {
    newState.additional_photos.push({
      angle: normAngle,
      ...photoRecord
    })
  }

  // Check overall completion
  const missingRequired = REQUIRED_TRADE_ANGLES.filter(a => newState.photo_slots[a]?.status !== 'RECEIVED')
  newState.is_complete = missingRequired.length === 0
  if (newState.is_complete && !newState.completed_at) {
    newState.completed_at = new Date().toISOString()
  }

  return newState
}

/**
 * Formats the trade photo progress tracker (§384).
 */
export function formatTradePhotoProgress(state) {
  const total = REQUIRED_TRADE_ANGLES.length
  const received = REQUIRED_TRADE_ANGLES.filter(a => state.photo_slots[a]?.status === 'RECEIVED').length
  const missing = REQUIRED_TRADE_ANGLES.filter(a => state.photo_slots[a]?.status !== 'RECEIVED')

  const items = REQUIRED_TRADE_ANGLES.map(angle => {
    const isDone = state.photo_slots[angle]?.status === 'RECEIVED'
    const label = angle.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    return {
      angle,
      label,
      completed: isDone,
      icon: isDone ? '✓' : '○'
    }
  })

  let nextPrompt = ''
  if (missing.length === 0) {
    nextPrompt = "All required trade photos have been received! Our appraisal team will review these shortly."
  } else if (missing.length === 1) {
    const lastAngle = items.find(i => i.angle === missing[0])?.label
    nextPrompt = `I have most of what I need. One ${lastAngle} photo would complete the set.`
  } else {
    const nextAngle = items.find(i => i.angle === missing[0])?.label
    nextPrompt = `Got it! Next up, could you send a photo of the ${nextAngle}?`
  }

  return {
    completed_count: received,
    total_count: total,
    progress_percent: Math.round((received / total) * 100),
    is_complete: received === total,
    checklist: items,
    missing_angles: missing,
    conversational_prompt: nextPrompt
  }
}

/**
 * Adds an advisory condition note (§342).
 */
export function addAdvisoryConditionNote(state, note = {}) {
  const newState = JSON.parse(JSON.stringify(state))
  newState.condition_observations.push({
    observation_id: `obs_${Date.now()}`,
    type: note.type || 'COSMETIC', // 'COSMETIC', 'MECHANICAL_INDICATOR', 'TIRE_WEAR', 'GLASS'
    description: note.description || 'Visible wear observed',
    location: note.location || 'General',
    media_id: note.media_id || null,
    status: 'OBSERVED_NOT_APPRAISED',
    timestamp: new Date().toISOString()
  })
  return newState
}
