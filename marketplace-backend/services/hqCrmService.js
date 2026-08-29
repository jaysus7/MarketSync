/**
 * MarketSync HQ — Customer CRM & Multi-Channel Ingestion Service.
 *
 * Governing architecture:
 * Ingestion (All Inbound Forms, Chatbot, Ads, Trials, Imports)
 *   ↓
 * Identity Matching & Deduplication
 *   ↓
 * Contact ↔ Company Match/Create (Dealer Group Hierarchy support)
 *   ↓
 * Multi-Touch Attribution Capture (gclid, fbclid, wbraid, UTMs, Affiliate)
 *   ↓
 * Evidence-Based Consent Recording
 *   ↓
 * Canonical Customer Activity Timeline Logging
 */
import { supabaseAdmin, isEmailLike } from '../shared.js'
import { logHqAudit } from '../hq-audit.js'

function extractDomain(emailOrUrl) {
  if (!emailOrUrl) return null
  const str = String(emailOrUrl).trim().toLowerCase()
  if (str.includes('@')) {
    const domain = str.split('@')[1]
    // Filter out common consumer webmail domains so we don't group Gmail/Yahoo users into one company
    const freeDomains = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com'])
    return freeDomains.has(domain) ? null : domain
  }
  try {
    const url = str.startsWith('http') ? str : `https://${str}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export async function ingestLead({
  name,
  email,
  phone = null,
  dealershipName = null,
  companyName = null,
  jobTitle = null,
  plan = null,
  message = null,
  notes = null,
  channel = 'website',
  firstTouchSource = null,
  lastTouchSource = null,
  campaignId = null,
  campaignName = null,
  adGroup = null,
  adId = null,
  keyword = null,
  landingPage = null,
  referrer = null,
  gclid = null,
  fbclid = null,
  wbraid = null,
  utmSource = null,
  utmMedium = null,
  utmCampaign = null,
  utmContent = null,
  utmTerm = null,
  affiliateId = null,
  estimatedValue = 0,
  ipAddress = null,
  userAgent = null,
  consentGiven = true,
  consentPurpose = 'sales_inquiry',
  sourceRecord = 'website_form',
  externalEventId = null,
  rawPayload = {},
}) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail || !isEmailLike(cleanEmail)) {
    throw new Error('A valid email address is required for lead ingestion')
  }

  const cleanName = String(name || '').trim() || 'Lead'
  const nameParts = cleanName.split(' ')
  const firstName = nameParts[0] || 'Lead'
  const lastName = nameParts.slice(1).join(' ') || ''
  const effectiveCompanyName = String(dealershipName || companyName || '').trim() || null
  const corporateDomain = extractDomain(cleanEmail) || extractDomain(effectiveCompanyName)

  // 1. Resolve or Match Company
  let companyId = null
  if (corporateDomain || effectiveCompanyName) {
    let companyQuery = supabaseAdmin.from('hq_companies').select('id, name, domain, status')
    if (corporateDomain) {
      companyQuery = companyQuery.eq('domain', corporateDomain)
    } else {
      companyQuery = companyQuery.ilike('name', effectiveCompanyName)
    }
    const { data: existingCompany } = await companyQuery.maybeSingle()

    if (existingCompany?.id) {
      companyId = existingCompany.id
    } else if (effectiveCompanyName) {
      const { data: newCompany, error: compErr } = await supabaseAdmin.from('hq_companies').insert({
        name: effectiveCompanyName,
        domain: corporateDomain,
        status: 'lead',
        metadata: { source: channel, utm_campaign: utmCampaign || campaignName },
      }).select('id').single()

      if (!compErr && newCompany) {
        companyId = newCompany.id
      }
    }
  }

  // 2. Resolve or Match Contact (Identity Matching & Deduplication)
  let contactId = null
  const { data: existingContact } = await supabaseAdmin
    .from('hq_contacts')
    .select('id, company_id, phone, job_title, lifecycle_stage')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (existingContact?.id) {
    contactId = existingContact.id
    // Update company link if contact was unlinked and we found one
    if (!existingContact.company_id && companyId) {
      await supabaseAdmin.from('hq_contacts').update({ company_id: companyId }).eq('id', contactId)
    }
    if (!existingContact.phone && phone) {
      await supabaseAdmin.from('hq_contacts').update({ phone }).eq('id', contactId)
    }
  } else {
    const { data: newContact, error: contErr } = await supabaseAdmin.from('hq_contacts').insert({
      first_name: firstName,
      last_name: lastName,
      email: cleanEmail,
      phone: phone || null,
      job_title: jobTitle || null,
      company_id: companyId || null,
      lifecycle_stage: 'lead',
      status: 'active',
      notes: notes || message || null,
    }).select('id').single()

    if (contErr) {
      console.warn('[hq-crm] Error inserting contact:', contErr.message)
    }
    contactId = newContact?.id || null
  }

  // 3. Create Canonical Lead Record with Full Attribution Touchpoints
  const effectiveSource = utmSource || lastTouchSource || firstTouchSource || channel || 'direct'
  const leadPayload = {
    contact_id: contactId,
    company_id: companyId,
    status: 'new',
    channel: channel || 'website',
    first_touch_source: firstTouchSource || effectiveSource,
    last_touch_source: lastTouchSource || effectiveSource,
    campaign_id: campaignId ? String(campaignId) : null,
    campaign_name: campaignName || utmCampaign || null,
    ad_group: adGroup || null,
    ad_id: adId ? String(adId) : null,
    keyword: keyword || utmTerm || null,
    landing_page: landingPage || null,
    referrer: referrer || null,
    gclid: gclid || null,
    fbclid: fbclid || null,
    wbraid: wbraid || null,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    utm_content: utmContent || null,
    utm_term: utmTerm || null,
    affiliate_id: affiliateId || null,
    estimated_value: Number(estimatedValue) || 0,
    notes: [message, notes, plan ? `Plan Interest: ${plan}` : null].filter(Boolean).join('\n') || null,
    raw_payload: { ...rawPayload, external_event_id: externalEventId, ingested_at: new Date().toISOString() },
  }

  const { data: leadRecord, error: leadErr } = await supabaseAdmin
    .from('hq_leads')
    .insert(leadPayload)
    .select('*')
    .single()

  if (leadErr) {
    console.error('[hq-crm] Lead insertion failed:', leadErr.message)
    throw new Error(`Lead ingestion failed: ${leadErr.message}`)
  }

  // 4. Evidence-Based Consent Recording
  let consentRecord = null
  if (contactId && consentGiven) {
    const { data: consent, error: consentErr } = await supabaseAdmin.from('hq_consent_records').insert({
      contact_id: contactId,
      email: cleanEmail,
      channel: 'all',
      purpose: consentPurpose || 'sales_inquiry',
      source_record: `hq_leads:${leadRecord.id}`,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      policy_version: '2026-v1',
      is_valid: true,
    }).select('*').maybeSingle()

    if (!consentErr) consentRecord = consent
  }

  // 5. Customer Activity Timeline Event
  let activityRecord = null
  const activityDescription = [
    cleanName,
    effectiveCompanyName ? `from ${effectiveCompanyName}` : '',
    plan ? `interested in ${plan}` : '',
    message ? `— "${message.slice(0, 100)}..."` : '',
  ].filter(Boolean).join(' ')

  const { data: activity, error: actErr } = await supabaseAdmin.from('hq_customer_activity').insert({
    company_id: companyId,
    contact_id: contactId,
    event_type: 'lead_captured',
    title: `Inbound Lead: ${channel.toUpperCase()}`,
    description: activityDescription,
    metadata: {
      lead_id: leadRecord.id,
      utm_source: utmSource,
      utm_campaign: utmCampaign,
      gclid,
      fbclid,
      affiliate_id: affiliateId,
      plan,
    },
  }).select('*').maybeSingle()

  if (!actErr) activityRecord = activity

  // 6. Audit Logging
  await logHqAudit({
    entityType: 'hq_lead',
    entityId: leadRecord.id,
    action: 'lead_ingested',
    afterState: { id: leadRecord.id, email: cleanEmail, company_id: companyId, contact_id: contactId },
    actorName: 'Lead Ingestion Gateway',
    reason: `Inbound lead from ${channel}`,
    ipAddress,
  })

  return {
    success: true,
    lead: leadRecord,
    contactId,
    companyId,
    consent: consentRecord,
    activity: activityRecord,
  }
}
