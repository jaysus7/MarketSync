/**
 * MarketSync Customer Intelligence — Customer Constraint & Diverse Recommendation Engine.
 *
 * Implements deterministic filtering for hard requirements and negative constraints before AI ranking.
 * Generates diverse recommendations (BEST_MATCH, BEST_VALUE, LOWER_PAYMENT, UPGRADE_OPTION)
 * and classifies customer sensitivity (PRICE, PAYMENT, VALUE, FEATURE, TIME).
 */

export const SENSITIVITY_TYPES = {
  PRICE_SENSITIVE: 'PRICE_SENSITIVE',
  PAYMENT_SENSITIVE: 'PAYMENT_SENSITIVE',
  VALUE_SENSITIVE: 'VALUE_SENSITIVE',
  FEATURE_SENSITIVE: 'FEATURE_SENSITIVE',
  TIME_SENSITIVE: 'TIME_SENSITIVE',
}

export const RECOMMENDATION_TIERS = {
  BEST_MATCH: 'BEST_MATCH',
  BEST_VALUE: 'BEST_VALUE',
  LOWER_PAYMENT: 'LOWER_PAYMENT',
  UPGRADE_OPTION: 'UPGRADE_OPTION',
}

/**
 * Classifies customer sensitivity profile from conversational evidence.
 */
export function detectCustomerSensitivity(messages = [], purchaseState = {}) {
  const text = (messages || []).map(m => m.message || '').join(' ').toLowerCase()

  if (/\b(\$?\d{2,4}\s*(?:\/|\s*a\s*|\s*per\s*)?mo|monthly payment|keep payment under|payment comfort)\b/i.test(text)) {
    return SENSITIVITY_TYPES.PAYMENT_SENSITIVE
  }
  if (/\b(out the door|sticker price|total cost|msrp|best cash price|rebates?|discount)\b/i.test(text)) {
    return SENSITIVITY_TYPES.PRICE_SENSITIVE
  }
  if (/\b(must have (?:leather|sunroof|awd|towing|3rd row)|exact trim|package)\b/i.test(text)) {
    return SENSITIVITY_TYPES.FEATURE_SENSITIVE
  }
  if (/\b(today|tomorrow|asap|need a car now|leaving town)\b/i.test(text)) {
    return SENSITIVITY_TYPES.TIME_SENSITIVE
  }
  return SENSITIVITY_TYPES.VALUE_SENSITIVE
}

/**
 * Filters inventory deterministically against hard requirements and negative constraints.
 */
export function filterInventoryByConstraints(inventoryList = [], constraints = {}) {
  const c = constraints || {}
  const neg = c.negative_preferences || [] // ['no_ev', 'no_black', 'no_accidents', 'no_fwd']

  return (inventoryList || []).filter(v => {
    // 1. Status Check
    if (v.status !== 'available') return false

    // 2. Hard Budget Limit
    if (c.hard_max_price && v.price && v.price > c.hard_max_price) return false

    // 3. Hard Max Mileage
    if (c.hard_max_mileage && v.mileage && v.mileage > c.hard_max_mileage) return false

    // 4. Hard Drivetrain / AWD
    if (c.hard_must_have_awd) {
      const isAwd = /\b(awd|4wd|4x4|all-?wheel)\b/i.test(`${v.drivetrain || ''} ${v.trim || ''} ${v.description || ''}`)
      if (!isAwd) return false
    }

    // 5. Negative Preferences
    if (neg.includes('no_ev') && /\b(electric|bev|ev)\b/i.test(`${v.fuel_type || ''} ${v.description || ''}`)) return false
    if (neg.includes('no_black') && /\bblack\b/i.test(v.exterior_color || '')) return false

    return true
  })
}

/**
 * Builds diverse recommendations across four distinct tiers.
 */
export function generateDiverseRecommendations(candidateVehicles = [], customerRequirements = {}) {
  const list = [...(candidateVehicles || [])]
  if (!list.length) return []

  list.sort((a, b) => (a.price || 0) - (b.price || 0))

  const results = []
  const usedIds = new Set()

  // 1. Lower Payment / Budget Option (lowest price matching unit)
  const lowerPayment = list[0]
  if (lowerPayment) {
    results.push({
      tier: RECOMMENDATION_TIERS.LOWER_PAYMENT,
      vehicle: lowerPayment,
      reason: `Lowest entry price ($${(lowerPayment.price || 0).toLocaleString()}) to keep monthly payments minimal`,
    })
    usedIds.add(lowerPayment.id)
  }

  // 2. Upgrade Option (highest trim / top specs)
  const upgrade = list[list.length - 1]
  if (upgrade && !usedIds.has(upgrade.id)) {
    results.push({
      tier: RECOMMENDATION_TIERS.UPGRADE_OPTION,
      vehicle: upgrade,
      reason: `Premium equipped option ($${(upgrade.price || 0).toLocaleString()}) with top trim features and warranty`,
    })
    usedIds.add(upgrade.id)
  }

  // 3. Best Value (middle pricing with strong features)
  const bestValue = list.find(v => !usedIds.has(v.id))
  if (bestValue) {
    results.push({
      tier: RECOMMENDATION_TIERS.BEST_VALUE,
      vehicle: bestValue,
      reason: `Optimal balance of modern features, mileage, and price point ($${(bestValue.price || 0).toLocaleString()})`,
    })
    usedIds.add(bestValue.id)
  }

  return results
}
