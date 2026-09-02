/**
 * Integration batches A–D inbound + status surface.
 *
 * Honest by construction: a provider is connected only when its env + token
 * path exists. Inbound webhooks never mark an external outcome complete without
 * provider evidence (A20).
 */
import { googleSuiteConfigured, fetchSearchConsole, fetchGa4 } from '../providers/google-suite.js'
import { googleAdsConversionsConfigured, uploadOfflineConversion } from '../providers/google-ads-conversions.js'
import { metaLeadAdsConfigured, verifyLeadAdsSubscription, normalizeLeadgenWebhook, fetchLeadgenFields } from '../providers/meta-lead-ads.js'
import { resendSendingConfigured, resendEventsConfigured, verifyResendSignature, mapResendEvent } from '../providers/resend-events.js'
import { verifyMarketSyncWebhook } from '../providers/webhook-verify.js'
import { providerConfigured as calendarConfigured } from '../calendarSync.js'
import { adProviderConfigured } from '../adSpendSync.js'
import { qboConfigured } from '../providers/quickbooks.js'
import { oauthConfigured } from '../providers/oauth.js'
import { twilioA2pConfigured } from '../providers/twilio-a2p.js'
import { twilioProvisionConfigured } from '../providers/twilio-provision.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'

export function integrationMatrix() {
  return {
    google: {
      oauth_app: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      calendar: calendarConfigured('google'),
      gsc: googleSuiteConfigured('gsc'),
      ga4: googleSuiteConfigured('ga4'),
      google_business: oauthConfigured('google_business'),
      google_ads_reporting: adProviderConfigured('google_ads'),
      google_ads_conversions: googleAdsConversionsConfigured(),
    },
    meta: {
      oauth_app: !!(process.env.META_ADS_CLIENT_ID || process.env.FACEBOOK_APP_ID || process.env.META_APP_ID),
      ads_reporting: adProviderConfigured('meta'),
      lead_ads: metaLeadAdsConfigured(),
    },
    twilio: {
      provision: twilioProvisionConfigured(),
      a2p: twilioA2pConfigured(),
      inbound_sms: true,
      outbound_sms: !!(process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_MASTER_SID),
    },
    resend: {
      sending: resendSendingConfigured(),
      delivery_events: resendEventsConfigured(),
    },
    marketcheck: { live: !!process.env.MARKETCHECK_API_KEY },
    accounting: {
      quickbooks: qboConfigured(),
      xero: oauthConfigured('xero'),
    },
    webhooks: { retries: true, delivery_verification: true },
    inventory_feeds: { syndication_validation: true },
  }
}

export function registerIntegrationBatches(app) {
  app.get('/integrations/matrix', requireAuth, requireMfa, requirePermission('integrations.manage'), (_req, res) => {
    res.json({ matrix: integrationMatrix() })
  })

  app.get('/integrations/meta/lead-ads/webhook', (req, res) => {
    const result = verifyLeadAdsSubscription({
      mode: req.query['hub.mode'],
      token: req.query['hub.verify_token'],
      challenge: req.query['hub.challenge'],
    })
    if (!result.ok) return res.status(403).json({ error: result.reason })
    res.status(200).send(result.challenge)
  })

  app.post('/integrations/meta/lead-ads/webhook', async (req, res) => {
    const leads = normalizeLeadgenWebhook(req.body || {})
    if (!leads.length) return res.status(200).json({ received: true, imported: 0, reason: 'No leadgen_id in payload.' })
    const pageToken = process.env.META_PAGE_ACCESS_TOKEN || ''
    const results = []
    for (const lead of leads) {
      results.push(await fetchLeadgenFields({ pageAccessToken: pageToken, leadgenId: lead.leadgen_id }))
    }
    const imported = results.filter(r => r.imported).length
    res.status(200).json({ received: true, imported, results })
  })

  app.post('/integrations/resend/events', (req, res) => {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})
    const verified = verifyResendSignature({ payload: raw, headers: req.headers })
    if (!verified.ok) return res.status(401).json({ error: verified.reason })
    const mapped = mapResendEvent(typeof req.body === 'string' ? JSON.parse(raw) : (req.body || {}))
    if (!mapped.accepted) return res.status(202).json({ accepted: false, reason: mapped.reason })
    res.json({ accepted: true, status: mapped.status, email_id: mapped.email_id, evidence: mapped.evidence })
  })

  app.post('/integrations/webhooks/verify', (req, res) => {
    const result = verifyMarketSyncWebhook({
      secret: req.body?.secret,
      body: req.body?.body,
      signature: req.body?.signature || req.headers['x-marketsync-signature'],
    })
    if (!result.ok) return res.status(400).json({ ok: false, error: result.reason })
    res.json({ ok: true })
  })

  app.post('/integrations/google/ads/conversions', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    const result = await uploadOfflineConversion({
      accessToken: req.body?.access_token,
      customerId: req.body?.customer_id,
      conversion: req.body?.conversion || req.body,
    })
    res.status(result.uploaded ? 200 : 409).json(result)
  })

  app.post('/integrations/google/gsc/query', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    const result = await fetchSearchConsole({
      accessToken: req.body?.access_token,
      siteUrl: req.body?.site_url,
      startDate: req.body?.start_date,
      endDate: req.body?.end_date,
    })
    res.json(result)
  })

  app.post('/integrations/google/ga4/query', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    const result = await fetchGa4({
      accessToken: req.body?.access_token,
      propertyId: req.body?.property_id,
      startDate: req.body?.start_date,
      endDate: req.body?.end_date,
    })
    res.json(result)
  })
}
