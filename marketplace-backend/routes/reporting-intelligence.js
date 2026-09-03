import { requireAuth, requireMfa } from '../middleware.js'
import {
  listMetrics, metricsCount, getMetric,
  listDimensions, dimensionsCount,
  getReportLibrary, getReportById, predefinedReportCount, listReportsByDepartment,
  buildReportPlan, executePlan,
  reportLabCatalog, compileReportLab,
  interpretReportingQuestion,
  evaluateInsight,
  resolveReportAction, supportedActions,
  saveReport, listSavedReports, getSavedReport, scheduleReport, exportAllowed
} from '../services/reporting/index.js'

export function registerReportingIntelligence(app) {
  const guard = (req, res) => {
    if (!req.dealershipId) {
      res.status(400).json({ error: 'No dealership' })
      return false
    }
    return true
  }

  app.get('/reporting/catalog', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    res.json({
      ok: true,
      metrics: listMetrics(),
      dimensions: listDimensions(),
      metrics_count: metricsCount(),
      dimensions_count: dimensionsCount(),
      predefined_reports: predefinedReportCount()
    })
  })

  app.get('/reporting/reports', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    const dept = req.query.department
    const reports = dept ? listReportsByDepartment(dept) : getReportLibrary()
    res.json({ ok: true, count: reports.length, reports: reports.map(summarize) })
  })

  app.get('/reporting/reports/:id', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    const report = getReportById(req.params.id)
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json({ ok: true, report })
  })

  app.post('/reporting/query', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    try {
      const plan = buildReportPlan(req.body || {})
      const dataset = req.body?.dataset || {}
      const result = executePlan(plan, dataset, { dealershipId: req.dealershipId, timeZone: req.body?.time_zone })
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  app.get('/reporting/lab', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    res.json({ ok: true, catalog: reportLabCatalog() })
  })

  app.post('/reporting/lab', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    try {
      res.json(compileReportLab(req.body || {}))
    } catch (err) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  app.post('/reporting/ask', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    try {
      res.json({ ok: true, ...interpretReportingQuestion(req.body?.question || '', req.body || {}) })
    } catch (err) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  app.post('/reporting/insights/evaluate', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    res.json({ ok: true, insight: evaluateInsight(req.body || {}) })
  })

  app.get('/reporting/actions', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    res.json({ ok: true, actions: supportedActions() })
  })

  app.post('/reporting/actions/:id', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    try {
      const handoff = resolveReportAction(req.params.id)
      res.json({ ok: true, handoff, payload: req.body || {}, note: 'Calls canonical engine; does not duplicate workflow.' })
    } catch (err) {
      res.status(400).json({ error: err.message, code: err.code })
    }
  })

  app.post('/reporting/saved', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    const row = saveReport(req.dealershipId, req.user?.id, req.body?.definition || {}, req.body || {})
    res.json({ ok: true, saved: row })
  })

  app.get('/reporting/saved', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    res.json({ ok: true, reports: listSavedReports(req.dealershipId) })
  })

  app.post('/reporting/saved/:id/schedule', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    const row = scheduleReport(req.dealershipId, req.params.id, req.body?.cadence, req.body?.permissions)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true, saved: row })
  })

  app.post('/reporting/saved/:id/export', requireAuth, requireMfa, (req, res) => {
    if (!guard(req, res)) return
    const row = getSavedReport(req.dealershipId, req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    if (!exportAllowed(row, { dealershipId: req.dealershipId, role: req.profile?.role || req.user?.role })) {
      return res.status(403).json({ error: 'Export not permitted' })
    }
    res.json({ ok: true, definition: row.definition, rows: req.body?.aggregated_rows || [] })
  })
}

function summarize(r) {
  return {
    id: r.id, name: r.name, department: r.department,
    metric_ids: r.metric_ids, default_dimensions: r.default_dimensions,
    visualization: r.visualization
  }
}

void getMetric
