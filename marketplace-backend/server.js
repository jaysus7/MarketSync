import express from 'express'
import cors from 'cors'
import { securityHeaders, corsOriginCheck, rateLimitHealth } from './security.js'
import { startWebhookRetryWorker, registerWebhookRoutes } from './webhooks.js'
import { CANONICAL_FRONTEND, supabaseAdmin } from './shared.js'
import { registerRoutes as registerAuth } from './routes/auth.js'
import { registerRoutes as registerProfile } from './routes/profile.js'
import { registerAccessContext } from './routes/access-context.js'
import { requireAuth } from './middleware.js'
import { requireFeature } from './access.js'
import { registerRoutes as registerBlog } from './routes/blog.js'
import { registerRoutes as registerDashboard } from './routes/dashboard.js'
import { registerRoutes as registerInventory } from './routes/inventory.js'
import { registerRoutes as registerListings } from './routes/listings.js'
import { registerRoutes as registerBilling } from './routes/billing.js'
import { registerRoutes as registerFeeds } from './routes/feeds.js'
import { registerRoutes as registerSync } from './routes/sync.js'
import { registerRoutes as registerMisc } from './routes/misc.js'
import { registerAI } from './routes/ai.js'
import { registerRoutes as registerVinSticker } from './routes/vinsticker.js'
import { registerNotifications } from './routes/notifications.js'
import { registerGroups } from './routes/groups.js'
import { registerPipeline } from './routes/pipeline.js'
import { registerLeads } from './routes/leads.js'
import { registerCrm } from './routes/crm.js'
import { registerSite } from './routes/site.js'
import { registerAutomation } from './routes/automation.js'
import { registerDealerEmailMarketing } from './routes/dealer-automation.js'
import { registerEquity } from './routes/equity.js'
import { registerRecon } from './routes/recon.js'
import { registerFni } from './routes/fni.js'
import { registerMarketsync } from './routes/marketsync.js'
import { registerIntegrations } from './routes/integrations.js'
import { registerCredit } from './routes/credit.js'
import { registerHistory } from './routes/history.js'
import { registerDeposits } from './routes/deposits.js'
import { registerPayments } from './routes/payments.js'
import { registerSyndication } from './routes/syndication.js'
import { refreshDedicatedDemoAccounts, registerDemo } from './routes/demo.js'
import { registerDemoControl } from './routes/demo-control.js'
import { registerMarketing } from './routes/marketing.js'
import { registerBulk } from './routes/bulk.js'
import { registerService } from './routes/service.js'
import { registerReports } from './routes/reports.js'
import { registerEsign } from './routes/esign.js'
import registerSeoRoutes from './routes/seo.js'
import registerDiscoverabilityRoutes from './routes/discoverability.js'
import { registerCalendar } from './routes/calendar.js'
import { registerAdSpend } from './routes/adspend.js'
import { registerIdentity } from './routes/identity.js'
import { registerVehicleFit } from './routes/vehicle-fit.js'
import { registerSquare } from './routes/square.js'
import { registerCommissions } from './routes/commissions.js'
import { registerFniCatalog } from './routes/fni-catalog.js'
import { registerAccounting } from './routes/accounting.js'
import { registerExpenses } from './routes/expenses.js'
import { registerDealerTasks } from './routes/dealertasks.js'
import { registerEvents, startEventDispatcher } from './routes/events.js'
import { registerWorkflow } from './routes/workflow.js'
import { registerActionExecutor } from './routes/action-executor.js'
import { registerAccountingEngine } from './routes/accounting-engine.js'
import { registerAccountingArAp } from './routes/accounting-ar-ap.js'
import { registerCampaigns } from './routes/campaigns.js'
import { registerSocial } from './routes/social.js'
import { registerSocialPublish } from './routes/social-publish.js'
import { registerMarketingStudio } from './routes/marketing-studio.js'
import { registerConsent } from './routes/consent.js'
import { registerConversations } from './routes/conversations.js'
import { registerSalesVideo } from './routes/sales-video.js'
import { registerReputation } from './routes/reputation.js'
import { registerMyDay } from './routes/my-day.js'
import { registerPeopleOffboarding } from './routes/people-offboarding.js'
import { registerAcademy } from './routes/academy.js'
import { registerPeopleTime } from './routes/people-time.js'
import { registerPeopleCompliance } from './routes/people-compliance.js'
import { registerPeopleDossier } from './routes/people-dossier.js'
import { registerLaunchHub } from './routes/launch-hub.js'
import { registerConfigEngine } from './routes/config-engine.js'
import { registerAiEngine } from './routes/ai-engine.js'
import { registerAiRuntime } from './routes/ai-runtime.js'
import { registerIntegrationEngine } from './routes/integration-engine.js'
import { registerServiceEngine } from './routes/service-engine.js'
import { registerOwnerAdmin } from './routes/owner-admin.js'
import { registerCommandCenter } from './routes/command-center.js'
import { registerMarketplaceHome } from './routes/marketplace-home.js'
import { registerSaasAdmin } from './routes/saas-admin.js'
import { registerSaasSequences } from './routes/saas-sequences.js'
import { registerDelivery } from './routes/delivery.js'
import { registerPublicApi } from './routes/public-api.js'
import { registerPlaid } from './routes/plaid.js'
import { registerAffiliate } from './routes/affiliate.js'
import { registerHR } from './routes/hr.js'
import { registerStaffChat } from './routes/staff-chat.js'
import { registerHqAgentsRoutes } from './routes/hq-agents.js'
import { registerHqCrm } from './routes/hq-crm.js'

