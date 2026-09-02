/**
 * Meta Lead Ads ingest. Subscription verification is a hub.challenge echo.
 * A lead is only accepted when the payload carries a leadgen_id. Fetching the
 * field data from Graph is a separate step that requires a page token — without
 * it we record the event as received, not imported.
 */
const GRAPH_VER = process.env.META_GRAPH_VERSION || 'v21.0'

export function metaLeadAdsConfigured() {
  return !!(process.env.META_APP_SECRET || process.env.META_ADS_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET)
}

export function metaAppSecret() {
  return process.env.META_APP_SECRET || process.env.META_ADS_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || ''
}

export function verifyLeadAdsSubscription({ mode, token, challenge, verifyToken } = {}) {
  const expected = verifyToken || process.env.META_LEAD_ADS_VERIFY_TOKEN || ''
  if (mode !== 'subscribe' || !expected || token !== expected) {
    return { ok: false, reason: 'Subscription verify token mismatch.' }
  }
  return { ok: true, challenge: String(challenge ?? '') }
}

export function normalizeLeadgenWebhook(body = {}) {
  const entries = Array.isArray(body.entry) ? body.entry : []
  const leads = []
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : []
    for (const change of changes) {
      if (change.field && change.field !== 'leadgen') continue
      const v = change.value || {}
      if (!v.leadgen_id) continue
      leads.push({
        leadgen_id: String(v.leadgen_id),
        page_id: String(v.page_id || entry.id || ''),
        form_id: v.form_id ? String(v.form_id) : null,
        ad_id: v.ad_id ? String(v.ad_id) : null,
        adgroup_id: v.adgroup_id ? String(v.adgroup_id) : null,
        created_time: v.created_time || null,
      })
    }
  }
  return leads
}

export async function fetchLeadgenFields({ pageAccessToken, leadgenId, fetchImpl = fetch } = {}) {
  if (!pageAccessToken) {
    return { imported: false, status: 'blocked', reason: 'No Page access token — lead event received, fields not fetched.' }
  }
  if (!leadgenId) {
    return { imported: false, status: 'blocked', reason: 'Missing leadgen_id.' }
  }
  const url = `https://graph.facebook.com/${GRAPH_VER}/${encodeURIComponent(leadgenId)}?fields=id,created_time,field_data,form_id,ad_id`
  const r = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${pageAccessToken}` },
    signal: AbortSignal.timeout(12000),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok || json.error) {
    return { imported: false, status: 'failed', reason: json.error?.message || `Graph HTTP ${r.status}`, evidence: { http_status: r.status } }
  }
  const fields = {}
  for (const row of json.field_data || []) {
    const key = String(row.name || '').trim()
    const val = Array.isArray(row.values) ? row.values[0] : row.values
    if (key) fields[key] = val == null ? '' : String(val)
  }
  return {
    imported: true,
    status: 'imported',
    evidence: { provider: 'meta_lead_ads', leadgen_id: json.id || leadgenId, http_status: r.status },
    contact: {
      full_name: fields.full_name || [fields.first_name, fields.last_name].filter(Boolean).join(' ') || null,
      email: fields.email || null,
      phone: fields.phone_number || fields.phone || null,
      source_key: 'meta_lead_ads',
      meta: { leadgen_id: json.id || leadgenId, form_id: json.form_id || null, ad_id: json.ad_id || null, fields },
    },
  }
}
