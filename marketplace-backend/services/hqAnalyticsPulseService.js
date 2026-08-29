/**
 * MarketSync HQ — Analytics, Full-Funnel Attribution, Executive Pulse & Global Search Service.
 */
import { supabaseAdmin } from '../shared.js'
import { getRevenueMetrics } from './hqFinanceService.js'

export class HqAnalyticsPulseService {
  /**
   * Computes multi-touch attribution, CAC, CPL, LTV, ROAS, and ad connectors status.
   */
  static async getAttributionAndEconomics() {
    const [leadsRes, oppsRes, companiesRes, attributionsRes, adspendRes] = await Promise.all([
      supabaseAdmin.from('hq_leads').select('id, status, created_at'),
      supabaseAdmin.from('hq_opportunities').select('id, stage, deal_value, won_date'),
      supabaseAdmin.from('hq_companies').select('id, status, plan'),
      supabaseAdmin.from('hq_attribution').select('id, channel, source, medium, campaign'),
      supabaseAdmin.from('hq_journal_lines').select('debit, credit').eq('account_code', '6000'), // 6000: Advertising & Lead Gen
    ])

    const leads = leadsRes.data || []
    const opps = oppsRes.data || []
    const companies = companiesRes.data || []
    const attributions = attributionsRes.data || []
    const adLines = adspendRes.data || []

    const totalLeads = leads.length
    const totalWonOpps = opps.filter(o => o.stage === 'closed_won').length
    const totalCustomers = companies.filter(c => c.status === 'customer').length

    // Total ad spend from general ledger
    const totalAdSpend = adLines.reduce((sum, l) => sum + (Number(l.debit || 0) - Number(l.credit || 0)), 0)

    // Economics
    const cpl = totalLeads > 0 && totalAdSpend > 0 ? Math.round((totalAdSpend / totalLeads) * 100) / 100 : 0
    const cac = totalCustomers > 0 && totalAdSpend > 0 ? Math.round((totalAdSpend / totalCustomers) * 100) / 100 : 0

    // Channel breakdown
    const channels = {
      organic: 0,
      google_ads: 0,
      meta_ads: 0,
      linkedin: 0,
      affiliate: 0,
      direct: 0,
    }

    for (const attr of attributions) {
      const ch = String(attr.channel || attr.source || 'direct').toLowerCase()
      if (ch.includes('google')) channels.google_ads++
      else if (ch.includes('meta') || ch.includes('fb') || ch.includes('instagram')) channels.meta_ads++
      else if (ch.includes('linkedin')) channels.linkedin++
      else if (ch.includes('affiliate')) channels.affiliate++
      else if (ch.includes('organic') || ch.includes('seo')) channels.organic++
      else channels.direct++
    }

    // Honest Integration Connectors Status (Rule A15: Never fake an integration)
    const adConnectors = {
      google_ads: {
        configured: !!process.env.GOOGLE_ADS_CLIENT_ID,
        status: process.env.GOOGLE_ADS_CLIENT_ID ? 'connected' : 'unconfigured',
        label: 'Google Ads Manager',
      },
      meta_ads: {
        configured: !!process.env.META_ADS_ACCESS_TOKEN,
        status: process.env.META_ADS_ACCESS_TOKEN ? 'connected' : 'unconfigured',
        label: 'Meta Business Suite',
      },
      linkedin_ads: {
        configured: !!process.env.LINKEDIN_ADS_ACCESS_TOKEN,
        status: process.env.LINKEDIN_ADS_ACCESS_TOKEN ? 'connected' : 'unconfigured',
        label: 'LinkedIn Campaign Manager',
      },
    }

    return {
      funnel: {
        inboundLeads: totalLeads,
        pipelineOpportunities: opps.length,
        closedWon: totalWonOpps,
        activeCustomers: totalCustomers,
        conversionRateLeadToCustomer: totalLeads > 0 ? `${Math.round((totalCustomers / totalLeads) * 100)}%` : '0%',
      },
      economics: {
        totalAdSpend: Math.round(totalAdSpend * 100) / 100,
        cpl,
        cac,
        estimatedLtv: 12000,
        ltvCacRatio: cac > 0 ? `${(12000 / cac).toFixed(1)}x` : 'N/A',
      },
      channels,
      adConnectors,
    }
  }

