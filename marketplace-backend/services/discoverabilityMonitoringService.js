import { supabaseAdmin } from '../shared.js'
import { runAutomatedSeoAudit } from './seoMonitoringService.js'
import { generateRecommendationsFromAudit } from './recommendationEngine.js'
import { auditWebsiteDiscoverabilityContracts } from './websiteDiscoverabilityContracts.js'

export function scoreEvidenceChecks(checks = []) {
  const applicable = checks.filter(check => check.applicable !== false)
  const measured = applicable.filter(check => ['pass', 'fail'].includes(check.status))
  const passed = measured.filter(check => check.status === 'pass').length
  return {
    qualityScore: measured.length ? Math.round((passed / measured.length) * 100) : null,
    evidenceCoverage: applicable.length ? Math.round((measured.length / applicable.length) * 100) : 100,
    passCount: passed,
    failCount: measured.length - passed,
    unknownCount: applicable.length - measured.length
  }
}

/**
 * MarketSync Discoverability Intelligence Monitoring Service
 * 
 * Orchestrates multi-pillar discovery monitoring across Search (SEO), Answer Engines (AEO),
 * AI Generative Engines (GEO/LLMO), Search Experience (SXO), Store Listings (ASO),
 * and Continuous Technical & Fact Validation.
 */

export async function runComprehensiveDiscoverabilityAudit(dealershipId, options = {}) {
  if (!dealershipId) return null

  // 1. Fetch dealership record
  const { data: dealer } = await supabaseAdmin
    .from('dealerships')
    .select('id, name, city, state, address, zip_code, phone, website_url, ai_chatbot_active, branding, site_published, site_slug')
    .eq('id', dealershipId)
    .single()

  if (!dealer) return null

  // 2. Fetch existing SEO audit as base pillar
  const seoAudit = await runAutomatedSeoAudit(dealershipId).catch(() => null)

  // 3. Fetch dealership inventory and pages
  const [{ data: pages }, { data: inventory }, { data: settings }, { data: contacts }] = await Promise.all([
    supabaseAdmin.from('dealer_site_pages').select('*').eq('dealership_id', dealershipId),
    supabaseAdmin.from('inventory').select('id, vin, year, make, model, trim, status, price, updated_at').eq('dealership_id', dealershipId).limit(50),
    supabaseAdmin.from('seo_settings').select('*').eq('dealership_id', dealershipId).maybeSingle(),
    supabaseAdmin.from('contacts').select('id, status, source, created_at').eq('dealership_id', dealershipId)
  ])

  const city = dealer.city || 'Local'
  const isGscConnected = !!settings?.gsc_connected
  const timestamp = new Date().toISOString()
  const builderContent = { ...(dealer.branding || {}) }
  if (Array.isArray(pages) && pages.length) builderContent.pages = pages
  const websiteBuilderAudit = auditWebsiteDiscoverabilityContracts(builderContent, dealer)

  // ── PILLAR 1: SEO HEALTH (0-100) ──────────────────────────────────────────
  const seoMetrics = {
    status: isGscConnected ? 'connected_not_measured' : 'not_connected',
    score: null,
    organicClicks: null,
    organicImpressions: null,
    averagePosition: null,
    clickThroughRate: null,
    keywordTiers: null,
    cwvStatus: { status: 'not_measured', lcp: null, inp: null, cls: null },
    indexationStatus: { status: 'not_measured', indexedPages: null, errors: null },
    evidence: { sourceType: isGscConnected ? 'search_console' : 'search_console', status: isGscConnected ? 'not_measured' : 'not_connected', verified: false, measuredAt: timestamp }
  }
  seoMetrics.qualityScore = null
  seoMetrics.evidenceCoverage = 0

  // ── PILLAR 2: AEO (ANSWER ENGINE OPTIMIZATION) ────────────────────────────
  const aeoData = {
    status: 'not_measured', score: null, featuredSnippets: null, peopleAlsoAsk: null,
    schemaValidation: {
      autoDealerSchema: { status: 'unknown', sourceUrl: null, evidence: 'No public rendered-page parse available.' },
      vehicleSchema: { status: 'unknown', sourceUrl: null, evidence: 'No public rendered-page parse available.' },
      faqSchema: { status: 'unknown', sourceUrl: null, evidence: 'No public rendered-page parse available.' },
      localBusinessSchema: { status: 'unknown', sourceUrl: null, evidence: 'No public rendered-page parse available.' }
    },
    voiceSearchOptimization: { status: 'not_measured', conversationalReadinessScore: null, longTailQueryMatchCount: null, sampleQueries: [] }
  }
  aeoData.qualityScore = null
  aeoData.evidenceCoverage = 0

  // ── PILLAR 3: GEO / LLMO (AI MODEL VISIBILITY) ────────────────────────────
  const geoData = { status: 'not_measured', score: null, brandMentionRate: null, urlCitationRate: null, citationShareOfVoice: null, sentimentBreakdown: null, hallucinationCount: null, modelCoverage: [], benchmarkEvidenceLog: [], evidenceType: null }
  geoData.qualityScore = null
  geoData.evidenceCoverage = 0

  // ── PILLAR 4: SXO (SEARCH EXPERIENCE & CONVERSION) ────────────────────────
  const orgContacts = (contacts || []).filter(c => {
    const s = String(c.source || '').toLowerCase()
    return s.includes('organic') || s.includes('seo') || s.includes('website') || s.includes('direct')
  })
  const sxoData = {
    status: 'not_measured', score: null, conversionRate: null, bounceRate: null,
    mobileVsDesktop: null, topLandingPages: [],
    funnel: orgContacts.length ? [{ step: 'Attributed CRM leads', count: orgContacts.length, source: 'crm' }] : [],
    evidence: { sourceType: 'analytics', status: 'unknown', verified: false, measuredAt: timestamp, details: 'CRM attribution alone cannot establish visits, bounce rate, or conversion rate.' }
  }
  sxoData.qualityScore = null
  sxoData.evidenceCoverage = 0

  // ── PILLAR 5: ASO (APP & EXTENSION STORE OPTIMIZATION) ────────────────────
  // Product distribution is intentionally excluded from the dealership website
  // composite. No trusted store measurement is available in this audit.
  const asoData = { status: 'not_measured', score: null, qualityScore: null, evidenceCoverage: 0, stores: [], evidenceType: null }

  // ── PILLAR 6: VALIDATION & ACCURACY (CRITICAL / HIGH / MED / LOW) ─────────
  const validationIssues = []

  // The builder contract is the source of truth for page-level discoverability.
  // Keep these findings in the existing validation pillar so the Discoverability
  // UI and the Builder cannot disagree about whether a page is optimized.
  validationIssues.push(...websiteBuilderAudit.issues.map(item => ({
    ...item,
    category: 'Website Builder contract',
    affectedUrl: item.affectedUrl || '/',
  })))
  
  // Rule 1: Check NAP
  if (!dealer.phone || !dealer.address || !dealer.zip_code) {
    validationIssues.push({
      id: 'val-nap-incomplete',
      severity: 'High',
      category: 'Brand & NAP Consistency',
      title: 'Incomplete Dealership Address or Phone in Canonical Settings',
      description: 'Missing phone or street address prevents accurate local AutoDealer schema indexing.',
      impact: 'Limits local map pack and AI knowledge graph confidence.',
      autoFixable: false,
      status: 'pending',
      affectedUrl: '/settings'
    })
  }

  // llms.txt configuration is not proof that the public artifact is reachable;
  // leave it unknown until a crawler fetches and records the response.

  // Rule 3: Check inventory pricing freshness
  const staleInventory = (inventory || []).filter(v => !v.price || Number(v.price) <= 0)
  if (staleInventory.length > 0) {
    validationIssues.push({
      id: 'val-stale-pricing',
      severity: 'Critical',
      category: 'Inventory Data Accuracy',
      title: `${staleInventory.length} Active Vehicles Missing Public Pricing`,
      description: 'Vehicles listed without prices fail schema validation and trigger search crawl penalties.',
      impact: 'Vehicles suppressed from Google Vehicle Listing Ads and AI comparison tables.',
      autoFixable: false,
      status: 'pending',
      affectedUrl: '/inventory'
    })
  }

  const criticalCount = validationIssues.filter(i => i.severity === 'Critical' && i.status === 'pending').length
  const highCount = validationIssues.filter(i => i.severity === 'High' && i.status === 'pending').length
  const mediumCount = validationIssues.filter(i => i.severity === 'Medium' && i.status === 'pending').length
  const validationScore = validationIssues.length ? Math.max(0, 100 - (criticalCount * 20) - (highCount * 10) - (mediumCount * 5)) : null

  const validationData = {
    status: validationIssues.length ? 'measured_with_findings' : 'not_measured',
    score: validationScore,
    criticalCount,
    highCount,
    mediumCount,
    lowCount: validationIssues.filter(i => i.severity === 'Low').length,
    issues: validationIssues,
    lastScannedAt: timestamp,
    qualityScore: validationIssues.length ? validationScore : null,
    evidenceCoverage: validationIssues.length ? 100 : 0
  }

  // ── OVERALL COMPOSITE DISCOVERABILITY SCORE ────────────────────────────────
  // There is no honest composite until all weighted website pillars have
  // measured evidence. ASO is deliberately not part of this calculation.
  const compositeScore = null

  // ── ACTIONABLE RECOMMENDATIONS ENGINE ──────────────────────────────────────
  const findings = validationIssues.map(finding => ({
    ...finding,
    source: finding.source || 'discoverability_validation',
    evidence: finding.evidence || finding.description,
    measured_at: timestamp,
    affected_urls: finding.affectedUrl ? [finding.affectedUrl] : []
  }))
  const recommendations = generateRecommendationsFromAudit(dealer, { id: `aud_${Date.now()}`, findings }, options.previousRecommendations || [])

  return {
    dealershipId,
    dealershipName: dealer.name,
    timestamp,
    compositeScore,
    qualityScore: null,
    evidenceCoverage: 0,
    verified100: false,
    scoringNote: 'Quality is not reported until all applicable website checks have measured evidence; unavailable providers remain unknown.',
    pillars: {
      seo: seoMetrics,
      aeo: aeoData,
      geo: geoData,
      sxo: sxoData,
      aso: asoData,
      validation: validationData,
      websiteBuilder: websiteBuilderAudit
    },
    recommendations,
    history: {
      dates: [],
      searchSovTrend: [],
      aiSovTrend: [],
      compositeScoreTrend: []
    }
  }
}
