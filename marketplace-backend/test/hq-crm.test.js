import test from 'node:test'
import assert from 'node:assert/strict'
import { ingestLead } from '../services/hqCrmService.js'
import { supabaseAdmin } from '../shared.js'

test('Phase 2 Customer Foundation: Ingestion pipeline creates Lead, Contact, Company, Attribution & Timeline', async () => {
  // Mock supabaseAdmin methods for isolated deterministic behavioral verification
  const originalFrom = supabaseAdmin.from

  const createdEntities = {
    companies: [],
    contacts: [],
    leads: [],
    consent: [],
    activity: [],
    audit: [],
  }

  supabaseAdmin.from = (table) => {
    return {
      select: (cols) => ({
        eq: (col, val) => ({
          maybeSingle: async () => {
            if (table === 'hq_companies') {
              return { data: createdEntities.companies.find(c => c[col] === val) || null }
            }
            if (table === 'hq_contacts') {
              return { data: createdEntities.contacts.find(c => c[col] === val) || null }
            }
            return { data: null }
          },
          single: async () => ({ data: null }),
        }),
        ilike: (col, val) => ({
          maybeSingle: async () => {
            if (table === 'hq_companies') {
              return { data: createdEntities.companies.find(c => c.name?.toLowerCase() === val?.toLowerCase()) || null }
            }
            return { data: null }
          },
        }),
        order: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
      insert: (payload) => ({
        select: () => ({
          single: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, ...payload }
            if (table === 'hq_companies') createdEntities.companies.push(row)
            if (table === 'hq_contacts') createdEntities.contacts.push(row)
            if (table === 'hq_leads') createdEntities.leads.push(row)
            if (table === 'hq_consent_records') createdEntities.consent.push(row)
            if (table === 'hq_customer_activity') createdEntities.activity.push(row)
            if (table === 'hq_audit_log') createdEntities.audit.push(row)
            return { data: row, error: null }
          },
          maybeSingle: async () => {
            const row = { id: `mock-${table}-${Date.now()}-${Math.random()}`, ...payload }
            if (table === 'hq_companies') createdEntities.companies.push(row)
            if (table === 'hq_contacts') createdEntities.contacts.push(row)
            if (table === 'hq_leads') createdEntities.leads.push(row)
            if (table === 'hq_consent_records') createdEntities.consent.push(row)
            if (table === 'hq_customer_activity') createdEntities.activity.push(row)
            if (table === 'hq_audit_log') createdEntities.audit.push(row)
            return { data: row, error: null }
          },
        }),
      }),
      update: (payload) => ({
        eq: (col, val) => ({
          select: () => ({
            single: async () => ({ data: { id: val, ...payload }, error: null }),
          }),
        }),
      }),
    }
  }

  try {
    // Execute Inbound Lead Ingestion (e.g. from Demo form)
    const result = await ingestLead({
      name: 'Sarah Connor',
      email: 'sarah@skylineauto.com',
      phone: '555-0199',
      dealershipName: 'Skyline Automotive Group',
      plan: 'dealer_os_pro',
      message: 'Looking to replace our legacy CRM and inventory system.',
      channel: 'website_demo',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'dealer_os_q3',
      gclid: 'gclid_test_12345',
      affiliateId: 'aff_partner_99',
      consentGiven: true,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test Agent',
    })

    // 1. Verify Lead was created with full attribution
    assert.ok(result.success, 'Ingestion must return success')
    assert.ok(result.lead, 'Lead record must be created')
    assert.equal(result.lead.status, 'new')
    assert.equal(result.lead.utm_source, 'google')
    assert.equal(result.lead.utm_campaign, 'dealer_os_q3')
    assert.equal(result.lead.gclid, 'gclid_test_12345')
    assert.equal(result.lead.affiliate_id, 'aff_partner_99')

    // 2. Verify Contact was created & identity linked
    assert.ok(result.contactId, 'Contact ID must be assigned')
    const contact = createdEntities.contacts.find(c => c.email === 'sarah@skylineauto.com')
    assert.ok(contact, 'Contact row must exist with exact email')
    assert.equal(contact.first_name, 'Sarah')
    assert.equal(contact.last_name, 'Connor')
    assert.equal(contact.phone, '555-0199')

    // 3. Verify Company was created from domain / dealership name
    assert.ok(result.companyId, 'Company ID must be assigned')
    const company = createdEntities.companies.find(c => c.name === 'Skyline Automotive Group')
    assert.ok(company, 'Company row must exist')
    assert.equal(company.domain, 'skylineauto.com')

    // 4. Verify Evidence-Based Consent was recorded
    assert.ok(result.consent, 'Consent record must be generated')
    assert.equal(result.consent.email, 'sarah@skylineauto.com')
    assert.equal(result.consent.policy_version, '2026-v1')
    assert.equal(result.consent.ip_address, '192.168.1.1')

    // 5. Verify Activity Timeline event was posted
    assert.ok(result.activity, 'Customer activity event must be recorded')
    assert.equal(result.activity.event_type, 'lead_captured')
    assert.match(result.activity.description, /Sarah Connor/)
    assert.equal(result.activity.metadata.gclid, 'gclid_test_12345')

    // 6. Verify Audit Log entry was recorded
    const audit = createdEntities.audit.find(a => a.entity_type === 'hq_lead')
    assert.ok(audit, 'Audit log entry must be present')
    assert.equal(audit.action, 'lead_ingested')
  } finally {
    supabaseAdmin.from = originalFrom
  }
})