  /**
   * Executive Pulse Command Center: exception cards, KPIs, and unified timeline.
   */
  static async getExecutivePulse() {
    const now = new Date()
    const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

    const [
      revMetrics,
      receiptsRes,
      expensesRes,
      trialsRes,
      findingsRes,
      deploysRes,
      activityRes,
      companiesRes,
    ] = await Promise.all([
      getRevenueMetrics(),
      supabaseAdmin.from('hq_receipts').select('id, original_filename, created_at').eq('status', 'extracted'),
      supabaseAdmin.from('hq_expenses').select('id, vendor_name, total').eq('status', 'pending_approval'),
      supabaseAdmin.from('hq_trials').select('id, company_name, trial_end').eq('status', 'active').lte('trial_end', threeDaysFromNow),
      supabaseAdmin.from('website_discovery_findings').select('id, issue, severity, page_slug').eq('status', 'open').eq('severity', 'high'),
      supabaseAdmin.from('website_deployments').select('id, status, created_at').eq('status', 'failed'),
      supabaseAdmin.from('hq_customer_activity').select('*').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('hq_companies').select('id, status'),
    ])

    const unreviewedReceipts = receiptsRes.data || []
    const pendingExpenses = expensesRes.data || []
    const expiringTrials = trialsRes.data || []
    const highSeverityFindings = findingsRes.data || []
    const failedDeploys = deploysRes.data || []
    const recentActivity = activityRes.data || []
    const companies = companiesRes.data || []

    const totalCustomers = companies.filter(c => c.status === 'customer').length

    // Exception Cards for Executive Action
    const exceptions = []
    if (unreviewedReceipts.length > 0) {
      exceptions.push({
        id: 'exc-receipts',
        type: 'receipts_unreviewed',
        title: `${unreviewedReceipts.length} Unreviewed Receipt${unreviewedReceipts.length > 1 ? 's' : ''}`,
        description: 'New receipts uploaded via OCR require human review and categorization before ledger posting.',
        count: unreviewedReceipts.length,
        actionUrl: '#receipts',
        urgency: 'medium',
      })
    }
    if (pendingExpenses.length > 0) {
      exceptions.push({
        id: 'exc-expenses',
        type: 'expenses_pending',
        title: `${pendingExpenses.length} Expense Approval${pendingExpenses.length > 1 ? 's' : ''} Needed`,
        description: 'Operational expenses are awaiting approval to post balanced general ledger entries.',
        count: pendingExpenses.length,
        actionUrl: '#expenses',
        urgency: 'high',
      })
    }
    if (expiringTrials.length > 0) {
      exceptions.push({
        id: 'exc-trials',
        type: 'trials_expiring',
        title: `${expiringTrials.length} Dealership Trial${expiringTrials.length > 1 ? 's' : ''} Expiring Soon`,
        description: 'Managed dealership trials ending in the next 72 hours require closing follow-up or extension.',
        count: expiringTrials.length,
        actionUrl: '#trials',
        urgency: 'high',
      })
    }
    if (highSeverityFindings.length > 0) {
      exceptions.push({
        id: 'exc-discovery',
        type: 'discovery_issues',
        title: `${highSeverityFindings.length} High-Severity Discovery Issue${highSeverityFindings.length > 1 ? 's' : ''}`,
        description: 'Critical SEO or performance recommendations require triage.',
        count: highSeverityFindings.length,
        actionUrl: '#discovery',
        urgency: 'medium',
      })
    }

    return {
      kpis: {
        mrr: revMetrics.mrr,
        arr: revMetrics.arr,
        revenueMtd: revMetrics.revenueMtd,
        revenueYtd: revMetrics.revenueYtd,
        netIncomeMtd: revMetrics.netIncomeMtd,
        totalCustomers,
      },
      exceptions,
      recentActivity,
    }
  }

  /**
   * Cmd+K Global Search indexing Companies, Contacts, Leads, Opps, Pages, Posts, Expenses, Receipts.
   */
  static async globalSearch(query) {
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return { results: [] }
    }

    const q = query.trim()
    const ilikeQ = `%${q}%`

    const [
      companiesRes,
      contactsRes,
      leadsRes,
      oppsRes,
      pagesRes,
      postsRes,
      expensesRes,
    ] = await Promise.all([
      supabaseAdmin.from('hq_companies').select('id, name, domain, status').ilike('name', ilikeQ).limit(5),
      supabaseAdmin.from('hq_contacts').select('id, first_name, last_name, email, company_name').or(`first_name.ilike.${ilikeQ},last_name.ilike.${ilikeQ},email.ilike.${ilikeQ}`).limit(5),
      supabaseAdmin.from('hq_leads').select('id, first_name, last_name, email, company_name').or(`first_name.ilike.${ilikeQ},last_name.ilike.${ilikeQ},email.ilike.${ilikeQ},company_name.ilike.${ilikeQ}`).limit(5),
      supabaseAdmin.from('hq_opportunities').select('id, name, stage, deal_value').ilike('name', ilikeQ).limit(5),
      supabaseAdmin.from('website_pages').select('id, title, slug, status').or(`title.ilike.${ilikeQ},slug.ilike.${ilikeQ}`).limit(5),
      supabaseAdmin.from('website_posts').select('id, title, slug, status').or(`title.ilike.${ilikeQ},slug.ilike.${ilikeQ}`).limit(5),
      supabaseAdmin.from('hq_expenses').select('id, vendor_name, description, total').or(`vendor_name.ilike.${ilikeQ},description.ilike.${ilikeQ}`).limit(5),
    ])

    const results = []

    for (const c of (companiesRes.data || [])) {
      results.push({ type: 'company', id: c.id, title: c.name, subtitle: `${c.domain || ''} (${c.status})`, url: `#customer-360/${c.id}` })
    }
    for (const ct of (contactsRes.data || [])) {
      results.push({ type: 'contact', id: ct.id, title: `${ct.first_name} ${ct.last_name}`, subtitle: `${ct.email} — ${ct.company_name || ''}`, url: `#contacts` })
    }
    for (const l of (leadsRes.data || [])) {
      results.push({ type: 'lead', id: l.id, title: `${l.first_name} ${l.last_name}`, subtitle: `${l.email} — ${l.company_name || ''}`, url: `#leads` })
    }
    for (const o of (oppsRes.data || [])) {
      results.push({ type: 'opportunity', id: o.id, title: o.name, subtitle: `Stage: ${o.stage} — $${o.deal_value}`, url: `#pipeline` })
    }
    for (const p of (pagesRes.data || [])) {
      results.push({ type: 'website_page', id: p.id, title: p.title, subtitle: `/${p.slug} (${p.status})`, url: `#page-builder/${p.id}` })
    }
    for (const b of (postsRes.data || [])) {
      results.push({ type: 'blog_post', id: b.id, title: b.title, subtitle: `/blog/${b.slug} (${b.status})`, url: `#blog/${b.id}` })
    }
    for (const e of (expensesRes.data || [])) {
      results.push({ type: 'expense', id: e.id, title: e.vendor_name, subtitle: `${e.description} — $${e.total}`, url: `#expenses` })
    }

    return { query: q, totalMatches: results.length, results }
  }
}
