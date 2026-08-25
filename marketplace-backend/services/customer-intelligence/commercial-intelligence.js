/**
 * MarketSync Customer Intelligence — Commercial & Fleet Buyer Intelligence Engine.
 *
 * Detects commercial purchase signals (work trucks, fleet orders, upfitting, commercial financing),
 * extracts business profiles, and coordinates commercial sales routing.
 */

export function detectCommercialBuyerIntent(message = '', conversationHistory = []) {
  const text = `${message} ${(conversationHistory || []).map(m => m.message || '').join(' ')}`.toLowerCase()

  const isCommercial = /\b(fleet|commercial|business use|work truck|service body|dump body|flatbed|box truck|upfit|cargo van|transit van|pro master|contractor|plumbing business|llc|inc|tax exempt|multiple vehicles|2 trucks|3 vans)\b/i.test(text)

  if (!isCommercial) {
    return {
      is_commercial: false,
      confidence: 0,
      profile: null,
    }
  }

  // Extract fleet count if mentioned
  const countMatch = text.match(/\b(\d{1,2})\s*(?:[a-z]+\s+)?(?:trucks|vans|vehicles|units|cars)\b/i)
  const vehicleCount = countMatch ? parseInt(countMatch[1], 10) : 1

  // Extract upfit requirements
  const upfits = []
  if (/\b(plow|snow plow)\b/i.test(text)) upfits.push('Snow Plow prep')
  if (/\b(service body|utility body)\b/i.test(text)) upfits.push('Utility/Service Body')
  if (/\b(flatbed|stake body)\b/i.test(text)) upfits.push('Flatbed')
  if (/\b(ladder rack|shelving)\b/i.test(text)) upfits.push('Shelving & Ladder Racks')

  return {
    is_commercial: true,
    confidence: 0.92,
    profile: {
      vehicle_count: vehicleCount,
      business_use: true,
      upfits_required: upfits,
      towing_payload_critical: /\b(payload|towing capacity|gvwr|gooseneck|fifth wheel)\b/i.test(text),
      commercial_financing_interest: /\b(commercial lease|trac lease|section 179|business credit|commercial financing)\b/i.test(text),
    },
    suggested_department: 'Sales',
    recommended_rep_type: 'commercial_fleet_specialist',
  }
}
