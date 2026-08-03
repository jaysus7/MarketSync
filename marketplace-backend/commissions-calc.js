// Pure commission math — NO IO, safe to unit-test. commissions.js re-exports these and
// keeps all the DB/event orchestration. Extracted verbatim from the existing engine so
// behavior is unchanged; the only new thing is that it's now importable without env/DB.
// AI never computes payable amounts — these are deterministic formulas.

export const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
export const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100

// Merge a per-deal override on top of the plan config (per-vehicle customization).
export function mergeConfig(plan, override) {
  const base = plan || {}
  if (!override || typeof override !== 'object') return base
  return {
    ...base,
    front: { ...(base.front || {}), ...(override.front || {}) },
    back: { ...(base.back || {}), ...(override.back || {}) },
    spiff_per_deal: override.spiff_per_deal != null ? override.spiff_per_deal : base.spiff_per_deal,
    bonuses: base.bonuses || [],
  }
}

// The core calc. Front: percent of (gross − pack), a flat amount, or the greater of the
// two, with an optional minimum. Back (F&I): percent of the F&I product revenue or a flat.
export function computeCommission(deal, planConfig, override) {
  const cfg = mergeConfig(planConfig, override)
  const front = cfg.front || {}
  const back = cfg.back || {}
  const price = n(deal.selling_price)
  const hasCost = deal.cost != null && n(deal.cost) > 0
  // Pack is what the store keeps off the top before the rep's %. Flat $ or % of price.
  const pack = (front.pack_type === 'percent') ? round2(price * (n(front.pack) / 100)) : n(front.pack)
  const frontGross = hasCost ? Math.max(0, price - n(deal.cost) - pack) : null
  const pct = frontGross != null ? frontGross * (n(front.percent) / 100) : 0
  const flat = n(front.flat)
  const method = front.method || 'greater'
  let frontAmt
  if (method === 'flat') frontAmt = flat
  else if (method === 'percent') frontAmt = frontGross != null ? pct : flat   // no cost → fall back to flat/mini
  else frontAmt = Math.max(pct, flat)                                          // 'greater'
  // Optional minimum commission (a floor the rep always earns on a deal).
  const min = n(front.min)
  if (min > 0 && frontAmt < min) frontAmt = min

  const fniItems = Array.isArray(deal.fni_items) ? deal.fni_items : []
  const fniGross = fniItems.reduce((s, x) => s + n(x?.price), 0)
  const backAmt = (back.method === 'flat') ? n(back.flat) : fniGross * (n(back.percent) / 100)

  const spiff = n(cfg.spiff_per_deal)
  return {
    front_amount: round2(frontAmt),
    back_amount: round2(backAmt),
    spiff_amount: round2(spiff),
    total: round2(frontAmt + backAmt + spiff),
    breakdown: {
      front_gross: frontGross, fni_gross: round2(fniGross), pack,
      front_method: method, front_percent: n(front.percent), front_flat: flat, front_min: min,
      back_method: back.method || 'percent', back_percent: n(back.percent), back_flat: n(back.flat),
      cost_known: hasCost,
    },
  }
}

// F&I (back-end) amount from a given back config.
export function computeBackAmount(deal, backCfg) {
  const fniGross = (Array.isArray(deal.fni_items) ? deal.fni_items : []).reduce((s, x) => s + n(x?.price), 0)
  return round2((backCfg?.method === 'flat') ? n(backCfg?.flat) : fniGross * (n(backCfg?.percent) / 100))
}

// Volume bonus from a plan's tiers, given the rep's period units + gross. Pays the single
// highest tier met per basis (units, gross), summed across bases.
export function volumeBonus(planConfig, units, gross) {
  const rules = Array.isArray(planConfig?.bonuses) ? planConfig.bonuses : []
  let byUnits = 0, byGross = 0
  for (const r of rules) {
    const thr = n(r.threshold), amt = n(r.amount)
    if (r.basis === 'gross') { if (gross >= thr && amt > byGross) byGross = amt }
    else { if (units >= thr && amt > byUnits) byUnits = amt }
  }
  return round2(byUnits + byGross)
}
