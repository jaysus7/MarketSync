import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreEvidenceChecks } from '../services/discoverabilityMonitoringService.js'
import { generateRecommendationsFromAudit, validateAppliedRecommendation } from '../services/recommendationEngine.js'

test('unknown checks reduce evidence coverage without becoming failures', () => {
  const score = scoreEvidenceChecks([
    { id: 'pass', status: 'pass' },
    { id: 'unknown', status: 'unknown' },
    { id: 'not-applicable', status: 'unknown', applicable: false }
  ])
  assert.equal(score.qualityScore, 100)
  assert.equal(score.evidenceCoverage, 50)
  assert.equal(score.failCount, 0)
})

test('recommendations cannot be generated without an observed finding', () => {
  assert.deepEqual(generateRecommendationsFromAudit({ id: 'dealer-1' }, { id: 'audit-1' }, []), [])
})

test('applied metadata remains pending until the public page is verified', async () => {
  const result = await validateAppliedRecommendation({ apply_strategy: 'update_page_meta', recommended_change: { field: 'meta_title', after: 'Verified title' } }, { updatedValue: 'Verified title' })
  assert.equal(result.passed, false)
  assert.equal(result.status, 'applied_pending_publish')
  assert.equal(result.checks[0].status, 'unknown')
})

test('verified 100 semantics require complete quality and coverage conditions', () => {
  const incomplete = scoreEvidenceChecks([{ id: 'good', status: 'pass' }, { id: 'missing', status: 'unknown' }])
  assert.notEqual(incomplete.evidenceCoverage, 100)
  assert.equal(incomplete.qualityScore, 100)
})
