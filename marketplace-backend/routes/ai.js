import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin, resend, EMAIL_FROM, browserFetch } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { scrapeMarketData } from '../scraper.js'

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'massiejay@gmail.com').toLowerCase()

function requireDealerAdmin(req, res, next) {
  if (req.profile?.role !== 'DEALER_ADMIN') {
    return res.status(403).json({ error: 'DEALER_ADMIN role required' })
  }
  next()
}

// Calculate median from a sorted array of numbers
function median(sorted) {
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export function registerAI(app) {
  // GET /ai/config — returns dealership's AI config
  app.get('/ai/config', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data, error } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, ai_tone, ai_required_fields, ai_manager_email, auction_api_key, vin_sticker_active')
      .eq('id', req.dealershipId)
      .single()
    if (error) return res.status(500).json({ error: error.message })
    const isOwner = (req.user.email || '').toLowerCase() === OWNER_EMAIL
    // Mask the key — return only a boolean indicating whether one is set,
    // plus a redacted preview so the UI can show "••••••••abc123"
    const auctionKeySet = !!data.auction_api_key
    const auctionKeyPreview = data.auction_api_key
      ? '••••••••' + data.auction_api_key.slice(-6)
      : ''
    const { auction_api_key: _, ...rest } = data
    res.json({ ...rest, ai_boost_active: isOwner ? true : !!data.ai_boost_active, auction_key_set: auctionKeySet, auction_key_preview: auctionKeyPreview })
  })

  // PUT /ai/config — update dealership AI config (DEALER_ADMIN only)
  app.put('/ai/config', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { ai_tone, ai_required_fields, ai_manager_email, ai_boost_active, auction_api_key } = req.body
    const update = {}
    if (ai_tone !== undefined) update.ai_tone = ai_tone
    if (ai_required_fields !== undefined) update.ai_required_fields = ai_required_fields
    if (ai_manager_email !== undefined) update.ai_manager_email = ai_manager_email
    if (ai_boost_active !== undefined) update.ai_boost_active = ai_boost_active
    // Empty string clears the key; undefined = no change
    if (auction_api_key !== undefined) update.auction_api_key = auction_api_key || null

    const { data, error } = await supabaseAdmin
      .from('dealerships')
      .update(update)
      .eq('id', req.dealershipId)
      .select('ai_boost_active, ai_tone, ai_required_fields, ai_manager_email, auction_api_key')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    const auctionKeySet = !!data.auction_api_key
    const auctionKeyPreview = data.auction_api_key ? '••••••••' + data.auction_api_key.slice(-6) : ''
    const { auction_api_key: __, ...rest2 } = data
    res.json({ ...rest2, auction_key_set: auctionKeySet, auction_key_preview: auctionKeyPreview })
  })

  // POST /ai/enrich-listing — run AI enrichment on an inventory item
  app.post('/ai/enrich-listing', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { inventory_id } = req.body
    if (!inventory_id) return res.status(400).json({ error: 'inventory_id required' })

    // Fetch inventory item
    const { data: vehicle, error: invErr } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', inventory_id)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (invErr || !vehicle) return res.status(404).json({ error: 'Inventory item not found' })

    // Fetch dealership AI config
    const { data: dealer, error: dealerErr } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, ai_tone, ai_required_fields, ai_manager_email')
      .eq('id', req.dealershipId)
      .single()
    if (dealerErr) return res.status(500).json({ error: dealerErr.message })

    if (!dealer.ai_boost_active) {
      return res.status(403).json({ error: 'AI Boost subscription is not active for this dealership' })
    }

    // Check Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI features not configured' })
    }

    // ── Missing field checks ──
    const warnings = []
    const requiredFields = dealer.ai_required_fields || ['price', 'mileage', 'image_urls']
    if (requiredFields.includes('price') && (!vehicle.price || Number(vehicle.price) === 0)) {
      warnings.push('Missing or zero price')
    }
    if (requiredFields.includes('mileage') && vehicle.mileage == null) {
      warnings.push('Missing mileage')
    }
    if (requiredFields.includes('image_urls') && (!vehicle.image_urls || vehicle.image_urls.length === 0)) {
      warnings.push('No photos attached')
    }
    if (requiredFields.includes('description') && (!vehicle.description || vehicle.description.length < 20)) {
      warnings.push('Description is missing or too short')
    }

    // Send email alert if there are warnings and manager email is set
    if (warnings.length > 0 && dealer.ai_manager_email && resend) {
      const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`
      await resend.emails.send({
        from: EMAIL_FROM,
        to: dealer.ai_manager_email,
        subject: `Missing info alert: ${vehicleLabel}`,
        html: `<p>The following required fields are missing for <strong>${vehicleLabel}</strong> (Stock #${vehicle.stocknumber || 'N/A'}):</p><ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul><p>Please update the listing before posting.</p>`
      }).catch(() => {}) // non-blocking — don't fail the request
    }

    // ── Price comp check ──
    // Skip for new vehicles only — used vehicles of any year are fair game for price comparison.
    let price_flag = null
    const _currentYear = new Date().getFullYear()
    const _isNewOrCurrentYear = vehicle.condition === 'new'
    if (!_isNewOrCurrentYear && vehicle.price && vehicle.make && vehicle.model && vehicle.year) {
      const yearMin = vehicle.year - 2
      const yearMax = vehicle.year + 2
      const { data: comps } = await supabaseAdmin
        .from('inventory')
        .select('price')
        .eq('dealership_id', req.dealershipId)
        .eq('make', vehicle.make)
        .eq('model', vehicle.model)
        .eq('status', 'available')
        .gte('year', yearMin)
        .lte('year', yearMax)
        .neq('id', inventory_id)
        .not('price', 'is', null)

      if (comps && comps.length > 0) {
        const prices = comps.map(c => Number(c.price)).filter(p => p > 0).sort((a, b) => a - b)
        const med = median(prices)
        if (med) {
          const pct_diff = ((Number(vehicle.price) - med) / med) * 100
          price_flag = {
            flagged: Math.abs(pct_diff) > 15,
            median: med,
            pct_diff: Math.round(pct_diff * 10) / 10,
            comp_count: prices.length
          }
        }
      }
    }

    // ── Generate AI copy via Anthropic ──
    const tone = dealer.ai_tone || 'professional'
    const toneInstruction = tone === 'friendly'
      ? 'Use a warm, approachable, conversational tone. You may use friendly language.'
      : tone === 'aggressive'
        ? 'Use an urgent, deal-focused tone. Emphasize value and urgency.'
        : 'Use a professional, informative tone. Be clear and factual. No emoji.'

    const vehicleDetails = [
      vehicle.year && vehicle.make && vehicle.model
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}`
        : null,
      vehicle.mileage ? `Mileage: ${Number(vehicle.mileage).toLocaleString()} km` : null,
      vehicle.price ? `Price: $${Number(vehicle.price).toLocaleString()}` : null,
      vehicle.condition ? `Condition: ${vehicle.condition}` : null,
      vehicle.exterior_color ? `Colour: ${vehicle.exterior_color}` : null,
      vehicle.stocknumber ? `Stock #: ${vehicle.stocknumber}` : null,
      vehicle.description ? `Description: ${vehicle.description}` : null,
    ].filter(Boolean).join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let copy = null
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are writing a Facebook Marketplace vehicle listing. ${toneInstruction}

