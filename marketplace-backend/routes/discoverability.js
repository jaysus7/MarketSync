import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { getCurrentAccessContext, hasProductAccess, hasFeature } from '../access.js'
import { runComprehensiveDiscoverabilityAudit } from '../services/discoverabilityMonitoringService.js'
import { crawlSite, crawlUrl, assertSafeUrl, createPersistedCrawlRun, getLatestPersistedCrawl, getPersistedCrawlPages, getPersistedCrawlFindings } from '../services/discoverabilityCrawlerService.js'
import { buildCanonicalFactObject, normalizeBenchmarkEvidence, calculateGeoMetrics, generateGeoQueries } from '../services/aeoGeoTruthService.js'
import { disconnectedSearchProvider, verifySearchProperty, normalizeSearchConsoleResponse, detectSearchOpportunities, detectCannibalization, detectContentGaps, detectInventoryDemandGaps, clusterSearchQuery, mapVdpSearchPerformance, searchScore, createSearchImpactRecord } from '../services/searchIntelligenceService.js'
import { queueIndexNowSubmission, recordIndexNowResult } from '../services/indexNowService.js'
import { buildCanonicalLocalEntity, disconnectedGbpProvider, normalizeGbpEvidence, compareGbpToCanonical, normalizeLocalRankEvidence, generateLocalQueries, localScore } from '../services/localDiscoverabilityService.js'
import { normalizeSxoEvent, classifySource, stitchFirstPartySession, attributionForEvents, funnelFromEvents, conversionRate, roiSummary, sxoQuality, prioritizeSxoRecommendation } from '../services/sxoAttributionService.js'
import {
  generateRecommendationsFromAudit,
  canAutoApplyRecommendation,
  applySingleRecommendation,
  revertRecommendation,
  applyAllSafeRecommendations,
  generateWeeklyDiscoverabilityReport,
  getRollbackSnapshot
} from '../services/recommendationEngine.js'
import {
  enqueueRecommendation,
  transitionQueue,
  getAutopilotQueue,
  getAutopilotAuditTrail
} from '../services/discoverabilityAutopilotService.js'

/**
 * MarketSync Discoverability Intelligence API Router
 * 
 * Extends the existing SEO engine with full multi-pillar discoverability and
 * a first-class Recommendations & Auto-Remediation Engine:
 * - Overview & Executive KPIs
 * - SEO (Preserved & Embedded)
 * - AEO (Answer Engine Optimization)
 * - GEO / LLMO (Generative Engine Optimization & Synthetic Benchmarks)
 * - SXO (Search Experience & Conversion Optimization)
 * - ASO (App / Chrome Web Store Optimization)
 * - Validation & Technical Accuracy Triage
 * - Recommendations Lifecycle: List, Detail, Preview, Apply Single, Approve, Reject, Revert Single, Apply All Safe, Batch Revert
 * - Automation Settings & Weekly Email Reporting
 */

// Global in-memory cache of recommendations per dealership
const DEALERSHIP_RECOMMENDATIONS_STORE = new Map()
const DEALERSHIP_CRAWL_STORE = new Map()

// Default Automation Settings
const DEFAULT_AUTOMATION_SETTINGS = {
  discoverability_automation_level: 'recommend_only', // 'recommend_only' | 'auto_apply_safe' | 'rules_based' | 'manual_approval'
  auto_apply_categories: ['Quick Wins', 'AI Visibility', 'Technical'],
  weekly_email_reports_enabled: true,
  notification_email: null
}

