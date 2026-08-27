import { supabaseAdmin } from '../../shared.js'
import { requireAuth, requireMfa } from '../../middleware.js'
import { requirePermission } from '../../authorization.js'
import { emitWebhook } from '../../webhooks.js'
import { ensureGetReadyCard } from '../recon.js'
import { ensureDealTasks } from '../dealertasks.js'
import { emitEvent } from '../events.js'
import { audit } from '../../audit.js'

export function registerDashboardReportsRoutes(app) {
  // ── Intelligence & Analytics summary (managers) ─────────────────────────────────
  app.get('/dashboard/analytics-summary', requireAuth, async (req, res) => {
    const did = req.dealershipId
    if (!did) return res.json({ ok: true, empty: true })
    const days = ({ '7': 7, '30': 30, '90': 90, '180': 180, '365': 365 }[String(req.query.range || '30')]) || 30
    const now = Date.now()
    const startMs = now - days * 86400000
    const prevStartMs = now - 2 * days * 86400000
    const startIso = new Date(startMs).toISOString()
    const prevStartIso = new Date(prevStartMs).toISOString()

    const { data: staff } = await supabaseAdmin.from('profiles')
      .select('id, full_name, display_name, role').eq('dealership_id', did)
    const myProfile = (staff || []).find(s => s.id === req.user.id)
    const isMgr = myProfile ? ['MANAGER', 'DEALER_ADMIN', 'OWNER', 'PLATFORM_ADMIN'].includes(myProfile.role) : false
    const nameOf = (id) => { const p = (staff || []).find(s => s.id === id); return p ? (p.full_name || p.display_name || 'Staff') : 'Staff' }

    const [{ data: curLeads }, { data: prevLeads }, { data: contacts }, { data: appraisals }, { data: tasks }, { data: mktgRows }] = await Promise.all([
      supabaseAdmin.from('leads').select('id, created_at, responded_at').eq('dealership_id', did).gte('created_at', startIso).limit(20000),
      supabaseAdmin.from('leads').select('id').eq('dealership_id', did).gte('created_at', prevStartIso).lt('created_at', startIso).limit(20000),
      supabaseAdmin.from('contacts').select('id, status, source, sold_source, assigned_rep, created_at, sold_at').eq('dealership_id', did).limit(20000),
      supabaseAdmin.from('trade_appraisals').select('id, created_by, created_at').eq('dealership_id', did).gte('created_at', startIso).limit(20000),
      supabaseAdmin.from('crm_tasks').select('id, done, due_at, assigned_to').eq('dealership_id', did).gte('due_at', startIso).limit(20000),
      supabaseAdmin.from('marketing_campaigns').select('name, channel, cost').eq('dealership_id', did).limit(500),
    ])

    const calculateResponseSpeed = (rows) => {
      const resp = (rows || []).filter(r => r.responded_at && r.created_at)
      if (!resp.length) return { responded: 0, under5: 0, median: null }
      const diffs = resp.map(r => Math.max(0, (new Date(r.responded_at) - new Date(r.created_at)) / 60000)).sort((a, b) => a - b)
      const u5 = diffs.filter(m => m <= 5).length
      const med = diffs[Math.floor(diffs.length / 2)]
      return { responded: resp.length, under5: u5, median: Math.round(med * 10) / 10 }
    }
    const sp = calculateResponseSpeed(curLeads || [])
    const respRate = curLeads?.length ? Math.round((sp.responded / curLeads.length) * 100) : 0
    const under5Pct = sp.responded ? Math.round((sp.under5 / sp.responded) * 100) : 0

    const wonStatuses = ['sold', 'fni', 'delivered']
    const wonRows = (contacts || []).filter(c => wonStatuses.includes(c.status))
    const soldInRange = (c) => {
      if (!wonStatuses.includes(c.status)) return false
      const ref = c.sold_at || c.created_at
      return ref && new Date(ref).getTime() >= startMs
    }
    const conversionPct = contacts?.length ? Math.round((wonRows.length / contacts.length) * 100) : 0

    const sold_by_source = {}
    for (const c of wonRows) {
      if (!soldInRange(c)) continue
      const src = c.sold_source || c.source || 'Direct / Walk-in'
      sold_by_source[src] = (sold_by_source[src] || 0) + 1
    }

    const { count: mkPosted } = await supabaseAdmin.from('listings')
      .select('id', { count: 'exact', head: true }).eq('posted_by', req.user.id).eq('status', 'posted')

    const { data: soldInv } = await supabaseAdmin.from('inventory')
      .select('lot_date, created_at, sold_at, archived_at, last_synced_at')
      .eq('dealership_id', did).in('status', ['sold', 'archived']).limit(10000)
    const daysSamples = []
    for (const v of (soldInv || [])) {
      const saleRef = v.sold_at || v.archived_at || v.last_synced_at
      if (!saleRef) continue
      const saleMs = new Date(saleRef).getTime()
      if (saleMs < startMs) continue
      const lotRef = v.lot_date || v.created_at
      if (!lotRef) continue
      const dts = Math.max(0, (saleMs - new Date(lotRef).getTime()) / 86400000)
      daysSamples.push(dts)
    }
    const avgDaysToSell = daysSamples.length ? Math.round(daysSamples.reduce((a, b) => a + b, 0) / daysSamples.length) : null

    const { count: priceFlags } = await supabaseAdmin.from('inventory')
      .select('id', { count: 'exact', head: true }).eq('dealership_id', did).eq('status', 'available').not('price_flag', 'is', null)

    const taskTotal = (tasks || []).length
    const taskDone = (tasks || []).filter(t => t.done).length
    const followupPct = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0

    let per_rep = []
    if (isMgr) {
      const { data: contactRows } = await supabaseAdmin.from('contacts')
        .select('assigned_rep, status, sold_at, created_at').eq('dealership_id', did).limit(20000)
      const { data: leadRows } = await supabaseAdmin.from('leads')
        .select('assigned_to, created_at, responded_at').eq('dealership_id', did).gte('created_at', startIso).limit(20000)
      const { data: taskRows } = await supabaseAdmin.from('crm_tasks')
        .select('assigned_to, done').eq('dealership_id', did).gte('due_at', startIso).limit(20000)
      const { data: apprRows } = await supabaseAdmin.from('trade_appraisals')
        .select('created_by').eq('dealership_id', did).gte('created_at', startIso).limit(20000)

      const acc = {}
      const bump = (rId) => acc[rId] || (acc[rId] = { rep_id: rId, leads: 0, responded: 0, under5: 0, deals: 0, appraisals: 0, tasks_total: 0, tasks_done: 0 })
      for (const l of (leadRows || [])) if (l.assigned_to) {
        const a = bump(l.assigned_to); a.leads++
        if (l.responded_at && l.created_at) {
          a.responded++
          if ((new Date(l.responded_at) - new Date(l.created_at)) <= 5 * 60000) a.under5++
        }
      }
      for (const c of (contactRows || [])) if (c.assigned_rep && soldInRange(c)) bump(c.assigned_rep).deals++
      for (const t of (taskRows || [])) if (t.assigned_to) { const a = bump(t.assigned_to); a.tasks_total++; if (t.done) a.tasks_done++ }
      for (const a of (apprRows || [])) if (a.created_by) bump(a.created_by).appraisals++
      per_rep = Object.values(acc)
        .filter(r => (staff || []).some(s => s.id === r.rep_id && s.role !== 'DEALER_GROUP'))
        .map(r => ({
          rep_id: r.rep_id, name: nameOf(r.rep_id), leads: r.leads, deals: r.deals, appraisals: r.appraisals,
          under_5min_pct: r.responded ? Math.round((r.under5 / r.responded) * 100) : 0,
          followup_pct: r.tasks_total ? Math.round((r.tasks_done / r.tasks_total) * 100) : 0,
        }))
        .sort((a, b) => b.deals - a.deals || b.leads - a.leads)
    }
    const totalSales = (contacts || []).filter(soldInRange).length

    let salesFinance = null
    if (isMgr) {
      const { data: dlrCost } = await supabaseAdmin.from('dealerships').select('cost_tracking_enabled').eq('id', did).maybeSingle()
      const { data: soldDeals } = await supabaseAdmin.from('deals')
        .select('selling_price, cost, deal_status, sold_at').eq('dealership_id', did).in('deal_status', ['sold', 'delivered']).gte('sold_at', startIso).limit(20000)
      const sd = soldDeals || []
      const revenue = sd.reduce((s, x) => s + (Number(x.selling_price) || 0), 0)
      salesFinance = { units: sd.length, revenue: Math.round(revenue), avg_price: sd.length ? Math.round(revenue / sd.length) : 0 }
      if (dlrCost?.cost_tracking_enabled) {
        const costed = sd.filter(x => Number(x.cost) > 0)
        const gross = costed.reduce((s, x) => s + ((Number(x.selling_price) || 0) - (Number(x.cost) || 0)), 0)
        salesFinance.front_gross = Math.round(gross)
        salesFinance.avg_gross = costed.length ? Math.round(gross / costed.length) : 0
        salesFinance.units_costed = costed.length
      }
    }

    res.json({
      ok: true, range_days: days, is_manager: isMgr,
      leads: {
        total: curLeads.length, prev_total: prevLeads.length,
        trend_pct: prevLeads.length ? Math.round(((curLeads.length - prevLeads.length) / prevLeads.length) * 100) : (curLeads.length ? 100 : 0),
        response_rate_pct: respRate, under_5min_pct: under5Pct, responded: sp.responded, median_response_min: sp.median,
      },
      pipeline: { total_contacts: contacts.length, won: wonRows.length, conversion_pct: conversionPct, sold_by_source },
      inventory: { marketplace_posted: mkPosted, avg_days_to_sell: avgDaysToSell, days_sold_count: daysSamples.length, repricing_signals: priceFlags || 0 },
      activity: { appraisals: appraisals.length, followup_completion_pct: followupPct, tasks_total: taskTotal, tasks_done: taskDone },
      sales: { total: isMgr ? totalSales : wonRows.length },
      finance: salesFinance,
      per_rep,
    })
  })

  // ── Inventory mix & aging report (managers) ─────────────────────────────────
  app.get('/dashboard/inventory-mix', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, empty: true })
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('country').eq('id', req.dealershipId).maybeSingle()
    const c = (dealer?.country || '').trim().toUpperCase()
    const isUS = c === 'US' || c === 'USA' || c === 'UNITED STATES'
    const unit = isUS ? 'mi' : 'km'

    const { data: inv } = await supabaseAdmin.from('inventory')
      .select('price, mileage, exterior_color, make, condition, lot_date, created_at, last_synced_at')
      .eq('dealership_id', req.dealershipId).eq('status', 'available').is('archived_at', null).limit(20000)
    const list = inv || []
    const now = Date.now()
    const ageOf = (v) => { const ref = v.lot_date || v.created_at || v.last_synced_at; return ref ? Math.floor((now - new Date(ref).getTime()) / 86400000) : 0 }
    const num = (n) => { const x = Number(n); return Number.isFinite(x) ? x : null }

    const groupBy = (rows, keyFn, order) => {
      const m = {}
      for (const v of rows) {
        const k = keyFn(v); if (k == null) continue
        const g = m[k] || (m[k] = { key: k, count: 0, value: 0, priced: 0, ageSum: 0 })
        g.count++; g.ageSum += ageOf(v)
        const p = num(v.price); if (p) { g.value += p; g.priced++ }
      }
      let arr = Object.values(m).map(g => ({
        key: g.key, count: g.count, value: Math.round(g.value),
        avg_price: g.priced ? Math.round(g.value / g.priced) : null,
        avg_age: g.count ? Math.round(g.ageSum / g.count) : null,
      }))
      if (order) arr.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      else arr.sort((a, b) => b.count - a.count)
      return arr
    }

    const ageBucket = (v) => { const d = ageOf(v); return d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+' }
    const AGE_ORDER = ['0–30', '31–60', '61–90', '90+']
    const kmBucket = (v) => {
      const m = num(v.mileage); if (m == null) return 'Unknown'
      return m < 50000 ? `Under 50k` : m < 100000 ? `50–100k` : m < 150000 ? `100–150k` : `150k+`
    }
    const KM_ORDER = ['Under 50k', '50–100k', '100–150k', '150k+', 'Unknown']

    const totalValue = list.reduce((s, v) => s + (num(v.price) || 0), 0)
    const avgAge = list.length ? Math.round(list.reduce((s, v) => s + ageOf(v), 0) / list.length) : 0
    const aged60 = list.filter(v => ageOf(v) > 60).length

    res.json({
      ok: true, distance_unit: unit,
      summary: { total_units: list.length, total_value: Math.round(totalValue), avg_age: avgAge, aged_over_60: aged60 },
      by_age: groupBy(list, ageBucket, AGE_ORDER),
      by_color: groupBy(list, v => (v.exterior_color || '').trim() || 'Unspecified').slice(0, 12),
      by_mileage: groupBy(list, kmBucket, KM_ORDER),
      by_make: groupBy(list, v => (v.make || '').trim() || 'Unspecified').slice(0, 12),
      by_condition: groupBy(list, v => { const x = (v.condition || '').toLowerCase(); return x === 'new' ? 'New' : x === 'demo' ? 'Demo' : x === 'certified' ? 'Certified' : 'Used' }),
    })
  })

  // ── Sales analysis (managers) ───────────────────────────────────────────────
  app.get('/dashboard/sales-analysis', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, empty: true })
    const days = ({ '30': 30, '90': 90, '180': 180, '365': 365 }[String(req.query.range || '90')]) || 90
    const startMs = Date.now() - days * 86400000
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('country').eq('id', req.dealershipId).maybeSingle()
    const c = (dealer?.country || '').trim().toUpperCase()
    const unit = (c === 'US' || c === 'USA' || c === 'UNITED STATES') ? 'mi' : 'km'

    const { data: rows } = await supabaseAdmin.from('inventory')
      .select('price, mileage, exterior_color, make, condition, lot_date, created_at, sold_at, archived_at, last_synced_at, status')
      .eq('dealership_id', req.dealershipId).in('status', ['sold', 'archived']).limit(50000)
    const num = (n) => { const x = Number(n); return Number.isFinite(x) ? x : null }
    const sold = []
    for (const v of (rows || [])) {
      const saleRef = v.sold_at || v.archived_at || v.last_synced_at
      if (!saleRef) continue
      const saleMs = new Date(saleRef).getTime()
      if (!(saleMs >= startMs)) continue
      const lotRef = v.lot_date || v.created_at
      const dts = lotRef ? Math.max(0, Math.round((saleMs - new Date(lotRef).getTime()) / 86400000)) : null
      sold.push({ ...v, _dts: dts })
    }

    const groupBy = (keyFn, order) => {
      const m = {}
      for (const v of sold) {
        const k = keyFn(v); if (k == null) continue
        const g = m[k] || (m[k] = { key: k, count: 0, value: 0, priced: 0, dtsSum: 0, dtsN: 0 })
        g.count++; const p = num(v.price); if (p) { g.value += p; g.priced++ }
        if (v._dts != null) { g.dtsSum += v._dts; g.dtsN++ }
      }
      let arr = Object.values(m).map(g => ({
        key: g.key, count: g.count, value: Math.round(g.value),
        avg_price: g.priced ? Math.round(g.value / g.priced) : null,
        avg_days_to_sell: g.dtsN ? Math.round(g.dtsSum / g.dtsN) : null,
      }))
      if (order) arr.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      else arr.sort((a, b) => b.count - a.count)
      return arr
    }
    const kmBucket = (v) => { const m = num(v.mileage); if (m == null) return 'Unknown'; return m < 50000 ? 'Under 50k' : m < 100000 ? '50–100k' : m < 150000 ? '100–150k' : '150k+' }
    const dtsBucket = (v) => { const d = v._dts; if (d == null) return 'Unknown'; return d <= 30 ? '0–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+' }
    const dtsAll = sold.map(v => v._dts).filter(x => x != null).sort((a, b) => a - b)
    const medianDts = dtsAll.length ? dtsAll[Math.floor(dtsAll.length / 2)] : null
    const totalValue = sold.reduce((s, v) => s + (num(v.price) || 0), 0)

    const condOf = (c) => { const x = (c || '').toLowerCase(); return x === 'new' ? 'new' : x === 'demo' ? 'demo' : 'used' }
    const { data: liveRows } = await supabaseAdmin.from('inventory')
      .select('condition')
      .eq('dealership_id', req.dealershipId).is('archived_at', null).neq('status', 'sold').limit(50000)
    const liveByCond = { used: 0, new: 0, demo: 0 }
    for (const r of (liveRows || [])) liveByCond[condOf(r.condition)]++
    const soldByCond = { used: 0, new: 0, demo: 0 }
    for (const v of sold) soldByCond[condOf(v.condition)]++
    const live = (liveRows || []).length
    const dailyRate = sold.length / days
    const salesPerMonth = Math.round(dailyRate * 30 * 10) / 10
    const turnsPerYear = live > 0 ? Math.round((dailyRate * 365 / live) * 10) / 10 : null
    const daysSupply = dailyRate > 0 ? Math.round(live / dailyRate) : null
    const turnFor = (k) => {
      const dr = soldByCond[k] / days, lv = liveByCond[k]
      return {
        label: k === 'used' ? 'Used' : k === 'new' ? 'New' : 'Demo',
        live: lv, sold: soldByCond[k],
        sales_per_month: Math.round(dr * 30 * 10) / 10,
        turns_per_year: lv > 0 ? Math.round((dr * 365 / lv) * 10) / 10 : null,
        days_supply: dr > 0 ? Math.round(lv / dr) : null,
      }
    }

    res.json({
      ok: true, range_days: days, distance_unit: unit,
      summary: {
        units_sold: sold.length,
        total_value: Math.round(totalValue),
        avg_days_to_sell: dtsAll.length ? Math.round(dtsAll.reduce((a, b) => a + b, 0) / dtsAll.length) : null,
        median_days_to_sell: medianDts,
        live_units: live,
        sales_per_month: salesPerMonth,
        turns_per_year: turnsPerYear,
        days_supply: daysSupply,
      },
      turn_by_condition: ['used', 'new', 'demo'].map(turnFor).filter(t => t.live > 0 || t.sold > 0),
      by_days_to_sell: groupBy(dtsBucket, ['0–30', '31–60', '61–90', '90+', 'Unknown']),
      by_color: groupBy(v => (v.exterior_color || '').trim() || 'Unspecified').slice(0, 12),
      by_mileage: groupBy(kmBucket, ['Under 50k', '50–100k', '100–150k', '150k+', 'Unknown']),
      by_make: groupBy(v => (v.make || '').trim() || 'Unspecified').slice(0, 12),
      by_condition: groupBy(v => { const x = (v.condition || '').toLowerCase(); return x === 'new' ? 'New' : x === 'demo' ? 'Demo' : x === 'certified' ? 'Certified' : 'Used' }),
    })
  })

  // ── Sales snapshot ──────────────────────────────────────────────────────────
  app.get('/dashboard/sales-snapshot', requireAuth, requirePermission('lead.assign'), async (req, res) => {
    const did = req.dealershipId
    if (!did) return res.json({ ok: true, empty: true })
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const count = async (table, build) => {
      try { const { count, error } = await build(supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('dealership_id', did)); return error ? 0 : (count || 0) }
      catch { return 0 }
    }
    const [unansweredLeads, followupsToday, followupsOverdue, apptsToday, dealsWorking, deliveriesPending, soldThisMonth] = await Promise.all([
      count('leads', q => q.is('responded_at', null)),
      count('crm_tasks', q => q.eq('done', false).neq('type', 'appointment').gte('due_at', startOfToday).lt('due_at', endOfToday)),
      count('crm_tasks', q => q.eq('done', false).neq('type', 'appointment').lt('due_at', startOfToday).not('due_at', 'is', null)),
      count('crm_tasks', q => q.eq('done', false).eq('type', 'appointment').gte('due_at', startOfToday).lt('due_at', endOfToday)),
      count('deals', q => q.in('deal_status', ['working', 'pending_credit'])),
      count('deals', q => q.eq('deal_status', 'sold')),
      count('deals', q => q.gte('sold_at', startOfMonth)),
    ])
    res.json({
      ok: true,
      unanswered_leads: unansweredLeads,
      followups_today: followupsToday,
      followups_overdue: followupsOverdue,
      appointments_today: apptsToday,
      deals_working: dealsWorking,
      deliveries_pending: deliveriesPending,
      sold_this_month: soldThisMonth,
    })
  })

  // ── Sold deals report ───────────────────────────────────────────────────────
  app.get('/reports/sold-deals', requireAuth, requireMfa, requirePermission('customer.export'), async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, rows: [], reps: [] })
    const did = req.dealershipId
    const days = ({ '30': 30, '90': 90, '180': 180, '365': 365, 'all': null }[String(req.query.range || '365')])
    const startIso = days ? new Date(Date.now() - days * 86400000).toISOString() : null
    const repFilter = req.query.rep && req.query.rep !== 'all' ? String(req.query.rep) : null
    const statuses = ['sold', 'fni', 'delivered']

    let q = supabaseAdmin.from('contacts')
      .select('id, first_name, last_name, full_name, email, phone, phone_mobile, phone_home, address, city, province, postal_code, country, birthday, status, source, sold_source, sold_at, assigned_rep, interest_inventory_id, trade_vehicle, opt_out, consent_email, consent_sms, created_at')
      .eq('dealership_id', did).in('status', statuses).limit(20000)
    if (repFilter) q = q.eq('assigned_rep', repFilter)
    if (startIso) q = q.or(`sold_at.gte.${startIso},and(sold_at.is.null,created_at.gte.${startIso})`)
    const { data: contacts } = await q

    const { data: staff } = await supabaseAdmin.from('profiles')
      .select('id, full_name, display_name, role').eq('dealership_id', did)
    const repName = (id) => { const p = (staff || []).find(s => s.id === id); return p ? (p.full_name || p.display_name || '') : '' }
    const reps = (staff || []).filter(p => p.role !== 'DEALER_GROUP').map(p => ({ id: p.id, name: p.full_name || p.display_name || '—' })).sort((a, b) => a.name.localeCompare(b.name))

    const invIds = [...new Set((contacts || []).map(c => c.interest_inventory_id).filter(Boolean))]
    let veh = {}
    if (invIds.length) {
      const { data: iv } = await supabaseAdmin.from('inventory')
        .select('id, year, make, model, trim, vin, stocknumber, drivetrain, condition, body_style').in('id', invIds)
      veh = Object.fromEntries((iv || []).map(v => [v.id, v]))
    }
    const contactIds = (contacts || []).map(c => c.id)
    let own = {}, deals = {}
    if (contactIds.length) {
      const { data: ot } = await supabaseAdmin.from('customer_ownership_tracking')
        .select('customer_id, delivery_date, owns_vehicle, vehicle_status').in('customer_id', contactIds)
      own = Object.fromEntries((ot || []).map(o => [o.customer_id, o]))
      const { data: dl } = await supabaseAdmin.from('deals')
        .select('*').eq('dealership_id', did).in('contact_id', contactIds)
      deals = Object.fromEntries((dl || []).map(d => [d.contact_id, d]))
    }
    const money = (n) => (n == null || n === '') ? null : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const yn = (b) => b === true ? 'Yes' : b === false ? 'No' : null

    const STATUS_LABEL = { sold: 'Sold', fni: 'F&I', delivered: 'Delivered' }
    const rows = (contacts || [])
      .sort((a, b) => new Date(b.sold_at || b.created_at) - new Date(a.sold_at || a.created_at))
      .map(c => {
        const v = veh[c.interest_inventory_id] || {}
        const o = own[c.id] || {}
        const dl = deals[c.id] || {}
        const delivered = dl.delivery_date || o.delivery_date || (c.status === 'delivered' ? c.sold_at : null)
        const noLongerOwns = o.owns_vehicle === false || ['traded_in', 'sold_private', 'totaled'].includes(o.vehicle_status)
        const cond = (v.condition || '').toLowerCase()
        return {
          contact_id: c.id,
          has_deal: !!deals[c.id],
          sold_date: c.sold_at || null,
          source: c.sold_source || c.source || null,
          first_name: c.first_name || null,
          last_name: c.last_name || (c.full_name && !c.first_name ? c.full_name : null),
          phone: c.phone || c.phone_mobile || c.phone_home || null,
          email: c.email || null,
          street_address: c.address || null,
          city: c.city || null,
          region: c.province || null,
          postal_code: c.postal_code || null,
          country: c.country || null,
          birthday: c.birthday || null,
          status: STATUS_LABEL[c.status] || c.status,
          delivery_date: delivered || null,
          delivery_time: dl.delivery_time || null,
          fni_manager: dl.fni_manager || null,
          deposit_amount: money(dl.deposit_amount),
          type_of_vehicle: cond === 'new' ? 'New' : cond === 'demo' ? 'Demo' : cond === 'certified' ? 'Certified' : cond ? 'Used' : (v.body_style || null),
          stock_number: v.stocknumber || null,
          vin: v.vin || null,
          year: v.year || null, make: v.make || null, model: v.model || null, trim: v.trim || null,
          drivetrain: v.drivetrain || null,
          deal_type: dl.deal_type || null,
          term: dl.term != null ? String(dl.term) : null,
          plates: dl.plates || null,
          fni_products: dl.fni_products || null,
          trade_type: c.trade_vehicle ? 'Trade' : null,
          google_review: yn(dl.google_review),
          gm_survey: yn(dl.gm_survey),
          gm_survey_pct: dl.gm_survey_pct != null ? dl.gm_survey_pct + '%' : null,
          fni_gross_1500: yn(dl.fni_gross_1500),
          split_deal: yn(dl.split_deal),
          split_with: dl.split_with || null,
          vehicle_commission: money(dl.vehicle_commission),
          fni_commission: money(dl.fni_commission),
          unsubscribed: (c.opt_out || c.consent_email === false || c.consent_sms === false) ? 'Yes' : 'No',
          no_longer_owns: noLongerOwns ? 'Yes' : 'No',
          salesperson: repName(c.assigned_rep) || null,
        }
      })
    res.json({ ok: true, rows, reps, count: rows.length })
  })

  // ── Desk / F&I record ──────────────────────────────────────────────────────
  const DEAL_NUM_FIELDS = ['deposit_amount', 'gm_survey_pct', 'vehicle_commission', 'fni_commission', 'term',
    'selling_price', 'trade_value', 'trade_payoff', 'down_payment', 'rebate', 'apr',
    'amount_financed', 'payment', 'tax_rate', 'tax_amount', 'total_price',
    'retail', 'rebate_before_tax', 'adjustment', 'balloon', 'deferral_days',
    'buy_rate', 'residual_amount', 'mileage_allowance', 'split_pct', 'cost']
  const DEAL_BOOL_FIELDS = ['google_review', 'gm_survey', 'fni_gross_1500', 'split_deal', 'tax_on_difference']
  const DEAL_TEXT_FIELDS = ['inventory_id', 'delivery_date', 'delivery_time', 'fni_manager', 'fni_manager_id', 'deal_type', 'plates',
    'fni_products', 'split_with', 'split_rep_id', 'notes', 'deal_status', 'payment_freq', 'trade_desc', 'trade_vin',
    'finance_company', 'first_payment_date', 'sale_type', 'program', 'co_buyer', 'tax_province', 'tax_country']
  const DEAL_JSON_FIELDS = ['addons', 'fni_items', 'fees', 'insurance', 'vehicle']

  app.get('/reports/deal', requireAuth, requireMfa, requirePermission('deal.approve'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const contactId = String(req.query.contact_id || '')
    const dealId = String(req.query.deal_id || req.query.id || '')
    if (!contactId && !dealId) return res.status(400).json({ error: 'contact_id or deal_id required' })
    let query = supabaseAdmin.from('deals').select('*').eq('dealership_id', req.dealershipId)
    if (dealId) query = query.eq('id', dealId)
    else query = query.eq('contact_id', contactId)
    const { data } = await query.maybeSingle()
    const { data: dlr } = await supabaseAdmin.from('dealerships')
      .select('cost_tracking_enabled, cost_rep_visible').eq('id', req.dealershipId).maybeSingle()
    if (data && !dlr?.cost_tracking_enabled) delete data.cost
    const targetContactId = contactId || data?.contact_id
    let cust = null
    if (targetContactId) {
      const { data: c } = await supabaseAdmin.from('contacts')
        .select('customer_number').eq('id', targetContactId).maybeSingle()
      cust = c
    }
    let salesperson = null
    const repId = data?.created_by
    if (repId) {
      const { data: rep } = await supabaseAdmin.from('profiles').select('full_name, registration_id').eq('id', repId).maybeSingle()
      if (rep) salesperson = { name: rep.full_name || null, registration_id: rep.registration_id || null }
    }
    res.json({ ok: true, deal: data || null, customer_number: cust?.customer_number || null, salesperson, cost_tracking_enabled: !!dlr?.cost_tracking_enabled, cost_rep_visible: !!dlr?.cost_rep_visible })
  })

  async function nextDealershipNumber(table, col, dealershipId, base) {
    const { data } = await supabaseAdmin.from(table).select(col)
      .eq('dealership_id', dealershipId).not(col, 'is', null).order(col, { ascending: false }).limit(1).maybeSingle()
    const cur = data?.[col]
    return (cur && cur >= base) ? cur + 1 : base
  }

  app.post('/reports/deal', requireAuth, requirePermission('deal.create'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const contactId = String(req.body?.contact_id || '')
    if (!contactId) return res.status(400).json({ error: 'contact_id required' })
    const { data: ct } = await supabaseAdmin.from('contacts').select('id').eq('id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!ct) return res.status(404).json({ error: 'Contact not found' })

    const num = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
    const bool = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1'
    const str = (v) => { const s = (v == null ? '' : String(v)).trim(); return s || null }
    const json = (v) => { if (v == null || v === '') return null; if (typeof v === 'string') { try { return JSON.parse(v) } catch { return null } } return v }
    const row = { dealership_id: req.dealershipId, contact_id: contactId, created_by: req.user?.id || null, updated_at: new Date().toISOString() }
    const body = req.body || {}
    for (const f of DEAL_NUM_FIELDS)  if (f in body) row[f] = num(body[f])
    for (const f of DEAL_BOOL_FIELDS) if (f in body) row[f] = bool(body[f])
    for (const f of DEAL_TEXT_FIELDS) if (f in body) row[f] = str(body[f])
    for (const f of DEAL_JSON_FIELDS) if (f in body) row[f] = json(body[f])
    if ('cost' in row) {
      const { data: dlrCost } = await supabaseAdmin.from('dealerships').select('cost_tracking_enabled').eq('id', req.dealershipId).maybeSingle()
      if (!dlrCost?.cost_tracking_enabled) delete row.cost
    }

    const { data: existingDeal } = await supabaseAdmin.from('deals')
      .select('id, deal_number, deal_status, inventory_id, selling_price, total_price, amount_financed, cost').eq('contact_id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (existingDeal?.deal_number) row.deal_number = existingDeal.deal_number
    else row.deal_number = await nextDealershipNumber('deals', 'deal_number', req.dealershipId, 1000)

    const { data: custRow } = await supabaseAdmin.from('contacts').select('customer_number').eq('id', contactId).maybeSingle()
    let customerNumber = custRow?.customer_number || null
    if (!customerNumber) {
      customerNumber = await nextDealershipNumber('contacts', 'customer_number', req.dealershipId, 1000)
      await supabaseAdmin.from('contacts').update({ customer_number: customerNumber }).eq('id', contactId)
    }

    const { data, error } = await supabaseAdmin.from('deals')
      .upsert(row, { onConflict: 'contact_id' }).select().maybeSingle()
    if (error) { console.error('deal upsert failed:', error.message); return res.status(500).json({ error: 'Save failed' }) }
    let vehiclePending = false
    const fniItems = Array.isArray(data?.fni_items) ? data.fni_items : []
    if (data?.inventory_id && fniItems.some(x => (x?.name || '').trim() || Number(x?.price) > 0)) {
      const { data: veh } = await supabaseAdmin.from('inventory')
        .select('status').eq('id', data.inventory_id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (veh && String(veh.status || 'available').toLowerCase() === 'available') {
        await supabaseAdmin.from('inventory').update({ status: 'pending' }).eq('id', data.inventory_id).eq('dealership_id', req.dealershipId)
        vehiclePending = true
      }
    }
    if (data?.inventory_id && data.deal_status === 'sold') {
      await ensureGetReadyCard(req.dealershipId, { inventoryId: data.inventory_id, dealId: data.id })
    }
    if (data?.id && ['sold', 'delivered'].includes(data.deal_status)) {
      ensureDealTasks(req.dealershipId, { dealId: data.id, inventoryId: data.inventory_id || null, contactId, createdBy: req.user?.id || null }).catch(() => {})
    }
    if (data?.id && !existingDeal) {
      emitEvent({
        dealershipId: req.dealershipId, eventName: 'deal.created', entityType: 'deal', entityId: data.id,
        summary: `Deal #${data.deal_number || ''} created`.trim(), toState: data.deal_status || 'open',
        department: 'Sales', createdBy: req.user?.id || null,
        payload: { contact_id: contactId, inventory_id: data.inventory_id || null, deal_number: data.deal_number || null },
      })
    }
    let salesperson = null
    if (row.created_by) {
      const { data: rep } = await supabaseAdmin.from('profiles').select('full_name, registration_id').eq('id', row.created_by).maybeSingle()
      if (rep) salesperson = { name: rep.full_name || null, registration_id: rep.registration_id || null }
    }
    if (data?.id) {
      emitEvent({
        dealershipId: req.dealershipId, eventName: 'deal.saved', entityType: 'deal', entityId: data.id,
        summary: 'Deal saved', department: 'Sales', createdBy: req.user?.id || null,
        payload: { contact_id: contactId, inventory_id: data.inventory_id || null },
      })
    }
    audit(req, existingDeal ? 'deal.updated' : 'deal.created', {
      deal_id: data?.id || null,
      before_state: existingDeal ? {
        id: existingDeal.id, deal_number: existingDeal.deal_number, deal_status: existingDeal.deal_status,
        inventory_id: existingDeal.inventory_id, selling_price: existingDeal.selling_price,
        total_price: existingDeal.total_price, amount_financed: existingDeal.amount_financed, cost: existingDeal.cost,
      } : null,
      after_state: data ? {
        id: data.id, deal_number: data.deal_number, deal_status: data.deal_status,
        inventory_id: data.inventory_id, selling_price: data.selling_price,
        total_price: data.total_price, amount_financed: data.amount_financed, cost: data.cost,
      } : null,
    })
    res.json({ ok: true, deal: data, customer_number: customerNumber, salesperson, vehicle_pending: vehiclePending })
  })

  app.post('/reports/deal/status', requireAuth, requireMfa, requirePermission('deal.finalize'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const contactId = String(req.body?.contact_id || '')
    const action = String(req.body?.action || '').toLowerCase()
    if (!contactId) return res.status(400).json({ error: 'contact_id required' })
    const now = new Date().toISOString()
    const MAP = {
      working:        { deal: 'working',        inv: 'available' },
      pending_credit: { deal: 'pending_credit', inv: 'pending', stamp: 'credit_app_at' },
      cash:           { deal: 'sold',           inv: 'sold', stamp: 'sold_at' },
      sold:           { deal: 'sold',           inv: 'sold', stamp: 'sold_at' },
      delivered:      { deal: 'delivered',      inv: 'sold', stamp: 'delivered_at' },
    }
    const m = MAP[action]
    if (!m) return res.status(400).json({ error: 'Invalid action' })
    const { data: deal } = await supabaseAdmin.from('deals')
      .select('id, inventory_id, deal_status').eq('contact_id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!deal) return res.status(404).json({ error: 'Save the deal first, then set its status.' })
    const patch = { deal_status: m.deal, updated_at: now }
    if (m.stamp) patch[m.stamp] = now
    const { error } = await supabaseAdmin.from('deals').update(patch).eq('id', deal.id).eq('dealership_id', req.dealershipId)
    if (error) { console.error('deal status update failed:', error.message); return res.status(500).json({ error: 'Update failed' }) }
    if (deal.inventory_id) {
      const invPatch = { status: m.inv }
      if (m.inv === 'sold') invPatch.sold_at = now
      if (m.inv === 'available') invPatch.sold_at = null
      await supabaseAdmin.from('inventory').update(invPatch).eq('id', deal.inventory_id).eq('dealership_id', req.dealershipId)
      if (m.deal === 'sold') {
        await ensureGetReadyCard(req.dealershipId, { inventoryId: deal.inventory_id, dealId: deal.id })
      }
    }
    if (['sold', 'delivered'].includes(m.deal)) {
      ensureDealTasks(req.dealershipId, { dealId: deal.id, inventoryId: deal.inventory_id || null, contactId, createdBy: req.user?.id || null }).catch(() => {})
    }
    if (m.deal === 'sold' || m.deal === 'delivered') {
      emitWebhook(req.dealershipId, m.deal === 'delivered' ? 'deal.delivered' : 'deal.sold', {
        deal_id: deal.id, contact_id: contactId, inventory_id: deal.inventory_id || null, at: now,
      })
    }
    emitEvent({
      dealershipId: req.dealershipId, eventName: 'deal.status_changed', entityType: 'deal', entityId: deal.id,
      summary: `Deal marked ${m.deal}`, toState: m.deal, department: 'Sales', createdBy: req.user?.id || null,
      payload: { contact_id: contactId, inventory_id: deal.inventory_id || null, action },
    })
    audit(req, 'deal.status_changed', {
      deal_id: deal.id,
      before_state: { id: deal.id, deal_status: deal.deal_status },
      after_state: { id: deal.id, deal_status: m.deal },
    })
    res.json({ ok: true, deal_status: m.deal, vehicle_status: m.inv })
  })

  // ── Desk-a-deal helpers ────────────────────────────────────────────────────
  app.get('/deals/customers', requireAuth, requirePermission('deal.create'), async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, rows: [] })
    const q = String(req.query.q || '').trim()
    let query = supabaseAdmin.from('contacts')
      .select('id, first_name, last_name, full_name, email, phone, phone_mobile, city, province')
      .eq('dealership_id', req.dealershipId).order('last_activity_at', { ascending: false, nullsFirst: false }).limit(25)
    if (q) {
      const like = `%${q.replace(/[%,]/g, ' ')}%`
      query = query.or(`full_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like},phone_mobile.ilike.${like}`)
    }
    const { data } = await query
    const rows = (data || []).map(c => ({
      id: c.id,
      name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Customer',
      email: c.email || null, phone: c.phone || c.phone_mobile || null,
      city: c.city || null, province: c.province || null,
    }))
    res.json({ ok: true, rows })
  })

  app.get('/deals/customer', requireAuth, requirePermission('deal.create'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const id = String(req.query.id || '')
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data: c } = await supabaseAdmin.from('contacts')
      .select('id, first_name, last_name, full_name, email, phone, phone_mobile, phone_home, phone_work, address, city, province, postal_code, country, dl_number, dl_expiry, interest_inventory_id, interest_vehicle, trade_vehicle')
      .eq('id', id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!c) return res.status(404).json({ error: 'Contact not found' })
    let vehicle = null
    if (c.interest_inventory_id) {
      const { data: v } = await supabaseAdmin.from('inventory')
        .select('id, vin, year, make, model, trim, mileage, exterior_color, stocknumber, price')
        .eq('id', c.interest_inventory_id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (v) vehicle = v
    }
    res.json({ ok: true, contact: c, vehicle })
  })

  app.get('/deals/trades', requireAuth, requirePermission('deal.create'), async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, rows: [] })
    const contactId = String(req.query.contact_id || '')
    if (!contactId) return res.json({ ok: true, rows: [] })
    const cols = 'id, year, make, model, trim, vin, mileage, color, suggested_offer, retail_median, created_at, contact_id, customer'
    const { data: linked } = await supabaseAdmin.from('trade_appraisals')
      .select(cols).eq('dealership_id', req.dealershipId).eq('contact_id', contactId)
      .order('created_at', { ascending: false }).limit(10)
    const rows = [...(linked || [])]
    const { data: c } = await supabaseAdmin.from('contacts')
      .select('email, phone, phone_mobile').eq('id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    const email = (c?.email || '').trim().toLowerCase()
    const phone = (c?.phone || c?.phone_mobile || '').replace(/\D/g, '')
    if (email || phone) {
      const { data: recent } = await supabaseAdmin.from('trade_appraisals')
        .select(cols).eq('dealership_id', req.dealershipId)
        .order('created_at', { ascending: false }).limit(200)
      const seen = new Set(rows.map(r => r.id))
      for (const a of (recent || [])) {
        if (seen.has(a.id)) continue
        const cust = a.customer || {}
        const aEmail = String(cust.email || '').trim().toLowerCase()
        const aPhone = String(cust.mobile_phone || cust.phone || cust.home_phone || '').replace(/\D/g, '')
        if ((email && aEmail && aEmail === email) || (phone && aPhone && aPhone === phone)) {
          rows.push(a); seen.add(a.id)
          if (rows.length >= 10) break
        }
      }
    }
    res.json({ ok: true, rows: rows.map(({ customer, ...r }) => r) })
  })

  app.get('/deals/vehicles', requireAuth, requirePermission('deal.create'), async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, rows: [] })
    const q = String(req.query.q || '').trim()
    let query = supabaseAdmin.from('inventory')
      .select('id, vin, year, make, model, trim, mileage, exterior_color, stocknumber, price, status')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(25)
    if (q) {
      const like = `%${q.replace(/[%,]/g, ' ')}%`
      query = query.or(`vin.ilike.${like},stocknumber.ilike.${like},make.ilike.${like},model.ilike.${like},trim.ilike.${like}`)
    }
    const { data } = await query
    res.json({ ok: true, rows: data || [] })
  })

  app.get('/reports/inventory', requireAuth, requirePermission('inventory.edit'), async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, rows: [] })
    const did = req.dealershipId
    const days = ({ '30': 30, '90': 90, '180': 180, '365': 365, 'all': null }[String(req.query.range || 'all')])
    const startIso = days ? new Date(Date.now() - days * 86400000).toISOString() : null
    const status = String(req.query.status || 'all')

    let q = supabaseAdmin.from('inventory')
      .select('stocknumber, vin, year, make, model, trim, condition, body_style, exterior_color, interior_color, mileage, price, status, drivetrain, fuel_type, transmission, lot_date, created_at, sold_at, archived_at')
      .eq('dealership_id', did).limit(20000)
    if (status === 'available') q = q.eq('status', 'available').is('archived_at', null)
    else if (status === 'sold') q = q.eq('status', 'sold')
    else if (status === 'archived') q = q.not('archived_at', 'is', null)
    if (startIso) q = q.or(`lot_date.gte.${startIso},and(lot_date.is.null,created_at.gte.${startIso})`)
    const { data: inv } = await q

    const now = Date.now()
    const money = (n) => (n == null || n === '') ? null : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const STATUS_LABEL = { available: 'Available', sold: 'Sold', archived: 'Archived', pending: 'Pending' }
    const rows = (inv || [])
      .sort((a, b) => new Date(b.lot_date || b.created_at || 0) - new Date(a.lot_date || a.created_at || 0))
      .map(v => {
        const ref = v.lot_date || v.created_at
        const end = v.sold_at || v.archived_at || (v.status === 'available' ? null : null)
        const daysOnLot = ref ? Math.floor(((end ? new Date(end).getTime() : now) - new Date(ref).getTime()) / 86400000) : null
        const st = (v.archived_at && v.status !== 'sold') ? 'archived' : v.status
        return {
          stock_number: v.stocknumber || null,
          vin: v.vin || null,
          year: v.year || null, make: v.make || null, model: v.model || null, trim: v.trim || null,
          condition: v.condition || null,
          body_style: v.body_style || null,
          exterior_color: v.exterior_color || null,
          interior_color: v.interior_color || null,
          mileage: v.mileage != null ? Number(v.mileage).toLocaleString('en-US') : null,
          price: money(v.price),
          status: STATUS_LABEL[st] || st || null,
          drivetrain: v.drivetrain || null,
          fuel_type: v.fuel_type || null,
          transmission: v.transmission || null,
          days_on_lot: daysOnLot != null ? String(daysOnLot) : null,
          lot_date: ref || null,
          sold_date: v.sold_at || null,
        }
      })
    res.json({ ok: true, rows, count: rows.length })
  })

  // ── Teams ──────────────────────────────────────────────────────────────────
  const LOGIN_TEAMS = { sales: ['SALES_REP'], management: ['MANAGER', 'DEALER_ADMIN', 'OWNER'] }
  const LABEL_TEAMS = ['service', 'admin', 'cleanup', 'lot']

  app.get('/team/roster', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ ok: true, team: 'sales', members: [], login: false })
    const team = String(req.query.team || 'sales').toLowerCase()
    if (LOGIN_TEAMS[team]) {
      const { data } = await supabaseAdmin.from('profiles')
        .select('id, full_name, display_name, role, avatar_url').eq('dealership_id', req.dealershipId).in('role', LOGIN_TEAMS[team])
      const members = (data || []).map(p => ({ id: p.id, name: p.full_name || p.display_name || '—', role: p.role, avatar_url: p.avatar_url || null, login: true }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return res.json({ ok: true, team, login: true, members })
    }
    if (LABEL_TEAMS.includes(team)) {
      const { data } = await supabaseAdmin.from('staff_members')
        .select('id, name, phone, email, notes, active').eq('dealership_id', req.dealershipId).eq('team', team).eq('active', true).order('name')
      return res.json({ ok: true, team, login: false, members: (data || []).map(m => ({ ...m, login: false })) })
    }
    res.status(400).json({ error: 'Unknown team' })
  })

  app.post('/team/staff', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const team = String(req.body?.team || '').toLowerCase()
    const name = String(req.body?.name || '').trim()
    if (!LABEL_TEAMS.includes(team)) return res.status(400).json({ error: 'Invalid team' })
    if (!name) return res.status(400).json({ error: 'Name required' })
    const row = {
      dealership_id: req.dealershipId, team, name,
      phone: String(req.body?.phone || '').trim() || null,
      email: String(req.body?.email || '').trim() || null,
      notes: String(req.body?.notes || '').trim() || null,
      created_by: req.user?.id || null, updated_at: new Date().toISOString(),
    }
    if (req.body?.id) {
      const { data, error } = await supabaseAdmin.from('staff_members').update(row).eq('id', req.body.id).eq('dealership_id', req.dealershipId).select().maybeSingle()
      if (error) return res.status(500).json({ error: 'Save failed' })
      if (data) audit(req, 'team.staff_updated', { staff_id: data.id, after_state: { team: data.team, contact_details_configured: !!(data.phone || data.email) } })
      return res.json({ ok: true, member: data })
    }
    const { data, error } = await supabaseAdmin.from('staff_members').insert(row).select().maybeSingle()
    if (error) return res.status(500).json({ error: 'Save failed' })
    if (data) audit(req, 'team.staff_created', { staff_id: data.id, after_state: { team: data.team, contact_details_configured: !!(data.phone || data.email) } })
    res.json({ ok: true, member: data })
  })

  app.delete('/team/staff/:id', requireAuth, requireMfa, requirePermission('users.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await supabaseAdmin.from('staff_members')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).eq('active', true)
      .select('id, name, team').maybeSingle()
    if (error) return res.status(500).json({ error: 'Deactivate failed' })
    if (data) audit(req, 'team.staff_deactivated', { staff_id: data.id, name: data.name, team: data.team })
    res.json({ ok: true, deactivated: true })
  })
}
