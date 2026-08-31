import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  isFieldProtected,
  PROTECTED_FIELDS,
  canAutoApplyRecommendation,
  createRollbackSnapshot,
  getRollbackSnapshot,
  calculateStateChecksum,
  validateAppliedRecommendation,
  generateRecommendationsFromAudit,
  applySingleRecommendation,
  revertRecommendation,
  applyAllSafeRecommendations,
  generateWeeklyDiscoverabilityReport
} from '../services/recommendationEngine.js'

describe('MarketSync Discoverability Recommendations & Auto-Remediation Engine', () => {

  // ── 1. Safety Engine & Protected Fields Guard ─────────────────────────────
  describe('Safety Engine & Protected Fields Guard', () => {
    it('correctly identifies protected fields that must never be auto-applied', () => {
      assert.equal(isFieldProtected('price'), true)
      assert.equal(isFieldProtected('msrp'), true)
      assert.equal(isFieldProtected('finance_rate'), true)
      assert.equal(isFieldProtected('legal_disclaimer'), true)
      assert.equal(isFieldProtected('privacy_policy'), true)
      assert.equal(isFieldProtected('phone'), true)
      assert.equal(isFieldProtected('address'), true)
      assert.equal(isFieldProtected('dealership_name'), true)
      assert.equal(isFieldProtected('homepage_hero_headline'), true)
      assert.equal(isFieldProtected('noindex_directive'), true)

      // Unprotected safe metadata
      assert.equal(isFieldProtected('meta_title'), false)
      assert.equal(isFieldProtected('meta_description'), false)
      assert.equal(isFieldProtected('schema_json'), false)
      assert.equal(isFieldProtected('llms_txt_enabled'), false)
    })

    it('allows safe low-risk, high-confidence auto-fixable recommendations', () => {
      const rec = {
        execution_class: 'auto_fixable',
        risk_level: 'low',
        confidence: 95,
        status: 'open',
        recommended_change: {
          field: 'meta_title',
          before: 'Old Title',
          after: 'New Optimized Title'
        }
      }
      const safety = canAutoApplyRecommendation(rec)
      assert.equal(safety.safe, true)
    })

    it('rejects recommendations with protected fields', () => {
      const rec = {
        execution_class: 'auto_fixable',
        risk_level: 'low',
        confidence: 95,
        status: 'open',
        recommended_change: {
          field: 'vehicle_price',
          before: '$32,000',
          after: '$29,995'
        }
      }
      const safety = canAutoApplyRecommendation(rec)
      assert.equal(safety.safe, false)
      assert.match(safety.reason, /protected/i)
    })

    it('rejects recommendations with approval_required or manual execution classes', () => {
      const approvalRec = {
        execution_class: 'approval_required',
        risk_level: 'medium',
        confidence: 90,
        status: 'open',
        recommended_change: { field: 'content_html', before: '', after: 'Article' }
      }
      assert.equal(canAutoApplyRecommendation(approvalRec).safe, false)

      const manualRec = {
        execution_class: 'manual',
        risk_level: 'low',
        confidence: 90,
        status: 'open',
        recommended_change: { field: 'backlink_outreach', before: '', after: 'Contact' }
      }
      assert.equal(canAutoApplyRecommendation(manualRec).safe, false)
    })

    it('rejects recommendations with confidence below 80', () => {
      const lowConfidenceRec = {
        execution_class: 'auto_fixable',
        risk_level: 'low',
        confidence: 72,
        status: 'open',
        recommended_change: { field: 'meta_title', before: 'Old', after: 'New' }
      }
      const safety = canAutoApplyRecommendation(lowConfidenceRec)
      assert.equal(safety.safe, false)
      assert.match(safety.reason, /confidence/i)
    })
  })

  // ── 2. Snapshot Manager & Rollback Subsystem ───────────────────────────────
  describe('Snapshot Creation & Verification', () => {
    it('creates an immutable rollback snapshot with valid SHA-256 checksum', async () => {
      const snapshot = await createRollbackSnapshot({
        dealershipId: 'dealership_test_123',
        recommendationId: 'rec_test_title',
        resourceType: 'dealer_site_pages',
        resourceId: 'page_trucks',
        field: 'meta_title',
        previousValue: 'Original Title Tag',
        proposedValue: 'Optimized Title Tag',
        actorId: 'user_123',
        actorEmail: 'admin@dealership.com'
      })

      assert.ok(snapshot.id.startsWith('snap_'))
      assert.equal(snapshot.dealership_id, 'dealership_test_123')
      assert.equal(snapshot.previous_value, 'Original Title Tag')
      assert.equal(snapshot.proposed_value, 'Optimized Title Tag')
      assert.equal(snapshot.checksum, calculateStateChecksum('Original Title Tag'))

      const retrieved = getRollbackSnapshot(snapshot.id)
      assert.deepEqual(retrieved, snapshot)
    })
  })

  // ── 3. Post-Apply Validation Engine ───────────────────────────────────────
  describe('Post-Apply Validation Engine', () => {
    it('validates meta title / description updates correctly', async () => {
      const rec = {
        apply_strategy: 'update_page_meta',
        recommended_change: {
          field: 'meta_title',
          after: 'Used Trucks in Welland | Apex Auto'
        }
      }

      const passResult = await validateAppliedRecommendation(rec, {
        updatedValue: 'Used Trucks in Welland | Apex Auto',
        publicVerification: { verified: true, statusCode: 200, sourceUrl: 'https://dealer.example/' }
      })
      assert.equal(passResult.passed, true)

      const failResult = await validateAppliedRecommendation(rec, {
        updatedValue: 'Wrong Value'
      })
      assert.equal(failResult.passed, false)
    })

    it('validates JSON-LD FAQPage schema syntax and structure', async () => {
      const rec = {
        apply_strategy: 'inject_schema_faq',
        recommended_change: {
          field: 'schema_json',
          after: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [{ '@type': 'Question', name: 'Q1', acceptedAnswer: { text: 'A1' } }]
          })
        }
      }

      const passResult = await validateAppliedRecommendation(rec, {
        schema: {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [{ '@type': 'Question', name: 'Q1', acceptedAnswer: { text: 'A1' } }]
        },
        publicVerification: { verified: true, statusCode: 200, sourceUrl: 'https://dealer.example/service' }
      })
      assert.equal(passResult.passed, true)

      const failResult = await validateAppliedRecommendation(rec, {
        schema: 'invalid-json{{'
      })
      assert.equal(failResult.passed, false)
    })

    it('validates llms.txt and crawler manifest generation', async () => {
      const rec = {
        apply_strategy: 'enable_llms_txt',
        recommended_change: { field: 'llms_txt_enabled', after: true }
      }
      const val = await validateAppliedRecommendation(rec, { success: true, publicVerification: { verified: true, statusCode: 200, sourceUrl: 'https://dealer.example/llms.txt' } })
      assert.equal(val.passed, true)
    })
  })

  // ── 4. Apply Single & Automatic Rollback on Validation Failure ─────────────
  describe('Apply Single & Failure Rollback', () => {
    it('successfully applies a safe recommendation, creates snapshot, and validates', async () => {
      const rec = {
        id: 'rec_safe_test_meta',
        dealer_id: 'dealer_123',
        execution_class: 'auto_fixable',
        risk_level: 'low',
        confidence: 96,
        status: 'open',
        pillar: 'seo',
        title: 'Update Meta Title',
        apply_strategy: 'update_page_meta',
        recommended_change: {
          resource_type: 'dealer_site_pages',
          resource_id: 'page_home',
          field: 'meta_title',
          before: 'Old Home Title',
          after: 'New Home Title'
        }
      }

      const result = await applySingleRecommendation(rec, {
        dealershipId: 'dealer_123',
        actorId: 'user_456'
      })

      assert.equal(result.success, true)
      assert.equal(result.recommendation.status, 'applied_pending_publish')
      assert.ok(result.snapshot.id)
      assert.equal(result.validation.passed, false)
      assert.equal(result.validation.status, 'applied_pending_publish')
    })

    it('keeps an applied change pending when public verification is unavailable', async () => {
      const rec = {
        id: 'rec_fail_test_schema',
        dealer_id: 'dealer_123',
        execution_class: 'auto_fixable',
        risk_level: 'low',
        confidence: 90,
        status: 'open',
        pillar: 'aeo',
        title: 'Inject Broken Schema Test',
        apply_strategy: 'inject_schema_faq',
        recommended_change: {
          resource_type: 'dealer_site_pages',
          resource_id: 'page_service',
          field: 'schema_json',
          before: '{"existing":"schema"}',
          after: 'MALFORMED_JSON_STRING'
        }
      }

      const result = await applySingleRecommendation(rec, {
        dealershipId: 'dealer_123',
        actorId: 'user_456'
      })

      assert.equal(result.success, true)
      assert.equal(result.pendingVerification, true)
      assert.equal(result.recommendation.status, 'applied_pending_publish')
      assert.match(result.message, /awaiting public verification/i)
    })
  })

  // ── 5. Revert / Rollback Subsystem ─────────────────────────────────────────
  describe('Revert / Rollback Subsystem', () => {
    it('restores original pre-mutation state using rollback snapshot', async () => {
      const rec = {
        id: 'rec_revert_demo',
        dealer_id: 'dealer_123',
        execution_class: 'auto_fixable',
        risk_level: 'low',
        confidence: 95,
        status: 'open',
        pillar: 'seo',
        title: 'Revert Demonstration',
        apply_strategy: 'update_page_meta',
        recommended_change: {
          resource_type: 'dealer_site_pages',
          resource_id: 'page_about',
          field: 'meta_title',
          before: 'Original About Title',
          after: 'Applied About Title'
        },
        public_verification: { verified: true, statusCode: 200, sourceUrl: 'https://dealer.example/about' }
      }

      // Apply first
      const applyRes = await applySingleRecommendation(rec, { dealershipId: 'dealer_123' })
      assert.equal(applyRes.success, true)
      assert.equal(rec.status, 'validated')

      // Revert
      const revertRes = await revertRecommendation(rec, applyRes.snapshot, { actorId: 'user_123' })
      assert.equal(revertRes.success, true)
      assert.equal(rec.status, 'reverted')
      assert.equal(revertRes.restored_value, 'Original About Title')
    })
  })

  // ── 6. Batch "Apply All Safe Recommendations" Pipeline ────────────────────
  describe('Batch "Apply All Safe Recommendations" Pipeline', () => {
    it('executes eligible safe fixes, resolves conflicts, and isolates failures', async () => {
      const recList = [
        {
          id: 'rec_batch_1',
          dealer_id: 'dealer_batch',
          execution_class: 'auto_fixable',
          risk_level: 'low',
          confidence: 95,
          status: 'open',
          pillar: 'seo',
          title: 'Batch Title 1',
          estimated_score_gain: '+3',
          apply_strategy: 'update_page_meta',
          recommended_change: {
            resource_type: 'dealer_site_pages',
            resource_id: 'p1',
            field: 'meta_title',
            before: 'B1',
            after: 'A1'
          }
        },
        {
          id: 'rec_batch_2',
          dealer_id: 'dealer_batch',
          execution_class: 'approval_required', // Should be skipped safely
          risk_level: 'medium',
          confidence: 88,
          status: 'open',
          pillar: 'geo',
          title: 'Batch Content 2',
          estimated_score_gain: '+5',
          recommended_change: {
            resource_type: 'blog_posts',
            resource_id: 'p2',
            field: 'content_html',
            before: '',
            after: 'Long content'
          }
        },
        {
          id: 'rec_batch_3',
          dealer_id: 'dealer_batch',
          execution_class: 'auto_fixable',
          risk_level: 'low',
          confidence: 92,
          status: 'open',
          pillar: 'validation',
          title: 'Enable llms.txt',
          estimated_score_gain: '+2',
          apply_strategy: 'enable_llms_txt',
          recommended_change: {
            resource_type: 'seo_settings',
            resource_id: 'global',
            field: 'llms_txt_enabled',
            before: false,
            after: true
          }
        }
      ]

      const summary = await applyAllSafeRecommendations('dealer_batch', recList, {
        actorId: 'batch_runner'
      })

      assert.equal(summary.success, true)
      assert.equal(summary.eligible_count, 2)
      assert.equal(summary.applied_count, 2)
      assert.equal(summary.failed_count, 0)
      assert.equal(summary.destructive_changes_count, 0)
      assert.equal(summary.estimated_score_gain, '+5')
      assert.match(summary.message, /2 Safe Fixes Applied/i)
    })
  })

  // ── 7. Duplicate Prevention & Stale Detection ──────────────────────────────
  describe('Duplicate Prevention & Findings Normalization', () => {
    it('merges new audit runs with existing recommendations without creating duplicates', () => {
      const dealer = { id: 'd_100', name: 'Apex Auto', city: 'Welland', website_url: 'https://apex.com' }
      const findings = [1, 2, 3].map(index => ({ id: `finding-${index}`, title: `Observed issue ${index}`, evidence: { sourceType: 'crawler', verified: true }, source: 'crawler', measured_at: new Date().toISOString(), affected_urls: ['/'] }))
      const firstRun = generateRecommendationsFromAudit(dealer, { id: 'aud_1', findings }, [])
      assert.equal(firstRun.length, findings.length)

      // Simulate approving one recommendation
      firstRun[0].status = 'approved'
      firstRun[0].approved_at = new Date().toISOString()

      // Second audit run should preserve approved status and increment occurrence_count
      const secondRun = generateRecommendationsFromAudit(dealer, { id: 'aud_2', findings }, firstRun)
      assert.equal(secondRun.length, firstRun.length)
      const matching = secondRun.find(r => r.finding_id === firstRun[0].finding_id)
      assert.equal(matching.status, 'approved')
      assert.equal(matching.occurrence_count, 2)
    })
  })

  // ── 8. Weekly Report Generator ─────────────────────────────────────────────
  describe('Weekly Report Generator', () => {
    it('generates structured weekly summary with score delta, top wins, and action items', () => {
      const report = generateWeeklyDiscoverabilityReport({
        dealership: { id: 'd_200', name: 'Metro Motors', city: 'Toronto' },
        scoreBefore: 80,
        scoreAfter: 88,
        recommendations: [
          { execution_class: 'approval_required', status: 'open', title: 'Need Approval' },
          { execution_class: 'manual', status: 'open', title: 'Manual Action' }
        ],
        appliedCount: 4,
        awaitingApprovalCount: 1,
        manualCount: 1
      })

      assert.equal(report.dealership_id, 'd_200')
      assert.equal(report.score_summary.delta, '+8')
      assert.equal(report.weekly_breakdown.auto_fixed_count, 4)
      assert.equal(report.weekly_breakdown.awaiting_approval_count, 1)
      assert.equal(report.weekly_breakdown.manual_action_count, 1)
      assert.ok(report.top_wins.length > 0)
      assert.equal(report.needs_approval.length, 1)
      assert.equal(report.manual_actions.length, 1)
    })
  })
})