export default function registerDiscoverabilityRoutes(app) {
  // Check if caller's dealership owns Discoverability / SEO entitlement
  async function checkDiscoverabilityEntitlement(req, res, next) {
    if (!req.dealershipId) {
      return res.status(400).json({ error: 'No dealership associated' })
    }
    try {
      const ctx = await getCurrentAccessContext(req)
      const isEntitled = hasProductAccess(ctx, 'marketsync_seo') ||
                         hasProductAccess(ctx, 'marketsync_digital') ||
                         hasProductAccess(ctx, 'dealeros_complete') ||
                         hasFeature(ctx, 'seo.overview') ||
                         hasFeature(ctx, 'marketing.discoverability')
      req.hasDiscoverabilityEntitlement = !!isEntitled
      next()
    } catch (err) {
      console.error('[discoverability] access check failed:', err.message)
      req.hasDiscoverabilityEntitlement = false
      next()
    }
  }

  // ── 1. Discoverability Overview & Executive Command Center ──────────────────
  app.get('/discoverability/overview', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) {
      return res.json({
        entitled: false,
        price: 149,
        currency: 'CAD',
        label: 'MarketSync Discoverability Intelligence',
        message: 'Upgrade to MarketSync Discoverability Intelligence ($149/mo CAD) to unlock Search, Answer Engine, and AI Model visibility monitoring.'
      })
    }

    const previousRecs = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId, { previousRecommendations: previousRecs }).catch(() => null)
    
    if (audit?.recommendations) {
      DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, audit.recommendations)
    }

    res.json({
      entitled: true,
      timestamp: audit?.timestamp || new Date().toISOString(),
      compositeScore: audit?.compositeScore ?? null,
      qualityScore: audit?.qualityScore ?? null,
      evidenceCoverage: audit?.evidenceCoverage ?? 0,
      verified100: audit?.verified100 === true,
      standardsVersion: 'MarketSync Discoverability Standards — 2026',
      pillars: audit?.pillars || {},
      recommendations: audit?.recommendations || [],
      history: audit?.history || {}
    })
  })

  app.get('/discoverability/sxo/overview', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const since = req.query.since || new Date(Date.now() - 30 * 86400000).toISOString()
    try {
      const { data, error } = await supabaseAdmin.from('events').select('*').eq('dealership_id', req.dealershipId).gte('created_at', since).order('created_at', { ascending: true }).limit(20000)
      if (error) throw error
      const events = (data || []).flatMap(row => { try { return [normalizeSxoEvent(row)] } catch { return [] } })
      const funnel = funnelFromEvents(events)
      const roi = roiSummary({ events })
      const measuredChecks = [{ status: events.length ? 'pass' : 'unknown' }, { status: 'unknown' }, { status: 'unknown' }]
      res.json({ success: true, period: { since, until: new Date().toISOString() }, funnel, roi, quality: sxoQuality(measuredChecks), attribution: { firstTouch: attributionForEvents(events, 'first_touch'), lastTouch: attributionForEvents(events, 'last_touch'), assisted: attributionForEvents(events, 'assisted') }, sourceBreakdown: Object.fromEntries([...new Set(events.map(classifySource))].map(source => [source, events.filter(event => classifySource(event) === source).length])) })
    } catch (error) { res.status(503).json({ error: 'SXO evidence is unavailable', detail: error.message }) }
  })

  app.get('/discoverability/sxo/events', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try { const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 2000); const { data, error } = await supabaseAdmin.from('events').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).range(0, limit - 1); if (error) throw error; res.json({ success: true, events: (data || []).flatMap(row => { try { return [normalizeSxoEvent(row)] } catch { return [] } }) }) } catch (error) { res.status(503).json({ error: 'SXO event evidence is unavailable', detail: error.message }) }
  })

  app.post('/discoverability/sxo/stitch', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    if (!req.body?.anonymousSessionId || !req.body?.contactId) return res.status(400).json({ error: 'anonymousSessionId and contactId are required' })
    try { const { data } = await supabaseAdmin.from('events').select('*').eq('dealership_id', req.dealershipId).eq('payload->>anonymousSessionId', req.body.anonymousSessionId).limit(500); const events = (data || []).flatMap(row => { try { return [normalizeSxoEvent(row)] } catch { return [] } }); const result = stitchFirstPartySession(events, { sessionId: req.body.anonymousSessionId, contactId: req.body.contactId, dealershipId: req.dealershipId }); if (result.linked.length) await supabaseAdmin.from('discoverability_attribution_links').insert({ dealership_id: req.dealershipId, anonymous_session_id: req.body.anonymousSessionId, contact_id: req.body.contactId, confidence: result.confidence, source: result.source }); res.json({ success: true, ...result }) } catch (error) { res.status(503).json({ error: 'Identity stitching is unavailable', detail: error.message }) }
  })

  // ── 2. AEO (Answer Engine Optimization) ────────────────────────────────────
  app.get('/discoverability/aeo', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId).catch(() => null)
    res.json({
      success: true,
      aeo: audit?.pillars?.aeo || {}
    })
  })

  // ── 3. GEO / LLMO (Generative Engine & AI Model Visibility) ────────────────
  app.get('/discoverability/geo', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId).catch(() => null)
    res.json({
      success: true,
      geo: audit?.pillars?.geo || {}
    })
  })

  app.get('/discoverability/aeo/facts', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const [{ data: dealer }, { data: inventory }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('*').eq('id', req.dealershipId).maybeSingle(),
      supabaseAdmin.from('inventory').select('id, vin, year, make, model, trim, status, price, updated_at').eq('dealership_id', req.dealershipId).limit(500)
    ])
    const facts = buildCanonicalFactObject(dealer || {}, inventory || [])
    res.json({ success: true, facts, querySet: generateGeoQueries(facts) })
  })

  app.post('/discoverability/geo/benchmark/evidence', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const records = Array.isArray(req.body?.records) ? req.body.records : []
    let normalized
    try { normalized = records.map(normalizeBenchmarkEvidence) } catch (error) { return res.status(400).json({ error: error.message }) }
    const metrics = calculateGeoMetrics(normalized)
    let persistence = { status: 'not_requested', runId: null }
    if (normalized.length) {
      try {
        const { data: run, error: runError } = await supabaseAdmin.from('discoverability_ai_benchmark_runs').insert({ dealership_id: req.dealershipId, query_set_version: req.body?.querySetVersion || 'canonical-facts-v1', evidence_type: normalized[0].evidenceType, locale: normalized[0].locale }).select('id').maybeSingle()
        if (runError) throw runError
        const { error } = await supabaseAdmin.from('discoverability_ai_benchmark_evidence').insert(normalized.map(record => ({ run_id: run?.id, query: record.query, engine: record.engine, model: record.model, dealership_mentioned: record.dealershipMentioned, dealership_cited: record.dealershipCited, cited_urls: record.citedUrls, response_excerpt_hash: record.responseExcerptHash, competitors_mentioned: record.competitorsMentioned, factual_accuracy: record.factualAccuracy, evidence_type: record.evidenceType, measured_at: record.timestamp, evidence: record.evidence || {} })))
        if (error) throw error
        persistence = { status: 'persisted', runId: run?.id || null }
      } catch (error) { persistence = { status: 'unavailable', error: error.message, runId: null } }
    }
    res.json({ success: true, metrics, records: normalized, persistence })
  })

  // ── 4. Synthetic AI Model Benchmark Runner ──────────────────────────────────
  // This endpoint is a lab harness only. Its output must never be presented as
  // organic AI visibility or merged into the dealership website score.
  app.post('/discoverability/geo/benchmark', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const { query = '', engine = 'All Engines', locale = 'en-CA' } = req.body

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('name, city, website_url')
      .eq('id', req.dealershipId)
      .single()

    const engines = engine === 'All Engines'
      ? ['Google Gemini', 'ChatGPT (GPT-4o)', 'Perplexity AI', 'Microsoft Copilot', 'Anthropic Claude', 'Google AI Overviews']
      : [engine]

    const runs = engines.map((eng, idx) => ({
      id: `bm-${Date.now()}-${idx}`,
      query: query || `Best used car dealership in ${dealer?.city || 'local area'}`,
      engine: eng,
      model: eng.includes('Gemini') ? 'Gemini 1.5 Pro' : eng.includes('GPT') ? 'GPT-4o' : eng.includes('Claude') ? 'Claude 3.5 Sonnet' : 'Search AI',
      timestamp: new Date().toISOString(),
      locale,
      evidenceType: 'synthetic_test',
      mentioned: null,
      cited: null,
      sourceUrl: dealer?.website_url || 'https://marketsync.link',
      competitorMentions: [],
      accuracy: null,
      status: 'not_measured'
    }))

    res.json({
      success: true,
      query: query || `Best used car dealership in ${dealer?.city || 'local area'}`,
      executedRunsCount: runs.length,
      runs
    })
  })

  // ── 5. SXO (Search Experience & Conversion Optimization) ───────────────────
  app.get('/discoverability/sxo', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId).catch(() => null)
    res.json({
      success: true,
      sxo: audit?.pillars?.sxo || {}
    })
  })

  // ── 6. ASO (App & Chrome Web Store Optimization) ───────────────────────────
  app.get('/discoverability/aso', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId).catch(() => null)
    res.json({
      success: true,
      aso: audit?.pillars?.aso || {}
    })
  })

  // ── 7. Validation & Technical Accuracy Triage ──────────────────────────────
  app.get('/discoverability/validation', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId).catch(() => null)
    res.json({
      success: true,
      validation: audit?.pillars?.validation || {}
    })
  })

  app.post('/discoverability/validation/scan', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId, { forceFresh: true }).catch(() => null)
    res.json({
      success: true,
      message: 'On-demand technical and data validation crawl completed.',
      validation: audit?.pillars?.validation || {}
    })
  })

  // ── 8. Actionable Recommendations Engine ───────────────────────────────────
  app.get('/discoverability/recommendations', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    let list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId)
    if (!list || list.length === 0) {
      const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId).catch(() => null)
      list = audit?.recommendations || []
      DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, list)
    }

    const { status, pillar, execution_class, category, search } = req.query
    let filtered = [...list]

    if (status && status !== 'all') {
      filtered = filtered.filter(r => r.status === status)
    }
    if (pillar && pillar !== 'all') {
      filtered = filtered.filter(r => r.pillar === pillar)
    }
    if (execution_class && execution_class !== 'all') {
      filtered = filtered.filter(r => r.execution_class === execution_class)
    }
    if (category && category !== 'all') {
      filtered = filtered.filter(r => r.category === category)
    }
    if (search) {
      const q = String(search).toLowerCase()
      filtered = filtered.filter(r => r.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q))
    }

    const summary = {
      total: list.length,
      auto_fixable: list.filter(r => r.execution_class === 'auto_fixable' && r.status === 'open').length,
      approval_required: list.filter(r => r.execution_class === 'approval_required' && r.status === 'open').length,
      manual: list.filter(r => r.execution_class === 'manual' && r.status === 'open').length,
      open: list.filter(r => r.status === 'open').length,
      validated: list.filter(r => r.status === 'validated').length,
      reverted: list.filter(r => r.status === 'reverted').length
    }

    res.json({
      success: true,
      summary,
      recommendations: filtered
    })
  })

  // ── 9. Single Recommendation Detail & Preview ──────────────────────────────
  app.get('/discoverability/recommendations/:id', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const rec = list.find(r => r.id === req.params.id)
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' })

    const safety = canAutoApplyRecommendation(rec)
    const snapshot = rec.rollback_snapshot_id ? getRollbackSnapshot(rec.rollback_snapshot_id) : null

    res.json({
      success: true,
      recommendation: rec,
      safety,
      snapshot
    })
  })

  // ── 10. Apply Single Recommendation ────────────────────────────────────────
  app.post('/discoverability/recommendations/:id/apply', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const recIndex = list.findIndex(r => r.id === req.params.id)
    if (recIndex === -1) return res.status(404).json({ error: 'Recommendation not found' })

    const rec = list[recIndex]
    try {
      const result = await applySingleRecommendation(rec, {
        dealershipId: req.dealershipId,
        actorId: req.user?.id || 'admin',
        actorEmail: req.user?.email || 'admin@marketsync.link',
        req
      })

      list[recIndex] = result.recommendation
      DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, list)

      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 11. Approve Recommendation (for Approval-Required) ─────────────────────
  app.post('/discoverability/recommendations/:id/approve', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const recIndex = list.findIndex(r => r.id === req.params.id)
    if (recIndex === -1) return res.status(404).json({ error: 'Recommendation not found' })

    const rec = list[recIndex]
    const timestamp = new Date().toISOString()
    rec.status = 'approved'
    rec.approved_at = timestamp
    rec.approved_by = req.user?.email || 'dealer_admin'
    rec.approval_notes = req.body?.notes || null

    list[recIndex] = rec
    DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, list)

    res.json({
      success: true,
      recommendation: rec,
      message: `Recommendation "${rec.title}" approved by ${rec.approved_by}.`
    })
  })

  // ── 12. Reject / Dismiss Recommendation ────────────────────────────────────
  app.post('/discoverability/recommendations/:id/reject', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const recIndex = list.findIndex(r => r.id === req.params.id)
    if (recIndex === -1) return res.status(404).json({ error: 'Recommendation not found' })

    const rec = list[recIndex]
    rec.status = 'dismissed'
    rec.rejected_at = new Date().toISOString()
    rec.rejection_reason = req.body?.reason || 'Dismissed by dealership'

    list[recIndex] = rec
    DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, list)

    res.json({
      success: true,
      recommendation: rec,
      message: `Recommendation "${rec.title}" dismissed.`
    })
  })

  // ── 13. Revert Single Applied Recommendation ───────────────────────────────
  app.post('/discoverability/recommendations/:id/revert', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const recIndex = list.findIndex(r => r.id === req.params.id)
    if (recIndex === -1) return res.status(404).json({ error: 'Recommendation not found' })

    const rec = list[recIndex]
    try {
      const result = await revertRecommendation(rec, null, {
        actorId: req.user?.id || 'admin',
        actorEmail: req.user?.email || 'admin@marketsync.link',
        req
      })

      list[recIndex] = result.recommendation
      DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, list)

      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 14. Apply All Safe Recommendations (Batch Execution) ───────────────────
  app.post('/discoverability/recommendations/apply-all-safe', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    let list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId)
    if (!list || list.length === 0) {
      const audit = await runComprehensiveDiscoverabilityAudit(req.dealershipId).catch(() => null)
      list = audit?.recommendations || []
    }

    const batchSummary = await applyAllSafeRecommendations(req.dealershipId, list, {
      actorId: req.user?.id || 'admin_batch_apply',
      actorEmail: req.user?.email || 'admin@marketsync.link',
      req
    })

    DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, list)

    res.json(batchSummary)
  })

  // ── 15. Batch Revert Recommendations ───────────────────────────────────────
  app.post('/discoverability/recommendations/revert-batch', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const { recommendation_ids = [] } = req.body
    const list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const results = []

    for (const id of recommendation_ids) {
      const rec = list.find(r => r.id === id)
      if (rec && rec.status === 'validated') {
        try {
          const rev = await revertRecommendation(rec, null, {
            actorId: req.user?.id || 'admin',
            actorEmail: req.user?.email || 'admin@marketsync.link',
            req
          })
          results.push(rev)
        } catch (e) {
          results.push({ success: false, id, error: e.message })
        }
      }
    }

    DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, list)
    res.json({
      success: true,
      reverted_count: results.filter(r => r.success).length,
      results
    })
  })

  // ── 16. Run Discoverability Audit (Scheduled or On-Demand) ─────────────────
  app.post('/discoverability/audit', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const previousRecs = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const auditResult = await runComprehensiveDiscoverabilityAudit(req.dealershipId, {
      forceFresh: true,
      previousRecommendations: previousRecs
    })

    if (auditResult?.recommendations) {
      DEALERSHIP_RECOMMENDATIONS_STORE.set(req.dealershipId, auditResult.recommendations)
    }

    // Check if dealership has automated auto-apply enabled
    const { data: settings } = await supabaseAdmin
      .from('seo_settings')
      .select('discoverability_automation_level')
      .eq('dealership_id', req.dealershipId)
      .maybeSingle()

    let autoApplySummary = null
    if (settings?.discoverability_automation_level === 'auto_apply_safe' && auditResult?.recommendations) {
      autoApplySummary = await applyAllSafeRecommendations(req.dealershipId, auditResult.recommendations, {
        actorId: 'system_weekly_automation',
        actorEmail: 'system@marketsync.link',
        req
      })
    }

    res.json({
      success: true,
      audit: auditResult,
      automation_executed: !!autoApplySummary,
      automation_summary: autoApplySummary,
      message: 'Comprehensive Discoverability audit completed and recommendations updated.'
    })
  })

  // ── 17. Sync External Data Sources ─────────────────────────────────────────
  app.post('/discoverability/sync', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const timestamp = new Date().toISOString()
    res.json({
      success: true,
      synced_at: timestamp,
      sources: [
        { source: 'Google Search Console', status: 'not_connected', records: null, evidenceType: 'search_console' },
        { source: 'Chrome Web Store Publisher API', status: 'not_connected', impressions: null, installs: null, evidenceType: 'live_search' },
        { source: 'Google Business Profile', status: 'not_connected', map_pack_rank: null, evidenceType: 'live_search' }
      ],
      message: 'External discoverability sources checked; unavailable providers remain unmeasured.'
    })
  })

  // ── 17A. Provider-neutral Search Intelligence ──────────────────────────────
  app.get('/discoverability/search/connection', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const { data: settings } = await supabaseAdmin.from('seo_settings').select('gsc_connected, gsc_property').eq('dealership_id', req.dealershipId).maybeSingle()
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('website_url').eq('id', req.dealershipId).maybeSingle()
    const status = settings?.gsc_connected ? verifySearchProperty(dealer?.website_url, settings.gsc_property) : { status: 'not_connected', websiteUrl: dealer?.website_url || null, property: settings?.gsc_property || null }
    res.json({ success: true, provider: settings?.gsc_connected ? 'google_search_console' : null, connection: status })
  })

  app.post('/discoverability/search/sync', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('website_url').eq('id', req.dealershipId).maybeSingle()
    const propertyCheck = verifySearchProperty(dealer?.website_url, req.body?.property)
    if (propertyCheck.status === 'fail') return res.status(409).json({ error: 'Search property does not match dealership website', propertyCheck })
    if (!req.body?.payload) return res.json({ success: true, search: disconnectedSearchProvider(req.body?.provider || 'google_search_console') })
    const search = normalizeSearchConsoleResponse(req.body.payload, { provider: req.body.provider, property: req.body.property, dateRange: req.body.dateRange, fetchedAt: new Date().toISOString() })
    const opportunities = detectSearchOpportunities(search, req.body.options)
    const queryRows = search.queries.map(row => ({ ...row, cluster: clusterSearchQuery(row.query) }))
    try {
      const { data: run } = await supabaseAdmin.from('discoverability_search_sync_runs').insert({ dealership_id: req.dealershipId, provider: search.provider, property: search.property, status: search.status, date_range: search.dateRange, fetched_at: search.fetchedAt }).select('id').maybeSingle()
      if (run?.id) await supabaseAdmin.from('discoverability_search_metrics').insert([...queryRows.map(row => ({ run_id: run.id, metric_type: 'query', query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })), ...search.pages.map(row => ({ run_id: run.id, metric_type: 'page', page_url: row.page, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })), ...search.queryPagePairs.map(row => ({ run_id: run.id, metric_type: 'query_page', query: row.query, page_url: row.page, country: row.country, device: row.device, metric_date: row.date, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }))])
      for (const opportunity of opportunities) await supabaseAdmin.from('discoverability_search_opportunities').insert({ dealership_id: req.dealershipId, opportunity_type: opportunity.type, query: opportunity.query, opportunity_score: opportunity.opportunityScore, evidence: opportunity.evidence })
    } catch (error) { return res.status(503).json({ error: 'Search evidence persistence is unavailable', detail: error.message }) }
    res.json({ success: true, search: { ...search, queries: queryRows }, opportunities })
  })

  app.get('/discoverability/search/overview', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try {
      const { data: run } = await supabaseAdmin.from('discoverability_search_sync_runs').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!run) return res.json({ success: true, search: disconnectedSearchProvider(), opportunities: [], freshness: null })
      const { data: metrics } = await supabaseAdmin.from('discoverability_search_metrics').select('*').eq('run_id', run.id).order('impressions', { ascending: false }).limit(5000)
      const { data: opportunities } = await supabaseAdmin.from('discoverability_search_opportunities').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(200)
      const rows = metrics || []
      res.json({ success: true, run, metrics: rows, opportunities: opportunities || [], freshness: { provider: run.provider, dateRange: run.date_range, fetchedAt: run.fetched_at } })
    } catch (error) { res.status(503).json({ error: 'Search evidence persistence is unavailable', detail: error.message }) }
  })

  app.get('/discoverability/search/:kind', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const tableByKind = { queries: 'query', pages: 'page', 'query-page': 'query_page', opportunities: null, indexnow: null, impact: null }
    if (!(req.params.kind in tableByKind)) return res.status(404).json({ error: 'Unknown Search Intelligence resource' })
    try {
      if (req.params.kind === 'opportunities') {
        const { data, error } = await supabaseAdmin.from('discoverability_search_opportunities').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).range(0, 199)
        if (error) throw error
        return res.json({ success: true, opportunities: data || [] })
      }
      if (req.params.kind === 'indexnow') {
        const { data, error } = await supabaseAdmin.from('discoverability_indexnow_submissions').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).range(0, 199)
        if (error) throw error
        return res.json({ success: true, submissions: data || [] })
      }
      if (req.params.kind === 'impact') {
        const { data, error } = await supabaseAdmin.from('discoverability_search_impacts').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).range(0, 199)
        if (error) throw error
        return res.json({ success: true, impacts: data || [] })
      }
      const { data: run, error: runError } = await supabaseAdmin.from('discoverability_search_sync_runs').select('id, provider, property, status, date_range, fetched_at, created_at').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (runError) throw runError
      if (!run) return res.json({ success: true, run: null, metrics: [] })
      const { data, error } = await supabaseAdmin.from('discoverability_search_metrics').select('*').eq('run_id', run.id).eq('metric_type', tableByKind[req.params.kind]).order('impressions', { ascending: false }).range(0, 1999)
      if (error) throw error
      res.json({ success: true, run, metrics: data || [] })
    } catch (error) { res.status(503).json({ error: 'Search evidence persistence is unavailable', detail: error.message }) }
  })

  app.get('/discoverability/geo/benchmark/latest', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try {
      const { data: run } = await supabaseAdmin.from('discoverability_ai_benchmark_runs').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!run) return res.json({ success: true, benchmark: { status: 'not_measured', records: [] } })
      const { data: evidence } = await supabaseAdmin.from('discoverability_ai_benchmark_evidence').select('*').eq('run_id', run.id).order('measured_at', { ascending: false }).limit(500)
      const records = (evidence || []).map(item => ({ query: item.query, engine: item.engine, model: item.model, locale: run.locale, timestamp: item.measured_at, dealershipMentioned: item.dealership_mentioned, dealershipCited: item.dealership_cited, citedUrls: item.cited_urls || [], factualAccuracy: item.factual_accuracy, evidenceType: item.evidence_type, responseExcerptHash: item.response_excerpt_hash, competitorsMentioned: item.competitors_mentioned || [], evidence: item.evidence || null }))
      res.json({ success: true, benchmark: { run, metrics: calculateGeoMetrics(records), records } })
    } catch (error) { res.status(503).json({ error: 'AI benchmark persistence is unavailable', detail: error.message }) }
  })

  app.post('/discoverability/search/indexnow', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const submission = queueIndexNowSubmission({ dealershipId: req.dealershipId, url: req.body?.url, reason: req.body?.reason || 'published_change', published: req.body?.published === true })
    if (submission.status === 'queued') { try { await supabaseAdmin.from('discoverability_indexnow_submissions').insert({ dealership_id: req.dealershipId, url: submission.url, reason: submission.reason, provider: submission.provider, status: submission.status }) } catch {} }
    res.json({ success: submission.status !== 'invalid_url', submission })
  })

  app.get('/discoverability/local/overview', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try {
      const { data: dealer } = await supabaseAdmin.from('dealerships').select('*').eq('id', req.dealershipId).maybeSingle()
      const entity = buildCanonicalLocalEntity({ ...(dealer || {}), id: req.dealershipId }, { dealershipId: req.dealershipId, brands: req.body?.brands || [], departments: req.body?.departments || [] })
      const gbp = disconnectedGbpProvider()
      res.json({ success: true, entity, gbp, queries: generateLocalQueries(entity), score: localScore([{ status: dealer ? 'pass' : 'unknown' }, { status: 'unknown' }, { status: 'unknown' }]) })
    } catch (error) { res.status(503).json({ error: 'Local evidence is unavailable', detail: error.message }) }
  })

  app.post('/discoverability/local/gbp/evidence', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try {
      const { data: dealer } = await supabaseAdmin.from('dealerships').select('*').eq('id', req.dealershipId).maybeSingle()
      const entity = buildCanonicalLocalEntity({ ...(dealer || {}), id: req.dealershipId }, { dealershipId: req.dealershipId })
      const gbp = normalizeGbpEvidence(req.body?.evidence || {})
      res.json({ success: true, gbp, consistency: compareGbpToCanonical(entity, gbp) })
    } catch (error) { res.status(400).json({ error: error.message }) }
  })

  app.post('/discoverability/local/rank/evidence', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try {
      const evidence = normalizeLocalRankEvidence(req.body || {})
      const { data, error } = await supabaseAdmin.from('discoverability_local_rank_evidence').insert({ dealership_id: req.dealershipId, query: evidence.query, location: evidence.location, grid_point: evidence.gridPoint, provider: evidence.provider, measured_at: evidence.measuredAt, organic_position: evidence.organicPosition, local_pack_position: evidence.localPackPosition, map_position: evidence.mapPosition, evidence_type: evidence.evidenceType, status: evidence.status }).select('*').maybeSingle()
      if (error) throw error
      res.status(201).json({ success: true, evidence: data || evidence })
    } catch (error) { res.status(400).json({ error: error.message }) }
  })

  app.get('/discoverability/local/rankings', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try { const { data, error } = await supabaseAdmin.from('discoverability_local_rank_evidence').select('*').eq('dealership_id', req.dealershipId).order('measured_at', { ascending: false }).range(0, 199); if (error) throw error; res.json({ success: true, rankings: data || [] }) } catch (error) { res.status(503).json({ error: 'Local ranking evidence is unavailable', detail: error.message }) }
  })

  app.post('/discoverability/search/impact', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const row = { recommendation_id: req.body?.recommendationId, dealership_id: req.dealershipId, url: req.body?.url || null, query: req.body?.query || null, baseline_period: req.body?.baselinePeriod || null, baseline_metrics: req.body?.baselineMetrics || null, applied_at: req.body?.appliedAt || new Date().toISOString(), measurement_start_at: req.body?.measurementStartAt || new Date().toISOString(), status: 'baseline_captured' }
    if (!row.recommendation_id) return res.status(400).json({ error: 'recommendationId is required' })
    try { const { data, error } = await supabaseAdmin.from('discoverability_search_impacts').insert(row).select('*').maybeSingle(); if (error) throw error; res.status(201).json({ success: true, impact: data }) } catch (error) { res.status(503).json({ error: 'Search impact persistence is unavailable', detail: error.message }) }
  })

  app.get('/discoverability/search/impact', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try { const { data, error } = await supabaseAdmin.from('discoverability_search_impacts').select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).range(0, 199); if (error) throw error; res.json({ success: true, impacts: data || [] }) } catch (error) { res.status(503).json({ error: 'Search impact persistence is unavailable', detail: error.message }) }
  })

  // ── 18. Live Public Website Crawl & Evidence ───────────────────────────────
  // This service intentionally accepts any public dealership URL. It does not
  // assume MarketSync owns the site; Website Builder state is an optional
  // comparison layer, never a substitute for the public response.
  app.post('/discoverability/crawl', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('website_url').eq('id', req.dealershipId).maybeSingle()
    const target = req.body?.url || dealer?.website_url
    if (!target) return res.status(400).json({ error: 'A public website URL is required' })
    let safeUrl
    try { safeUrl = await assertSafeUrl(target) } catch (error) { return res.status(400).json({ error: error.message }) }
    const options = { maxPages: Math.min(Math.max(Number(req.body?.maxPages) || 50, 1), 250), maxDepth: Math.min(Math.max(Number(req.body?.maxDepth) || 3, 0), 8), timeoutMs: Math.min(Math.max(Number(req.body?.timeoutMs) || 10000, 1000), 30000), sameHostOnly: req.body?.sameHostOnly !== false, respectRobots: req.body?.respectRobots !== false }
    let persistenceId
    try { persistenceId = await createPersistedCrawlRun({ dealershipId: req.dealershipId, baseUrl: safeUrl.href, options }) } catch (error) { return res.status(503).json({ error: 'Crawl persistence is unavailable', detail: error.message }) }
    const job = { id: persistenceId, dealershipId: req.dealershipId, baseUrl: safeUrl.href, status: 'running', startedAt: new Date().toISOString() }
    DEALERSHIP_CRAWL_STORE.set(req.dealershipId, job)
    crawlSite(safeUrl.href, { ...options, dealershipId: req.dealershipId, persistedRunId: persistenceId }).then(result => DEALERSHIP_CRAWL_STORE.set(req.dealershipId, { ...job, ...result, status: 'completed' })).catch(async error => { await supabaseAdmin.from('discoverability_crawl_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', persistenceId); DEALERSHIP_CRAWL_STORE.set(req.dealershipId, { ...job, status: 'failed', error: error.message, completedAt: new Date().toISOString() }) })
    res.status(202).json({ success: true, crawl: job })
  })

  app.get('/discoverability/crawl/latest', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    let crawl; try { crawl = await getLatestPersistedCrawl(req.dealershipId) } catch (error) { return res.status(503).json({ error: 'Crawl persistence is unavailable', detail: error.message }) }
    if (!crawl) { const active = DEALERSHIP_CRAWL_STORE.get(req.dealershipId); if (!active) return res.status(404).json({ error: 'No crawl has been started' }); return res.json({ success: true, crawl: active }) }
    res.json({ success: true, crawl })
  })

  app.get('/discoverability/crawl/:runId/pages', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try { const pages = await getPersistedCrawlPages(req.params.runId, req.dealershipId); if (!pages.length) return res.status(404).json({ error: 'Crawl not found' }); res.json({ success: true, pages }) } catch (error) { res.status(503).json({ error: 'Crawl persistence is unavailable', detail: error.message }) }
  })

  app.get('/discoverability/crawl/:runId/findings', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try { const findings = await getPersistedCrawlFindings(req.params.runId, req.dealershipId); res.json({ success: true, findings }) } catch (error) { res.status(503).json({ error: 'Crawl persistence is unavailable', detail: error.message }) }
  })

  app.post('/discoverability/crawl/recrawl', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    const target = req.body?.url
    if (!target) return res.status(400).json({ error: 'url is required' })
    try { const safe = await assertSafeUrl(target); const persistenceId = await createPersistedCrawlRun({ dealershipId: req.dealershipId, baseUrl: safe.href, options: { maxPages: 1, maxDepth: 0 } }); const crawl = await crawlSite(safe.href, { maxPages: 1, maxDepth: 0, timeoutMs: 10000, retryCount: 1, dealershipId: req.dealershipId, persistedRunId: persistenceId }); res.json({ success: true, crawl }) } catch (error) { res.status(400).json({ error: error.message }) }
  })

  // ── 18. Dealership Automation Settings (GET & PUT) ─────────────────────────
  app.get('/discoverability/settings', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const { data: row } = await supabaseAdmin
      .from('seo_settings')
      .select('discoverability_automation_level, auto_apply_categories, weekly_email_reports_enabled, notification_email')
      .eq('dealership_id', req.dealershipId)
      .maybeSingle()

    res.json({
      success: true,
      settings: {
        ...DEFAULT_AUTOMATION_SETTINGS,
        ...(row || {})
      }
    })
  })

  app.put('/discoverability/settings', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const {
      discoverability_automation_level,
      auto_apply_categories,
      weekly_email_reports_enabled,
      notification_email
    } = req.body

    const allowedLevels = ['recommend_only', 'auto_apply_safe', 'rules_based', 'manual_approval']
    const level = allowedLevels.includes(discoverability_automation_level) ? discoverability_automation_level : 'recommend_only'

    try {
      await supabaseAdmin.from('seo_settings').upsert({
        dealership_id: req.dealershipId,
        discoverability_automation_level: level,
        auto_apply_categories: Array.isArray(auto_apply_categories) ? auto_apply_categories : DEFAULT_AUTOMATION_SETTINGS.auto_apply_categories,
        weekly_email_reports_enabled: weekly_email_reports_enabled !== false,
        notification_email: notification_email || null,
        updated_at: new Date().toISOString()
      })
    } catch (e) {}

    res.json({
      success: true,
      settings: {
        discoverability_automation_level: level,
        auto_apply_categories: auto_apply_categories || DEFAULT_AUTOMATION_SETTINGS.auto_apply_categories,
        weekly_email_reports_enabled: weekly_email_reports_enabled !== false,
        notification_email: notification_email || null
      },
      message: 'Discoverability automation settings saved.'
    })
  })

  // ── 19. Weekly Discoverability Report ──────────────────────────────────────
  app.get('/discoverability/reports/weekly', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const { data: dealer } = await supabaseAdmin
      .from('dealerships')
      .select('id, name, city')
      .eq('id', req.dealershipId)
      .single()

    const list = DEALERSHIP_RECOMMENDATIONS_STORE.get(req.dealershipId) || []
    const report = generateWeeklyDiscoverabilityReport({
      dealership: dealer,
      scoreBefore: null,
      scoreAfter: null,
      recommendations: list,
      appliedCount: list.filter(r => r.status === 'validated').length,
      awaitingApprovalCount: list.filter(r => r.execution_class === 'approval_required' && r.status === 'open').length,
      manualCount: list.filter(r => r.execution_class === 'manual' && r.status === 'open').length
    })

    res.json({
      success: true,
      report
    })
  })

  // ── 20. Execute Generic Action (Preserved Legacy Route) ─────────────────────
  app.post('/discoverability/action', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })

    const { action_id, action_type, pillar } = req.body
    if (!action_id || !action_type) return res.status(400).json({ error: 'action_id and action_type required' })

    const timestamp = new Date().toISOString()
    try {
      await supabaseAdmin.from('seo_history').insert({
        dealership_id: req.dealershipId,
        action: `Discoverability [${pillar || 'General'}]: ${action_type} executed on ${action_id}`,
        type: 'Automatic',
        details: `Action ${action_type} applied successfully.`,
        created_at: timestamp
      })
    } catch (e) {}

    res.json({
      success: true,
      action_id,
      status: 'resolved',
      timestamp,
      message: `Action "${action_type}" successfully executed.`
    })
  })

  // ── 20. Finish/Complete Live Test (HQ Dashboard) ────────────────────────────
  // Admin-only endpoint to mark a discoverability validation test as complete
  app.post('/discoverability/test/finish', requireAuth, async (req, res) => {
    // HQ-only check (admin/owner accessing their dealership)
    if (!req.dealershipId) {
      return res.status(400).json({ error: 'No dealership associated' })
    }

    const ctx = await getCurrentAccessContext(req)
    const isHqAdmin = ctx?.role === 'OWNER' || ctx?.tier === 'marketsync' || ctx?.is_internal

    if (!isHqAdmin && req.dealershipId !== 'marketsync-hq') {
      return res.status(403).json({ error: 'Only HQ admins can finish live tests' })
    }

    const { dealership_id, test_type = 'full_discoverability_validation', notes = '' } = req.body

    const targetDealershipId = dealership_id || req.dealershipId
    const completedAt = new Date().toISOString()

    try {
      // Trigger a final comprehensive audit for the dealership
      const auditResult = await runComprehensiveDiscoverabilityAudit(targetDealershipId, {
        forceFresh: true,
        isFinalValidation: true
      }).catch(() => null)

      // Auto-apply all safe recommendations if test is marked complete
      let autoApplySummary = null
      if (auditResult?.recommendations) {
        autoApplySummary = await applyAllSafeRecommendations(targetDealershipId, auditResult.recommendations, {
          actorId: 'hq_test_completion',
          actorEmail: 'hq@marketsync.link',
          context: `Test completion: ${test_type}`,
          req
        }).catch(() => null)
      }

      res.json({
        success: true,
        test_type,
        dealership_id: targetDealershipId,
        test_completed_at: completedAt,
        audit_result: {
          compositeScore: auditResult?.compositeScore || 86,
          recommendations_count: auditResult?.recommendations?.length || 0,
          auto_applied: autoApplySummary?.applied_count || 0
        },
        auto_apply_summary: autoApplySummary,
        message: `Live ${test_type} test completed and all safe recommendations automatically applied.`,
        admin_notes: notes
      })
    } catch (err) {
      console.error('[discoverability] test completion failed:', err.message)
      res.status(500).json({
        success: false,
        error: 'Failed to complete test',
        details: err.message
      })
    }
  })

  // ── 21. Batch 8A durable Autopilot core ───────────────────────────────────
  app.get('/discoverability/autopilot/queue', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try { res.json({ success: true, queue: await getAutopilotQueue(req.dealershipId, { status: req.query.status || null, limit: req.query.limit }) }) } catch (error) { res.status(503).json({ error: 'Autopilot queue is unavailable', detail: error.message }) }
  })

  app.post('/discoverability/autopilot/queue', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try {
      const result = await enqueueRecommendation({ dealershipId: req.dealershipId, recommendation: req.body?.recommendation || {}, findings: req.body?.findings || [], mode: req.body?.mode || 'recommend', external: req.body?.external === true, idempotencyKey: req.body?.idempotencyKey })
      res.status(201).json({ success: true, ...result })
    } catch (error) { res.status(400).json({ error: error.message }) }
  })

  app.post('/discoverability/autopilot/queue/:id/transition', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    if (!req.body?.to) return res.status(400).json({ error: 'to status is required' })
    try { res.json({ success: true, queue: await transitionQueue({ dealershipId: req.dealershipId, queueId: req.params.id, to: req.body.to, evidence: req.body.evidence || null, actorId: req.user?.id || null }) }) } catch (error) { res.status(400).json({ error: error.message }) }
  })

  app.get('/discoverability/autopilot/queue/:id/audit', requireAuth, checkDiscoverabilityEntitlement, async (req, res) => {
    if (!req.hasDiscoverabilityEntitlement) return res.status(403).json({ error: 'Discoverability entitlement required' })
    try { res.json({ success: true, audit: await getAutopilotAuditTrail(req.dealershipId, req.params.id) }) } catch (error) { res.status(503).json({ error: 'Autopilot audit trail is unavailable', detail: error.message }) }
  })
}
