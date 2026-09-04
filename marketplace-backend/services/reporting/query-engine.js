/** Reporting query engine. Plans from registries; numbers from fixtures or tenant-scoped canonical reads. */
import { getMetric, assertApprovedMetricIds, WON_DEAL_STATUSES } from './metric-registry.js'
import { assertApprovedDimensions, seasonFromIso } from './dimension-registry.js'

export const MAX_DIMENSIONS = 5
export const APPROVED_TABLES = Object.freeze(['deals','leads','contacts','inventory','crm_tasks','profiles','dealerships','marketing_campaigns','listings','trade_appraisals','repair_orders','appointments','videos','website_events','ai_usage','parts','time_clock','automations'])
export const VISUALIZATIONS = Object.freeze(['kpi','table','line','bar','stacked_bar','scatter','heatmap','funnel','cohort','retention_curve','distribution'])
export const COMPARISONS = Object.freeze(['prior_period','prior_year','dealership','employee','team','model','cohort','benchmark'])

function pct(n, d) { if (d == null || d === 0) return null; return Math.round((n / d) * 1000) / 10 }
function money(n) { return Math.round(Number(n) || 0) }
function median(nums) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
function num(row, ...keys) {
  for (const key of keys) {
    const value = Number(row?.[key])
    if (Number.isFinite(value)) return value
  }
  return null
}
function unavailable(metric, rows, reason = 'required_source_fields_unavailable') {
  return { value: null, unit: metric.unit, sample_size: rows.length, available: false, note: reason }
}
function isShown(row) { return /show|arrived|complete|done/i.test([row.status, row.to_state, row.event_type].filter(Boolean).join(' ')) }

export function resolveTimeWindow(range = {}, now = new Date()) {
  const end = range.end ? new Date(range.end) : now
  const start = range.start ? new Date(range.start) : new Date(end.getTime() - Number(range.days || 30) * 86400000)
  return { start: start.toISOString(), end: end.toISOString(), timeZone: 'America/Toronto', days: Math.max(1, Math.round((end - start) / 86400000)) }
}

export function buildReportPlan(input = {}) {
  const metricIds = Array.isArray(input.metric_ids) ? input.metric_ids : (input.metric_id ? [input.metric_id] : [])
  if (!metricIds.length) { const err = new Error('At least one metric_id is required'); err.code = 'MISSING_METRIC'; throw err }
  const metrics = assertApprovedMetricIds(metricIds)
  const dimensions = Array.isArray(input.dimensions) ? input.dimensions.slice(0, MAX_DIMENSIONS) : []
  if ((input.dimensions || []).length > MAX_DIMENSIONS) { const err = new Error(`Maximum ${MAX_DIMENSIONS} dimensions`); err.code = 'TOO_MANY_DIMENSIONS'; throw err }
  for (const metric of metrics) assertApprovedDimensions(dimensions, metric)
  if (input.tables) {
    const rogue = input.tables.filter((t) => !APPROVED_TABLES.includes(t))
    if (rogue.length) { const err = new Error(`Unapproved tables: ${rogue.join(', ')}`); err.code = 'UNAPPROVED_TABLE'; throw err }
  }
  return Object.freeze({
    metric_ids: metricIds,
    metrics: metrics.map((m) => ({ id: m.id, formula: m.formula, source_entity: m.source_entity })),
    dimensions,
    filters: { ...(input.filters || {}) },
    date_range: resolveTimeWindow(input.date_range || {}),
    comparison: input.comparison && COMPARISONS.includes(input.comparison) ? input.comparison : null,
    visualization: VISUALIZATIONS.includes(input.visualization) ? input.visualization : 'table',
    tenant_required: true,
    approved_tables: [...new Set(metrics.flatMap((m) => String(m.source_entity).split('+')))].filter((t) => APPROVED_TABLES.includes(t))
  })
}

