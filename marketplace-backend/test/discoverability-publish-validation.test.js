import test from 'node:test'
import assert from 'node:assert/strict'

import {
  validateAction,
  validateMetadata,
  validateCanonical,
  validateSchema,
  validateInternalLink,
  validateSitemap,
  validateLlmsTxt,
  validateInventory,
  validateLocal,
  findingResolutionFromValidation,
  applyRegression,
  rollbackEligibility,
  indexNowEligibility,
  searchImpactEligibility,
  VALIDATION_ACTIONS
} from '../services/discoverabilityValidationService.js'

const ok = (html = {}, extra = {}) => ({ statusCode: 200, finalUrl: 'https://example.test/p', html, ...extra })

test('an unrecognised action can never pass validation', () => {
  const result = validateAction('something_new', { anything: true }, ok())
  assert.equal(result.passed, false)
  assert.equal(result.reason, 'unsupported_validation_action')
})

test('validation with nothing expected is not a success', () => {
  // "We deployed and nothing blew up" must not read as proof.
  const result = validateMetadata({}, ok({ title: 'Anything' }))
  assert.equal(result.passed, false)
})

test('metadata validation passes only when the live page matches', () => {
  const expected = { title: 'Used Cars & Trucks for Sale in Welland | ABC Motors' }
  assert.equal(validateMetadata(expected, ok({ title: expected.title })).passed, true)
  const mismatch = validateMetadata(expected, ok({ title: 'Used Inventory | ABC Motors' }))
  assert.equal(mismatch.passed, false)
  assert.match(mismatch.reason, /title/)
})

test('an unreachable page fails validation even if expectations are otherwise unchecked', () => {
  const result = validateMetadata({ title: 'X' }, { statusCode: 404, html: { title: 'X' } })
  assert.equal(result.passed, false)
  const status = result.checks.find((c) => c.field === 'http_status')
  assert.equal(status.matched, false)
})

test('canonical validation rejects a page advertising multiple canonicals', () => {
  const expected = { canonical: 'https://example.test/p' }
  assert.equal(validateCanonical(expected, ok({ canonical: 'https://example.test/p', canonicals: ['https://example.test/p'] })).passed, true)
  const conflicting = validateCanonical(expected, ok({ canonical: 'https://example.test/p', canonicals: ['https://example.test/p', 'https://example.test/other'] }))
  assert.equal(conflicting.passed, false)
})

test('malformed JSON-LD fails schema validation', () => {
  const observed = ok({ schema: ['{"@type":"AutoDealer"', '{"@type":"AutoDealer"}'] })
  const result = validateSchema({ entityType: 'AutoDealer' }, observed)
  assert.equal(result.passed, false)
  assert.equal(result.checks.find((c) => c.field === 'schema_parses').matched, false)
})

test('schema validation checks the expected entity and its factual values', () => {
  const observed = ok({ schema: [{ '@type': 'AutoDealer', telephone: '905-555-0100' }] })
  assert.equal(validateSchema({ entityType: 'AutoDealer', properties: { telephone: '905-555-0100' } }, observed).passed, true)
  assert.equal(validateSchema({ entityType: 'AutoDealer', properties: { telephone: '905-555-9999' } }, observed).passed, false)
  assert.equal(validateSchema({ entityType: 'Vehicle' }, observed).passed, false)
})

test('internal link validation requires the link to exist and its destination to resolve', () => {
  const observed = ok({ links: [{ url: 'https://example.test/pricing', href: '/pricing', anchor: 'Pricing' }] })
  const expected = { destination: 'https://example.test/pricing', anchor: 'Pricing' }

  assert.equal(validateInternalLink(expected, observed, { statusCode: 200 }).passed, true)
  // Link present, but pointing at a dead page is not a repaired link.
  assert.equal(validateInternalLink(expected, observed, { statusCode: 404 }).passed, false)
  // Link absent entirely.
  assert.equal(validateInternalLink(expected, ok({ links: [] }), { statusCode: 200 }).passed, false)
})

test('sitemap validation reads the live XML and enforces exclusions', () => {
  const body = '<urlset><url><loc>https://example.test/pricing</loc></url></urlset>'
  assert.equal(validateSitemap({ mustContain: ['https://example.test/pricing'] }, { statusCode: 200, body }).passed, true)
  assert.equal(validateSitemap({ mustNotContain: ['https://example.test/pricing'] }, { statusCode: 200, body }).passed, false)
  assert.equal(validateSitemap({ mustContain: ['https://example.test/x'] }, { statusCode: 200, body: 'not xml' }).passed, false)
})

test('llms.txt validation proves stale claims are gone, not merely outnumbered', () => {
  const body = 'MarketSync is a dealership operating system. Facebook Marketplace tool.'
  const result = validateLlmsTxt({ mustContain: ['dealership operating system'], mustNotContain: ['Facebook Marketplace tool'] }, { statusCode: 200, body })
  assert.equal(result.passed, false)
  const clean = validateLlmsTxt(
    { mustContain: ['dealership operating system'], mustNotContain: ['Facebook Marketplace tool'] },
    { statusCode: 200, body: 'MarketSync is a dealership operating system.' }
  )
  assert.equal(clean.passed, true)
})

