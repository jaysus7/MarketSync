import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import express from 'express'

process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

import { supabase, supabaseAdmin } from '../shared.js'
import registerSeoRoutes from '../routes/seo.js'
import registerDiscoverabilityRoutes from '../routes/discoverability.js'

// Mock Supabase auth & DB methods for unit test server
supabase.auth.getUser = async (token) => {
  if (token === 'test-token') {
    return { data: { user: { id: 'usr-test' } }, error: null }
  }
  return { data: { user: null }, error: new Error('Invalid token') }
}

supabaseAdmin.from = (table) => {
  if (table === 'profiles') {
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'usr-test', dealership_id: 'dlr-test-disc', role: 'DEALER_ADMIN', active: true, billing_status: 'ACTIVE' },
            error: null
          })
        })
      })
    }
  }
  if (table === 'dealerships') {
    return {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'dlr-test-disc', name: 'Test Dealership', city: 'Welland', state: 'ON', address: '123 Main St', zip_code: 'L3B 1A1', phone: '905-555-0100', website_url: 'https://testdealership.ca', seo_active: true, billing_status: 'ACTIVE', products: { marketsync_seo: true } },
            error: null
          }),
          maybeSingle: async () => ({
            data: { id: 'dlr-test-disc', name: 'Test Dealership', city: 'Welland', state: 'ON', address: '123 Main St', zip_code: 'L3B 1A1', phone: '905-555-0100', website_url: 'https://testdealership.ca', seo_active: true, billing_status: 'ACTIVE', products: { marketsync_seo: true } },
            error: null
          })
        })
      })
    }
  }
  if (table === 'subscriptions' || table === 'subscription_product_coverage') {
    const chain = {
      eq: () => chain,
      then: (fn) => Promise.resolve({ data: [{ product_id: 'marketsync_seo', status: 'active', plan_id: 'marketsync-seo' }], error: null }).then(fn),
    }
    return { select: () => chain }
  }
  if (table === 'user_roles') {
    const chain = {
      eq: () => chain,
      then: (fn) => Promise.resolve({ data: [{ role_id: 'dealer_owner' }], error: null }).then(fn),
    }
    return { select: () => chain }
  }

  const defaultChain = {
    eq: () => defaultChain,
    in: () => defaultChain,
    is: () => defaultChain,
    neq: () => defaultChain,
    order: () => defaultChain,
    limit: () => defaultChain,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (fn) => Promise.resolve({ data: [], error: null }).then(fn),
  }

  return {
    select: () => defaultChain,
    upsert: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null })
  }
}

function createTestServer() {
  const app = express()
  app.use(express.json())
  registerSeoRoutes(app)
  registerDiscoverabilityRoutes(app)

  const server = http.createServer(app)
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const baseUrl = `http://127.0.0.1:${port}`
      resolve({
        server,
        baseUrl,
        authHeaders: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
        close: () => new Promise(r => server.close(r))
      })
    })
  })
}

test('Discoverability Intelligence Overview endpoint returns composite score, 7 pillars and recommendations', async () => {
  const { baseUrl, authHeaders, close } = await createTestServer()
  try {
    const res = await fetch(`${baseUrl}/discoverability/overview`, { headers: authHeaders })
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.entitled, true)
    assert.equal(typeof json.compositeScore, 'number')
    assert.ok(json.compositeScore >= 60 && json.compositeScore <= 100)
    assert.ok(json.pillars.seo, 'SEO pillar present')
    assert.ok(json.pillars.aeo, 'AEO pillar present')
    assert.ok(json.pillars.geo, 'GEO pillar present')
    assert.ok(json.pillars.sxo, 'SXO pillar present')
    assert.ok(json.pillars.aso, 'ASO pillar present')
    assert.ok(json.pillars.validation, 'Validation pillar present')
    assert.ok(Array.isArray(json.recommendations), 'Recommendations present')
    assert.ok(json.history.searchSovTrend, 'Search SOV trend present')
    assert.ok(json.history.aiSovTrend, 'AI SOV trend present')
  } finally {
    await close()
  }
})

test('Discoverability AEO endpoint returns Featured Snippets, PAA reach, and Voice Search', async () => {
  const { baseUrl, authHeaders, close } = await createTestServer()
  try {
    const res = await fetch(`${baseUrl}/discoverability/aeo`, { headers: authHeaders })
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)
    assert.ok(json.aeo.featuredSnippets, 'Featured snippets present')
    assert.ok(json.aeo.peopleAlsoAsk, 'PAA queries present')
    assert.ok(json.aeo.schemaValidation, 'Schema validation present')
    assert.ok(json.aeo.voiceSearchOptimization, 'Voice search optimization present')
  } finally {
    await close()
  }
})

