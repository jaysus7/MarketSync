import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../shared.js'
import { requireAuth } from '../../middleware.js'

const DAY_MS = 86400000

function segmentKey(row = {}) {
  const make = String(row.make || '').trim()
  const model = String(row.model || '').trim()
  return make && model ? `${make.toLowerCase()}|${model.toLowerCase()}` : null
}

function soldTimestamp(row = {}) {
  return row.sold_at || row.state_changed_at || row.archived_at || row.last_synced_at || null
}

export function buildInventoryIntelligencePayload({ available = [], sold = [], marketMedians = {}, country = '', now = Date.now() } = {}) {
  const since30 = now - 30 * DAY_MS
  const since90 = now - 90 * DAY_MS
  const sold30 = sold.filter(row => { const t = Date.parse(soldTimestamp(row) || ''); return Number.isFinite(t) && t >= since30 })
  const sold90 = sold.filter(row => { const t = Date.parse(soldTimestamp(row) || ''); return Number.isFinite(t) && t >= since90 })
  const names = new Map()
  const count = rows => {
    const result = new Map()
    for (const row of rows) {
      const key = segmentKey(row)
      if (!key) continue
      if (!names.has(key)) names.set(key, { make: String(row.make).trim(), model: String(row.model).trim() })
      result.set(key, (result.get(key) || 0) + 1)
    }
    return result
  }
  const stock = count(available), sales30 = count(sold30), sales90 = count(sold90)
  const velocity = [...new Set([...stock.keys(), ...sales30.keys(), ...sales90.keys()])].map(key => {
    const sold_30d = sales30.get(key) || 0, sold_90d = sales90.get(key) || 0, current_stock = stock.get(key) || 0
    const monthly_velocity = Math.round((sold_90d / 3) * 10) / 10
    const months_of_supply = monthly_velocity > 0 ? Math.round((current_stock / monthly_velocity) * 10) / 10 : null
    return { ...names.get(key), sold_30d, sold_90d, current_stock, monthly_velocity, months_of_supply }
  }).sort((a, b) => (b.sold_90d - a.sold_90d) || ((a.months_of_supply ?? Infinity) - (b.months_of_supply ?? Infinity)))

  const hot_segments = velocity.filter(v => v.monthly_velocity > 0 && v.current_stock < 3).sort((a, b) => b.monthly_velocity - a.monthly_velocity).slice(0, 4)
  const cold_segments = velocity.filter(v => v.current_stock >= 2 && v.monthly_velocity < 1).sort((a, b) => b.current_stock - a.current_stock).slice(0, 4)
  const vins = new Map()
  for (const v of available) {
    const vin = String(v.vin || '').trim().toUpperCase()
    if (vin.length < 6) continue
    const units = vins.get(vin) || []
    units.push({ id: v.id, stock: v.stocknumber || '', year: v.year, make: v.make, model: v.model })
    vins.set(vin, units)
  }
  const duplicate_vins = [...vins.entries()].filter(([, units]) => units.length > 1).map(([vin, units]) => ({ vin, units }))
  const isUS = ['US', 'USA', 'UNITED STATES'].includes(String(country || '').trim().toUpperCase())
  const annualDistance = isUS ? 12000 : 20000
  const currentYear = new Date(now).getUTCFullYear()
  const vehicles = available.map(v => {
    const photos = Array.isArray(v.image_urls) ? v.image_urls.filter(Boolean).length : 0
    const lotTime = Date.parse(v.lot_date || v.created_at || '')
    const days = Number.isFinite(lotTime) ? Math.max(0, Math.floor((now - lotTime) / DAY_MS)) : 0
    const price = Number(v.price) || 0, mileage = Number(v.mileage) || 0
    const age = Math.max(0, currentYear - (Number(v.year) || currentYear))
    const expectedMileage = age > 0 ? age * annualDistance : null
    const mileage_ratio = expectedMileage && mileage > 0 ? Math.round((mileage / expectedMileage) * 100) / 100 : null
    const median = Number(marketMedians[v.id]) || null
    const price_vs_market_pct = median && price > 0 ? Math.round(((price - median) / median) * 100) : null
    const fieldCount = [v.year, v.make, v.model, v.condition].filter(Boolean).length
    const breakdown = {
      photos: photos >= 10 ? 30 : photos >= 5 ? 20 : photos >= 1 ? 10 : 0,
      days: days < 15 ? 25 : days < 30 ? 20 : days < 60 ? 10 : days < 90 ? 5 : 0,
      price: price > 0 ? 15 : 0,
      mileage: mileage > 0 ? 10 : 0,
      description: String(v.description || '').trim().length > 50 ? 10 : 0,
      fields: Math.round((fieldCount / 4) * 10),
    }
    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
    const issues = [
      photos === 0 && 'No photos', photos > 0 && photos < 5 && `Only ${photos} photo${photos === 1 ? '' : 's'}`,
      !(price > 0) && 'No price', !(mileage > 0) && 'No mileage',
      !(String(v.description || '').trim().length > 50) && 'Short or missing description',
      fieldCount < 4 && 'Incomplete core vehicle details', days >= 60 && `${days} days on lot`,
      price_vs_market_pct != null && price_vs_market_pct > 10 && `${price_vs_market_pct}% above latest market median`,
    ].filter(Boolean)
    return {
      id: v.id, vin: v.vin || null, stock: v.stocknumber || '', year: v.year, make: v.make, model: v.model, trim: v.trim,
      condition: v.condition, price, mileage, mileage_ratio, price_vs_market_pct, days, photos, score, breakdown, issues,
      photo_score: v.photo_score ?? null, photo_flags: Array.isArray(v.photo_flags) ? v.photo_flags : [], photo_checked_at: v.photo_checked_at || null,
    }
  }).sort((a, b) => a.score - b.score)
  const avgScore = vehicles.length ? Math.round(vehicles.reduce((sum, v) => sum + v.score, 0) / vehicles.length) : 0
  return {
    summary: { total: vehicles.length, avg_score: avgScore, needs_attention: vehicles.filter(v => v.score < 50).length, duplicate_vins: duplicate_vins.length },
    velocity: velocity.slice(0, 30), hot_segments, cold_segments, duplicate_vins, vehicles, generated_at: new Date(now).toISOString(),
  }
}