test('inventory validation checks VIN, price, availability and Vehicle schema', () => {
  const observed = ok({
    canonical: 'https://example.test/vdp',
    schema: [{ '@type': 'Vehicle', vehicleIdentificationNumber: '1FT7W2BT5KEC12345', offers: { price: '48995', availability: 'InStock' } }]
  })
  assert.equal(validateInventory({ vin: '1FT7W2BT5KEC12345', price: '48995', availability: 'InStock' }, observed).passed, true)
  // A stale price on the live page must fail even though everything else matches.
  assert.equal(validateInventory({ vin: '1FT7W2BT5KEC12345', price: '46995' }, observed).passed, false)
})

test('local validation checks NAP and hours from live schema', () => {
  const observed = ok({ schema: [{ '@type': 'AutoDealer', name: 'ABC Motors', telephone: '905-555-0100', address: { streetAddress: '1 Main St', postalCode: 'L3B 1A1' } }] })
  assert.equal(validateLocal({ name: 'ABC Motors', phone: '905-555-0100', streetAddress: '1 Main St' }, observed).passed, true)
  assert.equal(validateLocal({ phone: '905-555-0199' }, observed).passed, false)
})

test('every declared validation action has a real validator', () => {
  for (const action of VALIDATION_ACTIONS) {
    const result = validateAction(action, {}, ok())
    assert.notEqual(result.reason, 'unsupported_validation_action', `${action} has no validator`)
  }
})

test('a failed validation never resolves the finding', () => {
  const resolution = findingResolutionFromValidation({ status: 'open' }, { passed: false })
  assert.equal(resolution.status, 'open')
  assert.equal(resolution.resolvedAt, null)
})

test('only a passed validation resolves the finding', () => {
  const resolution = findingResolutionFromValidation({ status: 'open' }, { passed: true, job: { id: 'job-1' } })
  assert.equal(resolution.status, 'resolved')
  assert.equal(resolution.validationJobId, 'job-1')
  assert.ok(resolution.resolvedAt)
})

test('a resolved finding that fails a later validation regresses rather than staying resolved', () => {
  const resolution = findingResolutionFromValidation({ status: 'resolved' }, { passed: false })
  assert.equal(resolution.status, 'regressed')
})

test('regression reopens the same finding and increments recurrence', () => {
  const finding = { status: 'resolved', recurrence_count: 1, detected_at: '2026-08-01T00:00:00Z', resolved_at: '2026-08-29T00:00:00Z' }
  const regressed = applyRegression(finding, { observedAt: '2026-09-12T00:00:00Z' })
  assert.equal(regressed.status, 'regressed')
  assert.equal(regressed.recurrenceCount, 2)
  assert.equal(regressed.firstDetectedAt, '2026-08-01T00:00:00Z')
  assert.equal(regressed.previouslyResolvedAt, '2026-08-29T00:00:00Z')
  assert.equal(regressed.reappearedAt, '2026-09-12T00:00:00Z')
})

test('an already-open finding re-observed does not inflate the recurrence count', () => {
  const regressed = applyRegression({ status: 'open', recurrence_count: 0 })
  assert.equal(regressed.status, 'open')
  assert.equal(regressed.recurrenceCount, 0)
})

test('rollback stays conservative', () => {
  const base = { ownedByMarketSync: true, snapshot: { revisionId: 'r1' }, validationFailed: true, riskLevel: 'low' }
  assert.equal(rollbackEligibility(base).eligible, true)
  assert.equal(rollbackEligibility({ ...base, validationFailed: false }).eligible, false)
  assert.equal(rollbackEligibility({ ...base, snapshot: null }).state, 'manual_required')
  assert.equal(rollbackEligibility({ ...base, ownedByMarketSync: false }).state, 'manual_required')
})

test('protected or high-risk content waits for approval instead of auto-rolling back', () => {
  const base = { ownedByMarketSync: true, snapshot: { revisionId: 'r1' }, validationFailed: true }
  assert.equal(rollbackEligibility({ ...base, touchesProtectedFields: true }).state, 'rollback_pending')
  assert.equal(rollbackEligibility({ ...base, riskLevel: 'high' }).state, 'rollback_pending')
  assert.equal(rollbackEligibility({ ...base, riskLevel: 'high' }).eligible, false)
})

test('IndexNow is only earned after a validated public deployment', () => {
  const base = { validated: true, isPublic: true, isDraft: false, deploymentSucceeded: true }
  assert.equal(indexNowEligibility(base).eligible, true)
  assert.equal(indexNowEligibility({ ...base, validated: false }).eligible, false)
  assert.equal(indexNowEligibility({ ...base, isDraft: true }).eligible, false)
  assert.equal(indexNowEligibility({ ...base, isPublic: false }).eligible, false)
  assert.equal(indexNowEligibility({ ...base, deploymentSucceeded: false }).eligible, false)
})

test('Search Impact opens only for a validated Search fix with a connected provider', () => {
  assert.equal(searchImpactEligibility({ pillar: 'search', validated: true, providerConnected: true }).status, 'waiting_for_data')
  assert.equal(searchImpactEligibility({ pillar: 'search', validated: true, providerConnected: false }).status, 'not_connected')
  assert.equal(searchImpactEligibility({ pillar: 'search', validated: false, providerConnected: true }).eligible, false)
  assert.equal(searchImpactEligibility({ pillar: 'seo', validated: true, providerConnected: true }).eligible, false)
})
