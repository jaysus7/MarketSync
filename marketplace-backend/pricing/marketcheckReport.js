// Shared MarketCheck price-report builder.
//
// Produces the SAME full report payload the on-demand /ai/price-report endpoint
// builds from MarketCheck data — including the action verdict (ok / raise / lower)
// — so the nightly whole-lot job can pre-generate reports for every used vehicle
// and the modal cache (price_reports) stays valid and complete.
//
// NOTE: routes/ai.js has a parallel inline copy of this MarketCheck path. Keep the
// verdict rubric + estimate shape in sync until that route is migrated onto this
// module. Best-effort throughout: never throws — returns null when it can't build.
import Anthropic from '@anthropic-ai/sdk'

const PRICE_MIN_COMPS = Number(process.env.PRICE_MIN_COMPS || 8)

// The verdict rubric — turns a raw price-vs-market number into an ACTION by weighing
// the same things a person does when appraising, in priority order. Mirrors ai.js.
function verdictGuidance({ daysOnLot, todayContext, year }) {
  return `PRICING VERDICT — the dealer needs an ACTION, not just a number. Weigh these IN THIS ORDER:
1. Days on lot (${daysOnLot == null ? 'unknown' : daysOnLot + ' days'}) and realistic days-to-sell — THE MOST IMPORTANT factor. A unit sitting well past a normal turn is a strong reason to lower; a fresh unit has room to hold or raise.
2. Mileage vs market.
3. Colour desirability, overall condition/quality, and any accident history (reduces value).
4. Seasonality — today is ${todayContext}. Weigh seasonal demand (AWD/4x4/trucks stronger heading into winter, convertibles/sporty in spring/summer, year-end clearance pressure as the calendar year closes).
5. Model-year cycle — this is a ${year}. Consider whether a redesign/refresh is imminent or already happened: if it is now the previous-generation "old style" it should sit below the newer one; a fresh redesign can command more; the closer next-year models are to landing, the more aging pressure on older-year units.
Then classify:
- "ok"    → the current price is appropriate once ALL of the above are considered — EVEN IF it is above or below raw market average.
- "raise" → genuinely UNDERPRICED and leaving money on the table; recommend raising.
- "lower" → genuinely OVERPRICED for its situation and will sit too long; recommend lowering.
Only choose "raise" or "lower" when the price should actually change. When comps are thin or not trim-matched, default to "ok".`
}

