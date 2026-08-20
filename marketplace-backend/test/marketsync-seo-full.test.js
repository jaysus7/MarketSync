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
            data: { id: 'usr-test', dealership_id: 'dlr-test-seo', role: 'DEALER_ADMIN', active: true, billing_status: 'ACTIVE' },
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
            data: { id: 'dlr-test-seo', name: 'Test Dealership', seo_active: true, billing_status: 'ACTIVE', products: { marketsync_seo: true } },
            error: null
          }),
          maybeSingle: async () => ({
            data: { id: 'dlr-test-seo', name: 'Test Dealership', seo_active: true, billing_status: 'ACTIVE', products: { marketsync_seo: true } },
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

test('SEO Overview endpoint returns entitled status and health metrics', async () => {
  const ts = await createTestServer()
  try {
    const res = await fetch(`${ts.baseUrl}/seo/overview`, { headers: ts.authHeaders })
    const data = await res.json()
    assert.equal(res.status, 200)
    assert.equal(data.entitled, true)
    assert.ok(data.healthScore === null || typeof data.healthScore === 'number')
    assert.equal(data.standardsVersion, 'MarketSync SEO Standards — 2026')
  } finally {
    await ts.close()
  }
})

test('SEO Settings GET & PUT endpoint stores and retrieves settings', async () => {
  const ts = await createTestServer()
  try {
    const getRes = await fetch(`${ts.baseUrl}/seo/settings`, { headers: ts.authHeaders })
    const getData = await getRes.json()
    assert.equal(getRes.status, 200)
    assert.equal(getData.settings.mode, 'easy')
    assert.equal(typeof getData.settings.site_name, 'string')

    const putRes = await fetch(`${ts.baseUrl}/seo/settings`, {
      method: 'PUT',
      headers: ts.authHeaders,
      body: JSON.stringify({
        mode: 'advanced',
        canonical_domain: 'https://premierchevy.com',
        enforce_https: true,
        robots_mode: 'recommended'
      })
    })
    const putData = await putRes.json()

    assert.equal(putRes.status, 200)
    assert.equal(putData.success, true)
    assert.equal(putData.settings.mode, 'advanced')
    assert.equal(putData.settings.canonical_domain, 'https://premierchevy.com')

    const getUpdatedRes = await fetch(`${ts.baseUrl}/seo/settings`, { headers: ts.authHeaders })
    const getUpdatedData = await getUpdatedRes.json()
    assert.equal(getUpdatedData.settings.canonical_domain, 'https://premierchevy.com')
  } finally {
    await ts.close()
  }
})

test('Redirect Manager POST, GET, and DELETE operations', async () => {
  const ts = await createTestServer()
  try {
    const listRes1 = await fetch(`${ts.baseUrl}/seo/redirects`, { headers: ts.authHeaders })
    const listData1 = await listRes1.json()
    assert.equal(listRes1.status, 200)
    assert.ok(Array.isArray(listData1.redirects))

    const createRes = await fetch(`${ts.baseUrl}/seo/redirects`, {
      method: 'POST',
      headers: ts.authHeaders,
      body: JSON.stringify({
        source: '/old-silverado-promo',
        target: '/inventory?model=Silverado',
        type: 301,
        reason: 'Campaign Redirect'
      })
    })
    const createData = await createRes.json()
    assert.equal(createRes.status, 200)
    assert.equal(createData.success, true)
    assert.equal(createData.redirect.source, '/old-silverado-promo')

    const listRes2 = await fetch(`${ts.baseUrl}/seo/redirects`, { headers: ts.authHeaders })
    const listData2 = await listRes2.json()
    assert.ok(listData2.redirects.some(r => r.source === '/old-silverado-promo'))

    const deleteRes = await fetch(`${ts.baseUrl}/seo/redirects`, {
      method: 'DELETE',
      headers: ts.authHeaders,
      body: JSON.stringify({ id: createData.redirect.id })
    })
    const deleteData = await deleteRes.json()
    assert.equal(deleteRes.status, 200)
    assert.equal(deleteData.success, true)
  } finally {
    await ts.close()
  }
})

test('404 Log Monitor resolve with target redirect creation', async () => {
  const ts = await createTestServer()
  try {
    const logsRes = await fetch(`${ts.baseUrl}/seo/404-logs`, { headers: ts.authHeaders })
    const logsData = await logsRes.json()
    assert.equal(logsRes.status, 200)
    assert.ok(Array.isArray(logsData.logs))

    const resolveRes = await fetch(`${ts.baseUrl}/seo/404-logs/resolve`, {
      method: 'POST',
      headers: ts.authHeaders,
      body: JSON.stringify({
        id: '404-1',
        action: 'create_redirect',
        targetUrl: '/inventory?body_style=Truck'
      })
    })
    const resolveData = await resolveRes.json()
    assert.equal(resolveRes.status, 200)
    assert.equal(resolveData.success, true)

    const redirectsRes = await fetch(`${ts.baseUrl}/seo/redirects`, { headers: ts.authHeaders })
    const redirectsData = await redirectsRes.json()
    assert.ok(redirectsData.redirects.some(r => r.target === '/inventory?body_style=Truck'))
  } finally {
    await ts.close()
  }
})

test('Public generated endpoints /robots.txt, /sitemap.xml, /llms.txt', async () => {
  const ts = await createTestServer()
  try {
    const robotsRes = await fetch(`${ts.baseUrl}/robots.txt`)
    const robotsText = await robotsRes.text()
    assert.equal(robotsRes.status, 200)
    assert.ok(robotsText.includes('User-agent: *'))
    assert.ok(robotsText.includes('Sitemap: https://marketsync.link/sitemap.xml'))

    const sitemapRes = await fetch(`${ts.baseUrl}/sitemap.xml`)
    const sitemapText = await sitemapRes.text()
    assert.equal(sitemapRes.status, 200)
    assert.ok(sitemapText.includes('<sitemapindex'))
    assert.ok(sitemapText.includes('/sitemap-inventory.xml'))

    const llmsRes = await fetch(`${ts.baseUrl}/llms.txt`)
    const llmsText = await llmsRes.text()
    assert.equal(llmsRes.status, 200)
    assert.ok(llmsText.includes('AI Discovery Specification'))
  } finally {
    await ts.close()
  }
})

test('SEO Frontend Suite: setSeoMainTab and all SEO tabs are defined and exposed on window', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const part17Path = path.resolve(process.cwd(), '../marketplace-frontend/js/modules/dashboard-part17.js')
  const code = fs.readFileSync(part17Path, 'utf8')

  // 1. setSeoMainTab definition and intentional window attachment
  assert.ok(code.includes('function setSeoMainTab(tab)'), 'setSeoMainTab must be declared as a function')
  assert.ok(code.includes('window.setSeoMainTab = setSeoMainTab'), 'setSeoMainTab must be explicitly attached to window')
  assert.ok(code.includes('setSeoMainTab,') || code.includes('setSeoMainTab\n'), 'setSeoMainTab must be exposed via Object.assign(window)')

  // 2. Centralized __seoMainTab state without duplicate declarations
  const mainTabMatches = code.match(/let\s+__seoMainTab/g) || []
  assert.equal(mainTabMatches.length, 1, 'let __seoMainTab must only be declared once in top-level state')

  // 3. All required tabs are registered in navigation and handled in renderSeoMainBody
  const requiredTabs = ['overview', 'settings', 'content', 'technical', 'redirects', 'analytics', 'competitors']
  for (const tab of requiredTabs) {
    assert.ok(
      code.includes(`navTab('${tab}'`) ||
      code.includes(`setSeoMainTab('${tab}')`) ||
      code.includes(`__seoMainTab === '${tab}'`),
      `Tab "${tab}" must be wired in SEO workspace`
    )
  }

  // 4. View functions for all main tabs exist
  const expectedViews = [
    'renderSeoOverviewView',
    'renderSeoSettingsWorkspace',
    'renderSeoContentView',
    'renderSeoTechnicalView',
    'renderSeoRedirectsView',
    'renderSeoAnalyticsView',
    'renderSeoCompetitorsView',
    'renderSeoAutopilotView',
    'renderSeoHistoryView'
  ]
  for (const fn of expectedViews) {
    assert.ok(code.includes(`function ${fn}`), `View function ${fn} must be defined in dashboard-part17.js`)
  }
})