Vehicle details:
${vehicleDetails}

Write a compelling listing in under 280 words. Include the year/make/model/trim, mileage, price, condition, colour, and key highlights from the description. Do not invent details not provided. ${tone !== 'friendly' ? 'No emoji.' : 'Minimal emoji only if it enhances readability.'}`
          }
        ]
      })
      copy = message.content[0]?.text || null
    } catch (aiErr) {
      return res.status(502).json({ error: `AI generation failed: ${aiErr.message}` })
    }

    // Log activity so the dealer can see what AI found
    supabaseAdmin.from('ai_activity').insert({
      dealership_id: req.dealershipId,
      inventory_id,
      actor_id: req.user.id,
      vehicle_label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '),
      warnings: warnings.length > 0 ? warnings : null,
      price_flagged: !!(price_flag?.flagged),
      price_pct_diff: price_flag?.pct_diff ?? null,
      price_median: price_flag?.median ?? null,
      copy_generated: !!copy
    }).then(() => {}).catch(() => {}) // fire-and-forget

    res.json({ copy, warnings, price_flag })
  })

  // POST /ai/sync-all — run AI enrichment on all active inventory for the dealership
  // Runs in background; returns immediately with a count. Results appear in /ai/activity.
  app.post('/ai/sync-all', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, ai_tone, ai_required_fields, ai_manager_email')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = (req.user.email || '').toLowerCase() === OWNER_EMAIL
    if (!isOwner && !dealer?.ai_boost_active) {
      return res.status(403).json({ error: 'AI Boost not active' })
    }

    const { data: vehicles, error } = await supabaseAdmin
      .from('inventory')
      .select('id')
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')

    if (error) return res.status(500).json({ error: error.message })
    const ids = (vehicles || []).map(v => v.id)
    res.json({ queued: ids.length, message: `Running AI checks on ${ids.length} vehicles…` })

    // Run enrichments in the background sequentially to avoid Anthropic rate limits
    ;(async () => {
      for (const inventory_id of ids) {
        try {
          const { data: vehicle } = await supabaseAdmin
            .from('inventory').select('*').eq('id', inventory_id).single()
          if (!vehicle) continue

          const warnings = []
          const requiredFields = dealer.ai_required_fields || ['price', 'mileage', 'image_urls']
          if (requiredFields.includes('price') && (!vehicle.price || Number(vehicle.price) === 0)) warnings.push('Missing or zero price')
          if (requiredFields.includes('mileage') && vehicle.mileage == null) warnings.push('Missing mileage')
          if (requiredFields.includes('image_urls') && (!vehicle.image_urls || vehicle.image_urls.length === 0)) warnings.push('No photos attached')
          if (requiredFields.includes('description') && (!vehicle.description || vehicle.description.length < 20)) warnings.push('Description is missing or too short')

          let price_flag = null
          const currentYear = new Date().getFullYear()
          // Skip price flagging for new vehicles only — used vehicles of any year are compared
          const isNewOrCurrentYear = vehicle.condition === 'new'
          if (!isNewOrCurrentYear && vehicle.price && vehicle.make && vehicle.model && vehicle.year) {
            const { data: comps } = await supabaseAdmin
              .from('inventory').select('price')
              .eq('dealership_id', req.dealershipId).eq('make', vehicle.make)
              .eq('model', vehicle.model).eq('status', 'available')
              .gte('year', vehicle.year - 2).lte('year', vehicle.year + 2)
              .neq('id', inventory_id).not('price', 'is', null)
            if (comps?.length > 0) {
              const prices = comps.map(c => Number(c.price)).filter(p => p > 0).sort((a, b) => a - b)
              const med = median(prices)
              if (med) {
                const pct_diff = ((Number(vehicle.price) - med) / med) * 100
                price_flag = { flagged: Math.abs(pct_diff) > 15, median: med, pct_diff: Math.round(pct_diff * 10) / 10 }
              }
            }
          }

          await supabaseAdmin.from('ai_activity').insert({
            dealership_id: req.dealershipId,
            inventory_id,
            actor_id: req.user.id,
            vehicle_label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '),
            warnings: warnings.length > 0 ? warnings : null,
            price_flagged: !!(price_flag?.flagged),
            price_pct_diff: price_flag?.pct_diff ?? null,
            price_median: price_flag?.median ?? null,
            copy_generated: false
          })
        } catch {}
        await new Promise(r => setTimeout(r, 300)) // gentle rate limiting between vehicles
      }
    })()
  })

  // GET /ai/activity — recent AI enrichment log for the dealership
  app.get('/ai/activity', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const limit = Math.min(Number(req.query.limit) || 200, 500)
    const { data, error } = await supabaseAdmin
      .from('ai_activity')
      .select('id, vehicle_label, warnings, price_flagged, price_pct_diff, price_median, copy_generated, created_at, inventory_id')
      .eq('dealership_id', req.dealershipId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ activity: data || [] })
  })

  // GET /ai/price-report/:inventory_id — AI market estimate for a vehicle
  app.get('/ai/price-report/:inventory_id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { inventory_id } = req.params

    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, condition, price, mileage, exterior_color, stocknumber, status')
      .eq('id', inventory_id)
      .eq('dealership_id', req.dealershipId)
      .single()
    if (vErr || !vehicle) return res.status(404).json({ error: 'Vehicle not found' })

    if (!vehicle.price || !vehicle.make || !vehicle.model || !vehicle.year) {
      return res.json({ vehicle, estimate: null, pct_diff: null })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI features not configured' })
    }

    // Fetch dealership location and country for market context
    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('city, province, country')
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

    // Attempt live market scraping (best-effort; falls back to AI-only on failure)
    const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${trimText}`
    let scraped = { autotrader: null, cargurus: null, copart: null }
    let dataSource = 'ai_estimate'
    try {
      scraped = await scrapeMarketData({
        make: vehicle.make,
        model: vehicle.model,
        year: Number(vehicle.year),
        trim: vehicle.trim || '',
        postalCode: dealer?.postal_code || '',
        province: dealer?.province || '',
        city: dealer?.city || '',
        isUS,
        vehicleLabel,
      })
      if (scraped.autotrader || scraped.cargurus) dataSource = 'live'
    } catch {
      // scrapeMarketData handles its own alerts; keep ai_estimate mode
    }

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
${liveDataBlock}
CRITICAL RULES — accuracy is paramount:
1. USED vehicles: compare ONLY against used ${vehicle.year} ${vehicle.make} ${vehicle.model}${trimText} listings (same year, same trim) in the ${location} area
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