// Build the full price-report payload for one vehicle from a MarketCheck result.
// Returns { payload, pricingVerdict } or null when there's no usable median.
export async function buildMarketCheckReport({ vehicle, dealer, mc }) {
  if (!mc || !mc.median_price || !vehicle?.price) return null

  const countryRaw = (dealer?.country || '').trim().toUpperCase()
  const isUS = countryRaw === 'US' || countryRaw === 'USA' || countryRaw === 'UNITED STATES'
  const currency = isUS ? 'USD' : 'CAD'
  const marketLabel = isUS ? 'US' : 'Canadian'
  const distanceUnit = isUS ? 'miles' : 'km'
  const location = [dealer?.city, dealer?.province].filter(Boolean).join(', ') || (isUS ? 'United States' : 'Canada')
  const trimText = vehicle.trim ? ` ${vehicle.trim}` : ''
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${trimText}`
  const vehicleMileage = vehicle.mileage ? Number(vehicle.mileage) : null
  const mileageText = vehicleMileage ? `${vehicleMileage.toLocaleString()} ${distanceUnit}` : 'unknown mileage'
  const yourPrice = Number(vehicle.price)

  const _lotRef = vehicle.lot_date || vehicle.created_at
  const daysOnLot = _lotRef ? Math.max(0, Math.floor((Date.now() - new Date(_lotRef)) / 86400000)) : null
  const _now = new Date()
  const todayContext = `${_now.toISOString().slice(0, 10)} (${_now.toLocaleString('en-US', { month: 'long' })})`

  const mid = mc.median_price
  const pct_diff = Math.round(((yourPrice - mid) / mid) * 1000) / 10
  const ptm = Math.round((yourPrice / mid) * 100)
  const _hasTrim = !!(vehicle.trim && String(vehicle.trim).trim())
  const _trimMatched = mc.matched_on ? !!mc.matched_on.trim : null
  const reliable = Math.abs(pct_diff) <= 45
    && (mc.count == null || mc.count >= PRICE_MIN_COMPS)
    && !(_hasTrim && _trimMatched === false && Math.abs(pct_diff) > 15)

  let mileageRating = 'average', mileageImpact = 0
  if (mc.median_mileage && vehicleMileage) {
    const d = (vehicleMileage - mc.median_mileage) / mc.median_mileage
    mileageRating = d <= -0.3 ? 'well below average' : d <= -0.1 ? 'below average'
      : d >= 0.3 ? 'well above average' : d >= 0.1 ? 'above average' : 'average'
    const rate = isUS ? 0.10 : 0.08
    mileageImpact = Math.max(-4000, Math.min(4000, Math.round((mc.median_mileage - vehicleMileage) * rate)))
  }

  let note = `Based on ${mc.count.toLocaleString()} comparable ${marketLabel} listings, the market average for this ${vehicleLabel} is $${mid.toLocaleString()} ${currency}. Your price is ${Math.abs(pct_diff)}% ${pct_diff > 0 ? 'above' : pct_diff < 0 ? 'below' : 'in line with'} market.`
  if (!reliable) {
    note = `Low-confidence read: the ${mc.count.toLocaleString()} comparable listings we found aren't a clean like-for-like match. Verify the trim against a book (Black Book/vAuto) before repricing — don't treat the % to market as exact.`
  }

  let pricingVerdict = 'ok', verdictHeadline = null, verdictReason = null
  let daysToSell = pct_diff > 15 ? 75 : pct_diff > 5 ? 55 : pct_diff < -5 ? 25 : 40
  try {
    if (reliable && process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 600,
        system: 'You are a dealer-grade automotive pricing analyst. Respond with ONLY one valid JSON object — no markdown, no preamble.',
        messages: [{ role: 'user', content: `Vehicle: ${vehicleLabel}, ${mileageText}${vehicle.exterior_color ? ', ' + vehicle.exterior_color : ''}, listed at $${yourPrice.toLocaleString()} ${currency} in ${location}.
Real market data from ${mc.count} comparable listings: average $${mid.toLocaleString()} ${currency} (range $${mc.low_price.toLocaleString()}–$${mc.high_price.toLocaleString()}), average mileage ${mc.median_mileage ? mc.median_mileage.toLocaleString() + ' ' + distanceUnit : 'n/a'}. The listing is ${Math.abs(pct_diff)}% ${pct_diff > 0 ? 'above' : 'below'} market. Mileage rating: ${mileageRating}.

${verdictGuidance({ daysOnLot, todayContext, year: vehicle.year })}

Respond with ONLY this JSON:
{"insight":"<two plain, specific, factual sentences of market insight for the dealer>","verdict":"ok"|"raise"|"lower","headline":"<max 6 words>","reason":"<one or two sentences citing the deciding factors: days on lot, mileage, season, model cycle>","days_to_sell":<integer realistic days to sell at this price>}` }]
      })
      const t = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
      const j = t ? JSON.parse(t.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()) : null
      if (j) {
        if (j.insight) note = String(j.insight)
        if (['ok', 'raise', 'lower'].includes(j.verdict)) pricingVerdict = j.verdict
        if (j.headline) verdictHeadline = String(j.headline)
        if (j.reason) verdictReason = String(j.reason)
        if (Number.isFinite(Number(j.days_to_sell))) daysToSell = Math.round(Number(j.days_to_sell))
      }
    }
  } catch { /* verdict best-effort */ }
  if (!reliable) {
    pricingVerdict = 'ok'
    verdictHeadline = 'Low-confidence read'
    verdictReason = 'Comps are thin or not trim-matched — verify against a book before repricing.'
  }

  const estimate = {
    low: mc.low_price, mid, high: mc.high_price, currency,
    price_to_market_pct: ptm,
    days_on_market_estimate: daysToSell,
    pricing_verdict: pricingVerdict,
    verdict_headline: verdictHeadline,
    verdict_reason: verdictReason,
    confidence: !reliable ? 'low' : mc.count >= 25 ? 'high' : mc.count >= 8 ? 'medium' : 'low',
    reliable,
    trim_matched: _trimMatched,
    comp_count: mc.count ?? null,
    note,
    marketplace_averages: [
      { name: 'MarketCheck (live market)', avg: mid, estimated_listings: `${mc.count.toLocaleString()} listings`, avg_mileage: mc.median_mileage || null },
    ],
    mileage_analysis: {
      market_avg_mileage: mc.median_mileage || null,
      mileage_rating: mileageRating,
      mileage_price_impact: mileageImpact,
      mileage_note: mc.median_mileage && vehicleMileage
        ? `At ${vehicleMileage.toLocaleString()} ${distanceUnit} vs a market average of ${mc.median_mileage.toLocaleString()} ${distanceUnit}, this unit is ${mileageRating}.`
        : 'Mileage comparison unavailable.',
    },
    comps: (mc.listings || [])
      .filter(l => Number(l.price) > 0)
      .sort((a, b) => (a.price || 0) - (b.price || 0))
      .slice(0, 20)
      .map(l => ({ year: l.year ?? null, trim: l.trim ?? null, price: l.price ?? null, mileage: l.miles ?? null, region: l.region ?? null, dealer: l.dealer ?? null, url: l.vdp_url ?? null })),
  }

  const payload = { vehicle, estimate, pct_diff, data_source: 'marketcheck', copart: null }
  return { payload, pricingVerdict }
}
