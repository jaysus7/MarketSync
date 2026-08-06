import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../shared.js'
import { requireAuth, requireMfa } from '../../middleware.js'
import { hasPermission, requirePermission } from '../../authorization.js'
import { getMarketData, getSoldData, recordUsage, aiAllowed, marketcheckAllowed, recordMarketcheckCall } from '../../usage.js'
import { marketcheckEnabled, marketcheckPredictPrice } from '../../marketcheck.js'
import { findOrCreateContact } from '../crm.js'
import { createNotifications } from '../../notifications.js'
import { audit } from '../../audit.js'
import { isPlatformOwner, attachOemStickerToInventory } from '../ai-helpers.js'
import { SMART_MODEL } from '../../aiModels.js'

const MANAGEMENT_ROLES = ['OWNER', 'DEALER_ADMIN', 'MANAGER']

export function registerAiAppraisalManagementRoutes(app) {
  app.post('/ai/appraise', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const b = req.body || {}
    const year = parseInt(b.year)
    const make = String(b.make || '').trim()
    const model = String(b.model || '').trim()
    const trim = String(b.trim || '').trim()
    const mileage = b.mileage != null && b.mileage !== '' ? Number(b.mileage) : null
    const drivetrain = String(b.drivetrain || '').trim() || null
    const engine = String(b.engine || '').trim() || null
    if (!year || !make || !model) return res.status(400).json({ error: 'Year, make and model are required' })

    const recon = Math.max(0, Number(b.recon) || 0)
    const targetGross = Math.max(0, b.target_gross != null && b.target_gross !== '' ? Number(b.target_gross) : 2500)
    const bookValue = (b.book_value != null && b.book_value !== '') ? Math.max(0, Number(b.book_value) || 0) : null

    const ACCIDENT_PCT = {
      none: 0,
      minor: Number(process.env.APPRAISE_ACC_MINOR || 0.05),
      moderate: Number(process.env.APPRAISE_ACC_MODERATE || 0.10),
      major: Number(process.env.APPRAISE_ACC_MAJOR || 0.18),
      branded: Number(process.env.APPRAISE_ACC_BRANDED || 0.40),
    }
    const accidentRaw = String(b.accident || 'none').toLowerCase().trim()
    const reportedDamage = Math.max(0, Number(b.damage) || 0)
    const damageTier = reportedDamage >= 6000 ? 'major' : reportedDamage >= 3000 ? 'moderate' : reportedDamage >= 1 ? 'minor' : 'none'
    const rank = { none: 0, minor: 1, moderate: 2, major: 3, branded: 4 }
    let accidentTier = ['none', 'minor', 'moderate', 'major', 'branded'].includes(accidentRaw) ? accidentRaw : 'none'
    if (rank[damageTier] > rank[accidentTier]) accidentTier = damageTier
    const accidentPct = ACCIDENT_PCT[accidentTier] ?? 0

    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('name, country, province, postal_code, inv_intel_active, ai_boost_active').eq('id', req.dealershipId).maybeSingle()
    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer?.inv_intel_active) return res.status(403).json({ error: 'Inventory Intelligence add-on required' })
    const c = (dealer?.country || '').trim().toUpperCase()
    const isUS = c === 'US' || c === 'USA' || c === 'UNITED STATES'

    const radius = (() => {
      if (b.radius === undefined || b.radius === null || b.radius === '') return 250
      const r = Number(b.radius)
      return Number.isFinite(r) ? Math.min(2000, Math.max(0, Math.round(r))) : 250
    })()
    const zip = radius > 0 ? ((dealer?.postal_code || '').trim() || null) : null

    const { data: market } = await getMarketData({
      dealershipId: req.dealershipId, isOwner, allowLive: true,
      params: { make, model, year, trim, mileage, drivetrain, engine, zip, radius, state: dealer?.province || null, isUS },
    })

    const vehicle = { year, make, model, trim: trim || null, mileage, drivetrain, engine, vin: (b.vin ? String(b.vin).trim().toUpperCase() : null) }

    if (!market || !market.median_price) {
      return res.json({ ok: true, vehicle, retail: null, appraisal: null,
        message: 'Not enough comparable listings to value this reliably (needs at least 3). MarketCheck’s Canadian coverage can be thin for rare trims — try again without the trim, or appraise a more common model.' })
    }

    let prediction = null
    if (vehicle.vin && marketcheckEnabled() && await marketcheckAllowed(req.dealershipId, isOwner)) {
      try {
        prediction = await marketcheckPredictPrice({ vin: vehicle.vin, miles: mileage })
        await recordMarketcheckCall(req.dealershipId)
      } catch { /* prediction is a bonus — never fail the appraisal for it */ }
    }

    let sold = null
    try {
      const { data: soldData } = await getSoldData({
        dealershipId: req.dealershipId, isOwner, allowLive: true,
        params: { make, model, year, trim, mileage, drivetrain, engine, zip, radius, isUS },
      })
      sold = soldData || null
    } catch { /* sold data is a bonus — never fail the appraisal for it */ }

    const compMedian = market.median_price
    const compMiles = market.median_mileage || market.avg_mileage || null

    const REF_DIST = isUS ? 125000 : 200000
    const MILEAGE_SENS = Number(process.env.APPRAISE_MILEAGE_SENS || 0.5)
    let mileageAdj = 0
    if (mileage > 0 && compMiles > 0) {
      const ratePerDist = (compMedian * MILEAGE_SENS) / REF_DIST
      mileageAdj = Math.round((compMiles - mileage) * ratePerDist)
      const cap = Math.round(compMedian * 0.30)
      mileageAdj = Math.max(-cap, Math.min(cap, mileageAdj))
    }
    const mileageAdjusted = compMedian + mileageAdj

    const REALISM_DEFAULT = Number(process.env.APPRAISE_MARKET_REALISM || 0.04)
    let realism = REALISM_DEFAULT
    let realismProven = false
    if (sold && sold.median_price > 0 && compMedian > 0) {
      const gap = (compMedian - sold.median_price) / compMedian
      if (gap > 0) { realism = Math.min(0.25, gap); realismProven = true }
    }
    const realismCut = Math.round(mileageAdjusted * realism)
    const retailFromComps = Math.max(0, mileageAdjusted - realismCut)

    const retailSignals = [{ v: retailFromComps, w: 1.0, key: 'comps' }]
    let soldRetail = null
    if (sold && sold.median_price > 0) {
      const soldMiles = sold.median_mileage || compMiles || 0
      let sAdj = sold.median_price
      if (mileage > 0 && soldMiles > 0) {
        const sRate = (sold.median_price * MILEAGE_SENS) / REF_DIST
        const sCap = Math.round(sold.median_price * 0.30)
        sAdj += Math.max(-sCap, Math.min(sCap, Math.round((soldMiles - mileage) * sRate)))
      }
      soldRetail = Math.max(0, Math.round(sAdj))
      retailSignals.push({ v: soldRetail, w: 1.4, key: 'sold' })
    }
    if (prediction && prediction.predicted > 0) {
      retailSignals.push({ v: prediction.predicted, w: 0.9, key: 'model' })
    }
    const wSum = retailSignals.reduce((a, s) => a + s.w, 0)
    const retailClean = Math.max(0, Math.round(retailSignals.reduce((a, s) => a + s.v * s.w, 0) / wSum))
    const historyCut = Math.round(retailClean * accidentPct)
    const retailMid = Math.max(0, retailClean - historyCut)

    const tradeRatio = (() => {
      const p = Number(b.trade_pct)
      if (Number.isFinite(p) && p > 0) return Math.min(1, p > 1 ? p / 100 : p)
      const env = Number(process.env.APPRAISE_WHOLESALE_RATIO || process.env.APPRAISE_TRADE_RATIO)
      return Number.isFinite(env) && env > 0 ? Math.min(1, env) : 1.0
    })()
    const tradeValue = Math.round(retailMid * tradeRatio)
    let suggestedOffer = Math.max(0, tradeValue - recon - targetGross)
    let bookCapped = false
    if (bookValue != null && bookValue > 0 && suggestedOffer > bookValue) { suggestedOffer = Math.round(bookValue); bookCapped = true }
    const grossPct = retailMid > 0 ? Math.round(((retailMid - suggestedOffer) / retailMid) * 1000) / 10 : null
    const pctToMarket = retailMid > 0 ? Math.round((suggestedOffer / retailMid) * 100) : null

    const compList = (market.listings || [])
    const locMap = {}
    for (const l of compList) { const k = l.region || 'Other'; locMap[k] = (locMap[k] || 0) + 1 }
    const locations = Object.entries(locMap).map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count)

    let ai_summary = null
    const aiBoost = isOwner || !!dealer?.ai_boost_active
    if (aiBoost && process.env.ANTHROPIC_API_KEY && await aiAllowed(req.dealershipId, isOwner)) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const cur = isUS ? 'USD' : 'CAD', du = isUS ? 'mi' : 'km'
        const mileVsMarket = (mileage > 0 && compMiles > 0)
          ? `This vehicle has ${mileage.toLocaleString()} ${du} vs a market median of ${Math.round(compMiles).toLocaleString()} ${du} (${mileageAdj >= 0 ? '+' : '−'}${cur} $${Math.abs(mileageAdj).toLocaleString()} mileage adjustment).`
          : ''
        const accidentLine = (accidentTier !== 'none' && historyCut > 0)
          ? `Accident/history: this vehicle has a ${accidentTier} accident/history record${reportedDamage ? ` (~${cur} $${reportedDamage.toLocaleString()} reported damage)` : ''}, which permanently lowers value — we deducted ${cur} $${historyCut.toLocaleString()} (${Math.round(accidentPct * 100)}%) from clean retail. State this plainly as a reason the offer is below a clean-history example.`
          : ''
        const soldLine = (sold && sold.median_price > 0)
          ? `Proven to market: ${sold.count} recently SOLD comparable${sold.count === 1 ? '' : 's'} sold at a median of ${cur} $${sold.median_price.toLocaleString()}${sold.median_dom != null ? `, averaging ${sold.median_dom} days on market before selling` : ''}. Real sold prices run about ${Math.round(realism * 100)}% below the ${cur} $${compMedian.toLocaleString()} asking median, which is why the offer is grounded in what these cars actually sell for — not just what they're listed at.`
          : ''
        const prompt = `Write a professional 2–3 sentence market summary for a vehicle trade-appraisal sheet a dealer hands to a customer. Explain the offer in plain English and justify it with the market data, including how the odometer moved the value${soldLine ? ' and how recently-sold comps prove the number' : ''}. No markdown, no bullet points, no greeting.
Vehicle: ${year} ${make} ${model}${trim ? ' ' + trim : ''}${mileage ? `, ${mileage.toLocaleString()} ${du}` : ''}.
Retail market from ${market.count} comparable listings: asking median ${cur} $${compMedian.toLocaleString()}, range $${(market.low_price || compMedian).toLocaleString()}–$${(market.high_price || compMedian).toLocaleString()}. ${mileVsMarket}
${soldLine}
${accidentLine}
Adjusted retail value for this vehicle: ${cur} $${retailMid.toLocaleString()}.${tradeValue < retailMid - 1 ? `
Wholesale value (ACV): ${cur} $${tradeValue.toLocaleString()} — about ${Math.round(tradeRatio * 100)}% of retail, in line with trade/wholesale valuation tools like AutoTrader.` : ''}
ACV / wholesale take-in (what the dealer buys it for): ${cur} $${suggestedOffer.toLocaleString()} — the retail value less ${cur} $${recon.toLocaleString()} reconditioning and a ${cur} $${targetGross.toLocaleString()} target gross, in line with trade-value tools like AutoTrader.`
        const msg = await Promise.race([
          anthropic.messages.create({ model: SMART_MODEL, max_tokens: 220, messages: [{ role: 'user', content: prompt }] }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 20000)),
        ])
        ai_summary = (msg?.content?.[0]?.text || '').trim() || null
        if (ai_summary) recordUsage(req.dealershipId, { ai: 1 })
      } catch { /* summary is a nice-to-have */ }
    }

    const appraisalObj = {
      suggested_offer: suggestedOffer, retail_mid: retailMid, trade_value: tradeValue,
      recon, target_gross: targetGross, gross_pct: grossPct, pct_to_market: pctToMarket,
      ai_summary,
      sold_median: sold?.median_price ?? null,
      sold_dom: sold?.median_dom ?? null,
      sold_count: sold?.count ?? null,
      accident_tier: accidentTier !== 'none' ? accidentTier : null,
      accident_amount: historyCut || null,
      retail_clean: retailClean,
      book_value: bookValue, book_capped: bookCapped,
    }
    let appraisal_id = null
    try {
      const tradeRow = {
        dealership_id: req.dealershipId,
        created_by: req.user.id,
        salesperson_name: req.profile?.full_name || req.user.email || null,
        year, make, model, trim: trim || null, vin: vehicle.vin || null, mileage,
        suggested_offer: suggestedOffer, currency: isUS ? 'USD' : 'CAD',
        appraisal: appraisalObj,
      }
      const existingId = String(b.appraisal_id || '').trim()
      if (existingId) {
        const { data: owned } = await supabaseAdmin.from('trade_appraisals')
          .select('id, created_by').eq('id', existingId).eq('dealership_id', req.dealershipId).maybeSingle()
        if (owned && owned.created_by === req.user.id) {
          await supabaseAdmin.from('trade_appraisals').update(tradeRow).eq('id', existingId)
          appraisal_id = existingId
        }
      }
      if (!appraisal_id) {
        const { data: ins } = await supabaseAdmin.from('trade_appraisals').insert(tradeRow).select('id').single()
        appraisal_id = ins?.id || null
      }
    } catch (e) { console.warn('[appraise] auto-log failed:', e.message) }

    res.json({
      ok: true,
      vehicle,
      appraisal_id,
      dealer_name: dealer?.name || null,
      currency: isUS ? 'USD' : 'CAD',
      distance_unit: isUS ? 'mi' : 'km',
      dealer_postal: zip || null,
      search_radius: radius || null,
      retail: {
        median: retailMid,
        comp_median: compMedian,
        low: market.low_price ?? null,
        high: market.high_price ?? null,
        avg: market.avg_price ?? null,
        count: market.count ?? null,
        num_found: market.num_found ?? null,
        avg_days_online: market.avg_days_online ?? null,
        avg_mileage: market.avg_mileage ?? market.median_mileage ?? null,
        market_mileage: compMiles,
        matched_on: market.matched_on || {},
        radius_used: market.radius_used ?? null,
        geo_scope: market.geo_scope ?? null,
        median_distance: market.median_distance ?? null,
        source: market.source || 'MarketCheck',
      },
      appraisal: {
        suggested_offer: suggestedOffer,
        retail_mid: retailMid,
        trade_value: tradeValue,
        trade_ratio: Math.round(tradeRatio * 1000) / 10,
        recon,
        target_gross: targetGross,
        gross_pct: grossPct,
        pct_to_market: pctToMarket,
        book_value: bookValue,
        book_capped: bookCapped,
        ai_summary,
        adjustments: {
          comp_median: compMedian,
          subject_mileage: mileage || null,
          market_mileage: compMiles,
          mileage_adjustment: mileageAdj,
          market_realism_pct: Math.round(realism * 1000) / 10,
          market_realism_amount: -realismCut,
          market_realism_proven: realismProven,
          retail_from_comps: retailFromComps,
          retail_clean: retailClean,
          accident_tier: accidentTier !== 'none' ? accidentTier : null,
          accident_pct: accidentPct ? Math.round(accidentPct * 1000) / 10 : null,
          accident_amount: historyCut ? -historyCut : null,
          retail_value: retailMid,
          trade_ratio_pct: Math.round(tradeRatio * 1000) / 10,
          trade_value: tradeValue,
          recon: -recon,
          target_gross: -targetGross,
        },
        retail_signals: {
          comps: retailFromComps,
          sold: soldRetail,
          model: prediction?.predicted ?? null,
          reconciled: retailMid,
        },
      },
      sold: sold ? {
        count: sold.count,
        num_found: sold.num_found ?? null,
        median_price: sold.median_price,
        avg_price: sold.avg_price ?? null,
        low: sold.low_price ?? null,
        high: sold.high_price ?? null,
        median_mileage: sold.median_mileage ?? null,
        median_dom: sold.median_dom ?? null,
        adjusted_retail: soldRetail,
        ask_vs_sold_pct: (compMedian > 0 && sold.median_price > 0)
          ? Math.round(((compMedian - sold.median_price) / compMedian) * 1000) / 10 : null,
        offer_vs_sold_pct: (sold.median_price > 0)
          ? Math.round((suggestedOffer / sold.median_price) * 100) : null,
        matched_on: sold.matched_on || {},
        geo_scope: sold.geo_scope ?? null,
        radius_used: sold.radius_used ?? null,
        listings: (sold.listings || []).slice(0, 40).map(l => ({
          price: l.price, miles: l.miles, city: l.city, region: l.region,
          dealer: l.dealer || null, dom: l.dom ?? null, sold_date: l.sold_date || null,
          url: l.vdp_url || null, source: l.source || null,
        })),
      } : null,
      accident: accidentTier !== 'none' ? {
        tier: accidentTier,
        pct: Math.round(accidentPct * 1000) / 10,
        amount: historyCut,
        reported_damage: reportedDamage || null,
        retail_clean: retailClean,
        retail_after: retailMid,
      } : null,
      prediction,
      comps: compList.slice(0, 100).map(l => ({
        price: l.price, miles: l.miles, city: l.city, region: l.region,
        dealer: l.dealer || null, url: l.vdp_url || null, source: l.source || null,
        trim: l.trim || null, dist: l.dist ?? null,
      })),
      locations,
    })
  })

  // POST /ai/appraisals
  app.post('/ai/appraisals', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const isOwner = isPlatformOwner(req)
    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('inv_intel_active').eq('id', req.dealershipId).maybeSingle()
    if (!isOwner && !dealer?.inv_intel_active) return res.status(403).json({ error: 'Inventory Intelligence add-on required' })

    const b = req.body || {}
    const v = b.vehicle || {}
    const ap = b.appraisal || {}
    const num = x => { const n = Number(x); return Number.isFinite(n) ? n : null }
    const row = {
      dealership_id: req.dealershipId,
      created_by: req.user.id,
      salesperson_name: (b.salesperson_name && String(b.salesperson_name).trim()) || req.profile?.full_name || req.user.email || null,
      vin: v.vin ? String(v.vin).trim().toUpperCase().slice(0, 17) : null,
      year: v.year ? (parseInt(v.year) || null) : null,
      make: v.make || null, model: v.model || null, trim: v.trim || null,
      mileage: num(v.mileage),
      body_type: v.body_type || null, engine: v.engine || null,
      transmission: v.transmission || null, drivetrain: v.drivetrain || null,
      fuel_type: v.fuel_type || null, color: v.color || null,
      disposition: b.disposition === 'wholesale' ? 'wholesale' : 'retail',
      currency: b.currency || null,
      retail_median: num(ap.retail_mid), suggested_offer: num(ap.suggested_offer),
      recon: num(ap.recon), target_gross: num(ap.target_gross),
      appraisal: (ap && typeof ap === 'object') ? ap : null,
      customer: (b.customer && typeof b.customer === 'object') ? b.customer : null,
      disclosure: (b.disclosure && typeof b.disclosure === 'object') ? b.disclosure : null,
    }
    let savedId
    if (b.id) {
      const { created_by, salesperson_name, ...rowUpdate } = row
      const { data, error } = await supabaseAdmin.from('trade_appraisals')
        .update(rowUpdate).eq('id', b.id).eq('dealership_id', req.dealershipId).select('id').maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      savedId = data?.id || b.id
    } else {
      const { data, error } = await supabaseAdmin.from('trade_appraisals').insert(row).select('id').single()
      if (error) return res.status(500).json({ error: error.message })
      savedId = data.id
    }

    try {
      const cust = row.customer || {}
      const cname = [cust.first_name, cust.last_name].filter(Boolean).join(' ').trim() || cust.name || null
      let contactId = null
      const wantId = (b.contact_id || cust.contact_id || '').toString().trim()
      if (wantId) {
        const { data: c } = await supabaseAdmin.from('contacts')
          .select('id').eq('id', wantId).eq('dealership_id', req.dealershipId).maybeSingle()
        if (c) contactId = c.id
      }
      if (!contactId && (cname || cust.email || cust.phone || cust.mobile_phone || cust.home_phone)) {
        contactId = await findOrCreateContact({
          dealershipId: req.dealershipId, name: cname,
          email: cust.email, phone: cust.phone || cust.mobile_phone || cust.home_phone,
          repId: req.user.id, source: 'Trade Appraisal',
        })
      }
      if (contactId) await supabaseAdmin.from('trade_appraisals').update({ contact_id: contactId }).eq('id', savedId)
    } catch (e) { console.warn('[appraisals] contact link failed:', e.message) }

    const notifyIds = Array.isArray(b.notify) ? [...new Set(b.notify.filter(Boolean))] : []
    if (notifyIds.length) {
      const vlabel = [row.year, row.make, row.model, row.trim].filter(Boolean).join(' ') || 'a vehicle'
      const who = row.salesperson_name || 'A salesperson'
      const cName = [row.customer?.first_name, row.customer?.last_name].filter(Boolean).join(' ')
      createNotifications(notifyIds.map(uid => ({
        dealership_id: req.dealershipId,
        type: 'appraisal',
        title: 'Appraisal to review',
        body: `${who} requests your appraisal on ${vlabel}${cName ? ` for ${cName}` : ''}.`,
        link_page: 'appraisal',
        target_user_id: uid,
      }))).catch(() => {})
    }
    res.json({ ok: true, id: savedId, notified: notifyIds.length })
  })

  // GET /ai/appraisals
  app.get('/ai/appraisals', requireAuth, async (req, res) => {
    const emptyMeta = { is_management: false, reps_see_all: false, restricted: true, salespeople: [] }
    if (!req.dealershipId) return res.json({ items: [], meta: emptyMeta })
    const role = req.profile?.role || 'SALES_REP'
    const isManagement = await hasPermission(req, 'lead.assign')
    const repsSeeAll = !!req.profile?.can_see_all_appraisals
    const restrictToOwn = !isManagement && !repsSeeAll

    let query = supabaseAdmin.from('trade_appraisals')
      .select('id, created_at, created_by, salesperson_name, year, make, model, trim, vin, suggested_offer, currency, disposition, customer')
      .eq('dealership_id', req.dealershipId)
      .order('created_at', { ascending: false }).limit(200)
    if (restrictToOwn) query = query.eq('created_by', req.user.id)
    else if (req.query.salesperson) query = query.eq('created_by', req.query.salesperson)
    if (req.query.disposition === 'retail' || req.query.disposition === 'wholesale') query = query.eq('disposition', req.query.disposition)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    let items = (data || []).map(r => ({
      id: r.id, created_at: r.created_at, created_by: r.created_by, salesperson: r.salesperson_name,
      label: [r.year, r.make, r.model, r.trim].filter(Boolean).join(' '),
      vin: r.vin, offer: r.suggested_offer, currency: r.currency, disposition: r.disposition,
      customer_name: [r.customer?.first_name, r.customer?.last_name].filter(Boolean).join(' ') || null,
    }))
    const q = (req.query.q || '').trim().toLowerCase()
    if (q) items = items.filter(it => [it.label, it.vin, it.customer_name, it.salesperson].filter(Boolean).join(' ').toLowerCase().includes(q))

    let salespeople = []
    if (!restrictToOwn) {
      const { data: sp } = await supabaseAdmin.from('trade_appraisals')
        .select('created_by, salesperson_name').eq('dealership_id', req.dealershipId).limit(1000)
      const seen = new Map()
      for (const r of (sp || [])) if (r.created_by && !seen.has(r.created_by)) seen.set(r.created_by, r.salesperson_name || '—')
      salespeople = [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    res.json({ items, meta: { role, is_management: isManagement, reps_see_all: repsSeeAll, restricted: restrictToOwn, salespeople } })
  })

  // PUT /ai/rep-appraisal-visibility
  app.put('/ai/rep-appraisal-visibility', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const repId = req.body?.rep_id
    if (!repId) return res.status(400).json({ error: 'rep_id required' })
    const can = !!req.body?.can_see_all
    const { data, error } = await supabaseAdmin.from('profiles')
      .update({ can_see_all_appraisals: can }).eq('id', repId).eq('dealership_id', req.dealershipId)
      .select('id').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Rep not found in your dealership' })
    audit(req, 'appraisal.visibility_updated', { user_id: repId, after_state: { can_see_all_appraisals: can } })
    res.json({ ok: true, rep_id: repId, can_see_all: can })
  })

  // GET /ai/appraisals/:id
  app.get('/ai/appraisals/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data, error } = await supabaseAdmin.from('trade_appraisals')
      .select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Not found' })
    if (!(await hasPermission(req, 'lead.assign')) && data.created_by !== req.user.id) return res.status(403).json({ error: 'You can only view your own appraisals' })
    res.json(data)
  })

  // POST /ai/appraisals/:id/acquire
  app.post('/ai/appraisals/:id/acquire', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data: ap, error } = await supabaseAdmin.from('trade_appraisals')
      .select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!ap) return res.status(404).json({ error: 'Appraisal not found' })

    if (ap.inventory_id) {
      const { data: existing } = await supabaseAdmin.from('inventory')
        .select('id, status, awaiting_possession').eq('id', ap.inventory_id).maybeSingle()
      if (existing) return res.json({ ok: true, inventory_id: existing.id, already: true, awaiting_possession: !!existing.awaiting_possession })
    }

    const b = req.body || {}
    const numOrNull = (x) => { const n = Number(x); return Number.isFinite(n) ? n : null }
    const retail = numOrNull(ap.appraisal?.retail_mid) ?? numOrNull(ap.retail_median)
    const price = numOrNull(b.price) ?? retail
    const docFields = {}
    for (const k of ['window_sticker_oem_url', 'window_sticker_gen_url', 'brochure_oem_url', 'brochure_gen_url']) {
      if (b[k] && typeof b[k] === 'string') docFields[k] = b[k]
    }
    const row = {
      dealership_id: req.dealershipId, source: 'appraisal', status: 'available',
      condition: 'used',
      vin: ap.vin ? String(ap.vin).trim().toUpperCase().slice(0, 17) : null,
      year: ap.year || null, make: ap.make || null, model: ap.model || null, trim: ap.trim || null,
      mileage: numOrNull(ap.mileage), price,
      body_style: ap.body_type || null, engine: ap.engine || null,
      transmission: ap.transmission || null, drivetrain: ap.drivetrain || null,
      fuel_type: ap.fuel_type || null, exterior_color: ap.color || null,
      stocknumber: (b.stocknumber && String(b.stocknumber).trim()) || (ap.vin ? String(ap.vin).trim().toUpperCase().slice(-8) : null),
      image_urls: Array.isArray(b.image_urls) ? b.image_urls.filter(u => typeof u === 'string') : [],
      description: b.description || null,
      ...docFields,
      awaiting_possession: true,
      source_appraisal_id: ap.id,
      lot_date: new Date().toISOString(),
    }
    const { data: inv, error: invErr } = await supabaseAdmin.from('inventory').insert(row).select('id').single()
    if (invErr) return res.status(500).json({ error: invErr.message })
    await supabaseAdmin.from('trade_appraisals').update({ inventory_id: inv.id }).eq('id', ap.id)
    audit(req, 'inventory.acquired_from_appraisal', { appraisal_id: ap.id, inventory_id: inv.id })
    if (row.vin && !row.window_sticker_oem_url) {
      const { data: dealer } = await supabaseAdmin.from('dealerships').select('inv_intel_active').eq('id', req.dealershipId).maybeSingle()
      const isOwner = isPlatformOwner(req)
      if (isOwner || dealer?.inv_intel_active) attachOemStickerToInventory(req.dealershipId, inv.id, { vin: row.vin, make: row.make }).catch(() => {})
    }
    res.json({ ok: true, inventory_id: inv.id, awaiting_possession: true })
  })

  // POST /ai/appraisals/:id/take-possession
  app.post('/ai/appraisals/:id/take-possession', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data: ap } = await supabaseAdmin.from('trade_appraisals')
      .select('id, inventory_id').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!ap?.inventory_id) return res.status(404).json({ error: 'No acquired unit for this appraisal' })
    const { error } = await supabaseAdmin.from('inventory')
      .update({ awaiting_possession: false, possession_at: new Date().toISOString() })
      .eq('id', ap.inventory_id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    await supabaseAdmin.from('trade_appraisals').update({ acquired_at: new Date().toISOString() }).eq('id', ap.id)
    audit(req, 'inventory.possession_taken', { appraisal_id: ap.id, inventory_id: ap.inventory_id })
    res.json({ ok: true, inventory_id: ap.inventory_id, live: true })
  })

  // GET /ai/appraisers
  app.get('/ai/appraisers', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json([])
    const { data, error } = await supabaseAdmin.from('profiles')
      .select('id, full_name, role')
      .eq('dealership_id', req.dealershipId)
      .in('role', MANAGEMENT_ROLES)
      .order('full_name', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json((data || []).map(m => ({ id: m.id, name: m.full_name || '(no name)', role: m.role })))
  })
}
