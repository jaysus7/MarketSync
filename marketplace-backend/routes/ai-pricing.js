/**
 * AI inventory-intelligence + pricing routes (extracted from ai.js).
 * Market positions, lot report, price report, repricing, stocking, inventory
 * intelligence, AI Vision scans, and competitor tracking.
 */
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin, resend, EMAIL_FROM, FRONTEND_URL, browserFetch } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { marketcheckMarket, marketcheckListings, marketcheckEnabled, marketcheckCompetitorStats, marketcheckPing, marketcheckDecodeVin, marketcheckPredictPrice, marketcheckMarketStats } from '../marketcheck.js'
import { getMarketData, getSoldData, recordUsage, aiAllowed, getUsage, assistantDailyAllowed, recordAssistantChat, ASSISTANT_DAILY_LIMIT, marketcheckAllowed, recordMarketcheckCall } from '../usage.js'
import { findOrCreateContact } from './crm.js'
import { buildEquityRadar } from './equity.js'
import { buildMarketingRoi } from './marketing.js'
import { createNotification, createNotifications } from '../notifications.js'
import { runPhotoVision, scoreVehiclePhotos } from '../sync/photoVision.js'
import { fetchOemWindowStickerPdf } from '../utils/oemWindowSticker.js'
import { lookupPlate, plateLookupConfigured } from '../providers/plateLookup.js'
import {
  isPlatformOwner, attachOemStickerToInventory, LANG_NAME, langName,
  PRODUCT_KB, ASSISTANT_TOOLS, REPORT_TOPICS,
  buildDealershipReport, runAssistantTool,
  skipPriceComp, PRICE_MIN_COMPS, buildPriceFlag, aiErrorMessage,
  marketMedianForScan, median, mileageAdjustedMedian,
  computeDailyDigest,
} from './ai-helpers.js'

import { registerAiCompetitorVisionRoutes } from './submodules/ai-competitor-vision.js'
import { registerAiInventoryIntelRoutes } from './submodules/ai-inventory-intel.js'

