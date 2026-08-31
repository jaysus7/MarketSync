import test from 'node:test'
import assert from 'node:assert/strict'
import {
  disconnectedSearchProvider,
  verifySearchProperty,
  normalizeSearchConsoleResponse,
  compareSearchPeriods,
  detectSearchOpportunities,
  detectFallingQueries,
  detectCannibalization,
  detectContentGaps,
  detectInventoryDemandGaps,
  clusterSearchQuery,
  mapVdpSearchPerformance,
  searchScore,
  createSearchImpactRecord
} from '../services/searchIntelligenceService.js'
import { queueIndexNowSubmission, recordIndexNowResult } from '../services/indexNowService.js'

test('disconnected providers never return synthetic metrics', () => {
  const result = disconnectedSearchProvider()
  assert.equal(result.status, 'not_connected')
  assert.equal(result.totals.clicks, null)
  assert.equal(result.totals.impressions, null)
  assert.deepEqual(result.queries, [])
})

test('Search Console property verification rejects another dealership', () => {
  assert.equal(verifySearchProperty('https://dealer.example', 'https://other.example').status, 'fail')
  assert.equal(verifySearchProperty('https://dealer.example', 'https://dealer.example/').status, 'pass')
})

test('Search Console rows normalize query, page and zero-safe CTR', () => {
  const result = normalizeSearchConsoleResponse({ rows: [
    { keys: ['used trucks', 'https://dealer.example/trucks'], clicks: 10, impressions: 100, position: 4 },
    { keys: ['used trucks', 'https://dealer.example/trucks'], clicks: 0, impressions: 0, position: 9 }
  ] }, { property: 'https://dealer.example', dateRange: { days: 28 } })
  assert.equal(result.status, 'measured')
  assert.equal(result.queries[0].impressions, 100)
  assert.equal(result.queries[0].ctr, 0.1)
  assert.equal(result.queryPagePairs.length, 2)
})

test('period comparisons handle zero denominators without fabricated percentages', () => {
  const result = compareSearchPeriods({ clicks: 10, impressions: 100 }, { clicks: 0, impressions: 0 })
  assert.equal(result.clicks.delta, 10)
  assert.equal(result.clicks.changePercent, null)
  assert.equal(result.impressions.changePercent, null)
})

test('opportunities use actual impressions and ignore low-volume noise', () => {
  const result = detectSearchOpportunities({ queries: [
    { query: 'used trucks welland', impressions: 4280, position: 4.8, ctr: 0.012 },
    { query: 'noise', impressions: 2, position: 9, ctr: 0 }
  ] })
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'high_visibility_low_ctr')
})

test('falling queries require sufficient observed data', () => {
  const result = detectFallingQueries([{ query: 'used trucks', clicks: 40, impressions: 200 }], [{ query: 'used trucks', clicks: 100, impressions: 300 }])
  assert.equal(result[0].type, 'falling_query')
})

test('cannibalization requires multiple materially visible pages', () => {
  const result = detectCannibalization([
    { query: 'used trucks', page: '/used-trucks', impressions: 500, position: 5 },
    { query: 'used trucks', page: '/inventory?body=truck', impressions: 300, position: 8 }
  ])
  assert.equal(result[0].competingPages.length, 2)
  assert.equal(detectCannibalization([{ query: 'used trucks', page: '/used-trucks', impressions: 500 }]).length, 0)
})

test('content gaps require a real dealership capability', () => {
  const query = [{ query: 'chevrolet brake service welland', impressions: 400 }]
  assert.equal(detectContentGaps(query, [{ url: '/', title: 'Dealer' }], { serviceCapabilities: ['service'] }).length, 1)
  assert.equal(detectContentGaps(query, [], { serviceCapabilities: [] }).length, 0)
})

test('inventory demand gaps use canonical inventory and VDP mappings', () => {
  const gap = detectInventoryDemandGaps([{ query: 'used gmc sierra welland', impressions: 900 }], [{ make: 'GMC', model: 'Sierra' }], [])
  assert.equal(gap[0].type, 'inventory_search_demand_gap')
  const vdp = mapVdpSearchPerformance([{ page: '/vdp/1', clicks: 4, impressions: 40 }], ['/vdp/1'])
  assert.equal(vdp[0].pageType, 'vdp')
})

test('query clustering is deterministic and capability-neutral', () => {
  assert.equal(clusterSearchQuery('Where can I service a Chevrolet near Welland?'), 'service')
  assert.equal(clusterSearchQuery('used GMC Sierra for sale'), 'used_inventory')
  assert.equal(clusterSearchQuery('best dealer in Welland'), 'location')
})

test('IndexNow blocks drafts, debounces repeats, and never implies indexing', () => {
  assert.equal(queueIndexNowSubmission({ dealershipId: 'd1', url: 'https://dealer.example/vdp/1', reason: 'publish', published: false }).status, 'blocked_draft')
  const first = queueIndexNowSubmission({ dealershipId: 'd1', url: 'https://dealer.example/vdp/1', reason: 'publish', published: true, now: 1000 })
  const second = queueIndexNowSubmission({ dealershipId: 'd1', url: 'https://dealer.example/vdp/1', reason: 'publish', published: true, now: 1001 })
  assert.equal(first.status, 'queued')
  assert.equal(second.status, 'debounced')
  const submitted = recordIndexNowResult(first, { success: true, statusCode: 202 })
  assert.equal(submitted.status, 'submitted')
  assert.equal(submitted.indexed, null)
})

test('search quality separates measured failures from unknown coverage', () => {
  const result = searchScore([{ status: 'pass' }, { status: 'fail' }, { status: 'unknown' }])
  assert.equal(result.qualityScore, 50)
  assert.equal(result.evidenceCoverage, 67)
  assert.equal(searchScore([{ status: 'pass' }, { status: 'unknown' }]).verified100, false)
})

test('search impact starts waiting for post-change evidence', () => {
  const result = createSearchImpactRecord('rec-1', { clicks: 10 })
  assert.equal(result.comparisonStatus, 'waiting_for_data')
  assert.equal(result.postChangeMetrics, null)
})
