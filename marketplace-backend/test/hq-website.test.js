import test from 'node:test'
import assert from 'node:assert/strict'
import { HqWebsiteService } from '../services/hqWebsiteService.js'
import { supabaseAdmin } from '../shared.js'

test('Phase 9, 10, 11, 12: Website Control Plane, Section Builder, Discovery & Render Deployments', async () => {
  const store = {
    pages: [],
    sections: [],
    pageVersions: [],
    posts: [],
    postVersions: [],
    scans: [],
    findings: [],
    changeSets: [],
    deployments: [],
    audit: [],
  }

  const originalFrom = supabaseAdmin.from
  supabaseAdmin.from = (table) => {
    return {
      select: (cols) => ({
        eq: (col, val) => ({
          single: async () => {
            if (table === 'website_pages') {
              const p = store.pages.find(x => x.id === val)
              return { data: p || null, error: p ? null : { message: 'Not found' } }
            }
            if (table === 'website_discovery_findings') {
              const f = store.findings.find(x => x.id === val)
              return { data: f || null, error: f ? null : { message: 'Not found' } }
            }
            return { data: null }
          },
          in: (inCol, inVals) => ({
            then: (resolve) => {
              if (table === 'website_deployments') {
                const active = store.deployments.filter(d => inVals.includes(d.status))
                return resolve({ data: active, error: null })
              }
              return resolve({ data: [], error: null })
            },
          }),
          order: () => ({
            then: (resolve) => resolve({ data: [], error: null }),
          }),
        }),
      }),
      insert: (payload) => ({
        select: () => ({
          single: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, ...payload }
            if (table === 'website_pages') store.pages.push(row)
            if (table === 'website_discovery_scans') store.scans.push(row)
            if (table === 'website_change_sets') store.changeSets.push(row)
            if (table === 'website_deployments') store.deployments.push(row)
            if (table === 'website_audit_log' || table === 'hq_audit_log') store.audit.push(row)
            return { data: row, error: null }
          },
          maybeSingle: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, ...payload }
            return { data: row, error: null }
          },
        }),
        then: (resolve) => {
          const list = Array.isArray(payload) ? payload : [payload]
          for (const item of list) {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, ...item }
            if (table === 'website_sections') store.sections.push(row)
            if (table === 'website_page_versions') store.pageVersions.push(row)
            if (table === 'website_post_versions') store.postVersions.push(row)
            if (table === 'website_discovery_findings') store.findings.push(row)
          }
          return resolve({ data: payload, error: null })
        },
      }),
      update: (payload) => ({
        eq: (col, val) => {
          if (table === 'website_pages') {
            const p = store.pages.find(x => x.id === val)
            if (p) Object.assign(p, payload)
          }
          if (table === 'website_discovery_findings') {
            const f = store.findings.find(x => x.id === val)
            if (f) Object.assign(f, payload)
          }
          if (table === 'website_deployments') {
            const d = store.deployments.find(x => x.id === val)
            if (d) Object.assign(d, payload)
          }
          if (table === 'website_change_sets') {
            const cs = store.changeSets.find(x => x.id === val)
            if (cs) Object.assign(cs, payload)
          }
          return {
            select: () => ({
              single: async () => ({ data: { id: val, ...payload }, error: null }),
            }),
            then: (resolve) => resolve({ data: null, error: null }),
          }
        },
      }),
      delete: () => ({
        eq: (col, val) => ({
          then: (resolve) => {
            if (table === 'website_sections') {
              store.sections = store.sections.filter(s => s.page_id !== val)
            }
            return resolve({ error: null })
          },
        }),
      }),
      upsert: (payload) => ({
        select: () => ({
          single: async () => {
            const existing = store.posts.find(p => p.slug === payload.slug)
            if (existing) {
              Object.assign(existing, payload)
              return { data: existing, error: null }
            }
            const row = { id: `mock-post-${Date.now()}`, ...payload }
            store.posts.push(row)
            return { data: row, error: null }
          },
        }),
      }),
    }
  }

  try {
    // 1. Pages CMS & Section Builder
    const { page, versionNumber } = await HqWebsiteService.savePageWithSections({
      slug: 'features-demo',
      title: 'Features & Capabilities',
      seoTitle: 'Dealership Management Features | MarketSync',
      sections: [
        { section_type: 'hero', sort_order: 0, data: { headline: 'Complete Dealership OS' } },
        { section_type: 'features_grid', sort_order: 1, data: { columns: 3 } },
      ],
      changeSummary: 'Initial section layout',
    })

    assert.ok(page.id)
    assert.equal(page.slug, 'features-demo')
    assert.equal(versionNumber, 2)
    assert.equal(store.sections.length, 2)
    assert.equal(store.pageVersions.length, 1)

    // 2. Blog CMS & n8n Ingestion
    const ingested = await HqWebsiteService.ingestPost({
      slug: 'how-to-scale-used-car-turnover',
      title: 'How to Scale Used Car Turnover in 2026',
      contentHtml: '<p>Automating inventory syndication reduces days-on-lot by 35%.</p>',
      excerpt: 'Proven strategies for dealership inventory turnover.',
      workflowId: 'n8n-wf-blog-generator-42',
      workflowName: 'AI Dealership Insights n8n Daily Run',
      source: 'n8n',
      status: 'draft',
    })

    assert.ok(ingested.id)
    assert.equal(ingested.slug, 'how-to-scale-used-car-turnover')
    assert.equal(ingested.source, 'n8n')
    assert.equal(ingested.status, 'draft', 'Ingested blog posts must start as draft for review')
    assert.equal(store.postVersions.length, 1)

    // 3. Discovery Engine Audit & Finding Triage
    const scan = await HqWebsiteService.runDiscoveryScan({ siteId: 'marketsync_corporate' })
    assert.ok(scan.id)
    assert.equal(scan.status, 'completed')
    assert.equal(store.findings.length, 2)

    const findingToApply = store.findings[0]
    const applied = await HqWebsiteService.applyFinding({ findingId: findingToApply.id })
    assert.equal(applied.status, 'applied')

    // 4. Change Sets & Render Deployments with Production Verification
    const deployResult = await HqWebsiteService.createAndDeployChangeSet({
      siteId: 'marketsync_corporate',
      name: 'Release 2026.08 — Discovery Fixes & Blog Ingestion',
      versionTag: 'v2026.08.28',
      items: [{ type: 'page', id: page.id }, { type: 'post', id: ingested.id }],
    })

    assert.ok(deployResult.verified)
    assert.equal(deployResult.deployment.status, 'verified')
    assert.match(deployResult.deployment.verified_status, /HTTP 200 OK/)
    assert.equal(deployResult.changeSet.status, 'published')
  } finally {
    supabaseAdmin.from = originalFrom
  }
})
