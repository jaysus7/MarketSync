import { supabaseAdmin, resend, EMAIL_FROM, FRONTEND_URL } from '../../shared.js'
import { rateLimit } from '../../security.js'
import { requireAuth, requireMfa } from '../../middleware.js'
import { requirePermission } from '../../authorization.js'
import { requestHasCronSecret } from '../../cron-auth.js'
import { createNotification, createNotifications } from '../../notifications.js'
import { isPlatformOwner, computeDailyDigest } from '../ai-helpers.js'

export async function buildReportData(dealershipId) {
  const now = Date.now()
  const ago7  = new Date(now - 7  * 86400000).toISOString()
  const ago14 = new Date(now - 14 * 86400000).toISOString()

  const [
    { data: allVehicles },
    { data: recentActivity },
    { data: prevActivity },
    { data: soldRecent }
  ] = await Promise.all([
    supabaseAdmin.from('inventory')
      .select('id, year, make, model, trim, price, condition, stocknumber, image_urls, last_synced_at, created_at, lot_date, status')
      .eq('dealership_id', dealershipId)
      .eq('status', 'available'),
    supabaseAdmin.from('ai_activity')
      .select('inventory_id, vehicle_label, warnings, price_flagged, price_pct_diff, created_at')
      .eq('dealership_id', dealershipId)
      .gte('created_at', ago7)
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin.from('ai_activity')
      .select('inventory_id, price_flagged, price_pct_diff')
      .eq('dealership_id', dealershipId)
      .gte('created_at', ago14)
      .lt('created_at', ago7)
      .limit(500),
    supabaseAdmin.from('inventory')
      .select('id, status, archived_at, last_synced_at')
      .eq('dealership_id', dealershipId)
      .in('status', ['sold', 'archived'])
      .or(`archived_at.gte.${ago14},last_synced_at.gte.${ago14}`)
  ])

  const vehicles = allVehicles || []
  const totalUnits = vehicles.length
  const withPhotos = vehicles.filter(v => v.image_urls?.length > 0).length
  const noPhotos = vehicles.filter(v => !v.image_urls?.length)
  const prices = vehicles.filter(v => v.price > 0).map(v => Number(v.price)).sort((a, b) => a - b)
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
  const medianPrice = prices.length ? prices[Math.floor(prices.length / 2)] : null

  const withDays = vehicles.map(v => ({
    ...v,
    daysOnLot: Math.floor((now - new Date(v.lot_date || v.created_at || v.last_synced_at).getTime()) / 86400000)
  }))
  const aging = withDays.filter(v => v.daysOnLot > 60).sort((a, b) => b.daysOnLot - a.daysOnLot)
  const slowMovers30 = withDays.filter(v => v.daysOnLot > 30 && v.daysOnLot <= 60).sort((a, b) => b.daysOnLot - a.daysOnLot)
  const avgDays = withDays.length ? Math.round(withDays.reduce((s, v) => s + v.daysOnLot, 0) / withDays.length) : 0

  const vehicleById = {}
  for (const v of vehicles) vehicleById[v.id] = v

  const driftMap = {}
  for (const a of (recentActivity || [])) {
    if (!a.price_flagged) continue
    const inv = vehicleById[a.inventory_id]
    if (!inv) continue
    const _cond = (inv.condition || '').toLowerCase()
    if (_cond === 'new' || _cond === 'demo' || _cond === 'demonstrator' || _cond === '') continue
    const key = a.inventory_id || a.vehicle_label
    if (!driftMap[key] || Math.abs(a.price_pct_diff) > Math.abs(driftMap[key].price_pct_diff)) driftMap[key] = a
  }
  const priceDrift = Object.values(driftMap).sort((a, b) => Math.abs(b.price_pct_diff) - Math.abs(a.price_pct_diff))

  const warnMap = {}
  for (const a of (recentActivity || [])) {
    const nonPhotoWarnings = (a.warnings || []).filter(w => !w.toLowerCase().includes('photo'))
    if (!nonPhotoWarnings.length) continue
    const key = a.inventory_id || a.vehicle_label
    if (!warnMap[key]) warnMap[key] = { ...a, warnings: nonPhotoWarnings }
  }
  const missingInfo = Object.values(warnMap)

  const prevDriftMap = {}
  for (const a of (prevActivity || [])) {
    if (!a.price_flagged) continue
    const inv = vehicleById[a.inventory_id]
    if (!inv) continue
    const _cond = (inv.condition || '').toLowerCase()
    if (_cond === 'new' || _cond === 'demo' || _cond === 'demonstrator' || _cond === '') continue
    const key = a.inventory_id || a.vehicle_label
    prevDriftMap[key] = a
  }
  const prevPriceFlagCount = Object.keys(prevDriftMap).length

  const newArrivalsThisWeek = vehicles.filter(v => v.created_at >= ago7).length
  const newArrivalsPrevWeek = vehicles.filter(v => v.created_at >= ago14 && v.created_at < ago7).length
  const soldAt = (v) => v.archived_at || v.last_synced_at
  const soldThisWeekCount = (soldRecent || []).filter(v => soldAt(v) >= ago7).length
  const soldPrevWeekCount = (soldRecent || []).filter(v => soldAt(v) >= ago14 && soldAt(v) < ago7).length

  const conditionCount = { new: 0, used: 0, demo: 0 }
  for (const v of vehicles) {
    const c = (v.condition || '').toLowerCase()
    if (c === 'new') conditionCount.new++
    else if (c === 'demo' || c === 'demonstrator') conditionCount.demo++
    else conditionCount.used++
  }

  const priceBrackets = [
    { label: '< $20K',    min: 0,     max: 20000, count: 0 },
    { label: '$20K–40K',  min: 20000, max: 40000, count: 0 },
    { label: '$40K–60K',  min: 40000, max: 60000, count: 0 },
    { label: '$60K–80K',  min: 60000, max: 80000, count: 0 },
    { label: '$80K+',     min: 80000, max: Infinity, count: 0 },
  ]
  for (const v of vehicles) {
    const p = Number(v.price) || 0
    const b = priceBrackets.find(b => p >= b.min && p < b.max)
    if (b) b.count++
  }

  const daysBrackets = [
    { label: '0–30 days',  count: 0 },
    { label: '31–60 days', count: 0 },
    { label: '61–90 days', count: 0 },
    { label: '90+ days',   count: 0 },
  ]
  for (const v of withDays) {
    if (v.daysOnLot <= 30) daysBrackets[0].count++
    else if (v.daysOnLot <= 60) daysBrackets[1].count++
    else if (v.daysOnLot <= 90) daysBrackets[2].count++
    else daysBrackets[3].count++
  }

  const makeCount = {}
  for (const v of vehicles) {
    const raw = (v.make || 'Unknown').trim()
    const k = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    makeCount[k] = (makeCount[k] || 0) + 1
  }
  const topMakes = Object.entries(makeCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const [{ data: crmLeads }, { data: crmDeals }, { data: crmAppts }, { data: crmEsign }, { data: crmTasksDone }] = await Promise.all([
    supabaseAdmin.from('leads').select('created_at').eq('dealership_id', dealershipId).gte('created_at', ago14).limit(50000),
    supabaseAdmin.from('deals').select('selling_price, deal_status, sold_at').eq('dealership_id', dealershipId).in('deal_status', ['sold', 'fni', 'delivered']).gte('sold_at', ago14).limit(20000),
    supabaseAdmin.from('crm_tasks').select('due_at, done, created_at').eq('dealership_id', dealershipId).eq('type', 'appointment').gte('created_at', ago14).limit(50000),
    supabaseAdmin.from('esign_requests').select('status, created_at').eq('dealership_id', dealershipId).gte('created_at', ago14).limit(20000),
    supabaseAdmin.from('crm_tasks').select('done_at').eq('dealership_id', dealershipId).eq('done', true).gte('done_at', ago14).limit(50000),
  ])
  const inWk = (iso) => iso && iso >= ago7
  const inPrev = (iso) => iso && iso >= ago14 && iso < ago7
  const dealsWkRows = (crmDeals || []).filter(d => inWk(d.sold_at))
  const pastApptsWk = (crmAppts || []).filter(a => a.due_at && new Date(a.due_at).getTime() < now && a.due_at >= ago7)
  const apptShowed = pastApptsWk.filter(a => a.done).length
  const crm = {
    leadsWk: (crmLeads || []).filter(l => inWk(l.created_at)).length,
    leadsPrev: (crmLeads || []).filter(l => inPrev(l.created_at)).length,
    dealsWk: dealsWkRows.length,
    dealsPrev: (crmDeals || []).filter(d => inPrev(d.sold_at)).length,
    revenueWk: Math.round(dealsWkRows.reduce((s, d) => s + (Number(d.selling_price) || 0), 0)),
    apptsWk: (crmAppts || []).filter(a => inWk(a.created_at)).length,
    apptsPrev: (crmAppts || []).filter(a => inPrev(a.created_at)).length,
    apptShowed,
    apptShowRate: pastApptsWk.length ? Math.round((apptShowed / pastApptsWk.length) * 100) : null,
    esignSentWk: (crmEsign || []).filter(e => inWk(e.created_at)).length,
    esignSignedWk: (crmEsign || []).filter(e => inWk(e.created_at) && e.status === 'signed').length,
    tasksDoneWk: (crmTasksDone || []).filter(t => inWk(t.done_at)).length,
  }

  return {
    crm,
    vehicles, vehicleById,
    totalUnits, withPhotos, noPhotos, prices, avgPrice, medianPrice,
    withDays, aging, slowMovers30, avgDays,
    priceDrift, missingInfo,
    prevPriceFlagCount,
    newArrivalsThisWeek, newArrivalsPrevWeek,
    soldThisWeekCount, soldPrevWeekCount,
    conditionCount, priceBrackets, daysBrackets, topMakes
  }
}

export function registerAiReportsCronRoutes(app) {
  // POST /ai/weekly-report
  app.post('/ai/weekly-report', requireAuth, requireMfa, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('ai_boost_active, inv_intel_active, ai_manager_email, name')
      .eq('id', req.dealershipId)
      .single()

    const isOwner = isPlatformOwner(req)
    if (!isOwner && !dealer?.ai_boost_active && !dealer?.inv_intel_active) return res.status(403).json({ error: 'Inventory Intelligence not active' })
    if (!dealer?.ai_manager_email) return res.status(400).json({ error: 'Add an alert email in AI settings before sending a report' })
    if (!resend) return res.status(503).json({ error: 'Email not configured' })

    const d = await buildReportData(req.dealershipId)
    const {
      vehicles, vehicleById,
      totalUnits, withPhotos, noPhotos, avgPrice, medianPrice,
      aging, slowMovers30, avgDays,
      priceDrift, missingInfo,
      prevPriceFlagCount,
      newArrivalsThisWeek, newArrivalsPrevWeek,
      soldThisWeekCount, soldPrevWeekCount,
      conditionCount, priceBrackets, daysBrackets, topMakes
    } = d

    const primary = '#1a2e4a'; const accent = '#6366f1'
    const photosPct = totalUnits ? Math.round((withPhotos / totalUnits) * 100) : 0
    const agingPct  = totalUnits ? Math.round((aging.length / totalUnits) * 100) : 0
    const driftPct  = totalUnits ? Math.round((priceDrift.length / totalUnits) * 100) : 0

    const wkDelta = (curr, prev, lowerBetter = false) => {
      const diff = curr - prev
      if (prev === 0 && diff === 0) return ''
      if (diff === 0) return `<div style="font-size:10px;color:#94a3b8">— same as last wk</div>`
      const up = diff > 0; const good = lowerBetter ? !up : up
      return `<div style="font-size:10px;color:${good ? '#16a34a' : '#ef4444'}">${up ? '↑' : '↓'}${Math.abs(diff)} vs last wk</div>`
    }
    const vLabel = v => {
      const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')
      return v.stocknumber ? `${name} <span style="color:#64748b;font-size:11px">#${v.stocknumber}</span>` : name
    }
    const aLabel = a => {
      const inv = vehicleById[a.inventory_id]; const sn = inv?.stocknumber
      return sn ? `${a.vehicle_label} <span style="color:#64748b;font-size:11px">#${sn}</span>` : a.vehicle_label
    }
    const statBox = (label, value, sub, color, delta = '') =>
      `<td width="25%" style="padding:12px;text-align:center;border-right:1px solid #e2e8f0">
        <div style="font-size:22px;font-weight:900;color:${color}">${value}</div>
        <div style="font-size:11px;font-weight:700;color:#475569;margin-top:2px;text-transform:uppercase;letter-spacing:0.05em">${label}</div>
        ${sub ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px">${sub}</div>` : ''}${delta}
      </td>`
    const barRow = (label, count, max, total, color = accent) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      const barW = max > 0 ? Math.round((count / max) * 180) : 0
      return `<tr>
        <td style="padding:3px 10px;font-size:12px;color:#334155;width:110px;white-space:nowrap">${label}</td>
        <td style="padding:3px 6px"><div style="background:#e2e8f0;border-radius:4px;height:13px;width:190px"><div style="background:${color};border-radius:4px;height:13px;width:${barW}px"></div></div></td>
        <td style="padding:3px 6px;font-size:11px;color:#64748b;white-space:nowrap">${count} (${pct}%)</td></tr>`
    }
    const sectionHeader = (title, cols = 3) =>
      `<tr><td colspan="${cols}" style="background:${primary};color:#fff;font-weight:700;font-size:13px;padding:9px 12px">${title}</td></tr>`
    const subNote = (text, cols = 3) =>
      `<tr><td colspan="${cols}" style="background:#f1f5f9;color:#475569;font-size:11px;padding:7px 12px;border-bottom:1px solid #e2e8f0;font-style:italic">${text}</td></tr>`
    const agingRow = v =>
      `<tr><td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${vLabel(v)}</td>
       <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px">${v.price ? '$' + Number(v.price).toLocaleString() : '—'}</td>
       <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:${v.daysOnLot > 90 ? '#ef4444' : '#f59e0b'};font-weight:700">${v.daysOnLot}d</td></tr>`
    const driftRow = a => {
      const pct = a.price_pct_diff; const over = pct > 0
      const fix = over
        ? `Consider reducing by $${Math.round(Math.abs(pct / 100) * (vehicleById[a.inventory_id]?.price || 0)).toLocaleString()} to align with market`
        : `May sell faster at current price — or raise to recapture margin`
      return `<tr>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${aLabel(a)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:${over ? '#16a34a' : '#ef4444'};font-weight:700">${over ? '+' : ''}${pct}%</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b">${over ? 'Overpriced' : 'Underpriced'} vs AutoTrader/CarGurus market median. ${fix}</td></tr>`
    }
    const warnRow = a =>
      `<tr><td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${aLabel(a)}</td>
       <td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#b45309">${(a.warnings || []).join(' · ')}</td></tr>`

    const maxCondition = Math.max(conditionCount.new, conditionCount.used, conditionCount.demo, 1)
    const maxPriceBracket = Math.max(...priceBrackets.map(b => b.count), 1)
    const maxDaysBracket  = Math.max(...daysBrackets.map(b => b.count), 1)
    const maxMakeCount = topMakes[0]?.[1] || 1
    const dateStr = new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif}</style>
</head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
<tr><td align="center">
<table width="660" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:${primary};padding:22px 24px">
    <div style="color:#fff;font-size:22px;font-weight:900">${dealer.name || 'Your Dealership'}</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:3px">Weekly Lot Health Report</div>
    <div style="color:#e2e8f0;font-size:15px;font-weight:700;margin-top:6px">${dateStr}</div>
  </td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('Total Inventory', totalUnits, 'all available units', '#1a2e4a')}
    ${statBox('New Units', conditionCount.new, `${totalUnits ? Math.round(conditionCount.new/totalUnits*100) : 0}% of lot`, '#0ea5e9')}
    ${statBox('Used Units', conditionCount.used, `${totalUnits ? Math.round(conditionCount.used/totalUnits*100) : 0}% of lot`, '#6366f1')}
    ${statBox('Demo Units', conditionCount.demo, `${totalUnits ? Math.round(conditionCount.demo/totalUnits*100) : 0}% of lot`, '#f59e0b')}
  </tr></table></td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('Photos', `${photosPct}%`, `${withPhotos} of ${totalUnits} have photos`, photosPct < 80 ? '#ef4444' : '#16a34a')}
    ${statBox('Avg Days on Lot', avgDays, agingPct > 0 ? `${agingPct}% aging 60d+` : 'healthy turnover', avgDays > 45 ? '#f59e0b' : '#16a34a')}
    ${statBox('Price Flags', priceDrift.length, `${driftPct}% of lot (used)`, priceDrift.length > 0 ? '#ef4444' : '#16a34a', wkDelta(priceDrift.length, prevPriceFlagCount, true))}
    ${statBox('No Photos', noPhotos.length, `${noPhotos.length} listings missing`, noPhotos.length > 0 ? '#ef4444' : '#16a34a')}
  </tr></table></td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('New Arrivals', newArrivalsThisWeek, 'added this week', '#6366f1', wkDelta(newArrivalsThisWeek, newArrivalsPrevWeek))}
    ${statBox('Sold This Week', soldThisWeekCount, 'units sold last 7 days', soldThisWeekCount > 0 ? '#16a34a' : '#94a3b8', wkDelta(soldThisWeekCount, soldPrevWeekCount))}
    ${statBox('60d+ Aging', aging.length, `${agingPct}% of lot`, aging.length > 0 ? '#f59e0b' : '#16a34a')}
    ${statBox('Avg Ask Price', avgPrice ? '$' + avgPrice.toLocaleString() : '—', medianPrice ? `median $${medianPrice.toLocaleString()}` : '', '#334155')}
  </tr></table></td></tr>
  <tr><td style="padding:14px 20px 8px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr valign="top">
      <td width="50%" style="padding-right:12px">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Inventory by Make</div>
        <table cellpadding="0" cellspacing="0">${topMakes.map(([make, cnt]) => barRow(make, cnt, maxMakeCount, totalUnits)).join('')}</table>
        <div style="font-size:10px;color:#94a3b8;margin-top:4px">Avg $${avgPrice?.toLocaleString() ?? '—'} · Median $${medianPrice?.toLocaleString() ?? '—'}</div>
      </td>
      <td width="50%" style="padding-left:12px;border-left:1px solid #e2e8f0">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Condition Mix</div>
        <table cellpadding="0" cellspacing="0">
          ${barRow('New', conditionCount.new, maxCondition, totalUnits, '#16a34a')}
          ${barRow('Used', conditionCount.used, maxCondition, totalUnits, '#6366f1')}
          ${barRow('Demo', conditionCount.demo, maxCondition, totalUnits, '#f59e0b')}
        </table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:8px 20px 14px;border-top:1px solid #f1f5f9">
    <table width="100%" cellpadding="0" cellspacing="0"><tr valign="top">
      <td width="50%" style="padding-right:12px">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Price Distribution</div>
        <table cellpadding="0" cellspacing="0">${priceBrackets.map(b => barRow(b.label, b.count, maxPriceBracket, totalUnits, '#0ea5e9')).join('')}</table>
      </td>
      <td width="50%" style="padding-left:12px;border-left:1px solid #e2e8f0">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Days on Lot</div>
        <table cellpadding="0" cellspacing="0">${daysBrackets.map((b, i) => barRow(b.label, b.count, maxDaysBracket, totalUnits, ['#16a34a','#6366f1','#f59e0b','#ef4444'][i])).join('')}</table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
    ${priceDrift.length ? `
      ${sectionHeader('💰 Price Drift Flags — Used Vehicles Only (' + priceDrift.length + ')')}
      ${subNote('Price drift = this vehicle\'s asking price vs. the median of similar make/model used units on your own lot. Negative = underpriced. Positive = overpriced. New vehicles excluded.')}
      <tr style="background:#f8fafc"><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">DRIFT</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">RECOMMENDATION</td></tr>
      ${priceDrift.map(driftRow).join('')}` : ''}
    ${aging.length ? `
      ${sectionHeader('⏱ Aging Units — 60+ Days on Lot (' + aging.length + ')')}
      ${subNote('Over 60 days. Consider a price reduction, additional marketing, or trade-in push. 90d+ shown in red.')}
      <tr style="background:#f8fafc"><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">PRICE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">DAYS</td></tr>
      ${aging.map(agingRow).join('')}` : ''}
    ${slowMovers30.length ? `
      ${sectionHeader('🐢 Watch List — 30–60 Days on Lot (' + slowMovers30.length + ')')}
      ${subNote('Approaching the aging threshold. A small price move now is better than a larger one at 60 days.')}
      ${slowMovers30.map(agingRow).join('')}` : ''}
    ${noPhotos.length ? `
      ${sectionHeader('📷 No Photos — All Vehicles (' + noPhotos.length + ')')}
      ${subNote('Listings without photos get significantly fewer clicks. Upload through your DMS or directly in MarketSync.')}
      <tr style="background:#f8fafc"><td colspan="3" style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td></tr>
      ${noPhotos.map(v => `<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${vLabel(v)}</td></tr>`).join('')}` : ''}
    ${missingInfo.length ? `
      ${sectionHeader('⚠ Other Missing Info (' + missingInfo.length + ' flags)')}
      ${missingInfo.map(warnRow).join('')}` : ''}
    ${!aging.length && !priceDrift.length && !slowMovers30.length && !noPhotos.length && !missingInfo.length
      ? '<tr><td colspan="3" style="padding:24px;text-align:center;color:#16a34a;font-weight:700">✓ No issues — your lot is in great shape!</td></tr>' : ''}
  </table></td></tr>
  <tr><td style="background:#f8fafc;padding:14px 24px;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Sent automatically by MarketSync AI Boost · <a href="https://marketsync.link" style="color:${accent}">marketsync.link</a></p>
  </td></tr>
