/**
 * Tenant-scoped adapter from the reporting semantic layer to MarketSync's
 * canonical Supabase tables. Semantic source names are intentionally stable;
 * this file is the only place that translates them to physical table names.
 */
import { assertTenantIsolation } from './query-engine.js'

const MAX_SOURCE_ROWS = 10000

export const REPORT_SOURCE_CONFIG = Object.freeze({
  deals: { table: 'deals', date: 'sold_at' },
  leads: { table: 'leads', date: 'created_at' },
  contacts: { table: 'contacts', date: 'created_at' },
  inventory: { table: 'inventory', date: null },
  crm_tasks: { table: 'crm_tasks', date: 'created_at' },
  appointments: { table: 'crm_tasks', date: 'created_at', filter: appointmentRows },
  profiles: { table: 'profiles', date: null },
  dealerships: { table: 'dealerships', tenantColumn: 'id', date: null },
  marketing_campaigns: { table: 'campaigns', date: 'created_at' },
  campaigns: { table: 'campaigns', date: 'created_at' },
  trade_appraisals: { table: 'trade_appraisals', date: 'created_at' },
  repair_orders: { table: 'repair_orders', date: 'closed_at' },
  videos: { table: 'sales_videos', date: 'created_at' },
  sales_videos: { table: 'sales_videos', date: 'created_at' },
  website_events: { table: 'events', date: 'created_at', filter: websiteEventRows },
  events: { table: 'events', date: 'created_at' },
  ai_usage: { table: 'api_usage', date: null },
  api_usage: { table: 'api_usage', date: null },
  parts: { table: 'parts', date: null },
  automations: { table: 'automated_campaigns', date: 'created_at' },
  // Staging has no canonical time-clock source yet. This remains explicit so
  // technician-efficiency reports say unavailable rather than inventing data.
  time_clock: null,
  // Listings are tenant-owned through inventory_id, not dealership_id. Do not
  // bypass that boundary with a broad service-role read.
  listings: null
})

function appointmentRows(rows) {
  return rows.filter((row) => /appointment/i.test([row.type, row.category, row.service_type].filter(Boolean).join(' ')))
}

function websiteEventRows(rows) {
  return rows.filter((row) => /website|vdp|page[_ .-]?view|vehicle[_ .-]?view/i.test([row.event_name, row.entity_type].filter(Boolean).join(' ')))
}

function normalizeRow(row, source) {
  const vehicle = row.vehicle && typeof row.vehicle === 'object' ? row.vehicle : {}
  return {
    ...row,
    salesperson: row.salesperson || row.salesperson_name || row.created_by || row.responded_by || null,
    employee: row.employee || row.assigned_to || row.created_by || null,
    advisor: row.advisor || row.advisor_id || null,
    technician: row.technician || row.technician_id || null,
    campaign: row.campaign || row.campaign_id || row.name || null,
    channel: row.channel || (Array.isArray(row.channels) ? row.channels.join(', ') : null),
    new_used: row.new_used || row.condition || row.deal_type || vehicle.condition || null,
    make: row.make || vehicle.make || null,
    model: row.model || vehicle.model || null,
    trim: row.trim || vehicle.trim || null,
    model_year: row.model_year || row.year || vehicle.year || null,
    exterior_colour: row.exterior_colour || row.exterior_color || row.color || vehicle.exterior_color || vehicle.colour || null,
    asking_price: row.asking_price || row.price || null,
    event_type: row.event_type || row.event_name || row.kind || null,
    __report_source: source
  }
}

function sourceError(error) {
  return {
    available: false,
    reason: error?.code === '42P01' || error?.code === 'PGRST205' ? 'source_not_deployed' : 'source_read_failed',
    detail: String(error?.message || 'Source could not be read').slice(0, 180),
    rows: 0
  }
}

async function readSource(client, source, config, dealershipId, dateRange) {
  if (!config) return { rows: [], status: { available: false, reason: 'source_not_available', rows: 0 } }
  let query = client.from(config.table).select('*').eq(config.tenantColumn || 'dealership_id', dealershipId)
  if (config.date && dateRange?.start) query = query.gte(config.date, dateRange.start)
  if (config.date && dateRange?.end) query = query.lte(config.date, dateRange.end)
  if (config.date) query = query.order(config.date, { ascending: false, nullsFirst: false })
  query = query.limit(MAX_SOURCE_ROWS)
  const { data, error } = await query
  if (error) return { rows: [], status: sourceError(error) }
  let rows = Array.isArray(data) ? data : []
  assertTenantIsolation(rows, dealershipId)
  if (config.filter) rows = config.filter(rows)
  rows = rows.map((row) => normalizeRow(row, source))
  return {
    rows,
    status: {
      available: true,
      table: config.table,
      rows: rows.length,
      truncated: Array.isArray(data) && data.length >= MAX_SOURCE_ROWS
    }
  }
}

export async function loadLiveReportingDataset(plan, { dealershipId, client } = {}) {
  if (!dealershipId) {
    const error = new Error('Tenant dealershipId is required')
    error.code = 'TENANT_REQUIRED'
    throw error
  }
  if (!client || typeof client.from !== 'function') {
    const error = new Error('Authenticated reporting data client is required')
    error.code = 'REPORTING_CLIENT_REQUIRED'
    throw error
  }
  const sources = [...new Set(plan?.approved_tables || [])]
  const dataset = {}
  const source_status = {}
  const physicalReads = new Map()

  for (const source of sources) {
    const config = REPORT_SOURCE_CONFIG[source]
    if (!config) {
      dataset[source] = []
      source_status[source] = { available: false, reason: 'source_not_available', rows: 0 }
      continue
    }
    const readKey = `${config.table}|${config.date || ''}`
    if (!physicalReads.has(readKey)) {
      physicalReads.set(readKey, readSource(client, source, { ...config, filter: null }, dealershipId, plan.date_range))
    }
    const base = await physicalReads.get(readKey)
    let rows = base.rows
    if (config.filter) rows = config.filter(rows)
    dataset[source] = rows.map((row) => normalizeRow(row, source))
    source_status[source] = { ...base.status, rows: dataset[source].length }
  }

  dataset.source_status = source_status
  return { dataset, source_status }
}

export { MAX_SOURCE_ROWS }
