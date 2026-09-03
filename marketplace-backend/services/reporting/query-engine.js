/** Reporting query engine. Plans from registries; numbers from fixtures or tenant-scoped canonical reads. */
import { getMetric, assertApprovedMetricIds, WON_DEAL_STATUSES } from './metric-registry.js'
import { assertApprovedDimensions, seasonFromIso } from './dimension-registry.js'

export const MAX_DIMENSIONS = 5
export const APPROVED_TABLES = Object.freeze(['deals','leads','contacts','inventory','crm_tasks','profiles','dealerships','marketing_campaigns','listings','trade_appraisals','repair_orders','appointments','videos','website_events','ai_usage','parts','time_clock'])
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
    default: return { value: null, unit: metric.unit, sample_size: rows.length, note: 'computed_via_source_query' }
  }
}

export function sliceByDimensions(rows, dimensions = [], timeZone = 'America/Toronto') {
  const keyOf = (row) => dimensions.map((d) => {
    if (d === 'season') return seasonFromIso(row.sold_at || row.created_at || row.event_at, timeZone) || 'unknown'
    if (d === 'hour') {
      const iso = row.sold_at || row.created_at || row.event_at
      if (!iso) return 'unknown'
      return new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
    }
    if (d === 'weekday') {
      const iso = row.sold_at || row.created_at || row.event_at
      if (!iso) return 'unknown'
      return new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'short' }).format(new Date(iso))
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
    const sourceRows = pickRows(metricId, dataset)
    const groups = plan.dimensions.length ? sliceByDimensions(sourceRows, plan.dimensions, timeZone) : [{ key: '_all', dimensions: {}, rows: sourceRows }]
    results.push({ metric_id: metricId, formula: getMetric(metricId)?.formula, groups: groups.map((g) => ({ ...computeMetricFromRows(metricId, g.rows, dataset), dimensions: g.dimensions, sample_size: g.rows.length })) })
  }
  return { ok: true, dealership_id: ctx.dealershipId, plan, results, transport: 'aggregated_only' }
}

function pickRows(metricId, dataset) {
  if (['units_sold','revenue','front_gross','back_gross','total_gross','fni_penetration','close_rate'].includes(metricId)) return dataset.deals || []
  if (['response_time','untouched_leads','appointment_rate'].includes(metricId)) return dataset.leads || []
  if (['followup_completion_rate','overdue_followups'].includes(metricId)) return dataset.tasks || dataset.crm_tasks || []
  if (['days_to_sell','inventory_turn','leads_per_vehicle'].includes(metricId)) return dataset.inventory || []
  return dataset[metricId] || dataset.deals || []
}

export function assertTenantIsolation(rows, dealershipId) {
  const leaked = (rows || []).filter((r) => r.dealership_id && r.dealership_id !== dealershipId)
  if (leaked.length) { const err = new Error('Tenant isolation violation'); err.code = 'TENANT_LEAK'; throw err }
  return true
}
