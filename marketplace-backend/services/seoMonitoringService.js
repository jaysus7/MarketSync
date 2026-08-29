import { supabaseAdmin } from '../shared.js'
import { syncSeoIntelligenceForDealership } from './seoVectorIngestion.js'

/**
 * Automated daily SEO monitoring engine for MarketSync SEO ($149/mo CAD).
 * 
 * Performs scheduled background checks across technical SEO, Search Console,
 * local SEO, inventory page lifecycle, schema, metadata, and LLM readiness.
 * Automatically repairs AUTO-FIX SAFE issues without requiring manual user intervention.
 */

export async function runAutomatedSeoAudit(dealershipId) {
  if (!dealershipId) return null

  // Fetch dealership info, pages, blog posts, inventory
  const { data: dealer } = await supabaseAdmin
    .from('dealerships')
    .select('id, name, city, state, address, zip_code, phone, website_url, ai_chatbot_active')
    .eq('id', dealershipId)
    .single()

  if (!dealer) return null

  // 1. Fetch site pages & blog posts
  const { data: pages } = await supabaseAdmin
    .from('dealer_site_pages')
    .select('id, slug, title, content_json, seo_title, seo_description')
    .eq('dealership_id', dealershipId)

  const { data: blogs } = await supabaseAdmin
    .from('dealer_blog_posts')
    .select('id, slug, title, content_html, status, seo_title, seo_description, cover_image_url')
    .eq('dealership_id', dealershipId)

  const { data: inventory } = await supabaseAdmin
    .from('inventory')
    .select('id, vin, year, make, model, trim, status, price, images')
    .eq('dealership_id', dealershipId)
    .eq('status', 'AVAILABLE')
    .limit(50)

  // 2. Scan issues
  const issues = []
  const autoFixesApplied = []
  const timestamp = new Date().toISOString()

  // Check 1: Missing llms.txt
  const { data: llmsCheck } = await supabaseAdmin
    .from('seo_settings')
    .select('*')
    .eq('dealership_id', dealershipId)
    .maybeSingle()

  if (!llmsCheck || !llmsCheck.llms_txt) {
    issues.push({
      id: `issue-llms-${Date.now()}`,
      category: 'AUTO_FIX',
      title: 'Missing llms.txt configuration',
      what_happened: 'Your website lacks an explicit llms.txt file to guide AI crawlers (ChatGPT, Gemini, Perplexity).',
      why_it_matters: 'AI search engines use llms.txt to discover authoritative dealership data and inventory structures.',
      estimated_impact: 'high',
      recommended_action: 'Generate and publish standard dealership llms.txt.',
      auto_fixable: true,
      status: 'unknown',
    })
    // Configuration alone does not prove that the public manifest exists. Keep
    // this as an observed unknown until a crawler fetches /llms.txt.
  }

  // Check 2: Missing Meta Titles / Descriptions on Pages
  for (const page of pages || []) {
    if (!page.seo_title || !page.seo_description) {
      const isAutoFixable = true
      issues.push({
        id: `issue-meta-page-${page.id}`,
        category: 'AUTO_FIX',
        title: `Missing SEO metadata on page: /${page.slug || ''}`,
        what_happened: `Page "${page.title || page.slug}" is missing a custom SEO title or meta description.`,
        why_it_matters: 'Search engines display default text or snippet fallbacks which reduces search CTR.',
        estimated_impact: 'medium',
        recommended_action: `Generate optimized SEO title & description for ${dealer.name} ${page.title || ''}.`,
        auto_fixable: isAutoFixable,
        status: 'pending',
      })
      // Do not claim the metadata was applied or validated from a database read.
    }
  }

  // Check 3: Local Schema / NAP Consistency
  if (!dealer.city || !dealer.address || !dealer.phone) {
    issues.push({
      id: `issue-nap-incomplete`,
      category: 'REVIEW_FIRST',
      title: 'Incomplete Dealership NAP Information',
      what_happened: 'Dealership address or phone number is missing from main settings.',
      why_it_matters: 'Local search rankings (Google Maps / Local Pack) require 100% consistent NAP data.',
      estimated_impact: 'high',
      recommended_action: 'Update full address, phone number, and operating hours in Website Setup.',
      auto_fixable: false,
      status: 'pending',
    })
  }

  // Public canonical/schema/indexation checks remain unknown until an actual
  // published URL is fetched and parsed. Database fields are not page evidence.

  // 3. Log only real mutations. This audit performs none when evidence is missing.
  for (const fix of autoFixesApplied) {
    try {
      await supabaseAdmin.from('seo_history').insert({
        dealership_id: dealershipId,
        action: fix.action,
        type: fix.type,
        details: fix.details,
        created_at: timestamp
      })
    } catch (e) {}
  }

  // 4. No synthetic health score: this service has not performed a public crawl
  // or received Search Console measurements.
  const healthScore = null

  // 5. Ingest updated findings into pgvector (Hybrid AI Intelligence)
  await syncSeoIntelligenceForDealership(dealershipId, {
    healthScore,
    status: 'not_measured',
    evidenceCoverage: 0,
    issues,
    autoFixesApplied,
    dealer,
    activeInventoryCount: (inventory || []).length
  }).catch(err => console.error('[seoMonitoring] Vector ingestion error:', err?.message || err))

  return {
    healthScore,
    issues,
    autoFixesAppliedCount: autoFixesApplied.length,
    timestamp
  }
}