</table></td></tr></table></body></html>`

    await resend.emails.send({
      from: EMAIL_FROM,
      to: dealer.ai_manager_email,
      subject: `Lot Health Report — ${dealer.name} — ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      html: emailHtml,
    })

    await createNotification({
      dealershipId: dealer.id,
      type: 'weekly_report',
      title: 'Weekly Lot Health Report Sent',
      body: `Your weekly lot health report has been sent to ${dealer.ai_manager_email}`,
      linkPage: 'inventory-overview',
    }).catch(() => {})

    res.json({ ok: true, sent_to: dealer.ai_manager_email })
  })

  // GET /ai/weekly-report/html
  app.get('/ai/weekly-report/html', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).send('No dealership associated')
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('name').eq('id', req.dealershipId).single()
    const d = await buildReportData(req.dealershipId)
    const {
      vehicles, vehicleById,
      totalUnits, withPhotos, noPhotos, avgPrice, medianPrice,
      aging, slowMovers30, avgDays,
      priceDrift, missingInfo,
      prevPriceFlagCount,
      newArrivalsThisWeek, newArrivalsPrevWeek,
      soldThisWeekCount, soldPrevWeekCount,
      conditionCount, priceBrackets, daysBrackets, topMakes
    } = d

    const primary = '#1a2e4a'; const accent = '#6366f1'
    const photosPct = totalUnits ? Math.round((withPhotos / totalUnits) * 100) : 0
    const agingPct  = totalUnits ? Math.round((aging.length / totalUnits) * 100) : 0
    const driftPct  = totalUnits ? Math.round((priceDrift.length / totalUnits) * 100) : 0

    const wkDelta = (curr, prev, lowerBetter = false) => {
      const diff = curr - prev
      if (prev === 0 && diff === 0) return ''
      if (diff === 0) return `<div style="font-size:10px;color:#94a3b8">— same as last wk</div>`
      const up = diff > 0; const good = lowerBetter ? !up : up
      return `<div style="font-size:10px;color:${good ? '#16a34a' : '#ef4444'}">${up ? '↑' : '↓'}${Math.abs(diff)} vs last wk</div>`
    }
    const vLabel = v => {
      const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')
      return v.stocknumber ? `${name} <span style="color:#64748b;font-size:11px">#${v.stocknumber}</span>` : name
    }
    const aLabel = a => {
      const inv = vehicleById[a.inventory_id]; const sn = inv?.stocknumber
      return sn ? `${a.vehicle_label} <span style="color:#64748b;font-size:11px">#${sn}</span>` : a.vehicle_label
    }
    const statBox = (label, value, sub, color, delta = '') =>
      `<td width="25%" style="padding:12px;text-align:center;border-right:1px solid #e2e8f0">
        <div style="font-size:22px;font-weight:900;color:${color}">${value}</div>
        <div style="font-size:11px;font-weight:700;color:#475569;margin-top:2px;text-transform:uppercase;letter-spacing:0.05em">${label}</div>
        ${sub ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px">${sub}</div>` : ''}${delta}
      </td>`
    const barRow = (label, count, max, total, color = accent) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0
      const barW = max > 0 ? Math.round((count / max) * 180) : 0
      return `<tr>
        <td style="padding:3px 10px;font-size:12px;color:#334155;width:110px;white-space:nowrap">${label}</td>
        <td style="padding:3px 6px"><div style="background:#e2e8f0;border-radius:4px;height:13px;width:190px"><div style="background:${color};border-radius:4px;height:13px;width:${barW}px"></div></div></td>
        <td style="padding:3px 6px;font-size:11px;color:#64748b;white-space:nowrap">${count} (${pct}%)</td></tr>`
    }
    const sectionHeader = (title, cols = 3) =>
      `<tr><td colspan="${cols}" style="background:${primary};color:#fff;font-weight:700;font-size:13px;padding:9px 12px">${title}</td></tr>`
    const subNote = (text, cols = 3) =>
      `<tr><td colspan="${cols}" style="background:#f1f5f9;color:#475569;font-size:11px;padding:7px 12px;border-bottom:1px solid #e2e8f0;font-style:italic">${text}</td></tr>`
    const agingRow = v =>
      `<tr><td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${vLabel(v)}</td>
       <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px">${v.price ? '$' + Number(v.price).toLocaleString() : '—'}</td>
       <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:${v.daysOnLot > 90 ? '#ef4444' : '#f59e0b'};font-weight:700">${v.daysOnLot}d</td></tr>`
    const driftRow = a => {
      const pct = a.price_pct_diff; const over = pct > 0
      const fix = over
        ? `Consider reducing by $${Math.round(Math.abs(pct / 100) * (vehicleById[a.inventory_id]?.price || 0)).toLocaleString()} to align with market`
        : `May sell faster at current price — or raise to recapture margin`
      return `<tr>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${aLabel(a)}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:${over ? '#16a34a' : '#ef4444'};font-weight:700">${over ? '+' : ''}${pct}%</td>
        <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b">${over ? 'Overpriced' : 'Underpriced'} vs AutoTrader/CarGurus market median. ${fix}</td></tr>`
    }
    const warnRow = a =>
      `<tr><td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${aLabel(a)}</td>
       <td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#b45309">${(a.warnings || []).join(' · ')}</td></tr>`

    const maxCondition = Math.max(conditionCount.new, conditionCount.used, conditionCount.demo, 1)
    const maxPriceBracket = Math.max(...priceBrackets.map(b => b.count), 1)
    const maxDaysBracket  = Math.max(...daysBrackets.map(b => b.count), 1)
    const maxMakeCount = topMakes[0]?.[1] || 1
    const dateStr = new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif}</style>
