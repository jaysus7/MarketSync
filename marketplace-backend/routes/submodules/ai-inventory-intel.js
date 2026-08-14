import { supabaseAdmin } from '../../shared.js'
import { requireAuth } from '../../middleware.js'
import { isPlatformOwner } from '../ai-helpers.js'

export function registerAiInventoryIntelRoutes(app) {
  // ── Inventory Intelligence ────────────────────────────────────────────────
  app.get('/ai/inventory-intelligence', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('inv_intel_active, name, country')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = isPlatformOwner(req)

    const cRaw = (dealer?.country || '').trim().toUpperCase()
    const isUsMkt = cRaw === 'US' || cRaw === 'USA' || cRaw === 'UNITED STATES'
    const annualDist = isUsMkt ? 12000 : 20000

    const since90  = new Date(Date.now() -  90 * 86400000).toISOString()
    const since30  = new Date(Date.now() -  30 * 86400000).toISOString()
    const since180 = new Date(Date.now() - 180 * 86400000).toISOString()

    const [{ data: available }, { data: sold90 }, { data: sold30 }] = await Promise.all([
      supabaseAdmin
        .from('inventory')
        .select('id, vin, stocknumber, make, model, year, condition, price, mileage, description, image_urls, created_at, photo_score, photo_flags, photo_checked_at')
        .eq('dealership_id', req.dealershipId)
        .eq('status', 'available'),
      supabaseAdmin
        .from('inventory')
        .select('make, model, year, condition, last_synced_at')
        .eq('dealership_id', req.dealershipId)
        .in('status', ['sold', 'archived'])
        .gte('last_synced_at', since90),
      supabaseAdmin
        .from('inventory')
        .select('make, model, year, condition, last_synced_at')
        .eq('dealership_id', req.dealershipId)
        .in('status', ['sold', 'archived'])
        .gte('last_synced_at', since30),
    ])

    const vehicles = available || []

    const marketMed = {}
    try {
      const { data: acts } = await supabaseAdmin.from('ai_activity')
        .select('inventory_id, market_median_price, created_at')
        .eq('dealership_id', req.dealershipId)
        .gte('created_at', since180)
        .not('market_median_price', 'is', null)
        .order('created_at', { ascending: false }).limit(2000)
      for (const a of (acts || [])) {
        if (!marketMed[a.inventory_id]) marketMed[a.inventory_id] = Number(a.market_median_price)
      }
    } catch {}

    const countBySegment = (rows) => {
      const counts = {}
      for (const r of rows) {
        const seg = [r.year, r.make, r.model].filter(Boolean).join(' ')
        if (seg) counts[seg] = (counts[seg] || 0) + 1
      }
      return counts
    }

    const availSegs  = countBySegment(vehicles)
    const sold90Segs = countBySegment(sold90 || [])
    const sold30Segs = countBySegment(sold30 || [])

    const segSet = new Set([...Object.keys(availSegs), ...Object.keys(sold90Segs)])
    const hot = []
    const cold = []
    for (const seg of segSet) {
      const invCount  = availSegs[seg]  || 0
      const s30       = sold30Segs[seg] || 0
      const s90       = sold90Segs[seg] || 0
      if (invCount <= 2 && s30 >= 1) hot.push(seg)
      if (invCount >= 3 && s90 === 0) cold.push(seg)
    }

    const currentYear = new Date().getFullYear()
    const scoredVehicles = vehicles.map(v => {
      const issues = []
      let score = 100

      const photos = Array.isArray(v.image_urls) ? v.image_urls.filter(Boolean).length : 0
      if (photos === 0) {
        score -= 30; issues.push('No photos attached — listings without photos get 80% fewer leads.')
      } else if (photos < 5) {
        score -= 15; issues.push(`Only ${photos} photos — add at least 5 for better buyer engagement.`)
      }

      if (v.photo_checked_at && v.photo_score != null && v.photo_score < 50) {
        score -= 15
        const mainFlag = (v.photo_flags || [])[0]
        issues.push(`Low photo quality score (${v.photo_score}/100)${mainFlag ? ': ' + mainFlag : ''}`)
      }

      const p = Number(v.price) || 0
      if (p === 0) {
        score -= 25; issues.push('Price is $0 or missing — set an asking price to show in searches.')
      } else if (marketMed[v.id]) {
        const med = marketMed[v.id]
        const diffPct = Math.round(((p - med) / med) * 100)
        if (diffPct > 10) {
          score -= 10
          issues.push(`Asking price $${p.toLocaleString()} is ${diffPct}% above market median ($${med.toLocaleString()}).`)
        }
      }

      const daysOnLot = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000)
      if (daysOnLot > 90) {
        score -= 20; issues.push(`Aging vehicle — ${daysOnLot} days on lot (over 90-day threshold).`)
      } else if (daysOnLot > 60) {
        score -= 10; issues.push(`Approaching aging limit — ${daysOnLot} days on lot.`)
      }

      const m = Number(v.mileage) || 0
      const age = currentYear - (Number(v.year) || currentYear)
      if (m > 0 && age > 0) {
        const expM = age * annualDist
        if (m > expM * 1.5) {
          score -= 10
          issues.push(`High mileage for age (${m.toLocaleString()} vs ~${expM.toLocaleString()} expected).`)
        }
      }

      return {
        id: v.id,
        vin: v.vin || null,
        stocknumber: v.stocknumber || null,
        label: [v.year, v.make, v.model].filter(Boolean).join(' '),
        year: v.year, make: v.make, model: v.model, condition: v.condition,
        price: p, mileage: m, days_on_lot: daysOnLot,
        photo_count: photos,
        photo_score: v.photo_score ?? null,
        health_score: Math.max(0, score),
        issues,
      }
    })

    const total = vehicles.length
    const avgScore = total ? Math.round(scoredVehicles.reduce((s, v) => s + v.health_score, 0) / total) : 100
    const needsAttention = scoredVehicles.filter(v => v.health_score < 70)

    const vinMap = {}
    for (const v of vehicles) {
      if (v.vin) vinMap[v.vin] = (vinMap[v.vin] || 0) + 1
    }
    const duplicateVins = Object.entries(vinMap).filter(([, count]) => count > 1).map(([vin]) => vin)

    const topMovers = Object.entries(sold90Segs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([seg, count]) => `${seg} (${count} sold 90d)`)

    res.json({
      summary: {
        total_vehicles: total,
        avg_health_score: avgScore,
        needs_attention_count: needsAttention.length,
        duplicate_vins_count: duplicateVins.length,
        duplicate_vins: duplicateVins,
        hot_segments: hot.slice(0, 6),
        cold_segments: cold.slice(0, 6),
        top_movers: topMovers,
        no_photos_count: scoredVehicles.filter(v => v.photo_count === 0).length,
        stale_60d_count: scoredVehicles.filter(v => v.days_on_lot > 60).length,
      },
      vehicles: scoredVehicles.sort((a, b) => a.health_score - b.health_score),
    })
  })

  // ── Inventory Narrative ────────────────────────────────────────────────
  app.post('/ai/inventory-narrative', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    const isOwner = isPlatformOwner(req)
    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('inv_intel_active')
      .eq('id', req.dealershipId)
      .single()
    if (!process.env.ANTHROPIC_API_KEY) return res.json({ narrative: null })

    const { total, avg_score, needs_attention, duplicate_vins, hot, cold, top_movers, no_photos, stale } = req.body
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const prompt = `You are an automotive inventory analyst for a Canadian dealership. Analyze this lot data and return exactly 5 bullet-point insights — each under 20 words, specific, actionable. Return ONLY a JSON array of strings (no markdown):

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
