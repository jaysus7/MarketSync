/**
 * MarketSync Customer Intelligence — Image Intelligence Engine (§339, §343–345, §348–349, §419, §431–432)
 * 
 * Analyzes customer-uploaded images:
 * - Trade vehicle photos
 * - Odometer readings with mandatory confirmation gating
 * - VIN / Stock / License plate visual extraction
 * - Dashboard warning lights with safety routing
 * - Competitor vehicle listing screenshots & comparative spec analysis
 * - Visual prompt-injection sanitization
 * 
 * Strict epistemological boundary:
 * OBSERVED != INFERRED != SYSTEM_VERIFIED != HUMAN_VERIFIED
 */

export const VERIFICATION_STATUSES = Object.freeze({
  OBSERVED: 'OBSERVED',
  INFERRED: 'INFERRED',
  CUSTOMER_STATED: 'CUSTOMER_STATED',
  SYSTEM_VERIFIED: 'SYSTEM_VERIFIED',
  HUMAN_VERIFIED: 'HUMAN_VERIFIED'
})

export const WARNING_LIGHT_SEVERITIES = Object.freeze({
  INFORMATIONAL: 'INFORMATIONAL',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  SERVICE_RECOMMENDED: 'SERVICE_RECOMMENDED',
  SAFETY_CRITICAL: 'SAFETY_CRITICAL'
})

/**
 * Known automotive dashboard warning symbols and safety triage rules (§345).
 */
export const WARNING_LIGHT_CATALOG = Object.freeze({
  check_engine: {
    symbol: 'Check Engine / Malfunction Indicator (MIL)',
    general_meaning: 'Engine emissions, ignition, or fuel system sensor anomaly.',
    severity: WARNING_LIGHT_SEVERITIES.SERVICE_RECOMMENDED,
    safety_critical: false,
    recommended_action: 'Schedule diagnostic scan at service department. Safe to drive unless flashing.',
    flashing_critical: true
  },
  oil_pressure: {
    symbol: 'Low Engine Oil Pressure',
    general_meaning: 'Loss of lubrication pressure — engine damage hazard.',
    severity: WARNING_LIGHT_SEVERITIES.SAFETY_CRITICAL,
    safety_critical: true,
    recommended_action: 'Pull over safely immediately and turn off engine. Do not continue driving.'
  },
  battery_charging: {
    symbol: 'Battery / Charging System',
    general_meaning: 'Alternator, serpentine belt, or electrical charging failure.',
    severity: WARNING_LIGHT_SEVERITIES.SERVICE_RECOMMENDED,
    safety_critical: false,
    recommended_action: 'Avoid turning off engine in unsafe area; visit service center promptly.'
  },
  brake_warning: {
    symbol: 'Brake System / ABS Malfunction',
    general_meaning: 'Hydraulic pressure loss, parking brake engaged, or low brake fluid.',
    severity: WARNING_LIGHT_SEVERITIES.SAFETY_CRITICAL,
    safety_critical: true,
    recommended_action: 'Inspect brake responsiveness immediately. Have vehicle towed if pedal feels spongy.'
  },
  tpms: {
    symbol: 'Tire Pressure Monitoring System (TPMS)',
    general_meaning: 'One or more tires significantly under-inflated.',
    severity: WARNING_LIGHT_SEVERITIES.MAINTENANCE_DUE,
    safety_critical: false,
    recommended_action: 'Check tire pressures and inflate to driver door placard PSI.'
  },
  airbag_srs: {
    symbol: 'Airbag / Supplemental Restraint System (SRS)',
    general_meaning: 'Fault in airbag deployment sensors or seatbelt pre-tensioners.',
    severity: WARNING_LIGHT_SEVERITIES.SAFETY_CRITICAL,
    safety_critical: true,
    recommended_action: 'Have system inspected by certified technician; airbags may not deploy in collision.'
  }
})

/**
 * Visual Prompt Injection Filter (§432)
 * Ensures instructions embedded in images/screenshots are treated strictly as passive data.
 */