</head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
<tr><td align="center">
<table width="660" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:${primary};padding:22px 24px">
    <div style="color:#fff;font-size:22px;font-weight:900">${dealer?.name || 'Your Dealership'}</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:3px">Weekly Lot Health Report</div>
    <div style="color:#e2e8f0;font-size:15px;font-weight:700;margin-top:6px">${dateStr}</div>
  </td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('Total Inventory', totalUnits, 'all available units', '#1a2e4a')}
    ${statBox('New Units', conditionCount.new, `${totalUnits ? Math.round(conditionCount.new/totalUnits*100) : 0}% of lot`, '#0ea5e9')}
    ${statBox('Used Units', conditionCount.used, `${totalUnits ? Math.round(conditionCount.used/totalUnits*100) : 0}% of lot`, '#6366f1')}
    ${statBox('Demo Units', conditionCount.demo, `${totalUnits ? Math.round(conditionCount.demo/totalUnits*100) : 0}% of lot`, '#f59e0b')}
  </tr></table></td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('Photos', `${photosPct}%`, `${withPhotos} of ${totalUnits} have photos`, photosPct < 80 ? '#ef4444' : '#16a34a')}
    ${statBox('Avg Days on Lot', avgDays, agingPct > 0 ? `${agingPct}% aging 60d+` : 'healthy turnover', avgDays > 45 ? '#f59e0b' : '#16a34a')}
    ${statBox('Price Flags', priceDrift.length, `${driftPct}% of lot (used)`, priceDrift.length > 0 ? '#ef4444' : '#16a34a', wkDelta(priceDrift.length, prevPriceFlagCount, true))}
    ${statBox('No Photos', noPhotos.length, `${noPhotos.length} listings missing`, noPhotos.length > 0 ? '#ef4444' : '#16a34a')}
  </tr></table></td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('New Arrivals', newArrivalsThisWeek, 'added this week', '#6366f1', wkDelta(newArrivalsThisWeek, newArrivalsPrevWeek))}
    ${statBox('Sold This Week', soldThisWeekCount, 'units sold last 7 days', soldThisWeekCount > 0 ? '#16a34a' : '#94a3b8', wkDelta(soldThisWeekCount, soldPrevWeekCount))}
    ${statBox('60d+ Aging', aging.length, `${agingPct}% of lot`, aging.length > 0 ? '#f59e0b' : '#16a34a')}
    ${statBox('Avg Ask Price', avgPrice ? '$' + avgPrice.toLocaleString() : '—', medianPrice ? `median $${medianPrice.toLocaleString()}` : '', '#334155')}
  </tr></table></td></tr>
  <tr><td style="padding:14px 20px 8px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr valign="top">
      <td width="50%" style="padding-right:12px">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Inventory by Make</div>
        <table cellpadding="0" cellspacing="0">${topMakes.map(([make, cnt]) => barRow(make, cnt, maxMakeCount, totalUnits)).join('')}</table>
        <div style="font-size:10px;color:#94a3b8;margin-top:4px">Avg $${avgPrice?.toLocaleString() ?? '—'} · Median $${medianPrice?.toLocaleString() ?? '—'}</div>
      </td>
      <td width="50%" style="padding-left:12px;border-left:1px solid #e2e8f0">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Condition Mix</div>
        <table cellpadding="0" cellspacing="0">
          ${barRow('New', conditionCount.new, maxCondition, totalUnits, '#16a34a')}
          ${barRow('Used', conditionCount.used, maxCondition, totalUnits, '#6366f1')}
          ${barRow('Demo', conditionCount.demo, maxCondition, totalUnits, '#f59e0b')}
        </table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:8px 20px 14px;border-top:1px solid #f1f5f9">
    <table width="100%" cellpadding="0" cellspacing="0"><tr valign="top">
      <td width="50%" style="padding-right:12px">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Price Distribution</div>
        <table cellpadding="0" cellspacing="0">${priceBrackets.map(b => barRow(b.label, b.count, maxPriceBracket, totalUnits, '#0ea5e9')).join('')}</table>
      </td>
      <td width="50%" style="padding-left:12px;border-left:1px solid #e2e8f0">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Days on Lot</div>
        <table cellpadding="0" cellspacing="0">${daysBrackets.map((b, i) => barRow(b.label, b.count, maxDaysBracket, totalUnits, ['#16a34a','#6366f1','#f59e0b','#ef4444'][i])).join('')}</table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
    ${priceDrift.length ? `
      ${sectionHeader('💰 Price Drift Flags — Used Vehicles Only (' + priceDrift.length + ')')}
      ${subNote('Price drift = this vehicle\'s asking price vs. the median of similar make/model used units on your own lot. Negative = underpriced. Positive = overpriced. New vehicles excluded.')}
      <tr style="background:#f8fafc"><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">DRIFT</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">RECOMMENDATION</td></tr>
      ${priceDrift.map(driftRow).join('')}` : ''}
    ${aging.length ? `
      ${sectionHeader('⏱ Aging Units — 60+ Days on Lot (' + aging.length + ')')}
      ${subNote('Over 60 days. Consider a price reduction, additional marketing, or trade-in push. 90d+ shown in red.')}
      <tr style="background:#f8fafc"><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">PRICE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">DAYS</td></tr>
      ${aging.map(agingRow).join('')}` : ''}
    ${slowMovers30.length ? `
      ${sectionHeader('🐢 Watch List — 30–60 Days on Lot (' + slowMovers30.length + ')')}
      ${subNote('Approaching the aging threshold. A small price move now is better than a larger one at 60 days.')}
      ${slowMovers30.map(agingRow).join('')}` : ''}
    ${noPhotos.length ? `
      ${sectionHeader('📷 No Photos — All Vehicles (' + noPhotos.length + ')')}
      ${subNote('Listings without photos get significantly fewer clicks. Upload through your DMS or directly in MarketSync.')}
      <tr style="background:#f8fafc"><td colspan="3" style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td></tr>
      ${noPhotos.map(v => `<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${vLabel(v)}</td></tr>`).join('')}` : ''}
    ${missingInfo.length ? `
      ${sectionHeader('⚠ Other Missing Info (' + missingInfo.length + ' flags)')}
      ${missingInfo.map(warnRow).join('')}` : ''}
    ${!aging.length && !priceDrift.length && !slowMovers30.length && !noPhotos.length && !missingInfo.length
      ? '<tr><td colspan="3" style="padding:24px;text-align:center;color:#16a34a;font-weight:700">✓ No issues — your lot is in great shape!</td></tr>' : ''}
  </table></td></tr>
  <tr><td style="background:#f8fafc;padding:14px 24px;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Sent automatically by MarketSync AI Boost · <a href="https://marketsync.link" style="color:${accent}">marketsync.link</a></p>
  </td></tr>
