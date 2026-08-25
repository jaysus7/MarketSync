/**
 * MarketSync Customer Intelligence — Multimodal Input Router (§338, §416–418, §434–435)
 * 
 * Normalizes all customer interactions (Text, Image, Document, Video, Audio,
 * Structured UI Responses, Tool Results) from any channel (Web Chat, SMS,
 * Email, Voice, Video, In-Person, Social) into a canonical interaction envelope.
 * 
 * Implements context compression to preserve structured observations without
 * flooding LLM context windows with raw media binaries.
 */

export const SUPPORTED_MEDIA_TYPES = Object.freeze([
  'TEXT',
  'IMAGE',
  'DOCUMENT',
  'VIDEO',
  'AUDIO',
  'STRUCTURED_UI_RESPONSE',
  'TOOL_RESULT'
])

export const SUPPORTED_CHANNELS = Object.freeze([
  'web_chat',
  'sms',
  'email',
  'voice',
  'video',
  'in_person',
  'social',
  'system'
])

export const SENDER_ROLES = Object.freeze([
  'CUSTOMER',
  'AI',
  'STAFF',
  'SYSTEM'
])

/**
 * Normalizes raw incoming interaction into a canonical interaction envelope.
 * 
 * @param {Object} input - Raw interaction parameters
 * @returns {Object} Canonical Multimodal Interaction Envelope
 */
export function normalizeInteractionEnvelope(input = {}) {
  const receivedAt = input.received_at || new Date().toISOString()
  const mediaType = String(input.media_type || 'TEXT').toUpperCase()
  
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
    throw new Error(`Unsupported media_type: ${input.media_type}. Must be one of: ${SUPPORTED_MEDIA_TYPES.join(', ')}`)
  }

  const channel = String(input.channel || 'web_chat').toLowerCase()
  const sender = String(input.sender || 'CUSTOMER').toUpperCase()

  const envelope = {
    envelope_id: input.envelope_id || `env_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    tenant_id: input.tenant_id || input.dealership_id || null,
    customer_id: input.customer_id || input.contact_id || null,
    conversation_id: input.conversation_id || null,
    channel,
    sender,
    media_type: mediaType,
    received_at: receivedAt,
    content: input.content || '',
    attachments: Array.isArray(input.attachments) ? input.attachments.map(normalizeAttachment) : [],
    current_state_ref: input.current_state_ref || null,
    ownership: {
      assigned_staff_id: input.assigned_staff_id || null,
      assigned_role: input.assigned_role || 'sales_ai',
      is_human_takeover: Boolean(input.is_human_takeover)
    },
    source_context: {
      origin_url: input.origin_url || null,
      launcher_component: input.launcher_component || 'default_chat',
      utm_source: input.utm_source || null,
      utm_campaign: input.utm_campaign || null,
      referrer: input.referrer || null,
      device_type: input.device_type || 'desktop'
    },
    metadata: { ...input.metadata }
  }

  return Object.freeze(envelope)
}

/**
 * Normalizes an individual media attachment.
 */
export function normalizeAttachment(att = {}) {
  return {
    attachment_id: att.attachment_id || att.id || `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    media_type: String(att.media_type || att.type || 'IMAGE').toUpperCase(),
    mime_type: att.mime_type || att.contentType || 'application/octet-stream',
    file_name: att.file_name || att.name || 'attachment',
    file_size_bytes: Number(att.file_size_bytes || att.size || 0),
    storage_url: att.storage_url || att.url || null,
    duration_seconds: att.duration_seconds ? Number(att.duration_seconds) : null,
    dimensions: att.dimensions ? { width: att.dimensions.width, height: att.dimensions.height } : null,
    checksum: att.checksum || null,
    status: att.status || 'UPLOADING' // UPLOADING, PROCESSING, READY, FAILED
  }
}

/**
 * Multimodal Context Compressor (§418)
 * Translates processed multimodal facts into a token-efficient structured representation.
 * Raw images/video/documents are omitted from LLM prompt loops once analyzed.
 */
export function compressMultimodalContext(state = {}, options = {}) {
  const observations = state.multimodal_observations || []
  const maxItems = options.max_items || 8

  // Sort by freshness and filter expired
  const now = Date.now()
  const validObservations = observations
    .filter(obs => !obs.expires_at || new Date(obs.expires_at).getTime() > now)
    .slice(0, maxItems)

  const compressed = {
    summary_tokens_est: 0,
    media_count: observations.length,
    active_observations: validObservations.map(obs => ({
      category: obs.category, // 'trade_odometer', 'warning_light', 'competitor_quote', etc.
      label: obs.label,
      value: obs.value,
      verification_status: obs.verification_status, // OBSERVED, CUSTOMER_STATED, SYSTEM_VERIFIED, HUMAN_VERIFIED
      confidence: obs.confidence,
      source_media_id: obs.media_id,
      timestamp: obs.timestamp
    }))
  }

  compressed.summary_tokens_est = JSON.stringify(compressed.active_observations).length / 4
  return compressed
}

/**
 * Fast-path vs Heavy-path Router (§434)
 * Returns processing pipeline route based on media complexity.
 */
export function routeInteractionPath(envelope) {
  if (envelope.media_type === 'TEXT' || envelope.media_type === 'STRUCTURED_UI_RESPONSE') {
    return {
      pipeline: 'FAST_SYNC',
      estimated_latency_ms: 250,
      requires_async_queue: false
    }
  }

  return {
    pipeline: 'HEAVY_ASYNC_MULTIMODAL',
    estimated_latency_ms: 1200,
    requires_async_queue: true,
    target_engine: getEngineForMediaType(envelope.media_type)
  }
}

function getEngineForMediaType(mediaType) {
  switch (mediaType) {
    case 'IMAGE': return 'image_intelligence'
    case 'DOCUMENT': return 'document_intelligence'
    case 'VIDEO': return 'video_intelligence'
    case 'AUDIO': return 'voice_or_audio_intelligence'
    case 'TOOL_RESULT': return 'action_executor'
    default: return 'general_orchestrator'
  }
}