const app = express()
const PORT = process.env.PORT || 10000

app.set('trust proxy', 1)
app.use(securityHeaders)
app.use(cors({ origin: corsOriginCheck, credentials: true }))

// Fast, dependency-free health check. A scheduled ping to this keeps the
// free-tier instance from spinning down (which caused ~50s cold-start hangs on
// the first request to the dashboard, pipeline/leads, and the extension).
let startupDemoRefresh = { status: 'pending' }
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now(), demo_refresh: startupDemoRefresh }))
app.get('/ready', async (req, res) => {
  const { error } = await supabaseAdmin.from('dealerships').select('id', { head: true }).limit(1)
  const rate_limiting = rateLimitHealth()
  if (error || !rate_limiting.ok) {
    return res.status(503).json({
      ok: false,
      database: error ? 'unavailable' : 'ready',
      rate_limiting,
    })
  }
  res.json({ ok: true, ts: Date.now(), database: 'ready', rate_limiting })
})

// Serve frontend static files when running locally or in test QA mode
if (process.env.SERVE_STATIC === 'true' || process.env.NODE_ENV === 'test') {
  app.use(express.static('../marketplace-frontend'))
} else {
  // Bounce any stale *.html requests to the canonical frontend
  app.get(/\.html$/, (req, res) => {
    res.redirect(302, `${CANONICAL_FRONTEND}${req.originalUrl}`)
  })
}

// Stripe webhook must be raw before express.json
registerBilling(app)
// Square webhook is also raw-body (own express.raw on /square/webhook); its other
// routes read no JSON body, so registering here (before express.json) is safe.
registerSquare(app)

app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))

// ── Product/feature entitlement guards (backend authorization layer) ──
// Mounted before the product-scoped route groups so they run ahead of the per-route RBAC
// guards. requireAuth here also primes the caller's access context (memoized on req).
// Orgs without an explicit subscription fall back to full dealer_os, so existing accounts
// are unaffected; only plans that don't include the feature (e.g. os_starter, or a
// Facebook-only org) are blocked here — the same gate RLS enforces at the row level.
app.use('/accounting', requireAuth, requireFeature('os.accounting'))
app.use('/service', requireAuth, requireFeature('os.service'))
app.use('/service-engine', requireAuth, requireFeature('os.service'))
app.use('/hr', requireAuth, requireFeature('os.people'))