</table></td></tr></table></body></html>`

    res.setHeader('Content-Type', 'text/html')
    res.send(emailHtml)
  })

  // POST /cron/expire-full-access
  app.post('/cron/expire-full-access', rateLimit('cron-expire-access', 60, 60000), async (req, res) => {
    if (!requestHasCronSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
      const { data } = await supabaseAdmin.from('dealerships')
        .select('id, ai_boost_paid, inv_intel_paid')
        .not('full_access_until', 'is', null)
        .lt('full_access_until', new Date().toISOString())
      let expired = 0
      for (const d of (data || [])) {
        await supabaseAdmin.from('dealerships').update({
          ai_boost_active: !!d.ai_boost_paid,
          inv_intel_active: !!d.inv_intel_paid,
          full_access_until: null,
        }).eq('id', d.id)
        expired++
      }
      res.json({ ok: true, expired })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // POST /cron/weekly-reports
  app.post('/cron/weekly-reports', rateLimit('cron-weekly-reports', 60, 60000), async (req, res) => {
    if (!requestHasCronSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data: dealers } = await supabaseAdmin
      .from('dealerships')
      .select('id, name, ai_boost_active, ai_manager_email')
      .eq('ai_boost_active', true)
      .not('ai_manager_email', 'is', null)

    let sent = 0; let failed = 0
    for (const dealer of dealers || []) {
      try {
        const d = await buildReportData(dealer.id)
        const {
          vehicles, vehicleById,
          totalUnits, withPhotos, noPhotos, avgPrice, medianPrice,
          aging, slowMovers30, avgDays,
          priceDrift, missingInfo,
          prevPriceFlagCount,
          newArrivalsThisWeek, newArrivalsPrevWeek,
          soldThisWeekCount, soldPrevWeekCount,
          conditionCount, priceBrackets, daysBrackets, topMakes
        } = d

        const primary = '#1a2e4a'; const accent = '#6366f1'
        const photosPct = totalUnits ? Math.round((withPhotos / totalUnits) * 100) : 0
        const agingPct  = totalUnits ? Math.round((aging.length / totalUnits) * 100) : 0
        const driftPct  = totalUnits ? Math.round((priceDrift.length / totalUnits) * 100) : 0

        const wkDelta = (curr, prev, lowerBetter = false) => {
          const diff = curr - prev
          if (prev === 0 && diff === 0) return ''
          if (diff === 0) return `<div style="font-size:10px;color:#94a3b8">— same as last wk</div>`
          const up = diff > 0; const good = lowerBetter ? !up : up
          return `<div style="font-size:10px;color:${good ? '#16a34a' : '#ef4444'}">${up ? '↑' : '↓'}${Math.abs(diff)} vs last wk</div>`
        }
        const vLabel = v => {
          const name = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')
          return v.stocknumber ? `${name} <span style="color:#64748b;font-size:11px">#${v.stocknumber}</span>` : name
        }
        const aLabel = a => {
          const inv = vehicleById[a.inventory_id]; const sn = inv?.stocknumber
          return sn ? `${a.vehicle_label} <span style="color:#64748b;font-size:11px">#${sn}</span>` : a.vehicle_label
        }
        const statBox = (label, value, sub, color, delta = '') =>
          `<td width="25%" style="padding:12px;text-align:center;border-right:1px solid #e2e8f0">
            <div style="font-size:22px;font-weight:900;color:${color}">${value}</div>
            <div style="font-size:11px;font-weight:700;color:#475569;margin-top:2px;text-transform:uppercase;letter-spacing:0.05em">${label}</div>
            ${sub ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px">${sub}</div>` : ''}${delta}
          </td>`
        const barRow = (label, count, max, total, color = accent) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const barW = max > 0 ? Math.round((count / max) * 180) : 0
          return `<tr>
            <td style="padding:3px 10px;font-size:12px;color:#334155;width:110px;white-space:nowrap">${label}</td>
            <td style="padding:3px 6px"><div style="background:#e2e8f0;border-radius:4px;height:13px;width:190px"><div style="background:${color};border-radius:4px;height:13px;width:${barW}px"></div></div></td>
            <td style="padding:3px 6px;font-size:11px;color:#64748b;white-space:nowrap">${count} (${pct}%)</td></tr>`
        }
        const sectionHeader = (title, cols = 3) =>
          `<tr><td colspan="${cols}" style="background:${primary};color:#fff;font-weight:700;font-size:13px;padding:9px 12px">${title}</td></tr>`
        const subNote = (text, cols = 3) =>
          `<tr><td colspan="${cols}" style="background:#f1f5f9;color:#475569;font-size:11px;padding:7px 12px;border-bottom:1px solid #e2e8f0;font-style:italic">${text}</td></tr>`
        const agingRow = v =>
          `<tr><td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${vLabel(v)}</td>
           <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px">${v.price ? '$' + Number(v.price).toLocaleString() : '—'}</td>
           <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:${v.daysOnLot > 90 ? '#ef4444' : '#f59e0b'};font-weight:700">${v.daysOnLot}d</td></tr>`
        const driftRow = a => {
          const pct = a.price_pct_diff; const over = pct > 0
          const fix = over
            ? `Consider reducing by $${Math.round(Math.abs(pct / 100) * (vehicleById[a.inventory_id]?.price || 0)).toLocaleString()} to align with market`
            : `May sell faster at current price — or raise to recapture margin`
          return `<tr>
            <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${aLabel(a)}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:13px;color:${over ? '#16a34a' : '#ef4444'};font-weight:700">${over ? '+' : ''}${pct}%</td>
            <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b">${over ? 'Overpriced' : 'Underpriced'} vs AutoTrader/CarGurus market median. ${fix}</td></tr>`
        }
        const warnRow = a =>
          `<tr><td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${aLabel(a)}</td>
           <td colspan="2" style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#b45309">${(a.warnings || []).join(' · ')}</td></tr>`

        const maxCondition = Math.max(conditionCount.new, conditionCount.used, conditionCount.demo, 1)
        const maxPriceBracket = Math.max(...priceBrackets.map(b => b.count), 1)
        const maxDaysBracket  = Math.max(...daysBrackets.map(b => b.count), 1)
        const maxMakeCount = topMakes[0]?.[1] || 1
        const dateStr = new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

        const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif}</style>
