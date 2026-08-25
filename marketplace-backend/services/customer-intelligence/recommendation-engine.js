/**
 * MarketSync Customer Intelligence — Customer Fit & Alternative Vehicle Recovery Engine.
 *
 * Evaluates live in-stock inventory against customer constraints, calculates fit scores,
 * generates human-readable matching reasons, and recovers when target units sell or exceed budget.
 */

/**
 * Evaluates a vehicle against customer preferences and returns fit score and explainable reasons.
 */
export function scoreVehicleFit(vehicle = {}, customerPreferences = {}) {
  const reqs = customerPreferences || {}
  let score = 50
  const reasons = []
  const mismatches = []

  // 1. Budget & Price
  if (reqs.max_price && vehicle.price) {
    if (vehicle.price <= reqs.max_price) {
      score += 20
      reasons.push(`Priced at $${vehicle.price.toLocaleString()}, comfortably under your $${reqs.max_price.toLocaleString()} budget`)
    } else if (vehicle.price <= reqs.max_price * 1.05) {
      score += 5
      reasons.push(`Within 5% of your target budget`)
    } else {
      score -= 25
      mismatches.push(`Priced at $${vehicle.price.toLocaleString()}, exceeding target budget`)
    }
  }

  // 2. Body Style
  if (reqs.body_style && vehicle.body_style) {
    if (vehicle.body_style.toLowerCase() === reqs.body_style.toLowerCase()) {
      score += 15
      reasons.push(`Matches requested ${vehicle.body_style} body style`)
    }
  }

  // 3. Drivetrain / AWD
  if (reqs.must_have_awd) {
    const isAwd = /\b(awd|4wd|4x4|all-?wheel)\b/i.test(`${vehicle.drivetrain || ''} ${vehicle.trim || ''} ${vehicle.description || ''}`)
    if (isAwd) {
      score += 20
      reasons.push('Equipped with All-Wheel Drive (AWD/4WD)')
    } else {
      score -= 30
      mismatches.push('Missing requested AWD/4WD')
    }
  }

  // 4. Seating / 3rd Row
  if (reqs.must_have_3rd_row) {
    const has3rd = /\b(3rd row|third row|7 passenger|8 passenger)\b/i.test(`${vehicle.description || ''} ${vehicle.trim || ''}`)
    if (has3rd) {
      score += 20
      reasons.push('Includes 3rd row seating')
    } else {
      score -= 30
      mismatches.push('Missing 3rd row seating')
    }
  }

  // 5. Must-have features matching
  if (Array.isArray(reqs.must_have_features) && reqs.must_have_features.length) {
    const text = `${vehicle.features?.join(' ') || ''} ${vehicle.description || ''}`.toLowerCase()
    for (const feat of reqs.must_have_features) {
      if (text.includes(feat.toLowerCase())) {
        score += 10
        reasons.push(`Includes requested ${feat}`)
      }
    }
  }

  // 6. Mileage preference
  if (reqs.max_mileage && vehicle.mileage) {
    if (vehicle.mileage <= reqs.max_mileage) {
      score += 10
      reasons.push(`Low mileage: ${vehicle.mileage.toLocaleString()} mi/km`)
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)))

  return {
    vehicle_id: vehicle.id,
    fit_score: finalScore,
    is_match: finalScore >= 60 && mismatches.length === 0,
    reasons: reasons.length ? reasons : ['Comparable in-stock inventory match'],
    mismatches,
  }
}

/**
 * Finds recovery alternatives when a vehicle is unavailable or exceeds budget.
 */
export function findAlternativeRecoveryOptions(unavailableVehicle, inventoryList = [], customerPreferences = {}) {
  const list = (inventoryList || []).filter(v => v.id !== unavailableVehicle?.id && v.status === 'available')
  if (!list.length) return []

  const targetMake = unavailableVehicle?.make?.toLowerCase()
  const targetPrice = unavailableVehicle?.price || customerPreferences?.max_price || 999999
  const targetBody = unavailableVehicle?.body_style?.toLowerCase() || customerPreferences?.body_style?.toLowerCase()

  const scored = list.map(v => {
    let affinity = 0
    const reasons = []

    // Same Make & Model
    if (targetMake && v.make?.toLowerCase() === targetMake) {
      affinity += 30
      if (v.model?.toLowerCase() === unavailableVehicle?.model?.toLowerCase()) {
        affinity += 30
        reasons.push(`Same ${v.year} ${v.make} ${v.model} model`)
      } else {
        reasons.push(`Same ${v.make} brand lineup`)
      }
    }

    // Same Body Style
    if (targetBody && v.body_style?.toLowerCase() === targetBody) {
      affinity += 20
      reasons.push(`Same ${v.body_style} category`)
    }

    // Comparable Price Range
    if (v.price && targetPrice) {
      const diff = Math.abs(v.price - targetPrice)
      if (diff <= 3000) {
        affinity += 20
        reasons.push(`Similar price point ($${v.price.toLocaleString()})`)
      }
    }

    return {
      vehicle: v,
      affinity_score: affinity,
      recovery_reasons: reasons,
    }
  }).sort((a, b) => b.affinity_score - a.affinity_score)

  return scored.slice(0, 3)
}