export function registerAiInventoryIntelRoutes(app) {
  // ── Inventory Intelligence ────────────────────────────────────────────────
  app.get('/ai/inventory-intelligence', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('country')
      .eq('id', req.dealershipId)
      .single()

    const since90  = new Date(Date.now() -  90 * 86400000).toISOString()
    const since180 = new Date(Date.now() - 180 * 86400000).toISOString()

    const [availableResult, soldResult] = await Promise.all([
      supabaseAdmin
        .from('inventory')
        .select('id, vin, stocknumber, make, model, trim, year, condition, price, mileage, description, image_urls, created_at, lot_date, photo_score, photo_flags, photo_checked_at')
        .eq('dealership_id', req.dealershipId)
        .eq('status', 'available'),
      supabaseAdmin
        .from('inventory')
        .select('make, model, sold_at, state_changed_at, archived_at, last_synced_at')
        .eq('dealership_id', req.dealershipId)
        .in('status', ['sold', 'archived'])
        .or(`sold_at.gte.${since90},state_changed_at.gte.${since90},archived_at.gte.${since90},last_synced_at.gte.${since90}`)
        .limit(10000),
    ])
    if (availableResult.error) return res.status(500).json({ error: availableResult.error.message })
    if (soldResult.error) return res.status(500).json({ error: soldResult.error.message })

    const marketMed = {}
    try {
      const { data: acts } = await supabaseAdmin.from('ai_activity')
        .select('inventory_id, price_median, created_at')
        .eq('dealership_id', req.dealershipId)
        .gte('created_at', since180)
        .not('price_median', 'is', null)
        .order('created_at', { ascending: false }).limit(2000)
      for (const a of (acts || [])) {
        if (!marketMed[a.inventory_id]) marketMed[a.inventory_id] = Number(a.price_median)
      }
    } catch {}

    res.json(buildInventoryIntelligencePayload({ available: availableResult.data || [], sold: soldResult.data || [], marketMedians: marketMed, country: dealer?.country || '' }))
  })

  // ── Inventory Narrative ────────────────────────────────────────────────
  app.post('/ai/inventory-narrative', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('country')
      .eq('id', req.dealershipId)
      .single()
    if (!process.env.ANTHROPIC_API_KEY) return res.json({ narrative: null })

    const { total, avg_score, needs_attention, duplicate_vins, hot, cold, top_movers, no_photos, stale } = req.body
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const market = ['US', 'USA', 'UNITED STATES'].includes(String(dealer?.country || '').trim().toUpperCase()) ? 'United States' : 'Canadian'
      const prompt = `You are an automotive inventory analyst for a ${market} dealership. Analyze this lot data and return exactly 5 bullet-point insights — each under 20 words, specific, actionable. Return ONLY a JSON array of strings (no markdown):

Lot: ${total} available | avg health score: ${avg_score}/100 | ${needs_attention} units need attention
Hot segments (low stock, selling fast): ${(hot || []).join('; ') || 'none'}
Cold segments (high stock, slow moving): ${(cold || []).join('; ') || 'none'}
Top movers 90d: ${(top_movers || []).join(', ')}
Duplicate VINs: ${duplicate_vins}
Units without photos: ${no_photos}
Units 60d+ on lot: ${stale}`
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = msg.content[0]?.text?.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '') || '[]'
      res.json({ narrative: JSON.parse(text) })
    } catch {
      res.json({ narrative: null })
    }
  })
}
