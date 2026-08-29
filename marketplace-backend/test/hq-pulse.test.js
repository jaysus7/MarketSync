import test from 'node:test'
import assert from 'node:assert/strict'
import { HqAnalyticsPulseService } from '../services/hqAnalyticsPulseService.js'
import { supabaseAdmin } from '../shared.js'

test('Phase 13 & 14: Analytics, Attribution, Executive Pulse & Global Search', async () => {
  const store = {
    leads: [{ id: 'l-1', status: 'new', created_at: new Date().toISOString() }],
    opps: [{ id: 'o-1', stage: 'closed_won', deal_value: 1999, won_date: new Date().toISOString() }],
    companies: [{ id: 'c-1', name: 'Apex Motors', domain: 'apexmotors.com', status: 'customer', plan: 'dealer_os_pro' }],
    contacts: [{ id: 'ct-1', first_name: 'John', last_name: 'Apex', email: 'john@apexmotors.com', company_name: 'Apex Motors' }],
    attributions: [{ id: 'a-1', channel: 'google_ads', source: 'google', medium: 'cpc', campaign: 'dealeros_launch' }],
    journalLines: [{ account_code: '6000', debit: 500, credit: 0 }],
    receipts: [{ id: 'r-1', original_filename: 'receipt_tool.jpg', status: 'extracted' }],
    expenses: [{ id: 'e-1', vendor_name: 'Google LLC', description: 'Search Ads', total: 500, status: 'pending_approval' }],
    trials: [{ id: 't-1', company_name: 'Trial Auto', trial_end: new Date().toISOString().slice(0, 10), status: 'active' }],
    findings: [{ id: 'f-1', issue: 'Missing LCP Preload', severity: 'high', page_slug: 'index', status: 'open' }],
    pages: [{ id: 'p-1', title: 'Home Page', slug: 'index', status: 'published' }],
    posts: [{ id: 'b-1', title: 'Why DealerOS Wins', slug: 'why-dealeros-wins', status: 'published' }],
    activity: [{ id: 'act-1', event_type: 'lead_created', description: 'New lead received' }],
    subscriptions: [{ id: 's-1', plan: 'dealer_os_pro', amount: 1999, status: 'active' }],
    chart: [],
    journals: [],
  }

  const originalFrom = supabaseAdmin.from
  supabaseAdmin.from = (table) => {
    return {
      select: (cols) => ({
        eq: (col, val) => ({
          lte: () => ({
            then: (resolve) => {
              if (table === 'hq_trials') return resolve({ data: store.trials, error: null })
              return resolve({ data: [], error: null })
            },
          }),
          eq: (col2, val2) => ({
            then: (resolve) => {
              if (table === 'website_discovery_findings') return resolve({ data: store.findings, error: null })
              return resolve({ data: [], error: null })
            },
          }),
          then: (resolve) => {
            if (table === 'hq_receipts') return resolve({ data: store.receipts, error: null })
            if (table === 'hq_expenses') return resolve({ data: store.expenses, error: null })
            if (table === 'hq_journal_lines') return resolve({ data: store.journalLines, error: null })
            if (table === 'website_deployments') return resolve({ data: [], error: null })
            return resolve({ data: [], error: null })
          },
        }),
        ilike: (col, val) => ({
          limit: (n) => ({
            then: (resolve) => {
              if (table === 'hq_companies') return resolve({ data: store.companies, error: null })
              if (table === 'hq_opportunities') return resolve({ data: store.opps, error: null })
              return resolve({ data: [], error: null })
            },
          }),
        }),
        or: (pattern) => ({
          limit: (n) => ({
            then: (resolve) => {
              if (table === 'hq_contacts') return resolve({ data: store.contacts, error: null })
              if (table === 'hq_leads') return resolve({ data: store.leads, error: null })
              if (table === 'website_pages') return resolve({ data: store.pages, error: null })
              if (table === 'website_posts') return resolve({ data: store.posts, error: null })
              if (table === 'hq_expenses') return resolve({ data: store.expenses, error: null })
              return resolve({ data: [], error: null })
            },
          }),
        }),
        order: () => ({
          limit: () => ({
            then: (resolve) => resolve({ data: store.activity, error: null }),
          }),
        }),
        then: (resolve) => {
          if (table === 'hq_leads') return resolve({ data: store.leads, error: null })
          if (table === 'hq_opportunities') return resolve({ data: store.opps, error: null })
          if (table === 'hq_companies') return resolve({ data: store.companies, error: null })
          if (table === 'hq_attribution') return resolve({ data: store.attributions, error: null })
          if (table === 'subscriptions') return resolve({ data: store.subscriptions, error: null })
          if (table === 'hq_journal_entries') return resolve({ data: [], error: null })
          if (table === 'hq_expenses') return resolve({ data: store.expenses, error: null })
          return resolve({ data: [], error: null })
        },
      }),
    }
  }

  try {
    // 1. Attribution & Economics Check
    const analytics = await HqAnalyticsPulseService.getAttributionAndEconomics()
    assert.equal(analytics.funnel.inboundLeads, 1)
    assert.equal(analytics.funnel.closedWon, 1)
    assert.equal(analytics.funnel.activeCustomers, 1)
    assert.equal(analytics.economics.totalAdSpend, 500)
    assert.equal(analytics.economics.cpl, 500)
    assert.equal(analytics.economics.cac, 500)
    assert.equal(analytics.channels.google_ads, 1)
    assert.equal(analytics.adConnectors.google_ads.status, 'unconfigured') // Honest integration status

    // 2. Executive Pulse Exceptions Check
    const pulse = await HqAnalyticsPulseService.getExecutivePulse()
    assert.equal(pulse.kpis.totalCustomers, 1)
    assert.ok(pulse.exceptions.length >= 3, 'Must generate exception cards for unreviewed receipts, pending expenses, expiring trials')
    const receiptExc = pulse.exceptions.find(e => e.type === 'receipts_unreviewed')
    assert.ok(receiptExc)
    assert.equal(receiptExc.count, 1)

    // 3. Cmd+K Global Search
    const search = await HqAnalyticsPulseService.globalSearch('Apex')
    assert.ok(search.results.length > 0)
    assert.ok(search.results.some(r => r.type === 'company' && r.title === 'Apex Motors'))
    assert.ok(search.results.some(r => r.type === 'contact' && r.title === 'John Apex'))
  } finally {
    supabaseAdmin.from = originalFrom
  }
})
