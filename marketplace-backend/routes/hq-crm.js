/**
 * MarketSync HQ — Customer CRM & Attribution API Routes.
 */
import { supabaseAdmin, isEmailLike } from '../shared.js'
import { requireHqAuth, requireHqPermission } from '../hq-auth.js'
import { logHqAudit } from '../hq-audit.js'
import { ingestLead } from '../services/hqCrmService.js'

export function registerHqCrm(app) {
  // ── 1. Canonical Inbound Lead Ingestion Gateway ──
  app.post('/hq/crm/leads/ingest', async (req, res) => {
    try {
      const result = await ingestLead({
        name: req.body?.name,
        email: req.body?.email,
        phone: req.body?.phone,
        dealershipName: req.body?.dealership_name || req.body?.dealershipName,
        companyName: req.body?.company_name || req.body?.companyName,
        jobTitle: req.body?.job_title || req.body?.jobTitle,
        plan: req.body?.plan,
        message: req.body?.message,
        notes: req.body?.notes,
        channel: req.body?.channel || 'api',
        firstTouchSource: req.body?.first_touch_source || req.body?.firstTouchSource,
        lastTouchSource: req.body?.last_touch_source || req.body?.lastTouchSource,
        campaignId: req.body?.campaign_id || req.body?.campaignId,
        campaignName: req.body?.campaign_name || req.body?.campaignName,
        adGroup: req.body?.ad_group || req.body?.adGroup,
        adId: req.body?.ad_id || req.body?.adId,
        keyword: req.body?.keyword,
        landingPage: req.body?.landing_page || req.body?.landingPage,
        referrer: req.body?.referrer,
        gclid: req.body?.gclid,
        fbclid: req.body?.fbclid,
        wbraid: req.body?.wbraid,
        utmSource: req.body?.utm_source || req.body?.utmSource,
        utmMedium: req.body?.utm_medium || req.body?.utmMedium,
        utmCampaign: req.body?.utm_campaign || req.body?.utmCampaign,
        utmContent: req.body?.utm_content || req.body?.utmContent,
        utmTerm: req.body?.utm_term || req.body?.utmTerm,
        affiliateId: req.body?.affiliate_id || req.body?.affiliateId,
        estimatedValue: req.body?.estimated_value || req.body?.estimatedValue,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
        consentGiven: req.body?.consent !== false,
        consentPurpose: req.body?.consent_purpose || 'sales_inquiry',
        sourceRecord: req.body?.source_record || 'api_ingest',
        externalEventId: req.body?.external_event_id || null,
        rawPayload: req.body || {},
      })
      res.status(201).json(result)
    } catch (err) {
      console.error('[hq-crm] Ingest endpoint error:', err.message)
      res.status(400).json({ error: err.message || 'Failed to ingest lead' })
    }
  })

  // ── 2. CRM Command Center Overview ──
  app.get('/hq/crm/overview', requireHqAuth, async (req, res) => {
    try {
      const [leadsRes, oppsRes, trialsRes, companiesRes] = await Promise.all([
        supabaseAdmin.from('hq_leads').select('id, status, created_at, estimated_value').order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.from('hq_opportunities').select('id, stage, expected_value, mrr_value, probability'),
        supabaseAdmin.from('hq_trials').select('id, status, started_at, ends_at'),
        supabaseAdmin.from('hq_companies').select('id, status, is_dealer_group, locations_count'),
      ])

      const leads = leadsRes.data || []
      const opps = oppsRes.data || []
      const trials = trialsRes.data || []
      const companies = companiesRes.data || []

      const totalLeads = leads.length
      const newLeads = leads.filter(l => l.status === 'new').length
      const activeTrials = trials.filter(t => t.status === 'active').length
      const totalPipelineValue = opps.reduce((sum, o) => sum + (Number(o.expected_value) || 0), 0)
      const totalPipelineMrr = opps.reduce((sum, o) => sum + (Number(o.mrr_value) || 0), 0)
      const wonOpps = opps.filter(o => o.stage === 'won').length
      const totalCustomers = companies.filter(c => c.status === 'customer').length

      res.json({
        totalLeads,
        newLeads,
        activeTrials,
        totalPipelineValue,
        totalPipelineMrr,
        wonOpps,
        totalCustomers,
        recentLeads: leads.slice(0, 10),
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 3. Leads Management ──
  app.get('/hq/crm/leads', requireHqAuth, async (req, res) => {
    try {
      const { status, channel, limit = 50, offset = 0 } = req.query
      let query = supabaseAdmin
        .from('hq_leads')
        .select('*, hq_contacts(*), hq_companies(*)')
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1)

      if (status) query = query.eq('status', status)
      if (channel) query = query.eq('channel', channel)

      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.patch('/hq/crm/leads/:id', requireHqAuth, async (req, res) => {
    try {
      const { id } = req.params
      const updates = { ...req.body, updated_at: new Date().toISOString() }
      const { data, error } = await supabaseAdmin.from('hq_leads').update(updates).eq('id', id).select('*').single()
      if (error) throw error

      await logHqAudit({
        entityType: 'hq_lead',
        entityId: id,
        action: 'lead_updated',
        afterState: data,
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
      })

      res.json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 4. Contacts Management ──
  app.get('/hq/crm/contacts', requireHqAuth, async (req, res) => {
    try {
      const { search, company_id, limit = 50, offset = 0 } = req.query
      let query = supabaseAdmin
        .from('hq_contacts')
        .select('*, hq_companies(id, name, domain, status)')
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1)

      if (company_id) query = query.eq('company_id', company_id)
      if (search) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/crm/contacts', requireHqAuth, async (req, res) => {
    try {
      const { first_name, last_name, email, phone, job_title, company_id, notes } = req.body
      if (!email || !first_name) return res.status(400).json({ error: 'first_name and email are required' })

      const { data, error } = await supabaseAdmin
        .from('hq_contacts')
        .insert({ first_name, last_name: last_name || '', email: email.toLowerCase().trim(), phone, job_title, company_id, notes })
        .select('*')
        .single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 5. Companies & Dealer Groups ──
  app.get('/hq/crm/companies', requireHqAuth, async (req, res) => {
    try {
      const { status, is_dealer_group, search, limit = 50, offset = 0 } = req.query
      let query = supabaseAdmin
        .from('hq_companies')
        .select('*, parent_group:dealer_group_id(id, name)')
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1)

      if (status) query = query.eq('status', status)
      if (is_dealer_group !== undefined) query = query.eq('is_dealer_group', is_dealer_group === 'true')
      if (search) query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%`)

      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/crm/companies', requireHqAuth, async (req, res) => {
    try {
      const { name, domain, website, dealer_group_id, is_dealer_group, address, phone, tier } = req.body
      if (!name) return res.status(400).json({ error: 'Company name is required' })

      const { data, error } = await supabaseAdmin
        .from('hq_companies')
        .insert({
          name: name.trim(),
          domain: domain ? domain.toLowerCase().trim() : null,
          website,
          dealer_group_id: dealer_group_id || null,
          is_dealer_group: !!is_dealer_group,
          address,
          phone,
          tier: tier || 'standard',
        })
        .select('*')
        .single()

      if (error) throw error
      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 6. Opportunities (Sales Pipeline) ──
  app.get('/hq/crm/opportunities', requireHqAuth, async (req, res) => {
    try {
      const { stage, company_id } = req.query
      let query = supabaseAdmin
        .from('hq_opportunities')
        .select('*, hq_companies(id, name, domain), hq_contacts(id, first_name, last_name, email)')
        .order('created_at', { ascending: false })

      if (stage) query = query.eq('stage', stage)
      if (company_id) query = query.eq('company_id', company_id)

      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/hq/crm/opportunities', requireHqAuth, async (req, res) => {
    try {
      const { company_id, contact_id, name, product, plan, expected_value, mrr_value, probability, stage, expected_close_date } = req.body
      if (!company_id || !name || !product) return res.status(400).json({ error: 'company_id, name, and product are required' })

      const { data, error } = await supabaseAdmin
        .from('hq_opportunities')
        .insert({
          company_id,
          contact_id: contact_id || null,
          name,
          product,
          plan,
          expected_value: Number(expected_value) || 0,
          mrr_value: Number(mrr_value) || 0,
          probability: Number(probability) || 50,
          stage: stage || 'discovery',
          expected_close_date: expected_close_date || null,
          owner_id: req.user?.id || null,
        })
        .select('*')
        .single()

      if (error) throw error

      await logHqAudit({
        entityType: 'hq_opportunity',
        entityId: data.id,
        action: 'opportunity_created',
        afterState: data,
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
      })

      res.status(201).json(data)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── 7. Customer 360 Full Profile ──
  app.get('/hq/crm/customer-360/:id', requireHqAuth, async (req, res) => {
    try {
      const { id } = req.params
      const [companyRes, contactsRes, leadsRes, oppsRes, trialsRes, activityRes] = await Promise.all([
        supabaseAdmin.from('hq_companies').select('*').eq('id', id).maybeSingle(),
        supabaseAdmin.from('hq_contacts').select('*').eq('company_id', id),
        supabaseAdmin.from('hq_leads').select('*').eq('company_id', id).order('created_at', { ascending: false }),
        supabaseAdmin.from('hq_opportunities').select('*').eq('company_id', id).order('created_at', { ascending: false }),
        supabaseAdmin.from('hq_trials').select('*').eq('company_id', id).order('created_at', { ascending: false }),
        supabaseAdmin.from('hq_customer_activity').select('*').eq('company_id', id).order('created_at', { ascending: false }).limit(100),
      ])

      if (!companyRes.data) {
        return res.status(404).json({ error: 'Company not found' })
      }

      res.json({
        company: companyRes.data,
        contacts: contactsRes.data || [],
        leads: leadsRes.data || [],
        opportunities: oppsRes.data || [],
        trials: trialsRes.data || [],
        activities: activityRes.data || [],
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 8. Customer Merging & Deduplication (History-Preserving) ──
  app.post('/hq/crm/merge', requireHqAuth, async (req, res) => {
    try {
      const { primary_company_id, secondary_company_id, reason } = req.body
      if (!primary_company_id || !secondary_company_id || primary_company_id === secondary_company_id) {
        return res.status(400).json({ error: 'Valid primary_company_id and secondary_company_id are required' })
      }

      // Move contacts, leads, opportunities, trials, activities
      await Promise.all([
        supabaseAdmin.from('hq_contacts').update({ company_id: primary_company_id }).eq('company_id', secondary_company_id),
        supabaseAdmin.from('hq_leads').update({ company_id: primary_company_id }).eq('company_id', secondary_company_id),
        supabaseAdmin.from('hq_opportunities').update({ company_id: primary_company_id }).eq('company_id', secondary_company_id),
        supabaseAdmin.from('hq_trials').update({ company_id: primary_company_id }).eq('company_id', secondary_company_id),
        supabaseAdmin.from('hq_customer_activity').update({ company_id: primary_company_id }).eq('company_id', secondary_company_id),
      ])

      // Archive secondary company record with merge metadata
      const { data: secondary } = await supabaseAdmin.from('hq_companies').select('*').eq('id', secondary_company_id).maybeSingle()
      await supabaseAdmin.from('hq_companies').update({
        status: 'churned',
        metadata: { merged_into: primary_company_id, merged_at: new Date().toISOString(), reason },
      }).eq('id', secondary_company_id)

      await logHqAudit({
        entityType: 'hq_company',
        entityId: primary_company_id,
        action: 'company_merged',
        beforeState: { merged_from: secondary_company_id },
        afterState: { primary_company_id },
        actorId: req.user?.id,
        actorName: req.profile?.full_name || 'HQ Operator',
        reason: reason || 'Customer deduplication merge',
      })

      res.json({ success: true, primary_company_id, secondary_company_id })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── 9. Evidence-Based Consent Records ──
  app.get('/hq/crm/consent', requireHqAuth, async (req, res) => {
    try {
      const { email, limit = 50 } = req.query
      let query = supabaseAdmin.from('hq_consent_records').select('*').order('consented_at', { ascending: false }).limit(Number(limit))
      if (email) query = query.eq('email', email.toLowerCase().trim())
      const { data, error } = await query
      if (error) throw error
      res.json(data || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