export function computeMetricFromRows(metricId, rows = [], opts = {}) {
  const metric = getMetric(metricId)
  if (!metric) { const err = new Error(`Unknown metric IDs: ${metricId}`); err.code = 'UNKNOWN_METRIC'; throw err }
  const won = (r) => WON_DEAL_STATUSES.includes(r.deal_status)
  switch (metricId) {
    case 'units_sold': return { value: rows.filter(won).length, unit: 'units', sample_size: rows.length }
    case 'revenue': return { value: money(rows.filter(won).reduce((s, r) => s + (Number(r.selling_price) || 0), 0)), unit: 'money', sample_size: rows.filter(won).length }
    case 'front_gross': {
      const costed = rows.filter((r) => won(r) && Number(r.cost) > 0)
      return { value: money(costed.reduce((s, r) => s + ((Number(r.selling_price) || 0) - Number(r.cost)), 0)), unit: 'money', sample_size: costed.length }
    }
    case 'back_gross': {
      let value = 0, n = 0
      for (const r of rows.filter(won)) {
        const items = Array.isArray(r.fni_items) ? r.fni_items : []
        if (items.length) n++
        for (const it of items) value += Number(it?.price) || 0
      }
      return { value: money(value), unit: 'money', sample_size: n }
    }
    case 'total_gross': {
      const front = computeMetricFromRows('front_gross', rows)
      const back = computeMetricFromRows('back_gross', rows)
      return { value: money(front.value + back.value), unit: 'money', sample_size: front.sample_size }
    }
    case 'close_rate': {
      const leads = opts.leads || rows
      const wonN = (opts.deals || rows).filter(won).length
      return { value: pct(wonN, leads.length), unit: 'percent', sample_size: leads.length, numerator: wonN, denominator: leads.length }
    }
    case 'appointment_rate': {
      const leads = opts.leads || []
      const appointments = opts.appointments || rows
      return { value: pct(appointments.length, leads.length), unit: 'percent', sample_size: leads.length, numerator: appointments.length, denominator: leads.length }
    }
    case 'show_rate': {
      const shown = rows.filter(isShown).length
      return { value: pct(shown, rows.length), unit: 'percent', sample_size: rows.length, numerator: shown, denominator: rows.length }
    }
    case 'fni_penetration': {
      const wonRows = rows.filter(won)
      const withFni = wonRows.filter((r) => (Array.isArray(r.fni_items) && r.fni_items.length) || (r.fni_products && String(r.fni_products).trim()))
      return { value: pct(withFni.length, wonRows.length), unit: 'percent', sample_size: wonRows.length, numerator: withFni.length, denominator: wonRows.length }
    }
    case 'response_time': {
      const diffs = rows.filter((r) => r.responded_at && r.created_at).map((r) => Math.max(0, (new Date(r.responded_at) - new Date(r.created_at)) / 60000))
      return { value: diffs.length ? Math.round(median(diffs) * 10) / 10 : null, unit: 'minutes', sample_size: diffs.length }
    }
    case 'followup_completion_rate': {
      const due = rows.length, done = rows.filter((r) => r.done).length
      return { value: pct(done, due), unit: 'percent', sample_size: due, numerator: done, denominator: due }
    }
    case 'days_to_sell': {
      const samples = []
      for (const v of rows) {
        const sale = v.sold_at || v.archived_at, lot = v.lot_date || v.created_at
        if (!sale || !lot) continue
        samples.push(Math.max(0, (new Date(sale) - new Date(lot)) / 86400000))
      }
      const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null
      return { value: avg == null ? null : Math.round(avg * 10) / 10, unit: 'days', sample_size: samples.length }
    }
    case 'untouched_leads': return { value: rows.filter((r) => !r.responded_at && r.status !== 'closed').length, unit: 'count', sample_size: rows.length }
    case 'overdue_followups': {
      const now = opts.now || new Date()
      return { value: rows.filter((r) => !r.done && r.due_at && new Date(r.due_at) < now).length, unit: 'count', sample_size: rows.length }
    }
    case 'video_send_rate': {
      const leads = opts.leads || []
      const sent = (opts.videos || rows).filter((r) => r.sent_at || /sent|delivered|opened|played/i.test(r.status || '')).length
      return { value: pct(sent, leads.length), unit: 'percent', sample_size: leads.length, numerator: sent, denominator: leads.length }
    }
    case 'video_view_rate': {
      const delivered = rows.filter((r) => r.sent_at || /sent|delivered|opened|played/i.test(r.status || ''))
      const played = delivered.filter((r) => r.first_played_at || num(r, 'play_count') > 0).length
      return { value: pct(played, delivered.length), unit: 'percent', sample_size: delivered.length, numerator: played, denominator: delivered.length }
    }
    case 'video_to_sale_rate': {
      const videos = opts.videos || rows
      const contactIds = new Set(videos.map((r) => r.contact_id).filter(Boolean))
      const wonContacts = new Set((opts.deals || []).filter(won).map((r) => r.contact_id).filter((id) => contactIds.has(id)))
      return { value: pct(wonContacts.size, contactIds.size), unit: 'percent', sample_size: contactIds.size, numerator: wonContacts.size, denominator: contactIds.size }
    }
    case 'inventory_turn': {
      const sold = (opts.deals || []).filter(won).length
      const onHand = rows.filter((r) => !/sold|archived/i.test(r.status || '')).length
      return { value: onHand ? Math.round((sold / onHand) * 100) / 100 : null, unit: 'ratio', sample_size: onHand, numerator: sold, denominator: onHand }
    }
    case 'market_position': {
      const positions = rows.map((r) => {
        const ask = num(r, 'asking_price', 'price'), mid = num(r, 'market_mid', 'retail_median')
        return ask != null && mid > 0 ? ((ask / mid) - 1) * 100 : null
      }).filter((v) => v != null)
      if (!positions.length) return unavailable(metric, rows)
      return { value: Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10, unit: 'percent', sample_size: positions.length }
    }
    case 'ltv': {
      const deals = (opts.deals || rows).filter(won)
      const customers = new Set(deals.map((r) => r.contact_id).filter(Boolean))
      if (!customers.size) return { value: null, unit: 'money', sample_size: 0, numerator: 0, denominator: 0 }
      const gross = computeMetricFromRows('total_gross', deals).value
      return { value: money(gross / customers.size), unit: 'money', sample_size: customers.size, numerator: gross, denominator: customers.size }
    }
    case 'service_revenue': {
      const closed = rows.filter((r) => /closed|complete|paid|ready/i.test(r.status || '') || r.closed_at)
      return { value: money(closed.reduce((sum, r) => sum + (num(r, 'customer_total', 'total') || 0), 0)), unit: 'money', sample_size: closed.length }
    }
    case 'effective_labour_rate': {
      const labour = rows.reduce((sum, r) => sum + (num(r, 'labour_dollars', 'labor_total') || 0), 0)
      const hours = rows.reduce((sum, r) => sum + (num(r, 'billed_hours', 'flagged_hours') || 0), 0)
      if (!hours) return unavailable(metric, rows)
      return { value: money(labour / hours), unit: 'money', sample_size: rows.length, numerator: labour, denominator: hours }
    }
    case 'employee_productivity': {
      const sold = (opts.deals || rows).filter(won).length
      const active = (opts.profiles || []).filter((r) => r.active !== false).length
      return { value: active ? Math.round((sold / active) * 100) / 100 : null, unit: 'ratio', sample_size: active, numerator: sold, denominator: active }
    }
    case 'vdp_views': {
      const views = rows.filter((r) => /vdp|vehicle.*view/i.test(r.event_type || r.event_name || '')).length
      return { value: views, unit: 'count', sample_size: rows.length }
    }
    case 'leads_per_vehicle': {
      const leads = (opts.leads || []).length
      const vehicles = rows.length
      return { value: vehicles ? Math.round((leads / vehicles) * 100) / 100 : null, unit: 'ratio', sample_size: vehicles, numerator: leads, denominator: vehicles }
    }
    case 'parts_turn': {
      const cogs = rows.reduce((sum, r) => sum + (num(r, 'parts_cogs', 'cogs') || 0), 0)
      const onHand = rows.reduce((sum, r) => sum + ((num(r, 'qty_on_hand') || 0) * (num(r, 'cost') || 0)), 0)
      if (!cogs || !onHand) return unavailable(metric, rows)
      return { value: Math.round((cogs / onHand) * 100) / 100, unit: 'ratio', sample_size: rows.length, numerator: cogs, denominator: onHand }
    }
    default: return unavailable(metric, rows, 'metric_requires_data_not_yet_recorded')
  }
}

