/**
 * Google Ads reporting lives in adSpendSync.js. This module is the offline /
 * enhanced-conversion upload path. A conversion is only marked uploaded when
 * Google Ads returns a result with partialFailureError absent AND at least one
 * result row. Intent, a queued job, or a missing gclid is not evidence.
 */
export function googleAdsConversionsConfigured() {
  return !!(
    (process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) &&
    (process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET) &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  )
}

export function normalizeOfflineConversion(input = {}) {
  const gclid = String(input.gclid || input.gbraid || input.wbraid || '').trim()
  const conversionAction = String(input.conversionAction || input.conversion_action || '').trim()
  const conversionDateTime = String(input.conversionDateTime || input.conversion_date_time || '').trim()
  const value = Number(input.value)
  return {
    gclid: input.gclid ? String(input.gclid).trim() : '',
    gbraid: input.gbraid ? String(input.gbraid).trim() : '',
    wbraid: input.wbraid ? String(input.wbraid).trim() : '',
    clickId: gclid,
    conversionAction,
    conversionDateTime,
    currencyCode: String(input.currencyCode || input.currency || 'CAD').slice(0, 3).toUpperCase(),
    conversionValue: Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null,
  }
}

export async function uploadOfflineConversion({
  accessToken,
  customerId,
  conversion,
  fetchImpl = fetch,
} = {}) {
  if (!googleAdsConversionsConfigured()) {
    return { uploaded: false, status: 'not_connected', reason: 'Google Ads developer token / OAuth app is not provisioned.' }
  }
  if (!accessToken) {
    return { uploaded: false, status: 'not_connected', reason: 'No Google Ads access token.' }
  }
  const row = normalizeOfflineConversion(conversion)
  if (!row.clickId) {
    return { uploaded: false, status: 'blocked', reason: 'No gclid/gbraid/wbraid — cannot claim an Ads click.' }
  }
  if (!row.conversionAction) {
    return { uploaded: false, status: 'blocked', reason: 'No conversion action resource name.' }
  }
  if (!customerId) {
    return { uploaded: false, status: 'blocked', reason: 'No Google Ads customer id.' }
  }
  const cid = String(customerId).replace(/-/g, '')
  const version = process.env.GOOGLE_ADS_API_VERSION || 'v17'
  const payload = {
    conversions: [{
      conversionAction: row.conversionAction,
      conversionDateTime: row.conversionDateTime || new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '+00:00'),
      conversionValue: row.conversionValue,
      currencyCode: row.currencyCode,
      ...(row.gclid ? { gclid: row.gclid } : {}),
      ...(row.gbraid ? { gbraid: row.gbraid } : {}),
      ...(row.wbraid ? { wbraid: row.wbraid } : {}),
    }],
    partialFailure: true,
  }
  const r = await fetchImpl(`https://googleads.googleapis.com/${version}/customers/${cid}:uploadClickConversions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) {
    return { uploaded: false, status: 'failed', reason: json.error?.message || `Google Ads HTTP ${r.status}`, evidence: { http_status: r.status } }
  }
  if (json.partialFailureError) {
    return { uploaded: false, status: 'failed', reason: json.partialFailureError.message || 'partialFailureError', evidence: { provider: 'google_ads', body: json.partialFailureError } }
  }
  const results = Array.isArray(json.results) ? json.results : []
  if (!results.length) {
    return { uploaded: false, status: 'failed', reason: 'Google Ads returned no conversion result.' }
  }
  return {
    uploaded: true,
    status: 'uploaded',
    evidence: { provider: 'google_ads', http_status: r.status, results },
  }
}
