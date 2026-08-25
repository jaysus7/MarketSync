/**
 * MarketSync Customer Intelligence — Policy Engine & Granular Kill Switches.
 *
 * Implements Policy-as-Code for dealership business rules, action autonomy classification,
 * and emergency kill switches (global, tool-specific, channel-specific).
 */

export const ACTION_AUTONOMY_LEVELS = {
  AUTOMATIC: 'AUTOMATIC',
  POLICY_DEPENDENT: 'POLICY_DEPENDENT',
  CUSTOMER_CONFIRMATION: 'CUSTOMER_CONFIRMATION',
  HUMAN_ONLY: 'HUMAN_ONLY',
}

export const ACTION_AUTONOMY_MAP = {
  answer_faq: ACTION_AUTONOMY_LEVELS.AUTOMATIC,
  search_inventory: ACTION_AUTONOMY_LEVELS.AUTOMATIC,
  create_lead: ACTION_AUTONOMY_LEVELS.AUTOMATIC,
  send_sms: ACTION_AUTONOMY_LEVELS.POLICY_DEPENDENT,
  book_appointment: ACTION_AUTONOMY_LEVELS.CUSTOMER_CONFIRMATION,
  create_trade_appraisal: ACTION_AUTONOMY_LEVELS.AUTOMATIC,
  change_deal_pricing: ACTION_AUTONOMY_LEVELS.HUMAN_ONLY,
  approve_financing: ACTION_AUTONOMY_LEVELS.HUMAN_ONLY,
  bind_insurance: ACTION_AUTONOMY_LEVELS.HUMAN_ONLY,
}

/**
 * Evaluates operational policies deterministically against dealership context.
 */
export function evaluateDealershipPolicy(actionName, context = {}, dealershipSettings = {}) {
  const killSwitches = dealershipSettings.kill_switches || {}

  // 1. Global AI Kill Switch
  if (killSwitches.global_ai_disabled) {
    return {
      allowed: false,
      reason: 'Global AI assistant kill switch is active — fallback to static contact form',
      autonomy: ACTION_AUTONOMY_LEVELS.HUMAN_ONLY,
    }
  }

  // 2. Tool-Specific Kill Switch
  if (killSwitches.disabled_tools?.includes(actionName)) {
    return {
      allowed: false,
      reason: `Tool "${actionName}" is temporarily disabled by dealership admin`,
      autonomy: ACTION_AUTONOMY_LEVELS.HUMAN_ONLY,
    }
  }

  // 3. Channel-Specific Kill Switch & Consent Policy
  if (actionName === 'send_sms') {
    if (killSwitches.sms_channel_disabled) {
      return { allowed: false, reason: 'SMS channel is disabled', autonomy: ACTION_AUTONOMY_LEVELS.HUMAN_ONLY }
    }
    if (context.consent_state !== 'opted_in' && context.consent_state !== 'express') {
      return { allowed: false, reason: 'SMS outreach blocked: customer has not provided express consent', autonomy: ACTION_AUTONOMY_LEVELS.HUMAN_ONLY }
    }
  }

  // 4. Autonomy Level Check
  const autonomy = ACTION_AUTONOMY_MAP[actionName] || ACTION_AUTONOMY_LEVELS.AUTOMATIC
  if (autonomy === ACTION_AUTONOMY_LEVELS.HUMAN_ONLY) {
    return {
      allowed: false,
      reason: `Action "${actionName}" is strictly HUMAN_ONLY and cannot be executed autonomously by AI`,
      autonomy,
    }
  }

  // 5. Business Hours / Handoff SLA Rules
  let handoffSlaMinutes = 15
  if (context.lead_temperature === 'HOT') {
    handoffSlaMinutes = context.is_open_hours ? 5 : 60
  }

  return {
    allowed: true,
    autonomy,
    requires_confirmation: autonomy === ACTION_AUTONOMY_LEVELS.CUSTOMER_CONFIRMATION,
    sla_target_minutes: handoffSlaMinutes,
  }
}