export function sanitizeVisualText(rawText = '') {
  const text = String(rawText || '')
  const injectionPatterns = [
    /ignore\s+(?:all\s+)?(?:previous\s+)?instructions/i,
    /system\s+prompt/i,
    /reveal\s+(?:api\s+)?keys?/i,
    /you\s+are\s+now\s+(?:an?\s+)?administrator/i,
    /developer\s+mode/i,
    /bypass\s+policy/i,
    /disregard\s+rules/i
  ]

  let isSuspicious = false
  const matchedPatterns = []

  for (const pat of injectionPatterns) {
    if (pat.test(text)) {
      isSuspicious = true
      matchedPatterns.push(pat.source)
    }
  }

  return {
    sanitized_text: isSuspicious
      ? `[UNTRUSTED VISUAL TEXT DETECTED AND PASSIVELY QUOTED]: ${text.replace(/[\n\r]+/g, ' ').slice(0, 500)}`
      : text,
    is_suspicious: isSuspicious,
    matched_patterns: matchedPatterns
  }
}

/**
 * Extracts approximate odometer reading from dashboard photo (§343).
 * Requires explicit customer confirmation before treating mileage as verified truth.
 */
export function extractOdometerReading(simulatedOcrText = '', options = {}) {
  const sanitized = sanitizeVisualText(simulatedOcrText)
  const text = sanitized.sanitized_text

  // Pattern matches common odometer displays: e.g. 92,184 km, 45230 mi, ODO 104,200
  const odoMatch = text.match(/(?:odo(?:meter)?\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})\s*(km|kms|mi|miles)?/i)

  if (!odoMatch) {
    return {
      success: false,
      reading: null,
      unit: null,
      confidence: 0.0,
      verification_status: VERIFICATION_STATUSES.INFERRED,
      confirmation_required: true,
      dialogue_prompt: "I couldn't clearly read the odometer from that photo. Could you verify your current mileage for me?"
    }
  }

  const rawNumber = odoMatch[1].replace(/,/g, '')
  const numericValue = parseInt(rawNumber, 10)
  const unit = (odoMatch[2] || 'km').toLowerCase().startsWith('m') && !odoMatch[2]?.toLowerCase().startsWith('km') ? 'miles' : 'km'
  const confidence = options.confidence || 0.92

  return {
    success: true,
    reading: numericValue,
    formatted: `${numericValue.toLocaleString()} ${unit}`,
    unit,
    confidence,
    verification_status: VERIFICATION_STATUSES.OBSERVED,
    is_verified: false, // Must remain false until customer confirms
    confirmation_required: true,
    dialogue_prompt: `I can read approximately ${numericValue.toLocaleString()} ${unit} from the odometer photo. Is that correct?`,
    source_media_id: options.media_id || null
  }
}

/**
 * Extracts VIN / Stock Number / License Plate (§344).
 */
