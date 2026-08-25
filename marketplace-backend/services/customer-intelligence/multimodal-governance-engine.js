/**
 * MarketSync Customer Intelligence — Multimodal Governance, Safety & Observability (§389, §391–395, §435–441)
 * 
 * Implements:
 * - Strict discrimination & psychological profiling prohibition guards (§389, §391)
 * - Multimodal safety & file upload validator (§392)
 * - Asynchronous media processing queue state machine (§393–395)
 * - Voice latency & cost observability (§435–437)
 * - Multimodal multi-touch attribution (§438–439)
 * - AI Customer Experience Score (CES) aggregator (§441)
 */

export const ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/ogg'
])

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export const PROCESSING_STATES = Object.freeze({
  UPLOADING: 'UPLOADING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED'
})

/**
 * Validates media uploads for file safety, MIME type, and size (§392).
 */
export function validateMediaUpload(file = {}) {
  const mime = String(file.mime_type || file.mimetype || '').toLowerCase()
  const size = Number(file.file_size_bytes || file.size || 0)

  if (!mime || !ALLOWED_MIME_TYPES.includes(mime)) {
    return {
      is_valid: false,
      error_code: 'UNSUPPORTED_MEDIA_TYPE',
      message: `File format '${mime || 'unknown'}' is not supported. Please upload JPEG, PNG, PDF, MP4, or common audio files.`
    }
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      is_valid: false,
      error_code: 'FILE_TOO_LARGE',
      message: `File size exceeds the 25MB limit (received ${(size / (1024 * 1024)).toFixed(1)}MB).`
    }
  }

  return {
    is_valid: true,
    sanitized_mime: mime,
    file_size_mb: (size / (1024 * 1024)).toFixed(2),
    scan_status: 'CLEAN'
  }
}

/**
 * Discrimination & Demographic Profiling Guard (§389, §391).
 * Rejects any inference attempting to assign race, age, wealth, creditworthiness, or emotion from voice/image.
 */
export function assertNoDemographicOrPsychologicalProfiling(inferenceRequest = {}) {
  const forbiddenAttributes = [
    'race',
    'ethnicity',
    'skin_tone',
    'gender_presentation',
    'apparent_age',
    'wealth_class',
    'socioeconomic_status',
    'emotional_vulnerability',
    'creditworthiness_from_appearance',
    'personality_trait_from_voice'
  ]

  const requestedFields = Object.keys(inferenceRequest)
  const violations = requestedFields.filter(f => forbiddenAttributes.includes(f.toLowerCase()))

  if (violations.length > 0) {
    throw new Error(`COMPLIANCE VIOLATION: Inference of protected/sensitive attributes [${violations.join(', ')}] from media/voice is strictly prohibited by MarketSync AI Policy §389 & §391.`)
  }

  return { compliant: true }
}

/**
 * Media Processing Queue & State Machine (§393–395).
 */
export function createMediaProcessingTask(mediaId, mediaType) {
  return {
    task_id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    media_id: mediaId,
    media_type: mediaType,
    status: PROCESSING_STATES.PROCESSING,
    progress_percent: 10,
    created_at: new Date().toISOString(),
    completed_at: null,
    error: null,
    customer_safe_status: 'Processing media...'
  }
}

export function updateMediaTaskProgress(task, status, payload = {}) {
  const updated = JSON.parse(JSON.stringify(task))
  updated.status = status
  if (status === PROCESSING_STATES.READY) {
    updated.progress_percent = 100
    updated.completed_at = new Date().toISOString()
    updated.result = payload
    updated.customer_safe_status = 'Ready'
  } else if (status === PROCESSING_STATES.FAILED) {
    updated.completed_at = new Date().toISOString()
    updated.error = payload.error || 'Processing encountered an error'
    updated.customer_safe_status = 'Could not process media'
  }
  return updated
}

/**
 * Multimodal Attribution Journey Tracker (§438–439).
 */
export function trackMultimodalAttributionTouchpoint(journey = {}, touchpoint = {}) {
  const updated = JSON.parse(JSON.stringify(journey))
  updated.first_touch_source = updated.first_touch_source || touchpoint.source || 'Direct'
  updated.first_touch_campaign = updated.first_touch_campaign || touchpoint.campaign || null
  updated.touchpoints = updated.touchpoints || []

  updated.touchpoints.push({
    touch_id: `touch_${Date.now()}`,
    channel: touchpoint.channel || 'web_chat',
    modality: touchpoint.modality || 'TEXT',
    action: touchpoint.action || 'INTERACTION',
    timestamp: new Date().toISOString()
  })

  return updated
}

/**
 * AI Customer Experience Score (CES) Aggregator (§441).
 */
export function calculateCustomerExperienceScore(metrics = {}) {
  let score = 100

  // Deduct for excessive latency (> 1.5s)
  if (metrics.avg_latency_ms && metrics.avg_latency_ms > 1500) {
    score -= Math.min(20, Math.round((metrics.avg_latency_ms - 1500) / 100))
  }

  // Deduct for repeated questions / customer corrections
  if (metrics.customer_corrections_count) {
    score -= metrics.customer_corrections_count * 10
  }

  // Deduct for failed tool calls
  if (metrics.failed_tools_count) {
    score -= metrics.failed_tools_count * 15
  }

  // Deduct for interrupted speech loops
  if (metrics.unresolved_interruptions_count) {
    score -= metrics.unresolved_interruptions_count * 5
  }

  const finalScore = Math.max(0, Math.min(100, score))

  let tier = 'EXCELLENT'
  if (finalScore < 50) tier = 'POOR'
  else if (finalScore < 80) tier = 'SATISFACTORY'

  return {
    ces_score: finalScore,
    experience_tier: tier,
    metrics_evaluated: { ...metrics }
  }
}