export function sliceByDimensions(rows, dimensions = [], timeZone = 'America/Toronto') {
  const keyOf = (row) => dimensions.map((d) => {
    const iso = row.sold_at || row.closed_at || row.created_at || row.event_at
    if (d === 'season') return seasonFromIso(iso, timeZone) || 'unknown'
    if (d === 'hour') {
      if (!iso) return 'unknown'
      return new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
    }
    if (d === 'weekday') {
      if (!iso) return 'unknown'
      return new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'short' }).format(new Date(iso))
    }
    if (d === 'day' || d === 'month' || d === 'year' || d === 'quarter' || d === 'week') {
      if (!iso) return 'unknown'
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
      const val = Object.fromEntries(parts.map((p) => [p.type, p.value]))
      if (d === 'year') return val.year
      if (d === 'month') return `${val.year}-${val.month}`
      if (d === 'day') return `${val.year}-${val.month}-${val.day}`
      if (d === 'quarter') return `${val.year}-Q${Math.ceil(Number(val.month) / 3)}`
      const first = Date.UTC(Number(val.year), 0, 1)
      const current = Date.UTC(Number(val.year), Number(val.month) - 1, Number(val.day))
      return `${val.year}-W${String(Math.ceil((((current - first) / 86400000) + new Date(first).getUTCDay() + 1) / 7)).padStart(2, '0')}`
    }
    return row[d] ?? row[d.replace('exterior_colour', 'exterior_color')] ?? 'unknown'
  }).join('|')
  const groups = new Map()
  for (const row of rows) {
    const k = keyOf(row)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(row)
  }
  return [...groups.entries()].map(([key, groupRows]) => ({ key, dimensions: Object.fromEntries(dimensions.map((d, i) => [d, key.split('|')[i]])), rows: groupRows }))
}

