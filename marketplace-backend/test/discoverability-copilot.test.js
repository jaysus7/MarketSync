import test from 'node:test'
import assert from 'node:assert/strict'
import { answerDiscoverabilityQuestion } from '../services/discoverabilityCopilotService.js'

const audit = {
  recommendations: [
    { id: 'safe-1', title: 'Add missing homepage meta description', status: 'open', execution_class: 'auto_fixable', confidence: 94, source: 'website_contract', affected_urls: ['/'] },
    { id: 'review-1', title: 'Create a truck comparison page', status: 'open', execution_class: 'approval_required', confidence: 88, source: 'website_contract' },
  ],
  pillars: { validation: { criticalCount: 0, highCount: 1 }, automotive: { inventoryComparison: { findings: [] } } },
}

test('copilot refuses to invent a visibility decline without measured history', () => {
  const result = answerDiscoverabilityQuestion({ question: 'Why did visibility fall?', audit, search: { search: { status: 'not_connected' }, opportunities: [] } })
  assert.equal(result.intent, 'visibility_change')
  assert.match(result.answer, /cannot prove/i)
  assert.ok(result.limitations.some(item => /Search Console/i.test(item)))
})

test('copilot does not treat a failed search sync as measured evidence', () => {
  const result = answerDiscoverabilityQuestion({
    question: 'Why did visibility fall?',
    audit,
    search: { run: { status: 'failed', created_at: '2026-09-02T00:00:00Z' }, search: { status: 'failed' }, opportunities: [] },
  })
  assert.match(result.answer, /cannot prove/i)
  assert.equal(result.evidence.length, 0)
})

test('copilot exposes only high-confidence auto-fixable recommendations as safe', () => {
  const result = answerDiscoverabilityQuestion({ question: 'What can MarketSync safely fix automatically?', audit })
  assert.equal(result.intent, 'safe_fixes')
  assert.deepEqual(result.proposals.map(item => item.id), ['safe-1'])
  assert.equal(result.evidence[0].source, 'website_contract')
})

test('copilot labels deterministic recommendations when measured search opportunity is absent', () => {
  const result = answerDiscoverabilityQuestion({ question: 'What content should be created next?', audit, search: { opportunities: [] } })
  assert.equal(result.intent, 'content_next')
  assert.match(result.answer, /recommendation, not measured search demand/i)
})

test('copilot will not diagnose vehicle indexation without public evidence', () => {
  const result = answerDiscoverabilityQuestion({ question: 'Why is Google not indexing these vehicles?', audit })
  assert.equal(result.intent, 'vehicle_indexing')
  assert.match(result.answer, /no measured public vehicle crawl/i)
})
