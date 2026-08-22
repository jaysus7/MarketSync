// ─────────────────────────────────────────────────────────────────────────────
// MarketSync CRM — AI Submodule: Vehicle Copy, Appraisals & VIN Decoding
// ─────────────────────────────────────────────────────────────────────────────
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../shared.js'
import { requireAuth, requireMfa } from '../../middleware.js'
import { requirePermission } from '../../authorization.js'
import { lookupPlate, plateLookupConfigured } from '../../providers/plateLookup.js'
import { getMarketData, getSoldData, recordUsage, aiAllowed, marketcheckAllowed, recordMarketcheckCall } from '../../usage.js'
import { marketcheckEnabled, marketcheckPredictPrice } from '../../marketcheck.js'
import { isPlatformOwner } from '../ai-helpers.js'

export function registerAiAppraisalRoutes(app) {

  // POST /ai/sales-pitch
  app.post('/ai/sales-pitch', requireAuth, requireMfa, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean).slice(0, 200) : []
    if (!ids.length) return res.status(400).json({ error: 'No vehicles selected' })
    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('name, ai_tone, ai_boost_active, city, province').eq('id', req.dealershipId).maybeSingle()
    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })

    const { data: vehicles, error } = await supabaseAdmin.from('inventory')
      .select('id, year, make, model, trim, mileage, condition, price, exterior_color, interior_color, drivetrain, fuel_type, transmission, engine, body_style, description, vin_data, specs_manual')
      .eq('dealership_id', req.dealershipId).in('id', ids)
    if (error) return res.status(500).json({ error: error.message })
    if (!vehicles?.length) return res.status(404).json({ error: 'No matching vehicles' })

    const tone = dealer?.ai_tone === 'friendly' ? 'warm and friendly' : dealer?.ai_tone === 'aggressive' ? 'energetic and deal-focused' : 'professional and confident'
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const pitches = {}
    let done = 0, limited = false
    for (const v of vehicles) {
      if (!(await aiAllowed(req.dealershipId, isOwner))) { limited = true; break }
      const d = v.vin_data && typeof v.vin_data === 'object' ? v.vin_data : {}
      const sm = v.specs_manual && typeof v.specs_manual === 'object' ? v.specs_manual : {}
      const facts = {
        vehicle: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
        condition: v.condition, mileage_km: v.mileage, price: v.price,
        exterior: v.exterior_color, interior: v.interior_color,
        drivetrain: v.drivetrain, fuel: v.fuel_type, transmission: v.transmission,
        engine: v.engine || d.engine_model, displacement_l: d.displacement_l, cylinders: d.cylinders, turbo: d.turbo,
        body_style: v.body_style, gvwr: d.gvwr,
        towing_capacity: sm.towing_capacity, horsepower: sm.horsepower, torque: sm.torque, curb_weight: sm.curb_weight, payload: sm.payload, seating: sm.seating, fuel_economy: sm.fuel_economy, cargo: sm.cargo,
        safety: Object.entries({ 'forward-collision warning': d.forward_collision, 'automatic emergency braking': d.auto_brake, 'lane-keep assist': d.lane_keep, 'blind-spot monitor': d.blind_spot_mon, 'adaptive cruise': d.adaptive_cruise }).filter(([, x]) => x && String(x).toLowerCase() !== 'not available').map(([k]) => k),
        feature_list: v.description || null,
      }
      const prompt = `You are an expert automotive copywriter for ${dealer?.name || 'a car dealership'}. Write a compelling, honest sales pitch for the vehicle below, to appear on the dealership's website vehicle-detail page.
Rules: 2–3 short paragraphs (about 60–120 words total). Lead with what makes THIS specific vehicle appealing (capability, comfort, tech, value). Use ONLY the facts provided — never invent specs, pricing, history, or awards. Don't just list features; sell the experience. Tone: ${tone}. No emoji, no markdown, no headings, no quotes.
Facts (ignore any blank/unknown fields): ${JSON.stringify(facts)}`
      try {
        const msg = await Promise.race([
          anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 25000)),
        ])
        const text = (msg?.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '')
        if (!text) continue
        await supabaseAdmin.from('inventory').update({ sales_pitch: text, sales_pitch_at: new Date().toISOString() }).eq('id', v.id).eq('dealership_id', req.dealershipId)
        recordUsage(req.dealershipId, { ai: 1 })
        pitches[v.id] = text; done++
      } catch (e) { console.warn('[sales-pitch] failed for', v.id, e.message) }
    }
    res.json({ ok: true, count: done, pitches, limited })
  })

  // POST /ai/vehicle-copy
  app.post('/ai/vehicle-copy', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const field = String(b.field || 'description').toLowerCase() === 'pitch' ? 'pitch' : 'description'
    const taskAlias = { improve: 'boost', rewrite: 'fresh', generate: 'fresh', expand: 'long', shorten: 'short' }
    const task = taskAlias[String(b.task || 'fresh').toLowerCase()] || String(b.task || 'fresh').toLowerCase()
    const current = String(b.current || '').slice(0, 2000)
    const v = (b.vehicle && typeof b.vehicle === 'object') ? b.vehicle : {}

    const { data: dealer } = await supabaseAdmin
      .from('dealerships').select('name, ai_tone, ai_boost_active, city, province').eq('id', req.dealershipId).maybeSingle()
    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer?.ai_boost_active) return res.status(403).json({ error: 'AI Boost not active' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })
    if (!(await aiAllowed(req.dealershipId, isOwner))) return res.status(429).json({ error: 'Monthly AI limit reached — resets next month.' })

    const YEAR = new Date().getFullYear()
    const sm = (v.specs_manual && typeof v.specs_manual === 'object') ? v.specs_manual : {}
    const vd = (v.vin_data && typeof v.vin_data === 'object') ? v.vin_data : {}
    const facts = {
      vehicle: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
      condition: v.condition, mileage_km: v.mileage, price: v.price,
      exterior: v.exterior_color, interior: v.interior_color,
      drivetrain: v.drivetrain, fuel: v.fuel_type, transmission: v.transmission,
      engine: v.engine || vd.engine_model, body_style: v.body_style, doors: v.doors,
      towing_capacity: sm.towing_capacity, horsepower: sm.horsepower, torque: sm.torque,
      curb_weight: sm.curb_weight, payload: sm.payload, seating: sm.seating,
      fuel_economy: sm.fuel_economy, cargo: sm.cargo,
      safety: Object.entries({ 'forward-collision warning': vd.forward_collision, 'automatic emergency braking': vd.auto_brake, 'lane-keep assist': vd.lane_keep, 'blind-spot monitor': vd.blind_spot_mon, 'adaptive cruise': vd.adaptive_cruise }).filter(([, x]) => x && String(x).toLowerCase() !== 'not available').map(([k]) => k),
    }
    if (!facts.vehicle) return res.status(400).json({ error: 'Add at least the year, make and model first.' })

    const tone = dealer?.ai_tone === 'friendly' ? 'warm and friendly' : dealer?.ai_tone === 'aggressive' ? 'energetic and deal-focused' : 'professional and confident'
    const loc = [dealer?.city, dealer?.province].filter(Boolean).join(', ')
    const instr = {
      boost: 'Keep the meaning but make it noticeably sharper — tighter phrasing, stronger verbs, better flow and punch.',
      fresh: 'Write it from scratch with a genuinely new angle and fresh wording.',
      short: 'Make it shorter and punchier — cut every wasted word while keeping the core selling points.',
      long: 'Expand it with more useful, specific detail a buyer actually cares about — no filler.',
      seo: `Rewrite it for search using modern ${YEAR} SEO best practices: write for humans first, weave in the year/make/model and body style naturally near the start, match buyer search intent, and keep it scannable. Never keyword-stuff.`,
    }[task] || 'Write fresh, specific copy.'

    const spec = field === 'pitch'
      ? `Write a compelling, honest SALES PITCH for the vehicle below, to appear on the dealership's website vehicle-detail page. 2–3 short paragraphs (about 60–120 words total). Lead with what makes THIS specific vehicle appealing (capability, comfort, tech, value); sell the experience, don't just list features.`
      : `Write a clear, appealing website DESCRIPTION for the vehicle below (the vehicle-detail overview). 2–4 sentences (about 40–80 words). Highlight the standout specs, features and condition a buyer cares about.`
    const prompt = `You are an expert automotive copywriter for ${dealer?.name || 'a car dealership'}${loc ? ' in ' + loc : ''}. Tone: ${tone}.
${spec} ${instr}
Rules: Use ONLY the facts provided — never invent specs, pricing, history, packages or awards. No emoji, no markdown, no headings, no quotes.${current ? `\nCurrent text to work from: "${current}".` : ''}
Facts (ignore any blank/unknown fields): ${JSON.stringify(facts)}
Return ONLY the ${field === 'pitch' ? 'sales pitch' : 'description'} — no preamble.`

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const maxTok = task === 'long' || field === 'pitch' ? 600 : 400
      const msg = await Promise.race([
        anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTok, temperature: 1, messages: [{ role: 'user', content: prompt }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 25000)),
      ])
      const text = (msg?.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '')
      if (!text) throw new Error('No copy generated')
      recordUsage(req.dealershipId, { ai: 1 })
      res.json({ ok: true, text })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // POST /ai/vin-decode
  app.post('/ai/vin-decode', requireAuth, requirePermission('inventory.view'), async (req, res) => {
    const vin = String(req.body?.vin || '').trim().toUpperCase()
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return res.status(400).json({ error: 'Enter a valid 17-character VIN' })
    try {
      const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
        signal: AbortSignal.timeout(10000),
      })
      if (!r.ok) return res.status(502).json({ error: `VIN service error (HTTP ${r.status})` })
      const j = await r.json()
      const row = j?.Results?.[0]
      const nv = v => (v && v !== 'Not Applicable' && String(v).trim() !== '') ? String(v).trim() : null
      const nf = v => { const n = parseFloat(v); return isNaN(n) ? null : n }
      const yr = parseInt(row?.ModelYear)
      const dispL = nf(row?.DisplacementL), cyls = nv(row?.EngineCylinders)
      const engineStr = [
        dispL ? `${dispL}L` : null,
        cyls ? `${cyls}-cyl` : null,
        nv(row?.Turbo) === 'Yes' ? 'Turbo' : null,
        nv(row?.EngineHP) ? `${nv(row?.EngineHP)} HP` : null,
      ].filter(Boolean).join(' ') || null
      const out = {
        year: isNaN(yr) ? null : yr,
        make: nv(row?.Make),
        model: nv(row?.Model),
        trim: nv(row?.Trim) || nv(row?.Series),
        body_type: nv(row?.BodyClass),
        engine: engineStr,
        transmission: nv(row?.TransmissionStyle),
        drivetrain: nv(row?.DriveType),
        fuel_type: nv(row?.FuelTypePrimary),
      }
      if (!out.make || !out.model) return res.status(422).json({ error: 'Could not decode that VIN — enter the details manually.' })
      res.json({ ok: true, vin, ...out })
    } catch (e) {
      res.status(502).json({ error: e.name === 'TimeoutError' ? 'VIN service timed out — try again or enter details manually.' : e.message })
    }
  })

  // POST /ai/plate-decode
  app.post('/ai/plate-decode', requireAuth, requireMfa, requirePermission('inventory.edit'), async (req, res) => {
    if (!plateLookupConfigured()) return res.status(503).json({ error: 'Plate lookup isn’t set up on this account yet — enter the VIN instead.', not_configured: true })
    try {
      const out = await lookupPlate({ plate: req.body?.plate, region: req.body?.region, country: req.body?.country })
      res.json({ ok: true, ...out })
    } catch (e) {
      res.status(e.notConfigured ? 503 : 422).json({ error: e.message || 'Could not look up that plate.' })
    }
  })
}
