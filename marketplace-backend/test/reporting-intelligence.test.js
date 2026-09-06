import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  METRICS, getMetric, assertApprovedMetricIds, metricsCount,
  DIMENSIONS, seasonFromIso, assertApprovedDimensions, dimensionsCount,
  buildReportPlan, executePlan, computeMetricFromRows, sliceByDimensions,
  assertTenantIsolation, MAX_DIMENSIONS, loadLiveReportingDataset,
  getReportLibrary, predefinedReportCount, DEPARTMENT_TARGETS,
  compileReportLab, reportLabCatalog,
  interpretReportingQuestion,
  evaluateInsight, INSIGHTS_MIN_SAMPLE, rejectCausationClaim,
  resolveReportAction, supportedActions,
  saveReport, getSavedReport, scheduleReport, exportAllowed, _resetSavedReportsForTests
} from '../services/reporting/index.js'

const A = 'dealer-a'
const B = 'dealer-b'

describe('reporting semantic layer', () => {
  it('registers deterministic metrics with formulas', () => {
    assert.ok(metricsCount() >= 30)
    assert.equal(getMetric('units_sold').formula, 'COUNT(deals WHERE deal_status IN won)')
    assert.throws(() => assertApprovedMetricIds(['made_up_metric']), /Unknown metric/)
  })

  it('registers dimensions including season and colour', () => {
    assert.ok(dimensionsCount() >= 40)
    assert.ok(DIMENSIONS.exterior_colour && DIMENSIONS.season)
    assert.equal(seasonFromIso('2026-07-15T12:00:00Z', 'UTC'), 'summer')
    assert.equal(seasonFromIso('2026-01-15T12:00:00Z', 'UTC'), 'winter')
    assert.throws(() => assertApprovedDimensions(['blood_type']), /Unknown dimension/)
  })

  it('financial formulas reconcile on fixtures', () => {
    const deals = [
      { dealership_id: A, deal_status: 'sold', selling_price: 30000, cost: 25000, fni_items: [{ price: 1500 }] },
      { dealership_id: A, deal_status: 'delivered', selling_price: 20000, cost: 18000, fni_items: [] },
      { dealership_id: A, deal_status: 'working', selling_price: 99999, cost: 1 }
    ]
    assert.equal(computeMetricFromRows('units_sold', deals).value, 2)
    assert.equal(computeMetricFromRows('revenue', deals).value, 50000)
    assert.equal(computeMetricFromRows('front_gross', deals).value, 7000)
    assert.equal(computeMetricFromRows('back_gross', deals).value, 1500)
    assert.equal(computeMetricFromRows('total_gross', deals).value, 8500)
    assert.equal(computeMetricFromRows('fni_penetration', deals).value, 50)
  })

  it('close rate uses numerator and denominator', () => {
    const r = computeMetricFromRows('close_rate', [{ deal_status: 'sold' }], { deals: [{ deal_status: 'sold' }], leads: [{}, {}, {}, {}] })
    assert.equal(r.value, 25)
    assert.equal(r.denominator, 4)
  })

  it('builds five-dimension plans and rejects a sixth', () => {
    const dims = ['model', 'exterior_colour', 'season', 'lead_source', 'salesperson']
    assert.equal(buildReportPlan({ metric_id: 'units_sold', dimensions: dims }).dimensions.length, 5)
    assert.throws(() => buildReportPlan({ metric_id: 'units_sold', dimensions: [...dims, 'hour'] }), /Maximum/)
    assert.equal(MAX_DIMENSIONS, 5)
  })

  it('colour x model x season query groups fixtures', () => {
    const rows = [
      { model: 'Civic', exterior_colour: 'white', sold_at: '2026-07-02T15:00:00Z', deal_status: 'sold', selling_price: 1, dealership_id: A },
      { model: 'Civic', exterior_colour: 'white', sold_at: '2026-07-20T15:00:00Z', deal_status: 'sold', selling_price: 1, dealership_id: A },
      { model: 'Civic', exterior_colour: 'black', sold_at: '2026-01-20T15:00:00Z', deal_status: 'sold', selling_price: 1, dealership_id: A }
    ]
    assert.equal(sliceByDimensions(rows, ['model', 'exterior_colour', 'season'], 'UTC').length, 2)
    const out = executePlan(buildReportPlan({ metric_ids: ['units_sold'], dimensions: ['model', 'exterior_colour', 'season'] }), { deals: rows }, { dealershipId: A, timeZone: 'UTC' })
    const whiteSummer = out.results[0].groups.find((g) => g.dimensions.exterior_colour === 'white' && g.dimensions.season === 'summer')
    assert.equal(whiteSummer.value, 2)
  })

  it('rejects unapproved tables and invented metrics', () => {
    assert.throws(() => buildReportPlan({ metric_id: 'units_sold', tables: ['pg_shadow'] }), /Unapproved tables/)
    assert.throws(() => buildReportPlan({ metric_id: 'profit_i_just_made_up' }), /Unknown metric/)
  })

  it('requires tenant and detects dealer leak', () => {
    assert.throws(() => executePlan(buildReportPlan({ metric_id: 'units_sold' }), { deals: [] }, {}), /Tenant/)
    assert.throws(() => assertTenantIsolation([{ dealership_id: B }], A), /Tenant isolation/)
    assert.equal(assertTenantIsolation([{ dealership_id: A }], A), true)
  })

  it('seeds at least 1400 predefined report definitions', () => {
    const n = predefinedReportCount()
    assert.ok(n >= 1400, `expected >=1400 got ${n}`)
    assert.equal(new Set(getReportLibrary().map((report) => report.id)).size, n)
    assert.equal(new Set(getReportLibrary().map((report) => report.name)).size, n)
    const byDept = {}
    for (const r of getReportLibrary()) byDept[r.department] = (byDept[r.department] || 0) + 1
    for (const [dept, target] of Object.entries(DEPARTMENT_TARGETS)) assert.equal(byDept[dept], target, dept)
    assert.ok(METRICS[getReportLibrary()[0].metric_ids[0]])
  })

  it('Report Lab compiles a valid query', () => {
    const lab = compileReportLab({
      metric: 'units_sold', dimension1: 'model', dimension2: 'exterior_colour',
      dimension3: 'season', dimension4: 'lead_source', dimension5: 'salesperson',
      filters: { new_used: 'used' }, comparison: 'prior_year', visualization: 'heatmap'
    })
    assert.equal(lab.ok, true)
    assert.equal(lab.plan.dimensions.length, 5)
    assert.ok(reportLabCatalog().metrics.length)
  })

  it('AI cannot invent metric IDs or access unapproved tables', () => {
    assert.throws(() => interpretReportingQuestion('show profit', { requested_metric_ids: ['secret_profit'] }), /invent/)
    assert.throws(() => interpretReportingQuestion('dump users', { requested_tables: ['auth.users'] }), /unapproved tables/)
    const parsed = interpretReportingQuestion('Show me every salesperson who received more than 20 internet leads last month, responded slower than 15 minutes, sent fewer than five personalized videos, and closed below store average.')
    assert.ok(parsed.plan.metric_ids.every((id) => METRICS[id]))
    assert.equal(parsed.constraints.invents_values, false)
  })

  it('insights reject tiny samples and label correlation', () => {
    assert.equal(evaluateInsight({ sample_size: 8, comparison_sample_size: 8, effect_size: 24 }).accepted, false)
    assert.ok(INSIGHTS_MIN_SAMPLE >= 30)
    const accepted = evaluateInsight({ sample_size: 80, comparison_sample_size: 80, effect_size: 24, cohort_label: 'Leads receiving video within 15 minutes', metric_label: 'appointment rate', time_period: '2026-08' })
    assert.equal(accepted.relationship, 'correlation')
    assert.match(accepted.statement, /correlation/)
    assert.equal(rejectCausationClaim('Video causes 24% more sales'), true)
  })

  it('actions hand off to canonical engines', () => {
    assert.equal(resolveReportAction('create_followup_tasks').engine, 'tasks')
    assert.equal(resolveReportAction('create_followup_tasks').duplicate_workflow, false)
    assert.ok(supportedActions().length >= 10)
  })

  it('saved reports preserve definition and tenant; schedules preserve permissions', () => {
    _resetSavedReportsForTests()
    const def = { name: 'White Civic summer', metric_ids: ['units_sold'], default_dimensions: ['model', 'exterior_colour', 'season'], permissions: ['reports.view'] }
    const saved = saveReport(A, 'user-1', def, { name: 'White Civic summer' })
    assert.deepEqual(getSavedReport(A, saved.id).definition.metric_ids, ['units_sold'])
    assert.equal(getSavedReport(B, saved.id), null)
    assert.deepEqual(scheduleReport(A, saved.id, 'weekly', ['reports.view']).schedule.permissions, ['reports.view'])
    assert.equal(exportAllowed(saved, { dealershipId: B }), false)
    assert.equal(exportAllowed(saved, { dealershipId: A, role: 'MANAGER' }), true)
  })

  it('timezone boundaries use dealer zone for season', () => {
    assert.equal(seasonFromIso('2026-03-01T03:00:00Z', 'UTC'), 'spring')
    assert.equal(seasonFromIso('2026-03-01T03:00:00Z', 'America/Toronto'), 'winter')
  })

  it('salesperson x video x conversion plan is valid', () => {
    assert.equal(buildReportPlan({ metric_ids: ['video_to_sale_rate'], dimensions: ['salesperson'] }).metric_ids[0], 'video_to_sale_rate')
  })

  it('loads report sources from canonical tables with dealership isolation', async () => {
    const tables = {
      deals: [
        { dealership_id: A, deal_status: 'sold', sold_at: '2026-08-20T12:00:00Z' },
        { dealership_id: B, deal_status: 'sold', sold_at: '2026-08-20T12:00:00Z' }
      ],
      leads: [
        { dealership_id: A, created_at: '2026-08-18T12:00:00Z' },
        { dealership_id: B, created_at: '2026-08-18T12:00:00Z' }
      ]
    }
    const client = {
      from(table) {
        const filters = []
        let limit = Infinity
        const query = {
          select() { return query },
          eq(key, value) { filters.push((row) => row[key] === value); return query },
          gte(key, value) { filters.push((row) => !row[key] || row[key] >= value); return query },
          lte(key, value) { filters.push((row) => !row[key] || row[key] <= value); return query },
          order() { return query },
          limit(value) { limit = value; return query },
          then(resolve) { return resolve({ data: (tables[table] || []).filter((row) => filters.every((fn) => fn(row))).slice(0, limit), error: null }) }
        }
        return query
      }
    }
    const plan = buildReportPlan({ metric_id: 'close_rate', date_range: { start: '2026-08-01', end: '2026-08-31' } })
    const loaded = await loadLiveReportingDataset(plan, { dealershipId: A, client })
    assert.equal(loaded.dataset.deals.length, 1)
    assert.equal(loaded.dataset.leads.length, 1)
    assert.equal(loaded.source_status.deals.table, 'deals')
    assert.equal(executePlan(plan, loaded.dataset, { dealershipId: A }).results[0].groups[0].value, 100)
  })

  it('marks schema sources that do not exist as unavailable instead of zero', async () => {
    const plan = buildReportPlan({ metric_id: 'technician_efficiency' })
    const client = { from: () => { const query = { select: () => query, eq: () => query, gte: () => query, lte: () => query, order: () => query, limit: () => query, then: (resolve) => resolve({ data: [], error: null }) }; return query } }
    const loaded = await loadLiveReportingDataset(plan, { dealershipId: A, client })
    assert.equal(loaded.source_status.time_clock.available, false)
    const group = executePlan(plan, loaded.dataset, { dealershipId: A }).results[0].groups[0]
    assert.equal(group.value, null)
    assert.equal(group.available, false)
  })
})