test('Discoverability GEO/LLMO endpoint and synthetic benchmark runner execute multi-engine checks', async () => {
  const { baseUrl, authHeaders, close } = await createTestServer()
  try {
    const res = await fetch(`${baseUrl}/discoverability/geo`, { headers: authHeaders })
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)
    assert.ok(json.geo.brandMentionRate, 'Brand mention rate present')
    assert.ok(json.geo.urlCitationRate, 'Citation rate present')
    assert.ok(Array.isArray(json.geo.modelCoverage), 'Model coverage present')

    // Test synthetic benchmark execution
    const benchRes = await fetch(`${baseUrl}/discoverability/geo/benchmark`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ query: 'Best used trucks near me', engine: 'All Engines' })
    })
    assert.equal(benchRes.status, 200)
    const benchJson = await benchRes.json()
    assert.equal(benchJson.success, true)
    assert.ok(benchJson.executedRunsCount >= 5, 'Executed runs across all engines')
    assert.ok(benchJson.runs[0].engine, 'First run has engine name')
  } finally {
    await close()
  }
})

test('Discoverability SXO & ASO endpoints return conversion metrics and store listings', async () => {
  const { baseUrl, authHeaders, close } = await createTestServer()
  try {
    const sxoRes = await fetch(`${baseUrl}/discoverability/sxo`, { headers: authHeaders })
    assert.equal(sxoRes.status, 200)
    const sxoJson = await sxoRes.json()
    assert.equal(sxoJson.success, true)
    assert.ok(sxoJson.sxo.conversionRate, 'Conversion rate present')
    assert.ok(Array.isArray(sxoJson.sxo.topLandingPages), 'Landing pages present')
    assert.ok(Array.isArray(sxoJson.sxo.funnel), 'SXO funnel present')

    const asoRes = await fetch(`${baseUrl}/discoverability/aso`, { headers: authHeaders })
    assert.equal(asoRes.status, 200)
    const asoJson = await asoRes.json()
    assert.equal(asoJson.success, true)
    assert.ok(Array.isArray(asoJson.aso.stores), 'Store listings present')
    assert.equal(asoJson.aso.stores[0].store, 'Chrome Web Store')
  } finally {
    await close()
  }
})

test('Discoverability Validation endpoint returns severity triage and supports on-demand scan', async () => {
  const { baseUrl, authHeaders, close } = await createTestServer()
  try {
    const valRes = await fetch(`${baseUrl}/discoverability/validation`, { headers: authHeaders })
    assert.equal(valRes.status, 200)
    const valJson = await valRes.json()
    assert.equal(valJson.success, true)
    assert.ok(Array.isArray(valJson.validation.issues), 'Validation issues present')
    assert.equal(typeof valJson.validation.criticalCount, 'number')

    const scanRes = await fetch(`${baseUrl}/discoverability/validation/scan`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    })
    assert.equal(scanRes.status, 200)
    const scanJson = await scanRes.json()
    assert.equal(scanJson.success, true)
  } finally {
    await close()
  }
})

test('Discoverability Recommendations & Action dispatch resolve issues', async () => {
  const { baseUrl, authHeaders, close } = await createTestServer()
  try {
    const recRes = await fetch(`${baseUrl}/discoverability/recommendations`, { headers: authHeaders })
    assert.equal(recRes.status, 200)
    const recJson = await recRes.json()
    assert.equal(recJson.success, true)
    assert.ok(Array.isArray(recJson.recommendations))

    const actRes = await fetch(`${baseUrl}/discoverability/action`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action_id: 'rec-1', action_type: 'create_ai_content', pillar: 'GEO / LLMO' })
    })
    assert.equal(actRes.status, 200)
    const actJson = await actRes.json()
    assert.equal(actJson.success, true)
    assert.equal(actJson.status, 'resolved')
  } finally {
    await close()
  }
})

test('Preserved SEO routes continue functioning identically', async () => {
  const { baseUrl, authHeaders, close } = await createTestServer()
  try {
    const res = await fetch(`${baseUrl}/seo/overview`, { headers: authHeaders })
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.entitled, true)
    assert.equal(json.auditSource, 'marketsync_site_audit')
  } finally {
    await close()
  }
})