</head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
<tr><td align="center">
<table width="660" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <tr><td style="background:${primary};padding:22px 24px">
    <div style="color:#fff;font-size:22px;font-weight:900">${dealer.name}</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:3px">Weekly Lot Health Report</div>
    <div style="color:#e2e8f0;font-size:15px;font-weight:700;margin-top:6px">${dateStr}</div>
  </td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('Total Inventory', totalUnits, 'all available units', '#1a2e4a')}
    ${statBox('New Units', conditionCount.new, `${totalUnits ? Math.round(conditionCount.new/totalUnits*100) : 0}% of lot`, '#0ea5e9')}
    ${statBox('Used Units', conditionCount.used, `${totalUnits ? Math.round(conditionCount.used/totalUnits*100) : 0}% of lot`, '#6366f1')}
    ${statBox('Demo Units', conditionCount.demo, `${totalUnits ? Math.round(conditionCount.demo/totalUnits*100) : 0}% of lot`, '#f59e0b')}
  </tr></table></td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('Photos', `${photosPct}%`, `${withPhotos} of ${totalUnits} have photos`, photosPct < 80 ? '#ef4444' : '#16a34a')}
    ${statBox('Avg Days on Lot', avgDays, agingPct > 0 ? `${agingPct}% aging 60d+` : 'healthy turnover', avgDays > 45 ? '#f59e0b' : '#16a34a')}
    ${statBox('Price Flags', priceDrift.length, `${driftPct}% of lot (used)`, priceDrift.length > 0 ? '#ef4444' : '#16a34a', wkDelta(priceDrift.length, prevPriceFlagCount, true))}
    ${statBox('No Photos', noPhotos.length, `${noPhotos.length} listings missing`, noPhotos.length > 0 ? '#ef4444' : '#16a34a')}
  </tr></table></td></tr>
  <tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0"><tr>
    ${statBox('New Arrivals', newArrivalsThisWeek, 'added this week', '#6366f1', wkDelta(newArrivalsThisWeek, newArrivalsPrevWeek))}
    ${statBox('Sold This Week', soldThisWeekCount, 'units sold last 7 days', soldThisWeekCount > 0 ? '#16a34a' : '#94a3b8', wkDelta(soldThisWeekCount, soldPrevWeekCount))}
    ${statBox('60d+ Aging', aging.length, `${agingPct}% of lot`, aging.length > 0 ? '#f59e0b' : '#16a34a')}
    ${statBox('Avg Ask Price', avgPrice ? '$' + avgPrice.toLocaleString() : '—', medianPrice ? `median $${medianPrice.toLocaleString()}` : '', '#334155')}
  </tr></table></td></tr>
  <tr><td style="padding:14px 20px 8px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr valign="top">
      <td width="50%" style="padding-right:12px">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Inventory by Make</div>
        <table cellpadding="0" cellspacing="0">${topMakes.map(([make, cnt]) => barRow(make, cnt, maxMakeCount, totalUnits)).join('')}</table>
        <div style="font-size:10px;color:#94a3b8;margin-top:4px">Avg $${avgPrice?.toLocaleString() ?? '—'} · Median $${medianPrice?.toLocaleString() ?? '—'}</div>
      </td>
      <td width="50%" style="padding-left:12px;border-left:1px solid #e2e8f0">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Condition Mix</div>
        <table cellpadding="0" cellspacing="0">
          ${barRow('New', conditionCount.new, maxCondition, totalUnits, '#16a34a')}
          ${barRow('Used', conditionCount.used, maxCondition, totalUnits, '#6366f1')}
          ${barRow('Demo', conditionCount.demo, maxCondition, totalUnits, '#f59e0b')}
        </table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:8px 20px 14px;border-top:1px solid #f1f5f9">
    <table width="100%" cellpadding="0" cellspacing="0"><tr valign="top">
      <td width="50%" style="padding-right:12px">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Price Distribution</div>
        <table cellpadding="0" cellspacing="0">${priceBrackets.map(b => barRow(b.label, b.count, maxPriceBracket, totalUnits, '#0ea5e9')).join('')}</table>
      </td>
      <td width="50%" style="padding-left:12px;border-left:1px solid #e2e8f0">
        <div style="font-size:12px;font-weight:700;color:${primary};margin-bottom:6px">Days on Lot</div>
        <table cellpadding="0" cellspacing="0">${daysBrackets.map((b, i) => barRow(b.label, b.count, maxDaysBracket, totalUnits, ['#16a34a','#6366f1','#f59e0b','#ef4444'][i])).join('')}</table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
    ${priceDrift.length ? `
      ${sectionHeader('💰 Price Drift Flags — Used Vehicles Only (' + priceDrift.length + ')')}
      ${subNote('Price drift = this vehicle\'s asking price vs. the median of similar make/model used units on your own lot. Negative = underpriced. Positive = overpriced. New vehicles excluded.')}
      <tr style="background:#f8fafc"><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">DRIFT</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">RECOMMENDATION</td></tr>
      ${priceDrift.map(driftRow).join('')}` : ''}
    ${aging.length ? `
      ${sectionHeader('⏱ Aging Units — 60+ Days on Lot (' + aging.length + ')')}
      ${subNote('Over 60 days. Consider a price reduction, additional marketing, or trade-in push. 90d+ shown in red.')}
      <tr style="background:#f8fafc"><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">PRICE</td><td style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b;text-align:right">DAYS</td></tr>
      ${aging.map(agingRow).join('')}` : ''}
    ${slowMovers30.length ? `
      ${sectionHeader('🐢 Watch List — 30–60 Days on Lot (' + slowMovers30.length + ')')}
      ${subNote('Approaching the aging threshold. A small price move now is better than a larger one at 60 days.')}
      ${slowMovers30.map(agingRow).join('')}` : ''}
    ${noPhotos.length ? `
      ${sectionHeader('📷 No Photos — All Vehicles (' + noPhotos.length + ')')}
      ${subNote('Listings without photos get significantly fewer clicks. Upload through your DMS or directly in MarketSync.')}
      <tr style="background:#f8fafc"><td colspan="3" style="padding:5px 12px;font-size:11px;font-weight:700;color:#64748b">VEHICLE</td></tr>
      ${noPhotos.map(v => `<tr><td colspan="3" style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:13px">${vLabel(v)}</td></tr>`).join('')}` : ''}
    ${missingInfo.length ? `
      ${sectionHeader('⚠ Other Missing Info (' + missingInfo.length + ' flags)')}
      ${missingInfo.map(warnRow).join('')}` : ''}
    ${!aging.length && !priceDrift.length && !slowMovers30.length && !noPhotos.length && !missingInfo.length
      ? '<tr><td colspan="3" style="padding:24px;text-align:center;color:#16a34a;font-weight:700">✓ No issues — your lot is in great shape!</td></tr>' : ''}
  </table></td></tr>
  <tr><td style="background:#f8fafc;padding:14px 24px;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8">Sent automatically by MarketSync AI Boost · <a href="https://marketsync.link" style="color:${accent}">marketsync.link</a></p>
  </td></tr>
</table></td></tr></table></body></html>`

        await resend.emails.send({
          from: EMAIL_FROM,
          to: dealer.ai_manager_email,
          subject: `Lot Health Report — ${dealer.name} — ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          html: emailHtml,
        })

        await createNotification({
          dealershipId: dealer.id,
          type: 'weekly_report',
          title: 'Weekly Lot Health Report Sent',
          body: `Your weekly lot health report has been sent to ${dealer.ai_manager_email}`,
          linkPage: 'inventory-overview',
        }).catch(() => {})

        const notifRows = []
        if (d.aging?.length) {
          notifRows.push({
            dealership_id: dealer.id,
            type: 'aging',
            title: `${d.aging.length} unit${d.aging.length > 1 ? 's' : ''} aging 60+ days`,
            body: `${d.aging.slice(0, 3).map(v => v.stock_number || v.vin?.slice(-6) || 'Unit').join(', ')}${d.aging.length > 3 ? ` +${d.aging.length - 3} more` : ''} — consider a price reduction.`,
            link_page: 'inventory',
            link_filter: null,
            read: false,
          })
        }
        if (d.priceDrift?.length) {
          notifRows.push({
            dealership_id: dealer.id,
            type: 'price_drift',
            title: `${d.priceDrift.length} price drift flag${d.priceDrift.length > 1 ? 's' : ''}`,
            body: `${d.priceDrift.length} used unit${d.priceDrift.length > 1 ? 's are' : ' is'} significantly over or under the lot median.`,
            link_page: 'inventory',
            link_filter: null,
            read: false,
          })
        }
        if (d.noPhotos?.length) {
          notifRows.push({
            dealership_id: dealer.id,
            type: 'missing_info',
            title: `${d.noPhotos.length} listing${d.noPhotos.length > 1 ? 's' : ''} without photos`,
            body: 'Listings without photos get significantly fewer clicks. Upload through your DMS.',
            link_page: 'inventory',
            link_filter: null,
            read: false,
          })
        }
        notifRows.push({
          dealership_id: dealer.id,
          type: 'weekly_report',
          title: 'Weekly lot health report sent',
          body: `${d.totalUnits} units · ${d.withPhotos} with photos · ${d.newArrivalsThisWeek} new arrivals this week.`,
          link_page: 'inventory-overview',
          link_filter: null,
          read: false,
        })
        await createNotifications(notifRows)

        sent++
      } catch (err) {
        console.error(`Weekly report failed for dealer ${dealer.id}:`, err.message)
        failed++
      }
    }

    res.json({ sent, failed, total: (dealers || []).length })
  })

  // POST /cron/daily-digest
  app.post('/cron/daily-digest', rateLimit('cron-daily-digest', 60, 60000), async (req, res) => {
    if (!requestHasCronSecret(req)) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    if (!resend) return res.json({ sent: 0, note: 'email not configured' })

    const { data: dealers } = await supabaseAdmin.from('dealerships')
      .select('id, name, ai_manager_email, inv_intel_active, ai_boost_active, daily_digest_enabled')
      .not('ai_manager_email', 'is', null)

    const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
    let sent = 0, failed = 0
    for (const d of (dealers || [])) {
      try {
        if (d.daily_digest_enabled === false) continue
        if (!d.inv_intel_active && !d.ai_boost_active) continue
        const digest = await computeDailyDigest(d.id, false)
        if (!digest.items.length) continue

        const itemsHtml = digest.items
          .map(i => `<li style="margin:6px 0;font-size:14px;color:#334155">${i.icon} ${esc(i.text)}</li>`).join('')
        await resend.emails.send({
          from: EMAIL_FROM,
          to: d.ai_manager_email,
          subject: `Today's briefing — ${digest.items.length} item${digest.items.length > 1 ? 's' : ''} on your lot`,
          html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 6px;color:#0f172a">Today's Briefing</h2>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:14px">${esc(d.name || '')} · ${esc(digest.date)}</div>
            <p style="font-size:15px;color:#0f172a;line-height:1.5;margin:0 0 14px">${esc(digest.summary || '')}</p>
            <ul style="list-style:none;padding:0;margin:0 0 20px">${itemsHtml}</ul>
            <a href="${FRONTEND_URL}/dashboard.html" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:10px 18px;border-radius:8px">Open your dashboard →</a>
            <p style="font-size:11px;color:#94a3b8;margin-top:22px">You're getting this because you're set as the alert email on MarketSync. It only sends on days there's something to act on.</p>
          </div>`,
        })
        sent++
      } catch (e) {
        console.error(`Daily digest failed for dealer ${d.id}:`, e.message)
        failed++
      }
    }
    res.json({ sent, failed, total: (dealers || []).length })
  })
}
