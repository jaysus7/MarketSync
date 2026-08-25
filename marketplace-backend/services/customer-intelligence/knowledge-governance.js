/**
 * MarketSync Customer Intelligence — Knowledge Governance & Tool Permission Engine.
 *
 * Enforces strict precedence hierarchy:
 * 1. Canonical MarketSync Database
 * 2. Verified Integrations
 * 3. Configured Knowledge Base
 * 4. General Knowledge
 *
 * Classifies tool execution safety: READ_ONLY, LOW_RISK_WRITE, CONFIRMATION_REQUIRED, HUMAN_ONLY.
 */

export const KNOWLEDGE_PRECEDENCE = {
  CANONICAL_DB: 1,
  VERIFIED_INTEGRATION: 2,
  DEALER_CONFIGURED_KB: 3,
  GENERAL_MODEL_KNOWLEDGE: 4,
}

export const TOOL_PERMISSION_LEVELS = {
  READ_ONLY: 'READ_ONLY',
  LOW_RISK_WRITE: 'LOW_RISK_WRITE',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  HUMAN_ONLY: 'HUMAN_ONLY',
}

export const TOOL_SAFETY_MAP = {
  inventory_search: TOOL_PERMISSION_LEVELS.READ_ONLY,
  inventory_get_vehicle: TOOL_PERMISSION_LEVELS.READ_ONLY,
  payments_calculate_estimate: TOOL_PERMISSION_LEVELS.READ_ONLY,
  dealership_info: TOOL_PERMISSION_LEVELS.READ_ONLY,
  trade_create_appraisal_request: TOOL_PERMISSION_LEVELS.LOW_RISK_WRITE,
  save_memory: TOOL_PERMISSION_LEVELS.LOW_RISK_WRITE,
  appointment_book: TOOL_PERMISSION_LEVELS.CONFIRMATION_REQUIRED,
  messaging_send_sms: TOOL_PERMISSION_LEVELS.CONFIRMATION_REQUIRED,
  human_request_handoff: TOOL_PERMISSION_LEVELS.LOW_RISK_WRITE,
  credit_approval_bind: TOOL_PERMISSION_LEVELS.HUMAN_ONLY,
  pricing_discount_authorize: TOOL_PERMISSION_LEVELS.HUMAN_ONLY,
}

/**
 * Validates whether an AI tool execution is authorized under given permissions.
 */
export function validateToolSafety(toolName = '') {
  const level = TOOL_SAFETY_MAP[toolName] || TOOL_PERMISSION_LEVELS.READ_ONLY
  if (level === TOOL_PERMISSION_LEVELS.HUMAN_ONLY) {
    return {
      allowed: false,
      level,
      error: `Tool "${toolName}" is strictly HUMAN_ONLY and cannot be executed autonomously by AI.`,
    }
  }
  return {
    allowed: true,
    level,
    requires_confirmation: level === TOOL_PERMISSION_LEVELS.CONFIRMATION_REQUIRED,
  }
}