Respond with ONLY valid JSON (no markdown, no explanation, no trailing commas):
{
  "low": <integer ${currency}, lower bound of fair retail range for this exact vehicle>,
  "mid": <integer ${currency}, typical asking price for comparable listings>,
  "high": <integer ${currency}, upper bound — well-equipped or low-mileage premium>,
  "currency": "${currency}",
  "price_to_market_pct": <integer, listed price as % of mid, e.g. 98 = 2% below market>,
  "days_on_market_estimate": <integer, realistic days to sell at listed price>,
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

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = message.content[0]?.text?.trim() || ''
      // Strip any markdown fencing if present
      const jsonText = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
      estimate = JSON.parse(jsonText)
    } catch (aiErr) {
      return res.status(502).json({ error: `AI estimate failed: ${aiErr.message}` })
    }

    const yourPrice = Number(vehicle.price)
    const pct_diff = estimate?.mid
      ? Math.round(((yourPrice - estimate.mid) / estimate.mid) * 1000) / 10
      : null

    res.json({
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
    })
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

  app.put('/ai/repricing-rules', requireAuth, requireDealerAdmin, async (req, res) => {
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
      .select('ai_boost_active, repricing_rules')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = (req.user.email || '').toLowerCase() === OWNER_EMAIL
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })

    const rules = dealer.repricing_rules || { enabled: false, days_on_lot_threshold: 45, price_drop_pct: 5, overprice_threshold_pct: 20 }
    const { days_on_lot_threshold, price_drop_pct, overprice_threshold_pct } = rules

    const { data: vehicles, error } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, price, last_synced_at, created_at')
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')
    if (error) return res.status(500).json({ error: error.message })

    const now = Date.now()
    const suggestions = []

    for (const vehicle of vehicles || []) {
      const refDate = vehicle.last_synced_at || vehicle.created_at
      const daysOnLot = refDate ? Math.floor((now - new Date(refDate).getTime()) / 86400000) : 0
      if (daysOnLot < days_on_lot_threshold) continue
      if (!vehicle.price || !vehicle.make || !vehicle.model) continue

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

      if (!comps || comps.length === 0) continue
      const prices = comps.map(c => Number(c.price)).filter(p => p > 0).sort((a, b) => a - b)
      const med = median(prices)
      if (!med) continue

      const pct_diff = ((Number(vehicle.price) - med) / med) * 100
      if (pct_diff <= overprice_threshold_pct) continue

      const suggestedPrice = Math.round(Number(vehicle.price) * (1 - price_drop_pct / 100))
      const label = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
      const note = `${daysOnLot} days on lot — suggest reducing price by ${price_drop_pct}% to $${suggestedPrice.toLocaleString()} (currently ${Math.round(pct_diff)}% above median $${Math.round(med).toLocaleString()})`

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
      .select('ai_boost_active')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = (req.user.email || '').toLowerCase() === OWNER_EMAIL
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })

    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })

    const since180 = new Date(Date.now() - 180 * 86400000).toISOString()

    const [{ data: sold }, { data: current }] = await Promise.all([
      supabaseAdmin
        .from('inventory')
        .select('make, model, year')
        .eq('dealership_id', req.dealershipId)
        .in('status', ['sold', 'archived'])
        .gte('updated_at', since180)
        .order('updated_at', { ascending: false })
        .limit(200),
      supabaseAdmin
        .from('inventory')
        .select('id, make, model, year, price, status')
        .eq('dealership_id', req.dealershipId)
        .eq('status', 'available')
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
      if (!stockMap[k]) stockMap[k] = { count: 0, ids: [] }
      stockMap[k].count++
      stockMap[k].ids.push(v.id)
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    let recommendations = []
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `You are an automotive inventory strategist for a Canadian GM dealership in Ontario, Canada. Based on this dealership's 180-day sell-through data and current stock, recommend 5 specific vehicle acquisitions. Base your advice on Canadian market conditions, Ontario buyer preferences, and Canadian government incentives (iZEV program, Ontario rebates) — do NOT reference US programs like IRA or federal US credits.

Sell-through (last 180 days):
${sell_through.map(s => `- ${s.make} ${s.model}: ${s.sold} sold`).join('\n') || 'No sold data available yet'}

Current stock (available units):
${Object.entries(stockMap).map(([k, d]) => `- ${k.replace('|', ' ')}: ${d.count} units (IDs: ${d.ids.slice(0, 3).join(', ')}${d.ids.length > 3 ? '…' : ''})`).join('\n') || 'No current stock'}

Return ONLY valid JSON array (no markdown):
[{"make":"...","model":"...","year_range":"...","reason":"...","priority":"high|medium|low","existing_ids":[]}]
- "existing_ids": array of inventory IDs from the current stock list that match this make/model (use the IDs provided above); empty array if none in stock
(exactly 5 items)`
        }]
      })
      const text = message.content[0]?.text?.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '') || '[]'
      recommendations = JSON.parse(text)
    } catch {
      recommendations = []
    }

    res.json({ recommendations, sell_through, generated_at: new Date().toISOString() })
  })

  // ── Competitor Monitoring ────────────────────────────────────────────────

  app.get('/ai/competitors', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data, error } = await supabaseAdmin
      .from('competitor_dealerships')
      .select('*')
      .eq('dealership_id', req.dealershipId)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ competitors: data || [] })
  })

  app.post('/ai/competitors', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { name, autotrader_url } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const { data, error } = await supabaseAdmin
      .from('competitor_dealerships')
      .insert({ dealership_id: req.dealershipId, name, autotrader_url: autotrader_url || null })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ competitor: data })
  })

  app.delete('/ai/competitors/:id', requireAuth, requireDealerAdmin, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { error } = await supabaseAdmin
      .from('competitor_dealerships')
      .delete()
      .eq('id', req.params.id)
      .eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ deleted: true })
  })

  app.post('/ai/competitors/scan', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = (req.user.email || '').toLowerCase() === OWNER_EMAIL
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })

    const { data: competitors } = await supabaseAdmin
      .from('competitor_dealerships')
      .select('*')
      .eq('dealership_id', req.dealershipId)

    const results = []
    for (const comp of competitors || []) {
      if (!comp.autotrader_url) {
        results.push({ id: comp.id, name: comp.name, result: { error: 'No URL configured', scanned_at: new Date().toISOString() } })
        continue
      }
      let scanResult
      try {
        const html = await browserFetch(comp.autotrader_url).then(r => r.text())
        // Try JSON-LD or embedded listing data
        let listing_count = null
        let prices = []

        // Look for result count patterns
        const countMatch = html.match(/"totalResults"\s*:\s*(\d+)/) || html.match(/"total"\s*:\s*(\d+)/) || html.match(/(\d+)\s+(?:results?|listings?|vehicles?)\s+found/i)
        if (countMatch) listing_count = parseInt(countMatch[1])

        // Extract prices from embedded JSON
        const priceMatches = [...html.matchAll(/"price"\s*:\s*(\d{3,6})/g)]
        if (priceMatches.length > 0) {
          prices = priceMatches.map(m => parseInt(m[1])).filter(p => p > 1000 && p < 500000)
        }

        const avg_price = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
        const sorted = [...prices].sort((a, b) => a - b)
        scanResult = {
          listing_count: listing_count || (prices.length > 0 ? prices.length : null),
          avg_price,
          min_price: sorted[0] || null,
          max_price: sorted[sorted.length - 1] || null,
          scanned_at: new Date().toISOString()
        }
      } catch {
        scanResult = { error: 'Could not parse listing data', scanned_at: new Date().toISOString() }
      }

      await supabaseAdmin
        .from('competitor_dealerships')
        .update({ last_scan_result: scanResult, last_scanned_at: new Date().toISOString() })
        .eq('id', comp.id)

      results.push({ id: comp.id, name: comp.name, result: scanResult })
    }

    res.json({ scanned: results.length, results })
  })

  // ── Weekly Lot Health Report ─────────────────────────────────────────────

  app.post('/ai/weekly-report', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, ai_manager_email, name')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = (req.user.email || '').toLowerCase() === OWNER_EMAIL
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })
    if (!resend) return res.status(503).json({ error: 'Email not configured' })

    const now = Date.now()
    const ago60 = new Date(now - 60 * 86400000).toISOString()
    const ago30 = new Date(now - 30 * 86400000).toISOString()
    const ago7 = new Date(now - 7 * 86400000).toISOString()

    const { data: allVehicles } = await supabaseAdmin
      .from('inventory')
      .select('id, year, make, model, trim, price, last_synced_at, created_at, status')
      .eq('dealership_id', req.dealershipId)
      .eq('status', 'available')

    const vehicles = allVehicles || []

    const aging = vehicles
      .map(v => ({ ...v, daysOnLot: Math.floor((now - new Date(v.last_synced_at || v.created_at).getTime()) / 86400000) }))
      .filter(v => v.daysOnLot > 60)
      .sort((a, b) => b.daysOnLot - a.daysOnLot)

    const slowMovers = vehicles
      .map(v => ({ ...v, daysOnLot: Math.floor((now - new Date(v.last_synced_at || v.created_at).getTime()) / 86400000) }))
      .filter(v => v.daysOnLot > 30)

    const { data: recentActivity } = await supabaseAdmin
      .from('ai_activity')
      .select('vehicle_label, warnings, price_flagged, price_pct_diff, created_at')
      .eq('dealership_id', req.dealershipId)
      .gte('created_at', ago7)
      .order('created_at', { ascending: false })
      .limit(100)

    const priceDrift = (recentActivity || []).filter(a => a.price_flagged)
    const missingInfo = (recentActivity || []).filter(a => a.warnings?.length > 0)

    const dealerName = dealer.name || 'Your Dealership'
    const primary = '#1a2e4a'

    const vehicleRow = v => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${v.price ? '$' + Number(v.price).toLocaleString() : '—'}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${v.daysOnLot} days</td></tr>`

    const sectionHeader = title => `<tr><td colspan="3" style="background:${primary};color:#fff;font-weight:700;font-size:13px;padding:8px 10px">${title}</td></tr>`

    const activityRow = a => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${a.vehicle_label}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#ef4444;text-align:right">${a.price_pct_diff != null ? (a.price_pct_diff > 0 ? '+' : '') + a.price_pct_diff + '% vs median' : ''}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b">${new Date(a.created_at).toLocaleDateString()}</td></tr>`

    const warnRow = a => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${a.vehicle_label}</td><td colspan="2" style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#b45309">${(a.warnings || []).join(', ')}</td></tr>`

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:${primary};padding:20px 24px">
    <div style="color:#fff;font-size:20px;font-weight:900">${dealerName}</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:2px">Weekly Lot Health Report · ${new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </td></tr>
  <tr><td style="padding:20px 24px">
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
      ${aging.length ? `${sectionHeader('⏱ Aging Units (60+ Days on Lot)')}${aging.slice(0, 10).map(vehicleRow).join('')}` : ''}
      ${priceDrift.length ? `${sectionHeader('💰 Price Drift Flags (Last 7 Days)')}${priceDrift.slice(0, 10).map(activityRow).join('')}` : ''}
      ${slowMovers.length ? `${sectionHeader('🐢 Slow Movers (30+ Days on Lot)')}${slowMovers.slice(0, 10).map(vehicleRow).join('')}` : ''}
      ${missingInfo.length ? `${sectionHeader('⚠ Missing Info Alerts (Last 7 Days)')}${missingInfo.slice(0, 10).map(warnRow).join('')}` : ''}
      ${!aging.length && !priceDrift.length && !slowMovers.length && !missingInfo.length ? '<tr><td colspan="3" style="padding:20px;text-align:center;color:#64748b">No issues found — your lot is in great shape!</td></tr>' : ''}
    </table>
    <p style="margin-top:20px;font-size:11px;color:#94a3b8">Sent by MarketSync AI Boost · <a href="https://marketsync.link" style="color:#6366f1">marketsync.link</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`

    const recipient = dealer.ai_manager_email || OWNER_EMAIL
    await resend.emails.send({
      from: EMAIL_FROM,
      to: recipient,
      subject: `Lot Health Report — ${dealerName} — ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      html: emailHtml
    })

    res.json({ sent: true, recipient })
  })
}
