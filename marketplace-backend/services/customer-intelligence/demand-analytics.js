/**
 * MarketSync Customer Intelligence — Aggregate Shopper Demand & Objection Analytics.
 *
 * Aggregates vehicle demand signals (body styles, features, payment bands) and objection patterns
 * across conversations for dealership management and inventory ordering.
 */

export function aggregateDemandSignals(conversationStates = []) {
  const bodyStyles = {}
  const paymentBands = {
    under_400: 0,
    '400_600': 0,
    '600_800': 0,
    over_800: 0,
  }
  const topFeatures = {}
  const objectionCounts = {}

  for (const s of conversationStates) {
    // Body Style
    const bs = s.vehicle_interest?.body_style?.value
    if (bs) bodyStyles[bs] = (bodyStyles[bs] || 0) + 1

    // Payment Comfort
    const pmt = s.purchase_state?.payment_comfort?.value
    if (pmt) {
      const num = parseInt(String(pmt).replace(/\D/g, ''), 10)
      if (num < 400) paymentBands.under_400 += 1
      else if (num <= 600) paymentBands['400_600'] += 1
      else if (num <= 800) paymentBands['600_800'] += 1
      else paymentBands.over_800 += 1
    }

    // Must have features
    const feats = s.vehicle_interest?.must_have_features || []
    for (const f of feats) {
      topFeatures[f] = (topFeatures[f] || 0) + 1
    }

    // Objections
    const objs = s.objections?.active_objections || []
    for (const o of objs) {
      const t = o.label || o.type
      objectionCounts[t] = (objectionCounts[t] || 0) + 1
    }
  }

  return {
    total_conversations_analyzed: conversationStates.length,
    body_style_demand: bodyStyles,
    payment_band_demand: paymentBands,
    top_requested_features: topFeatures,
    objection_frequency: objectionCounts,
  }
}
