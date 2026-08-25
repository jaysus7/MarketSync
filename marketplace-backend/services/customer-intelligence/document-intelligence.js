/**
 * MarketSync Customer Intelligence — Document Intelligence Engine (§350–353, §408–410, §432)
 * 
 * Safe document classification, sensitive PII / credential redaction,
 * and structured fact extraction with verification tracking.
 */

export const DOCUMENT_TYPES = Object.freeze({
  SERVICE_ESTIMATE: 'SERVICE_ESTIMATE',
  TRADE_APPRAISAL: 'TRADE_APPRAISAL',
  FINANCE_QUOTE: 'FINANCE_QUOTE',
  REPAIR_INVOICE: 'REPAIR_INVOICE',
  VEHICLE_SPEC: 'VEHICLE_SPEC',
  LEASE_END_DOC: 'LEASE_END_DOC',
  UNKNOWN: 'UNKNOWN'
})

export const SENSITIVE_DATA_TYPES = Object.freeze({
  SSN_SIN: 'SSN_SIN',
  BANKING_ACCOUNT: 'BANKING_ACCOUNT',
  CREDIT_CARD: 'CREDIT_CARD',
  CREDIT_REPORT_FULL: 'CREDIT_REPORT_FULL',
  DRIVERS_LICENSE_FULL: 'DRIVERS_LICENSE_FULL'
})

/**
 * Classifies document type from text content and structure (§351).
 */