export function registerAiPricing(app) {
  registerAiCompetitorVisionRoutes(app)
  registerAiInventoryIntelRoutes(app)

  // GET /ai/market-positions — latest market median per inventory_id (from the most
  // recent Inventory Scan). Powers the "% to market" badge on used inventory cards.
  // Inventory Intelligence add-on only; returns {} otherwise (so the UI stays hidden).
  app.get('/ai/market-positions', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ positions: {}, active: false })
    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('inv_intel_active').eq('id', req.dealershipId).maybeSingle()
    const isOwner = isPlatformOwner(req)
    // Inventory Intelligence is included in package
    const { data: acts } = await supabaseAdmin
      .from('ai_activity')
      .select('inventory_id, price_median, comp_count, trim_matched, created_at')
      .eq('dealership_id', req.dealershipId)
      .not('price_median', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3000)
    // Keep the newest median per vehicle (rows come newest-first). `meta` carries the
    // comp quality so the badge can show count + whether it was trim-matched.
    const positions = {}, meta = {}
    for (const a of acts || []) {
      if (a.inventory_id && positions[a.inventory_id] == null) {
        positions[a.inventory_id] = a.price_median
        meta[a.inventory_id] = { count: a.comp_count ?? null, trim_matched: a.trim_matched ?? null }
      }
    }

    // Action verdict per vehicle (ok / raise / lower) from the cached price reports —
    // powers the green/amber/red tag on inventory cards. Only surfaced when the report
    // was generated at the vehicle's CURRENT price (a price change makes it stale).
    const verdicts = {}
    const { data: reports } = await supabaseAdmin
      .from('price_reports')
      .select('inventory_id, report, price_at_generation, generated_at')
      .eq('dealership_id', req.dealershipId)
      .limit(5000)
    for (const r of reports || []) {
      const est = r.report?.estimate
      const v = est?.pricing_verdict
      if (!r.inventory_id || !v) continue
      verdicts[r.inventory_id] = {
        verdict: v,
        headline: est.verdict_headline || null,
        reason: est.verdict_reason || null,
        price_at_generation: r.price_at_generation ?? null,
        generated_at: r.generated_at || null,
      }
    }
    res.json({ positions, meta, verdicts, active: true })
  })

  // GET /ai/lot-report — aggregate the whole lot against AutoTrader/CarGurus market
  // averages. Built from the most recent scan (ai_activity.price_median per vehicle)
  // so it's instant and free — run "Scan All Inventory" first to refresh the comps.
  app.get('/ai/lot-report', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('inv_intel_active').eq('id', req.dealershipId).single()
    const isOwner = isPlatformOwner(req)
    // Lot Average Report is included in package

    // Latest scan result per vehicle that produced a (reliable) market median.
    const { data: acts, error: aErr } = await supabaseAdmin
      .from('ai_activity')
      .select('inventory_id, price_median, created_at')
      .eq('dealership_id', req.dealershipId)
      .not('price_median', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3000)
    if (aErr) return res.status(500).json({ error: aErr.message })

    const latest = new Map()
    for (const a of acts || []) {
      if (a.inventory_id && !latest.has(a.inventory_id)) latest.set(a.inventory_id, a)
    }
    const ids = [...latest.keys()]
    if (!ids.length) {
      return res.json({ count: 0, vehicles: [], lot_avg: 0, market_avg: 0, overall_pct_diff: 0, over: 0, under: 0, fair: 0 })
    }

    const { data: inv } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, price, status')
      .in('id', ids)
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')

    const vehicles = []
    for (const v of inv || []) {
      const a = latest.get(v.id)
      const yourPrice = Number(v.price)
      const market = Number(a?.price_median)
      if (!yourPrice || !market) continue
      const pct = Math.round(((yourPrice - market) / market) * 1000) / 10
      // Skip implausible comps (>45% off) — almost always mismatched/thin market
      // data, not real over/under-pricing. Keeps the report honest.
      if (Math.abs(pct) > 45) continue
      vehicles.push({
        inventory_id: v.id,
        label: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle',
        your_price: yourPrice,
        market_avg: market,
        pct_diff: pct,
      })
    }
    vehicles.sort((a, b) => b.pct_diff - a.pct_diff)

    const count = vehicles.length
    const lotAvg = count ? Math.round(vehicles.reduce((s, v) => s + v.your_price, 0) / count) : 0
    const marketAvg = count ? Math.round(vehicles.reduce((s, v) => s + v.market_avg, 0) / count) : 0
    const overallPct = marketAvg ? Math.round(((lotAvg - marketAvg) / marketAvg) * 1000) / 10 : 0
    const over = vehicles.filter(v => v.pct_diff > 5).length
    const under = vehicles.filter(v => v.pct_diff < -5).length
    const fair = count - over - under

    res.json({ count, lot_avg: lotAvg, market_avg: marketAvg, overall_pct_diff: overallPct, over, under, fair, vehicles })
  })

  // GET /ai/price-report/:inventory_id — AI market estimate for a vehicle
  app.get('/ai/price-report/:inventory_id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params

    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, condition, price, mileage, exterior_color, stocknumber, status, lot_date, created_at')
      .eq('id', inventory_id)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (vErr || !vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    if (!vehicle.price || !vehicle.make || !vehicle.model || !vehicle.year) {
      return res.json({ vehicle, estimate: null, pct_diff: null })
    }

    // Current-year / new / demo units have no meaningful used-market comp set —
    // skip the calculation entirely rather than flag them against mismatched data.
    if (skipPriceComp(vehicle)) {
      return res.json({
        vehicle, estimate: null, pct_diff: null, skipped: true,
        reason: `${vehicle.year} ${vehicle.make} ${vehicle.model} is a new / current-year vehicle — there isn't a reliable used-market comparison set, so a market price report isn't generated for it.`,
      })
    }

    // Serve the cached report if it's fresh (72 hours) and the asking price hasn't
    // changed. Reports cache for 72h from generation; ?refresh=1 forces a rebuild.
    const CACHE_HOURS = 72
    if (req.query.refresh !== '1') {
      const { data: cached } = await supabaseAdmin
        .from('price_reports').select('report, price_at_generation, generated_at')
        .eq('inventory_id', inventory_id).maybeSingle()
      if (cached) {
        const ageHours = (Date.now() - new Date(cached.generated_at)) / 3600000
        const priceSame = cached.price_at_generation == null || Number(cached.price_at_generation) === Number(vehicle.price)
        if (ageHours < CACHE_HOURS && priceSame) {
          return res.json({ ...cached.report, cached: true, generated_at: cached.generated_at })
        }
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI features not configured' })
    }

    // Fetch dealership location and country for market context
    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('city, province, country, postal_code')
      .eq('id', req.dealershipId)
      .single()

    const isNew = vehicle.condition === 'new' || Number(vehicle.year) >= new Date().getFullYear()
    const conditionLabel = isNew ? 'new' : 'used'

    // Determine market (US vs Canada) based on dealership country field
    const countryRaw = (dealer?.country || '').trim().toUpperCase()
    const isUS = countryRaw === 'US' || countryRaw === 'USA' || countryRaw === 'UNITED STATES'
    const currency = isUS ? 'USD' : 'CAD'
    const marketLabel = isUS ? 'US' : 'Canadian'
    const distanceUnit = isUS ? 'miles' : 'km'
    const marketSources = isUS
      ? ['AutoTrader.com', 'CarGurus.com', 'Cars.com']
      : ['AutoTrader Canada', 'CarGurus Canada', 'Kijiji Autos']
    const location = [dealer?.city, dealer?.province].filter(Boolean).join(', ') || (isUS ? 'United States' : 'Canada')
    const mileageText = vehicle.mileage ? `${Number(vehicle.mileage).toLocaleString()} ${distanceUnit}` : 'unknown mileage'
    const trimText = vehicle.trim ? ` ${vehicle.trim}` : ''

    const [src1, src2, src3] = marketSources
    const vehicleMileage = vehicle.mileage ? Number(vehicle.mileage) : null
    const currentYear = new Date().getFullYear()
    const vehicleAge = currentYear - Number(vehicle.year)
    // Expected mileage for age: CA = 19,000 km/yr, US = 13,500 mi/yr
    const expectedMileage = isUS ? vehicleAge * 13500 : vehicleAge * 19000
    const mileageDelta = vehicleMileage != null ? vehicleMileage - expectedMileage : null
    const mileageContext = vehicleMileage != null
      ? `This vehicle has ${mileageDelta > 0 ? mileageDelta.toLocaleString() + ' ' + distanceUnit + ' MORE than expected' : Math.abs(mileageDelta).toLocaleString() + ' ' + distanceUnit + ' LESS than expected'} for its age (expected ~${expectedMileage.toLocaleString()} ${distanceUnit} for a ${vehicleAge}-year-old vehicle at typical ${marketLabel} annual rates of ${isUS ? '13,500 mi/yr' : '19,000 km/yr'}).`
      : 'Mileage unknown.'

    const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${trimText}`
    const yourPrice = Number(vehicle.price)

    // Appraisal context the verdict weighs: how long it's sat, and today's date/season.
    const _lotRef = vehicle.lot_date || vehicle.created_at
    const daysOnLot = _lotRef ? Math.max(0, Math.floor((Date.now() - new Date(_lotRef)) / 86400000)) : null
    const _now = new Date()
    const todayContext = `${_now.toISOString().slice(0, 10)} (${_now.toLocaleString('en-US', { month: 'long' })})`

    // Shared verdict rubric — turns a raw price-vs-market number into an ACTION
    // ("ok" / "raise" / "lower") by weighing the same things a person does when
    // appraising, in priority order. Reused by both the MarketCheck and AI paths.
    const verdictGuidance = `PRICING VERDICT — the dealer needs an ACTION, not just a number. Weigh these IN THIS ORDER:
1. Days on lot (${daysOnLot == null ? 'unknown' : daysOnLot + ' days'}) and realistic days-to-sell — THE MOST IMPORTANT factor. A unit sitting well past a normal turn is a strong reason to lower; a fresh unit has room to hold or raise.
2. Mileage vs market.
3. Colour desirability, overall condition/quality, and any accident history (reduces value).
4. Seasonality — today is ${todayContext}. Weigh seasonal demand (AWD/4x4/trucks stronger heading into winter, convertibles/sporty in spring/summer, year-end clearance pressure as the calendar year closes).
5. Model-year cycle — this is a ${vehicle.year}. Consider whether a redesign/refresh is imminent or already happened: if it is now the previous-generation "old style" it should sit below the newer one; a fresh redesign can command more; the closer next-year models are to landing, the more aging pressure on older-year units.
Then classify:
- "ok"    → the current price is appropriate once ALL of the above are considered — EVEN IF it is above or below raw market average. Above market is fine when justified (low km, fresh redesign, in-season demand, desirable colour); below market is fine when justified (high km, old style, off-season, aged unit priced to move).
- "raise" → genuinely UNDERPRICED and leaving money on the table; recommend raising.
- "lower" → genuinely OVERPRICED for its situation and will sit too long; recommend lowering.
Only choose "raise" or "lower" when the price should actually change. When comps are thin or not trim-matched, default to "ok".`

    // ── PRIMARY: MarketCheck licensed data ──────────────────────────────────
    // When a MarketCheck key is configured we build the report from real
    // aggregated market stats (dealer-grade, same class of data as vAuto) and use
    // the AI only for a short written insight. Falls through to an AI-only estimate
    // below when there's no key or MarketCheck has no comps for this exact vehicle.
    if (marketcheckEnabled()) {
      const _prIsOwner = isPlatformOwner(req)
      const { data: mc } = await getMarketData({
        dealershipId: req.dealershipId, isOwner: _prIsOwner, allowLive: true,
        params: {
          make: vehicle.make, model: vehicle.model, year: Number(vehicle.year),
          trim: vehicle.trim || '', mileage: vehicleMileage,
          // Same geo ladder as the appraisal/scan: 200 km → province/state → national.
          zip: dealer?.postal_code || null, radius: 200, state: dealer?.province || null,
          isUS,
        },
      })
      if (mc && mc.median_price) {
        const mid = mc.median_price
        const pct_diff = Math.round(((yourPrice - mid) / mid) * 1000) / 10
        const ptm = Math.round((yourPrice / mid) * 100)
        // Reliability: a like-for-like read. MarketCheck relaxes to "any trim of the
        // model" when a loaded trim has thin comps, which pools cheap base trims and
        // reads falsely over/under. Beyond ±45% is almost always a mismatched set.
        const _hasTrim = !!(vehicle.trim && String(vehicle.trim).trim())
        const _trimMatched = mc.matched_on ? !!mc.matched_on.trim : null
        const reliable = Math.abs(pct_diff) <= 45
          && (mc.count == null || mc.count >= PRICE_MIN_COMPS)
          && !(_hasTrim && _trimMatched === false && Math.abs(pct_diff) > 15)
        // Mileage rating vs the MarketCheck market average mileage.
        let mileageRating = 'average', mileageImpact = 0
        if (mc.median_mileage && vehicleMileage) {
          const d = (vehicleMileage - mc.median_mileage) / mc.median_mileage
          mileageRating = d <= -0.3 ? 'well below average' : d <= -0.1 ? 'below average'
            : d >= 0.3 ? 'well above average' : d >= 0.1 ? 'above average' : 'average'
          // ~$0.08/km (CA) or ~$0.10/mi (US) rough odometer adjustment, capped.
          const rate = isUS ? 0.10 : 0.08
          mileageImpact = Math.max(-4000, Math.min(4000, Math.round((mc.median_mileage - vehicleMileage) * rate)))
        }

        // Short AI insight (best-effort — the numbers stand on their own if this fails).
        let note = `Based on ${mc.count.toLocaleString()} comparable ${marketLabel} listings, the market average for this ${vehicleLabel} is ${'$' + mid.toLocaleString()} ${currency}. Your price is ${Math.abs(pct_diff)}% ${pct_diff > 0 ? 'above' : pct_diff < 0 ? 'below' : 'in line with'} market.`
        if (!reliable) {
          const reason = (_hasTrim && _trimMatched === false)
            ? 'aren’t matched to this exact trim (they include other trims of the ' + (vehicle.model || 'model') + '), so the $' + mid.toLocaleString() + ' ' + currency + ' average likely understates a loaded trim'
            : (mc.count != null && mc.count < PRICE_MIN_COMPS)
              ? 'are too thin a sample (' + mc.count.toLocaleString() + ' listing' + (mc.count === 1 ? '' : 's') + ') to trust for a rare or premium trim — the $' + mid.toLocaleString() + ' ' + currency + ' average can be well off'
              : 'give an average of $' + mid.toLocaleString() + ' ' + currency + ' that’s far from your price'
          note = `Low-confidence read: the ${mc.count.toLocaleString()} comparable listings we found ${reason}. Verify the trim against a book (Black Book/vAuto) before repricing — don’t treat the % to market as exact.`
        }
        // Verdict = the ACTION. Low-confidence reads never flag a reprice — they stay
        // "ok" with the note explaining why. Only a reliable read asks the AI to judge
        // raise / hold / lower from the full appraisal context (days-on-lot, mileage,
        // season, model-year cycle). One AI call does both insight + verdict — no extra cost.
        let pricingVerdict = 'ok', verdictHeadline = null, verdictReason = null
        let daysToSell = pct_diff > 15 ? 75 : pct_diff > 5 ? 55 : pct_diff < -5 ? 25 : 40
        try {
          if (reliable && process.env.ANTHROPIC_API_KEY) {
            const anthropicN = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
            const msg = await anthropicN.messages.create({
              model: 'claude-sonnet-5', max_tokens: 600,
              system: 'You are a dealer-grade automotive pricing analyst. Respond with ONLY one valid JSON object — no markdown, no preamble.',
              messages: [{ role: 'user', content: `Vehicle: ${vehicleLabel}, ${mileageText}${vehicle.exterior_color ? ', ' + vehicle.exterior_color : ''}, listed at $${yourPrice.toLocaleString()} ${currency} in ${location}.
Real market data from ${mc.count} comparable listings: average $${mid.toLocaleString()} ${currency} (range $${mc.low_price.toLocaleString()}–$${mc.high_price.toLocaleString()}), average mileage ${mc.median_mileage ? mc.median_mileage.toLocaleString() + ' ' + distanceUnit : 'n/a'}. The listing is ${Math.abs(pct_diff)}% ${pct_diff > 0 ? 'above' : 'below'} market. Mileage rating: ${mileageRating}.

${verdictGuidance}

Respond with ONLY this JSON:
{"insight":"<two plain, specific, factual sentences of market insight for the dealer>","verdict":"ok"|"raise"|"lower","headline":"<max 6 words, e.g. 'Priced to turn' / 'Underpriced — room to raise' / 'Overpriced — trim to sell'>","reason":"<one or two sentences citing the deciding factors: days on lot, mileage, season, model cycle>","days_to_sell":<integer realistic days to sell at this price>}` }]
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
        } catch { /* insight/verdict best-effort — the numbers stand on their own */ }
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
          // The actual comps behind the average, so the dealer can verify the match
          // (right trim? right mileage?) instead of trusting a black-box number.
          comps: (mc.listings || [])
            .filter(l => Number(l.price) > 0)
            .sort((a, b) => (a.price || 0) - (b.price || 0))
            .slice(0, 20)
            .map(l => ({ year: l.year ?? null, trim: l.trim ?? null, price: l.price ?? null, mileage: l.miles ?? null, region: l.region ?? null, dealer: l.dealer ?? null, url: l.vdp_url ?? null })),
        }

        const payload = { vehicle, estimate, pct_diff, data_source: 'marketcheck', copart: null }
        supabaseAdmin.from('price_reports').upsert({
          inventory_id, dealership_id: req.dealershipId, report: payload,
          price_at_generation: yourPrice, generated_at: new Date().toISOString(),
        }, { onConflict: 'inventory_id' }).then(({ error }) => {
          if (error) console.warn('[price-report] cache write failed:', error.message)
        })
        return res.json(payload)
      }
    }

    // ── FALLBACK: AI estimate (no live comps) ────────────────────────────────
    // Reached only when MarketCheck has no key or no comps for this exact vehicle.
    // We no longer scrape retail sites; the AI produces a training-knowledge
    // estimate and the report is clearly marked ai_estimate.
    const scraped = { autotrader: null, cargurus: null, copart: null }
    const dataSource = 'ai_estimate'

    // Build real-data context lines to inject into the prompt
    const liveDataLines = []
    const fmtScraped = (s) => {
      const daysNote = s.avg_days_online != null
        ? `, avg days online ${s.avg_days_online} (${s.days_online_sample}/${s.count} listings had date)`
        : ''
      return `avg price $${s.avg_price.toLocaleString()} ${currency}, median price $${s.median_price.toLocaleString()}, avg mileage ${s.avg_mileage.toLocaleString()} ${distanceUnit}, median mileage ${s.median_mileage.toLocaleString()} ${distanceUnit}${daysNote}`
    }

    if (scraped.autotrader) liveDataLines.push(`LIVE ${src1} data (${scraped.autotrader.count} listings): ${fmtScraped(scraped.autotrader)}`)
    if (scraped.cargurus) liveDataLines.push(`LIVE ${src2} data (${scraped.cargurus.count} listings): ${fmtScraped(scraped.cargurus)}`)
    if (scraped.copart) {
      const cp = scraped.copart
      liveDataLines.push(`AUCTION REFERENCE — Copart Canada (${cp.count} salvage/insurance lots): avg $${cp.avg_price.toLocaleString()} ${currency}, median $${cp.median_price.toLocaleString()}, avg mileage ${cp.avg_mileage.toLocaleString()} ${distanceUnit} — these are WHOLESALE/SALVAGE values, expect retail to be 40–80% higher`)
    }

    const liveDataBlock = liveDataLines.length
      ? `\nREAL SCRAPED MARKET DATA — use these as your primary anchors for pricing, mileage, and days-on-market:\n${liveDataLines.join('\n')}\n`
      : `\nNo live scrape data available — use your training knowledge of the ${marketLabel} market.\n`

    // Compute combined avg days online across retail platforms (for days_on_market_estimate rule)
    const allDaysSamples = [scraped.autotrader, scraped.cargurus]
      .filter(s => s?.avg_days_online != null)
    const combinedAvgDays = allDaysSamples.length
      ? Math.round(allDaysSamples.reduce((a, b) => a + b.avg_days_online, 0) / allDaysSamples.length)
      : null

    // Marketplace-specific instructions for the JSON output
    const atInstruction = scraped.autotrader
      ? `"avg": ${scraped.autotrader.avg_price}, "estimated_listings": "~${scraped.autotrader.count} listings", "avg_mileage": ${scraped.autotrader.avg_mileage}`
      : `"avg": <integer ${currency} realistic avg for this vehicle on ${src1}>, "estimated_listings": "<e.g. ~40 listings>", "avg_mileage": <integer>`
    const cgInstruction = scraped.cargurus
      ? `"avg": ${scraped.cargurus.avg_price}, "estimated_listings": "~${scraped.cargurus.count} listings", "avg_mileage": ${scraped.cargurus.avg_mileage}`
      : `"avg": <integer ${currency}>, "estimated_listings": "<e.g. ~25 listings>", "avg_mileage": <integer>`

    const prompt = `You are a professional automotive market analyst with dealer-grade accuracy, equivalent to vAuto or Black Book. You specialize in the ${marketLabel} used vehicle market and have deep knowledge of real retail listing prices on ${marketSources.join(', ')}.

VEHICLE TO ANALYZE:
${vehicle.year} ${vehicle.make} ${vehicle.model}${trimText}
Listed price: ${vehicle.price ? '$' + Number(vehicle.price).toLocaleString() + ' ' + currency : 'unknown'}
Condition: ${conditionLabel}
Mileage: ${mileageText}
${vehicle.exterior_color ? `Colour: ${vehicle.exterior_color}` : ''}
Vehicle age: ${vehicleAge} year(s) old (${currentYear} model year context: ${vehicle.year})
Mileage context: ${mileageContext}
Days on lot: ${daysOnLot == null ? 'unknown' : daysOnLot + ' days'} · Today: ${todayContext}
${liveDataBlock}
CRITICAL RULES — accuracy is paramount:
1. Compare ONLY against listings that match on ALL of: same MODEL (${vehicle.make} ${vehicle.model}), same YEAR (${vehicle.year}), same TRIM (${vehicle.trim || 'base'}), same CONDITION (${conditionLabel}), and comparable MILEAGE (within roughly ±30% of ${mileageText}) in the ${location} area. Discard any comp that differs in trim, is a different model year, or has wildly different mileage — those are NOT valid comparables and must not pull the average up or down.
2. NEW vehicles: compare against new ${vehicle.year} ${vehicle.make} ${vehicle.model} at MSRP
3. ALL prices MUST be in ${currency} reflecting the ACTUAL ${marketLabel} retail market — do NOT use US prices for Canadian vehicles or vice versa
4. ${isUS ? 'US retail prices are typically 15–25% lower in USD than equivalent Canadian CAD prices.' : 'Canadian retail prices in CAD are typically 25–35% higher than the same vehicle in USD due to currency, taxes, and import costs.'}
5. If LIVE SCRAPED data is provided above, anchor your mid price and market_avg_mileage to that data — do not deviate by more than 5%
6. Mileage rating MUST accurately reflect the delta vs expected mileage — if mileage is ABOVE expected it is above/well above average, if BELOW it is below/well below average
7. price_to_market_pct: compute as Math.round((listedPrice / mid) * 100) where listedPrice = ${vehicle.price || 0}
8. days_on_market_estimate: ${combinedAvgDays != null ? `The scraped market average days online is ${combinedAvgDays} days — use this as your baseline, then adjust up/down based on how this vehicle's price compares to market mid` : 'estimate realistically based on price-to-market — overpriced vehicles take longer, well-priced take less'}
9. Each marketplace has slightly different avg prices — reflect this realistically
10. You MUST return ALL fields in the JSON — do not omit any field
11. This report is used by professional auto dealers — be precise and realistic, not generic

${verdictGuidance}

Respond with ONLY valid JSON (no markdown, no explanation, no trailing commas):
{
  "low": <integer ${currency}, lower bound of fair retail range for this exact vehicle>,
  "mid": <integer ${currency}, typical asking price for comparable listings>,
  "high": <integer ${currency}, upper bound — well-equipped or low-mileage premium>,
  "currency": "${currency}",
  "price_to_market_pct": <integer, listed price as % of mid, e.g. 98 = 2% below market>,
  "days_on_market_estimate": <integer, realistic days to sell at listed price>,
  "pricing_verdict": "ok" | "raise" | "lower",
  "verdict_headline": "<max 6 words, e.g. 'Priced to turn' / 'Underpriced — room to raise' / 'Overpriced — trim to sell'>",
  "verdict_reason": "<one or two sentences citing the deciding factors: days on lot, mileage, season, model-year cycle>",
  "confidence": "high" | "medium" | "low",
  "note": "<two specific sentences about this exact vehicle's market demand, trim desirability, mileage position, and regional pricing in ${location}>",
  "marketplace_averages": [
    { "name": "${src1}", ${atInstruction} },
    { "name": "${src2}", ${cgInstruction} },
    { "name": "${src3}", "avg": <integer ${currency}>, "estimated_listings": "<e.g. ~55 listings>", "avg_mileage": <integer> }
  ],
  "mileage_analysis": {
    "market_avg_mileage": <integer, ${scraped.autotrader || scraped.cargurus ? 'anchor to live scraped avg_mileage above' : `realistic average ${distanceUnit} for used ${vehicle.year} ${vehicle.make} ${vehicle.model}${trimText} listings in ${location}`}>,
    "mileage_rating": "well below average" | "below average" | "average" | "above average" | "well above average",
    "mileage_price_impact": <integer ${currency}, realistic dollar premium (positive) or discount (negative) vs same vehicle at average mileage — typically $500–$3000 range>,
    "mileage_note": "<one precise sentence: state actual mileage vs market avg and the pricing implication>"
  }
}`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    let estimate = null

    // Ask for the report, retrying once if the model returns unparseable output.
    let lastErr = null
    for (let attempt = 0; attempt < 2 && !estimate; attempt++) {
      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 1600,
          system: 'You are a precise automotive pricing engine. Respond with ONLY a single valid JSON object and nothing else — no prose, no markdown fences.',
          messages: [{ role: 'user', content: prompt }]
        })
        // Concatenate ALL text blocks (not just content[0]) so nothing is dropped.
        const text = (message.content || [])
          .filter(b => b.type === 'text' && b.text)
          .map(b => b.text).join('').trim()
        const jsonText = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
        try {
          estimate = JSON.parse(jsonText)
        } catch {
          const braced = jsonText.match(/\{[\s\S]*\}/)
          if (!braced) throw new Error('no JSON object in AI response')
          estimate = JSON.parse(braced[0])
        }
      } catch (aiErr) {
        lastErr = aiErr
        // On a credit/billing/rate error, don't waste a second attempt.
        if (/credit|billing|payment|429|rate.?limit/i.test(String(aiErr?.message || ''))) break
      }
    }
    if (!estimate) {
      return res.status(502).json({ error: aiErrorMessage(lastErr) })
    }

    const pct_diff = estimate?.mid
      ? Math.round(((yourPrice - estimate.mid) / estimate.mid) * 1000) / 10
      : null

    // Never flag a reprice off a low-confidence read — fall back to "ok" with a note.
    if (!['ok', 'raise', 'lower'].includes(estimate.pricing_verdict) || estimate.confidence === 'low' || estimate.reliable === false) {
      if (estimate.pricing_verdict && estimate.pricing_verdict !== 'ok') {
        estimate.verdict_headline = estimate.verdict_headline || 'Low-confidence read'
        estimate.verdict_reason = 'Comps are limited — verify against a book before repricing.'
      }
      estimate.pricing_verdict = 'ok'
    }

    const payload = {
      vehicle,
      estimate,
      pct_diff,
      data_source: dataSource,
      copart: scraped.copart ? {
        avg_price: scraped.copart.avg_price,
        median_price: scraped.copart.median_price,
        avg_mileage: scraped.copart.avg_mileage,
        count: scraped.copart.count,
      } : null,
    }

    // Cache the report for a week (keyed by vehicle; keyed price lets us bust it
    // early if the asking price changes). Fire-and-forget — never block the response.
    supabaseAdmin.from('price_reports').upsert({
      inventory_id: inventory_id,
      dealership_id: req.dealershipId,
      report: payload,
      price_at_generation: yourPrice,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'inventory_id' }).then(({ error }) => {
      if (error) console.warn('[price-report] cache write failed:', error.message)
    })

    res.json(payload)
  })

  // ── Repricing Rules ──────────────────────────────────────────────────────

  app.get('/ai/repricing-rules', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data, error } = await supabaseAdmin
      .from('dealerships')
      .select('repricing_rules')
      .eq('id', req.dealershipId)
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ rules: data.repricing_rules || { enabled: false, days_on_lot_threshold: 45, price_drop_pct: 5, overprice_threshold_pct: 20 } })
  })

  app.put('/ai/repricing-rules', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { enabled, days_on_lot_threshold, price_drop_pct, overprice_threshold_pct } = req.body
    const rules = { enabled: !!enabled, days_on_lot_threshold: Number(days_on_lot_threshold) || 45, price_drop_pct: Number(price_drop_pct) || 5, overprice_threshold_pct: Number(overprice_threshold_pct) || 20 }
    const { error } = await supabaseAdmin
      .from('dealerships')
      .update({ repricing_rules: rules })
      .eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ rules })
  })

  app.post('/ai/repricing-apply', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('inv_intel_active, repricing_rules, country, province, postal_code')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = isPlatformOwner(req)

    const rules = dealer.repricing_rules || { enabled: false, days_on_lot_threshold: 45, price_drop_pct: 5, overprice_threshold_pct: 20 }
    const { days_on_lot_threshold, price_drop_pct, overprice_threshold_pct } = rules
    const _reIsUS = (() => {
      const c = (dealer?.country || '').trim().toUpperCase()
      return c === 'US' || c === 'USA' || c === 'UNITED STATES'
    })()

    const { data: vehicles, error } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, price, mileage, condition, last_synced_at, created_at, lot_date')
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')
    if (error) return res.status(500).json({ error: error.message })

    const now = Date.now()
    const suggestions = []

    for (const vehicle of vehicles || []) {
      // Days on lot = time since the unit landed (true lot_date when the feed gave
      // one, else created_at = first-seen). last_synced_at is rewritten every sync,
      // so it can NEVER be used for aging — it would keep the count near 0.
      const refDate = vehicle.lot_date || vehicle.created_at || vehicle.last_synced_at
      const daysOnLot = refDate ? Math.floor((now - new Date(refDate).getTime()) / 86400000) : 0
      if (daysOnLot < days_on_lot_threshold) continue
      if (!vehicle.price || !vehicle.make || !vehicle.model) continue
      if (skipPriceComp(vehicle)) continue // new / current-year units have no used-market comp

      // Compare against the MARKET (MarketCheck/scraper — same source as the price
      // report), so a unit priced above real market gets flagged even when it's in
      // line with the store's own copies. Fall back to the internal-inventory median
      // when no market data is available.
      let med = null, medCount = null, trimMatched = null
      const mm = await marketMedianForScan({ vehicle, dealer, isUS: _reIsUS, dealershipId: req.dealershipId, isOwner: isPlatformOwner(req), allowLive: true })
      if (mm?.median) { med = mm.median; medCount = mm.count ?? null; trimMatched = mm.matched_on ? !!mm.matched_on.trim : null }
      if (!med) {
        const { data: comps } = await supabaseAdmin
          .from('inventory')
          .select('price')
          .eq('dealership_id', req.dealershipId)
          .eq('make', vehicle.make)
          .eq('model', vehicle.model)
          .eq('status', 'available')
          .gte('year', vehicle.year - 2)
          .lte('year', vehicle.year + 2)
          .neq('id', vehicle.id)
          .not('price', 'is', null)
        const prices = (comps || []).map(c => Number(c.price)).filter(p => p > 0).sort((a, b) => a - b)
        med = median(prices); medCount = prices.length; trimMatched = null   // internal fallback isn't trim-matched
      }
      if (!med) continue

      const pct_diff = ((Number(vehicle.price) - med) / med) * 100
      if (pct_diff <= overprice_threshold_pct) continue
      // ── Don't cry wolf on a mismatched comp set (the "drop $21k when vAuto says
      // 102%" bug). MarketCheck relaxes to "any trim of the model" when a loaded
      // trim has thin local comps, which pools cheap base trims and reads falsely
      // overpriced. Suppress the recommendation unless it's a like-for-like read:
      const hasTrim = !!(vehicle.trim && String(vehicle.trim).trim())
      if (pct_diff > 45) continue                                   // beyond ±45% = almost always bad comps
      if (hasTrim && trimMatched === false) continue                // comps weren't matched to this trim
      if (medCount != null && medCount < PRICE_MIN_COMPS) continue  // too thin a sample to trust

      const suggestedPrice = Math.round(Number(vehicle.price) * (1 - price_drop_pct / 100))
      const label = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
      const marketBasis = mm?.mileage_adjusted ? 'mileage-adjusted market value' : 'market median'
      const note = `${daysOnLot} days on lot — suggest reducing price by ${price_drop_pct}% to $${suggestedPrice.toLocaleString()} (currently ${Math.round(pct_diff)}% above ${marketBasis} $${Math.round(med).toLocaleString()})`

      suggestions.push({ inventory_id: vehicle.id, vehicle_label: label, note, days_on_lot: daysOnLot, suggested_price: suggestedPrice })

      await supabaseAdmin.from('ai_activity').insert({
        dealership_id: req.dealershipId,
        inventory_id: vehicle.id,
        actor_id: req.user.id,
        vehicle_label: label,
        warnings: [note],
        price_flagged: true,
        price_pct_diff: Math.round(pct_diff * 10) / 10,
        price_median: med,
        comp_count: medCount,
        trim_matched: trimMatched,
        copy_generated: false
      }).then(() => {}).catch(() => {})
    }

    res.json({ flagged: suggestions.length, suggestions })
  })

  // ── Stocking Recommendations ─────────────────────────────────────────────

  app.get('/ai/stocking-recommendations', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('inv_intel_active, stocking_recs, stocking_recs_at')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = isPlatformOwner(req)

    // Serve the cached set for 24h unless a refresh is explicitly requested. Keeps the
    // panel instant and always populated, and caps Claude spend to ~once/day/dealer.
    const refresh = req.query.refresh === '1'
    const CACHE_MS = 24 * 60 * 60 * 1000
    if (!refresh && dealer?.stocking_recs_at && Array.isArray(dealer.stocking_recs) && dealer.stocking_recs.length &&
        (Date.now() - new Date(dealer.stocking_recs_at).getTime()) < CACHE_MS) {
      return res.json({ recommendations: dealer.stocking_recs, generated_at: dealer.stocking_recs_at, cached: true })
    }

    // A unit's last_synced_at is the last time it appeared in the feed — i.e. roughly
    // when it sold and dropped off. Feeds refresh in bursts, so a strict 30-day window
    // often catches nothing; look back 90 days so there's real sell-through signal.
    const soldSince = new Date(Date.now() - 90 * 86400000).toISOString()

    const [{ data: sold }, { data: current }, { data: competitors }] = await Promise.all([
      supabaseAdmin
        .from('inventory')
        .select('make, model, year')
        .eq('dealership_id', req.dealershipId)
        .in('status', ['sold', 'archived'])
        .gte('last_synced_at', soldSince)
        .order('last_synced_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('inventory')
        .select('id, make, model, year, price, status, stocknumber')
        .eq('dealership_id', req.dealershipId)
        .eq('status', 'available'),
      supabaseAdmin
        .from('competitor_dealerships')
        .select('name, last_scan_result')
        .eq('dealership_id', req.dealershipId)
        .not('last_scanned_at', 'is', null)
    ])

    // Tally sell-through by make/model
    const sellMap = {}
    for (const v of sold || []) {
      const k = `${v.make}|${v.model}`
      sellMap[k] = (sellMap[k] || { make: v.make, model: v.model, sold: 0 })
      sellMap[k].sold++
    }
    const sell_through = Object.values(sellMap).sort((a, b) => b.sold - a.sold).slice(0, 20)

    // Current stock with IDs for linking
    const stockMap = {}
    for (const v of current || []) {
      const k = `${v.make}|${v.model}`
      if (!stockMap[k]) stockMap[k] = { count: 0, units: [] }
      stockMap[k].count++
      stockMap[k].units.push({ id: v.id, stocknumber: v.stocknumber || null })
    }

    // Summarise competitor stock from last scan results
    const competitorSummary = (competitors || [])
      .filter(c => c.last_scan_result && !c.last_scan_result.error)
      .map(c => {
        const r = c.last_scan_result
        const topModels = Array.isArray(r.top_models) ? r.top_models.slice(0, 5).join(', ') : ''
        const total = r.total_listings ?? r.unit_count ?? '?'
        return `- ${c.name}: ${total} units on lot${topModels ? '; top models: ' + topModels : ''}`
      }).join('\n')

    // Deterministic fallback so the panel ALWAYS shows recommendations even when the
    // AI call fails, the key is missing, or the daily AI budget is spent.
    const buildFallback = () => {
      const out = []
      const seen = new Set()
      // 1) Proven movers from recent sell-through.
      for (const s of sell_through) {
        const k = `${s.make}|${s.model}`
        if (seen.has(k)) continue
        seen.add(k)
        const inStock = stockMap[k]
        out.push({
          make: s.make, model: s.model, year_range: 'recent',
          reason: inStock
            ? `Strong seller — ${s.sold} sold recently with only ${inStock.count} now in stock. Restock to keep up with demand.`
            : `Sold ${s.sold} recently but none currently in stock — a proven mover worth re-acquiring.`,
          priority: s.sold >= 3 ? 'high' : (s.sold >= 2 ? 'medium' : 'low'),
          existing_units: inStock ? inStock.units.map(u => ({ id: u.id, stocknumber: u.stocknumber })) : []
        })
        if (out.length >= 5) return out
      }
      // 2) Top up from current stock composition (core models that fit this lot).
      const byCount = Object.entries(stockMap).sort((a, b) => b[1].count - a[1].count)
      for (const [k, d] of byCount) {
        if (seen.has(k)) continue
        seen.add(k)
        const [make, model] = k.split('|')
        out.push({
          make, model, year_range: 'recent',
          reason: `A core model on your lot (${d.count} in stock). Keep it stocked — it's a consistent fit for your buyers.`,
          priority: 'low',
          existing_units: d.units.map(u => ({ id: u.id, stocknumber: u.stocknumber }))
        })
        if (out.length >= 5) return out
      }
      // 3) Generic starter set (brand-new lot with no data yet).
      const starters = [
        { make: 'Chevrolet', model: 'Silverado 1500', reason: 'Full-size pickups are the highest-demand segment in Ontario — a reliable, fast-turning acquisition.' },
        { make: 'GMC', model: 'Sierra 1500', reason: 'Strong truck demand and healthy margins; pairs well with Silverado stock.' },
        { make: 'Chevrolet', model: 'Equinox', reason: 'Compact SUVs are the volume segment for Canadian families — quick turn, broad appeal.' },
        { make: 'GMC', model: 'Terrain', reason: 'Popular compact SUV with steady used demand across Ontario.' },
        { make: 'Chevrolet', model: 'Trax', reason: 'Affordable entry SUV — strong for first-time and budget buyers.' }
      ]
      for (const s of starters) {
        if (out.length >= 5) break
        out.push({ ...s, year_range: 'recent', priority: 'medium', existing_units: [] })
      }
      return out.slice(0, 5)
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    let recommendations = []
    try {
      if (!process.env.ANTHROPIC_API_KEY || !(await aiAllowed(req.dealershipId, isOwner))) throw new Error('ai_unavailable')
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are an automotive inventory strategist for a Canadian GM dealership in Ontario, Canada. Based on this dealership's recent sell-through data, current stock, and nearby competitor lots, recommend 5 specific vehicle acquisitions. Factor in Canadian market conditions (fuel prices, weather, rural vs urban mix), Ontario buyer preferences, seasonal demand, Canadian government incentives (iZEV program, Ontario rebates) — do NOT reference US programs. Also consider what competitors are stocking heavily (avoid oversupplied models) and where gaps exist.

Recent sell-through:
${sell_through.map(s => `- ${s.make} ${s.model}: ${s.sold} sold`).join('\n') || 'No sold data available yet'}

Current stock (available units):
${Object.entries(stockMap).map(([k, d]) => `- ${k.replace('|', ' ')}: ${d.count} units (${d.units.slice(0, 3).map(u => `id:${u.id}${u.stocknumber ? ' stock:' + u.stocknumber : ''}`).join(', ')}${d.units.length > 3 ? '…' : ''})`).join('\n') || 'No current stock'}
${competitorSummary ? `\nNearby competitor lots (scanned):\n${competitorSummary}` : ''}

Return ONLY valid JSON array (no markdown):
[{"make":"...","model":"...","year_range":"...","reason":"...","priority":"high|medium|low","existing_units":[{"id":"...","stocknumber":"..."}]}]
- "existing_units": array of {id, stocknumber} objects from the current stock list that match this make/model; empty array if none in stock
(exactly 5 items)`
        }]
      })
      const text = message.content[0]?.text?.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '') || '[]'
      recommendations = JSON.parse(text)
    } catch {
      recommendations = []
    }

    // Guarantee a populated list — fall back to the deterministic set when the AI
    // returned nothing usable.
    if (!Array.isArray(recommendations) || !recommendations.length) {
      recommendations = buildFallback()
    }

    // Attach the FULL matching in-stock list per recommendation (the AI prompt only
    // saw a sample, so re-fill from the complete stock map) — all stock #s, linkable.
    for (const r of recommendations) {
      const k = `${r.make}|${r.model}`
      const units = stockMap[k]?.units || []
      r.existing_units = units.map(u => ({ id: u.id, stocknumber: u.stocknumber }))
    }

    const generated_at = new Date().toISOString()
    supabaseAdmin.from('dealerships')
      .update({ stocking_recs: recommendations, stocking_recs_at: generated_at })
      .eq('id', req.dealershipId)
      .then(() => {}).catch(() => {})

    res.json({ recommendations, sell_through, generated_at })
  })

  // Inventory Intelligence routes extracted to routes/submodules/ai-inventory-intel.js
  // AI Vision & Competitor Monitoring routes extracted to routes/submodules/ai-competitor-vision.js
}