export function executePlan(plan, dataset = {}, ctx = {}) {
  if (!ctx.dealershipId) { const err = new Error('Tenant dealershipId is required'); err.code = 'TENANT_REQUIRED'; throw err }
  const timeZone = ctx.timeZone || 'America/Toronto'
  const results = []
  for (const metricId of plan.metric_ids) {
    const sourceRows = applyFilters(pickRows(metricId, dataset), plan.filters)
    const groups = plan.dimensions.length ? sliceByDimensions(sourceRows, plan.dimensions, timeZone) : [{ key: '_all', dimensions: {}, rows: sourceRows }]
    results.push({ metric_id: metricId, formula: getMetric(metricId)?.formula, groups: groups.map((g) => ({ ...computeMetricFromRows(metricId, g.rows, dataset), dimensions: g.dimensions })) })
  }
  return { ok: true, dealership_id: ctx.dealershipId, plan, results, source_status: dataset.source_status || {}, transport: 'aggregated_only' }
}

function applyFilters(rows, filters = {}) {
  const active = Object.entries(filters || {}).filter(([, value]) => value != null && value !== '')
  if (!active.length) return rows
  return rows.filter((row) => active.every(([key, value]) => String(row[key] ?? '').toLowerCase() === String(value).toLowerCase()))
}

function pickRows(metricId, dataset) {
  if (['units_sold','revenue','front_gross','back_gross','total_gross','fni_penetration','close_rate'].includes(metricId)) return dataset.deals || []
  if (['response_time','untouched_leads'].includes(metricId)) return dataset.leads || []
  if (['appointment_rate','show_rate'].includes(metricId)) return dataset.appointments || []
  if (['followup_completion_rate','overdue_followups'].includes(metricId)) return dataset.tasks || dataset.crm_tasks || []
  if (['days_to_sell','inventory_turn','market_position','leads_per_vehicle'].includes(metricId)) return dataset.inventory || []
  if (['video_send_rate','video_view_rate','video_to_sale_rate'].includes(metricId)) return dataset.videos || []
  if (['service_revenue','effective_labour_rate','technician_efficiency'].includes(metricId)) return dataset.repair_orders || []
  if (metricId === 'parts_turn') return dataset.parts || []
  if (metricId === 'vdp_views') return dataset.website_events || []
  if (metricId === 'employee_productivity') return dataset.profiles || []
  if (metricId === 'ltv') return dataset.deals || []
  if (['roas','cac','cpl','cost_per_appointment','cost_per_sale'].includes(metricId)) return dataset.marketing_campaigns || []
  if (['automation_roi'].includes(metricId)) return dataset.automations || []
  if (['ai_cost','ai_influenced_revenue'].includes(metricId)) return dataset.ai_usage || []
  return dataset[metricId] || []
}

export function assertTenantIsolation(rows, dealershipId) {
  const leaked = (rows || []).filter((r) => r.dealership_id && r.dealership_id !== dealershipId)
  if (leaked.length) { const err = new Error('Tenant isolation violation'); err.code = 'TENANT_LEAK'; throw err }
  return true
}
