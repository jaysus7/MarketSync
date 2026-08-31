import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTOPILOT_MODES,
  QUEUE_STATES,
  normalizeFinding,
  normalizeRecommendation,
  classifyRisk,
  canTransition,
  nextQueueState,
  enforceGuardrails,
  sxoStageEvidence,
  joinCanonicalDealRevenue,
  joinCanonicalServiceRevenue,
  completeVehicleAttribution,
  completeServiceAttribution
} from '../services/discoverabilityAutopilotService.js'

test('Batch 8A exposes conservative modes and a canonical finding', () => {
  assert.deepEqual(AUTOPILOT_MODES, ['monitor', 'recommend', 'auto_fix'])
  const finding = normalizeFinding({ type: 'missing_meta_description', pillar: 'seo', sourceType: 'crawler', affectedUrls: ['https://dealer.test/'] }, 'dealer-1')
  assert.equal(finding.dealershipId, 'dealer-1')
  assert.equal(finding.status, 'open')
  assert.ok(finding.fingerprint.includes('missing_meta_description'))
})

test('recommendations require findings and preserve exact change preview', () => {
  const finding = normalizeFinding({ id: 'finding-1', type: 'missing_image_alt', pillar: 'seo', affectedUrls: ['/inventory'] }, 'dealer-1')
  const recommendation = normalizeRecommendation({ id: 'recommendation-1', executionClass: 'auto_fixable', riskLevel: 'low', confidence: 96, recommendedChange: { field: 'image_alt', before: null, after: '2026 GMC Sierra front exterior' } }, [finding])
  assert.deepEqual(recommendation.findingIds, ['finding-1'])
  assert.equal(recommendation.recommendedChange.before, null)
  assert.equal(classifyRisk(recommendation, { protectedFields: ['phone', 'address', 'price'] }).allowed, true)
  assert.throws(() => normalizeRecommendation({ title: 'orphan recommendation' }, []), /requires at least one finding/i)
})

test('protected and low-confidence changes cannot auto-fix', () => {
  assert.equal(classifyRisk({ executionClass: 'auto_fixable', riskLevel: 'low', confidence: 99, recommendedChange: { field: 'phone', after: 'x' } }, { protectedFields: ['phone'] }).allowed, false)
  assert.equal(classifyRisk({ executionClass: 'auto_fixable', riskLevel: 'low', confidence: 89, recommendedChange: { field: 'meta_title', after: 'x' } }).allowed, false)
  assert.equal(classifyRisk({ executionClass: 'auto_fixable', riskLevel: 'low', confidence: 99, recommendedChange: { field: 'meta_title', after: 'x' } }, { external: true }).executionClass, 'manual')
})

test('queue transitions and guardrails are deterministic', () => {
  assert.ok(QUEUE_STATES.includes('published_pending_validation'))
  assert.equal(canTransition('published_pending_validation', 'validating'), true)
  assert.equal(canTransition('validated', 'applying'), false)
  assert.equal(nextQueueState({ status: 'validating' }, 'validated', { verified: true }).status, 'validated')
  assert.equal(enforceGuardrails({ automaticFixesToday: 10 }).allowed, false)
  assert.equal(enforceGuardrails({ pagesInBatch: 25 }).allowed, false)
  assert.equal(enforceGuardrails({ lastAppliedAt: new Date().toISOString(), nowMs: Date.now() }).allowed, false)
})

test('SXO distinguishes measured zero from missing instrumentation', () => {
  const result = sxoStageEvidence([], ['landing_page_view'])
  assert.deepEqual(result.stages.landing_page_view, { count: 0, status: 'measured_zero' })
  assert.equal(result.stages.vdp_view.count, null)
  assert.equal(result.stages.vdp_view.status, 'not_instrumented')
  assert.ok(result.evidenceCoverage < 100)
})

test('financial joins and attribution never infer missing revenue', () => {
  assert.equal(joinCanonicalDealRevenue({ id: 'deal-1', total_gross: 1200 }).totalGross, 1200)
  assert.equal(joinCanonicalDealRevenue({ id: 'deal-2' }).totalGross, null)
  assert.equal(joinCanonicalServiceRevenue({ id: 'ro-1', status: 'closed', total_revenue: 400 }).revenue, 400)
  assert.equal(joinCanonicalServiceRevenue({ id: 'ro-2', status: 'open' }).revenue, null)
  assert.equal(completeVehicleAttribution({ source: 'google_organic', sessionId: 's', contactId: 'c', vehicleId: 'v', dealId: 'd', delivered: true, grossEvidence: true, gross: 500 }).status, 'measured')
  assert.equal(completeVehicleAttribution({ source: 'google_organic', vehicleId: 'v' }).gross, null)
  assert.equal(completeServiceAttribution({ source: 'google_organic', sessionId: 's', contactId: 'c', appointmentId: 'a', repairOrderId: 'ro', closed: true, revenueEvidence: true, revenue: 200 }).status, 'measured')
})
