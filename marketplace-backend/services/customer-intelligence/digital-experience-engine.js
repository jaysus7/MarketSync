/**
 * MarketSync Customer Intelligence — Digital Experience, Video Intelligence & Rich UI Components.
 *
 * Recommends personalized MarketSync Video types, supports remote buyer workflows,
 * and formats rich interactive chat components (vehicle cards, comparison cards, quick replies).
 */

export const CHAT_COMPONENT_TYPES = {
  VEHICLE_CARD: 'vehicle_card',
  COMPARISON_CARD: 'comparison_card',
  APPOINTMENT_PICKER: 'appointment_picker',
  TRADE_START_CARD: 'trade_start_card',
  QUICK_REPLIES: 'quick_replies',
  VIDEO_CARD: 'video_card',
}

export function recommendVideoEngagement(customerContext = {}) {
  const { is_remote, asks_about_condition, compares_features, high_intent } = customerContext

  if (is_remote || asks_about_condition) {
    return {
      recommended: true,
      video_type: 'walkaround_and_condition',
      suggested_action: 'Offer personalized 60-second HD walkaround video focusing on vehicle interior and condition',
    }
  }
  if (compares_features) {
    return {
      recommended: true,
      video_type: 'feature_demonstration',
      suggested_action: 'Offer feature demonstration video highlighting requested infotainment and seating tech',
    }
  }
  return { recommended: false }
}

export function formatRichChatComponent(type, data = {}) {
  return {
    type,
    payload: data,
    rendered_at: new Date().toISOString(),
  }
}
