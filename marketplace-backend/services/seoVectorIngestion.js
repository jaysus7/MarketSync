import { ingestDocument, computeContentHash } from './vectorIngestion.js'
import { supabaseAdmin } from '../shared.js'

/**
 * SEO Intelligence Vector Ingestion Pipeline.
 * 
 * Formats canonical SEO records into chunked semantic documents and ingests
 * them into pgvector via `services/vectorIngestion.js`.
 * 
 * Data Flow & Architecture Constraints:
 * 1. Source of truth for exact numbers/metrics is ALWAYS canonical SQL tables.
 * 2. Vector layer contains semantic context, issue explanations, and historical summaries.
 * 3. Every chunk carries `dealership_id` for strict tenant isolation.
 * 4. Uses deterministic `source_key` & `source_id` so re-ingestion updates existing chunks.
 * 5. Contains timestamps (`generated_at`, `updated_at`, `as_of`).
 */

export async function syncSeoIntelligenceForDealership(dealershipId, auditData = {}) {
  if (!dealershipId) return

  const now = new Date().toISOString()
  const { healthScore = 92, issues = [], dealer = {}, activeInventoryCount = 0 } = auditData

  // 1. Site Health Chunk
  const healthContent = `MarketSync SEO Site Health Summary for ${dealer.name || 'Dealership'} (${dealer.city || 'Local'}):
SEO Health Score: ${healthScore}/100 as of ${now}.
Active Lot Inventory: ${activeInventoryCount} vehicles indexed with Vehicle/Product schema.
Unresolved Issues: ${issues.filter(i => i.status === 'pending').length} items requiring review.
Auto-Fixes Executed: ${issues.filter(i => i.status === 'fixed').length} automatic repairs applied.`

  await ingestDocument({
    dealership_id: dealershipId,
    source_type: 'seo',
    source_key: `seo:site:health:${dealershipId}`,
    source_id: `health-${dealershipId}`,
    source_name: `SEO Health (${dealer.name || 'Dealership'})`,
    content: healthContent,
    metadata: {
      health_score: healthScore,
      active_inventory: activeInventoryCount,
      as_of: now,
      generated_at: now,
      updated_at: now,
    }
  }).catch(err => console.error('[seoVectorIngestion] Health chunk error:', err?.message))

  // 2. Issues & Auto-Fix Summaries Chunk
  for (const issue of issues) {
    const issueContent = `SEO Audit Finding [${issue.category}]: ${issue.title}
What Happened: ${issue.what_happened}
Why It Matters: ${issue.why_it_matters}
Impact Level: ${issue.estimated_impact}
Recommended Action: ${issue.recommended_action}
Auto-Fix Status: ${issue.status}`

    await ingestDocument({
      dealership_id: dealershipId,
      source_type: 'seo',
      source_key: `seo:technical:${issue.id}`,
      source_id: issue.id,
      source_name: issue.title,
      content: issueContent,
      metadata: {
        category: issue.category,
        impact: issue.estimated_impact,
        status: issue.status,
        as_of: now,
        generated_at: now,
        updated_at: now,
      }
    }).catch(err => console.error('[seoVectorIngestion] Issue chunk error:', err?.message))
  }
}

/**
 * Revokes/deletes SEO vector chunks upon subscription cancellation.
 */
export async function revokeSeoVectors(dealershipId) {
  if (!dealershipId) return
  try {
    await supabaseAdmin
      .from('ai_knowledge_chunks')
      .delete()
      .eq('dealership_id', dealershipId)
      .eq('source_type', 'seo')
  } catch (err) {
    console.error('[seoVectorIngestion] Vector revocation error:', err?.message)
  }
}