export function classifyDocument(docText = '', metadata = {}) {
  const text = String(docText || '').toLowerCase()

  if (/lease\s+(?:end|return|inspection|wear\s+and\s+tear|residual)/i.test(text)) {
    return { type: DOCUMENT_TYPES.LEASE_END_DOC, confidence: 0.94 }
  }
  if (/(?:finance|lease)\s+(?:quote|proposal|worksheet|disclosure)|apr|monthly\s+payment|down\s+payment\s*\$|term\s*:\s*[0-9]{2}\s*mos?/i.test(text)) {
    return { type: DOCUMENT_TYPES.FINANCE_QUOTE, confidence: 0.95 }
  }
  if (/(?:trade(?:-in)?\s+(?:appraisal|valuation|allowance|offer)|kbb|black\s+book|canadian\s+black\s+book)/i.test(text)) {
    return { type: DOCUMENT_TYPES.TRADE_APPRAISAL, confidence: 0.93 }
  }
  if (/(?:repair\s+order|invoice|parts\s+total|labor\s+total|technician\s+notes|ro#)/i.test(text)) {
    return { type: DOCUMENT_TYPES.REPAIR_INVOICE, confidence: 0.92 }
  }
  if (/(?:service\s+estimate|recommended\s+services|multi-point\s+inspection|estimate\s+summary)/i.test(text)) {
    return { type: DOCUMENT_TYPES.SERVICE_ESTIMATE, confidence: 0.90 }
  }
  if (/(?:window\s+sticker|monroney|build\s+sheet|standard\s+equipment|optional\s+equipment)/i.test(text)) {
    return { type: DOCUMENT_TYPES.VEHICLE_SPEC, confidence: 0.96 }
  }

  return { type: DOCUMENT_TYPES.UNKNOWN, confidence: 0.40 }
}

/**
 * Detects sensitive PII or credentials that must NOT enter LLM context (§352, §408).
 */
export function detectSensitiveData(docText = '') {
  const text = String(docText || '')
  const detections = []

  // US SSN / Canadian SIN: 9 digits with dashes or spaces
  if (/\b(?:ssn|sin|social\s+(?:security|insurance))\s*(?:#|no\.?)?\s*:?\s*[0-9]{3}[-\s]?[0-9]{2,3}[-\s]?[0-9]{3,4}\b/i.test(text) ||
      /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/.test(text) ||
      /\b[0-9]{3}\s[0-9]{3}\s[0-9]{3}\b/.test(text)) {
    detections.push(SENSITIVE_DATA_TYPES.SSN_SIN)
  }

  // Bank Routing / Account number patterns
  if (/\b(?:routing|transit|institution|bank\s+acct|account\s*#)\s*:?\s*[0-9]{5,17}\b/i.test(text)) {
    detections.push(SENSITIVE_DATA_TYPES.BANKING_ACCOUNT)
  }

  // Credit Card numbers (Visa, MC, Amex, Discover)
  if (/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/.test(text.replace(/[-\s]/g, ''))) {
    detections.push(SENSITIVE_DATA_TYPES.CREDIT_CARD)
  }

  // Full credit bureau headers (Equifax, TransUnion, Experian)
  if (/(?:equifax|transunion|experian)\s+(?:credit\s+report|fico\s+score|vantage\s+score)/i.test(text)) {
    detections.push(SENSITIVE_DATA_TYPES.CREDIT_REPORT_FULL)
  }

  const isSensitive = detections.length > 0

  return {
    is_sensitive: isSensitive,
    sensitive_types: detections,
    safe_to_process_in_ai_context: !isSensitive,
    redacted_text: isSensitive ? redactSensitiveContent(text) : text,
    secure_routing_recommendation: isSensitive
      ? {
          action: 'ESCALATE_TO_SECURE_FORM',
          workflow: 'canonical_fni_credit_portal',
          message_to_customer: 'I noticed your document contains confidential financial credentials or identity details. To protect your privacy, please use our secure encrypted portal link to complete this step.'
        }
      : null
  }
}

function redactSensitiveContent(text) {
  return text
    .replace(/\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g, '[REDACTED_SSN]')
    .replace(/\b[0-9]{3}\s[0-9]{3}\s[0-9]{3}\b/g, '[REDACTED_SIN]')
    .replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, '[REDACTED_CARD]')
    .replace(/\b(?:account|acct|routing)\s*#?\s*:?\s*[0-9]{5,17}\b/gi, '[REDACTED_BANK_INFO]')
}

/**
 * Extracts structured facts from safe documents (§353).
 */
export function extractDocumentFacts(docText = '', classificationType = DOCUMENT_TYPES.UNKNOWN) {
  const sensitiveCheck = detectSensitiveData(docText)
  const cleanText = sensitiveCheck.redacted_text

  const facts = []

  if (classificationType === DOCUMENT_TYPES.FINANCE_QUOTE) {
    const paymentMatch = cleanText.match(/(?:monthly|payment)\s*:?\s*\$?\s*([0-9]{2,4}(?:\.[0-9]{2})?)/i)
    if (paymentMatch) {
      facts.push({
        field: 'monthly_payment',
        value: parseFloat(paymentMatch[1]),
        confidence: 0.97,
        source_location: 'monthly payment quote line',
        verification_state: 'OBSERVED'
      })
    }

    const termMatch = cleanText.match(/(?:term|months)\s*:?\s*([0-9]{2,3})\s*(?:mos?|months)?/i)
    if (termMatch) {
      facts.push({
        field: 'term_months',
        value: parseInt(termMatch[1], 10),
        confidence: 0.95,
        source_location: 'loan/lease term line',
        verification_state: 'OBSERVED'
      })
    }

    const aprMatch = cleanText.match(/(?:apr|rate|interest)\s*:?\s*([0-9]{1,2}(?:\.[0-9]{1,3})?)\s*%/i)
    if (aprMatch) {
      facts.push({
        field: 'apr_percentage',
        value: parseFloat(aprMatch[1]),
        confidence: 0.94,
        source_location: 'apr disclosure line',
        verification_state: 'OBSERVED'
      })
    }
  }

  if (classificationType === DOCUMENT_TYPES.TRADE_APPRAISAL) {
    const allowanceMatch = cleanText.match(/(?:trade(?:-in)?\s+(?:value|allowance|amount)|acv)\s*:?\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,6})/i)
    if (allowanceMatch) {
      facts.push({
        field: 'trade_allowance',
        value: parseInt(allowanceMatch[1].replace(/,/g, ''), 10),
        confidence: 0.93,
        source_location: 'trade allowance line',
        verification_state: 'OBSERVED'
      })
    }
  }

  if (classificationType === DOCUMENT_TYPES.SERVICE_ESTIMATE || classificationType === DOCUMENT_TYPES.REPAIR_INVOICE) {
    const totalMatch = cleanText.match(/(?:total|estimate|amount\s+due)\s*:?\s*\$?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6}(?:\.[0-9]{2})?)/i)
    if (totalMatch) {
      facts.push({
        field: 'estimated_total',
        value: parseFloat(totalMatch[1].replace(/,/g, '')),
        confidence: 0.91,
        source_location: 'total estimate line',
        verification_state: 'OBSERVED'
      })
    }
  }

  return {
    document_type: classificationType,
    sensitive_data_detected: sensitiveCheck.is_sensitive,
    facts,
    truthfulness_guardrail: 'Never infer missing contract terms or present unverified document estimates as binding dealer commitments.'
  }
}