// Route modules
registerAuth(app)
registerProfile(app)
registerAccessContext(app)
registerBlog(app)
registerDashboard(app)
registerInventory(app)
registerListings(app)
registerFeeds(app)
registerSync(app)
registerMisc(app)
registerAI(app)
registerVinSticker(app)
registerNotifications(app)
registerGroups(app)
registerPipeline(app)
registerLeads(app)
registerCrm(app)
registerSite(app)
registerAutomation(app)
registerDealerEmailMarketing(app)
registerEquity(app)
registerRecon(app)
registerFni(app)
registerMarketsync(app)
registerIntegrations(app)
registerCredit(app)
registerHistory(app)
registerDeposits(app)
registerPayments(app)
registerSyndication(app)
registerDemo(app)
registerDemoControl(app)
registerMarketing(app)
registerBulk(app)
registerService(app)
registerReports(app)
registerEsign(app)
registerCalendar(app)
registerAdSpend(app)
registerIdentity(app)
registerVehicleFit(app)
registerCommissions(app)
registerFniCatalog(app)
registerAccounting(app)
registerExpenses(app)
registerDealerTasks(app)
registerEvents(app)
registerWorkflow(app)
registerActionExecutor(app)
registerAccountingEngine(app)
registerAccountingArAp(app)   // AR/AP/CIT read surface — derived from the posted ledger
registerCampaigns(app)        // canonical Campaign + source taxonomy + attribution by ID
registerSocial(app)           // social account identity + server-side publish authorization
registerSocialPublish(app)    // the dispatcher: posts actually leave the building, or say why not
registerMarketingStudio(app)  // Studio — canonical creative editor and media library
registerConsent(app)          // the ONE consent gate every sender calls
registerConversations(app)    // one customer conversation across channels + human takeover
registerSalesVideo(app)       // Sales-owned video messaging — a link fetch is not a view
registerReputation(app)       // reviews asked for honestly — no review gating, by construction
registerMyDay(app)            // one queue across departments, permission-gated per source
registerPeopleOffboarding(app) // leaving properly — reassign owned work, revoke roles, then terminate
registerAcademy(app)          // Your Path by role/department + credentials that required the work
registerPeopleTime(app)       // the time clock — there was none — and payroll that names who it could not pay
registerPeopleCompliance(app) // policies, onboarding, and telling an absence of records from compliance
registerPeopleDossier(app)    // one employee, everything on record — and editing them after onboarding
registerLaunchHub(app)        // ONE setup hub — derived readiness, never a stored checklist, never a lock
registerConfigEngine(app)
registerAiEngine(app)
registerAiRuntime(app)
registerIntegrationEngine(app)
registerServiceEngine(app)
registerOwnerAdmin(app)
registerCommandCenter(app)
registerMarketplaceHome(app)
registerSaasAdmin(app)
registerSaasSequences(app)
registerDelivery(app)
registerPublicApi(app)
registerPlaid(app)
registerAffiliate(app)
registerHR(app)
registerStaffChat(app)
registerHqAgentsRoutes(app)
registerHqCrm(app)
registerSeoRoutes(app)
registerDiscoverabilityRoutes(app)
registerWebhookRoutes(app)

// Background event dispatcher and webhook retry worker: start only on dedicated worker instances (RUN_WORKERS=true)
if (process.env.RUN_WORKERS === 'true') {
  startEventDispatcher()
  startWebhookRetryWorker()
}

app.use((err, req, res, next) => {
  console.error('Unhandled Express error:', {
    path: req.path,
    method: req.method,
    message: err.message,
    stack: err.stack
  })
  if (res.headersSent) return next(err)
  res.status(500).json({ error: 'Internal server error' })
})

if (process.env.VALIDATE_STARTUP === 'true') {
  console.log('[startup-validation] Server startup & route registration validated successfully.')
  process.exit(0)
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Secure Marketplace engine live on port ${PORT}`)
  if (process.env.SKIP_DEMO_REFRESH !== 'true') {
    refreshDedicatedDemoAccounts()
      .then(results => {
      const seeded = results.filter(row => row.status === 'seeded')
      const skipped = results.filter(row => row.status === 'skipped')
      startupDemoRefresh = {
        status: skipped.length ? 'partial' : 'complete', seeded: seeded.length,
        current: results.filter(row => row.status === 'current').length, skipped: skipped.length,
        failures: skipped.map(row => ({ name: row.name, step: String(row.reason || 'unknown').split(':')[0].slice(0, 80) })),
      }
      if (seeded.length) console.log(`[demo] refreshed ${seeded.length} dedicated demo account(s)`)
      for (const row of skipped) console.error(`[demo] skipped ${row.name}: ${row.reason}`)
    })
    .catch(error => { startupDemoRefresh = { status: 'failed' }; console.error('[demo] startup refresh failed:', error.message) })
  }
})