export function extractVehicleIdentifiers(ocrText = '', options = {}) {
  const text = sanitizeVisualText(ocrText).sanitized_text

  // Standard 17-character VIN pattern (excluding I, O, Q)
  const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i)
  // Stock number pattern: e.g. Stock: STK-2025A, STK# 25-1049, or Stock 1049
  const stockMatch = text.match(/\b(?:stock|stk)(?:\s*#|\s*no\.?|\s*:)?\s*([A-Z0-9-]{3,12})\b/i)
  // Plate pattern: 2 to 8 alphanumeric
  const plateMatch = text.match(/\b(?:plate|licence|license)(?:\s*#|\s*:)?\s*([A-Z0-9]{4,8})\b/i)

  return {
    vin: vinMatch ? {
      value: vinMatch[1].toUpperCase(),
      status: VERIFICATION_STATUSES.OBSERVED,
      matched_canonical_record: false // Will be reconciled via inventory service
    } : null,
    stock_number: stockMatch ? {
      value: stockMatch[1].toUpperCase(),
      status: VERIFICATION_STATUSES.OBSERVED
    } : null,
    license_plate: plateMatch ? {
      value: plateMatch[1].toUpperCase(),
      status: VERIFICATION_STATUSES.OBSERVED,
      privacy_gated: true // Never exposed beyond authorized appraisals
    } : null,
    confidence: (vinMatch || stockMatch || plateMatch) ? 0.90 : 0.0
  }
}

/**
 * Analyzes dashboard warning lights (§345).
 */
export function analyzeDashboardWarningLight(detectedSymbolKey = '', options = {}) {
  const key = detectedSymbolKey.toLowerCase().replace(/[\s-]+/g, '_')
  const entry = WARNING_LIGHT_CATALOG[key]

  if (!entry) {
    return {
      identified: false,
      symbol_name: 'Unidentified Warning Indicator',
      severity: WARNING_LIGHT_SEVERITIES.SERVICE_RECOMMENDED,
      is_safety_critical: false,
      explanation: 'An illuminated dashboard symbol is visible, but the specific indicator could not be identified with certainty.',
      recommended_action: 'We recommend having our certified service technicians perform a multi-point scan.',
      service_routing: {
        suggest_appointment: true,
        priority: 'STANDARD'
      }
    }
  }

  const isFlashing = Boolean(options.is_flashing)
  const isSafetyCritical = entry.safety_critical || (entry.flashing_critical && isFlashing)

  return {
    identified: true,
    symbol_name: entry.symbol,
    general_meaning: entry.general_meaning,
    severity: isSafetyCritical ? WARNING_LIGHT_SEVERITIES.SAFETY_CRITICAL : entry.severity,
    is_safety_critical: isSafetyCritical,
    explanation: entry.general_meaning,
    recommended_action: isFlashing && entry.flashing_critical
      ? 'WARNING: A flashing check engine light indicates an active misfire that can cause catalytic converter failure. Reduce speed and visit service immediately.'
      : entry.recommended_action,
    service_routing: {
      suggest_appointment: true,
      department: 'service',
      priority: isSafetyCritical ? 'URGENT_HANDOFF' : 'STANDARD',
      advisor_note: `Customer uploaded warning light photo showing: ${entry.symbol}. ${isSafetyCritical ? 'SAFETY CONCERN.' : ''}`
    },
    truthfulness_guardrail: 'OBSERVATIONAL ADVISORY ONLY: Do not claim definitive remote mechanical diagnosis from a photo alone.'
  }
}

/**
 * Parses and extracts competitor vehicle listing screenshots (§348–349).
 */
export function parseCompetitorScreenshot(screenshotData = {}) {
  const ocrText = sanitizeVisualText(screenshotData.ocr_text || '').sanitized_text

  // Extract year, make, model, trim, price, mileage
  const yearMatch = ocrText.match(/\b(201[5-9]|202[0-9])\b/)
  const priceMatch = ocrText.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})/)
  const mileageMatch = ocrText.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})\s*(?:km|mi|miles)/i)

  const parsed = {
    source_type: 'COMPETITOR_SCREENSHOT',
    dealer_name: screenshotData.dealer_name || extractDealerName(ocrText) || 'Competitor Dealer',
    extracted_vehicle: {
      year: yearMatch ? parseInt(yearMatch[1], 10) : null,
      make: screenshotData.make || extractMake(ocrText),
      model: screenshotData.model || extractModel(ocrText),
      trim: screenshotData.trim || null,
      advertised_price: priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null,
      advertised_mileage: mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, ''), 10) : null
    },
    verification_status: VERIFICATION_STATUSES.OBSERVED,
    disclaimer: 'Based on the screenshot provided, pricing and equipment are subject to competitor dealer availability and verification.',
    timestamp: new Date().toISOString()
  }

  return parsed
}

function extractDealerName(text) {
  const m = text.match(/(?:at|from|dealer(?:ship)?:\s*)([A-Z][A-Za-z0-9\s&'-]{3,30}(?:Motors|Chevrolet|Ford|Toyota|Honda|Auto|GMC|Buick|Nissan|Hyundai))/i)
  return m ? m[1].trim() : null
}

function extractMake(text) {
  const makes = ['Chevrolet', 'GMC', 'Buick', 'Cadillac', 'Ford', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Subaru', 'Jeep', 'Ram', 'Dodge']
  for (const m of makes) {
    if (new RegExp(`\\b${m}\\b`, 'i').test(text)) return m
  }
  return null
}

function extractModel(text) {
  const models = ['Equinox', 'Terrain', 'Sierra', 'Silverado', 'F-150', 'RAV4', 'CR-V', 'Tucson', 'Sportage', 'Outback', 'Grand Cherokee', 'Tahoe', 'Yukon']
  for (const m of models) {
    if (new RegExp(`\\b${m}\\b`, 'i').test(text)) return m
  }
  return null
}
