/**
 * Google identity suite adapters — Calendar is already owned by calendarSync.js;
 * this module owns Search Console + GA4 reads that Discoverability and Marketing
 * consume. Every call is config-gated. No token, no property → not_connected.
 * A successful status requires a provider HTTP 2xx with a body we can parse.
 */
export function googleSuiteConfigured(kind) {
  const id = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!id || !secret) return false
  if (kind === 'gsc' || kind === 'ga4' || kind === 'gbp' || kind === 'calendar') return true
  return false
}

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
export const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage'
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export function googleSuiteScopes() {
  return [GSC_SCOPE, GA4_SCOPE, GBP_SCOPE, CALENDAR_SCOPE]
}

function bearer(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

export async function fetchSearchConsole({ accessToken, siteUrl, startDate, endDate, fetchImpl = fetch } = {}) {
  if (!accessToken) return { status: 'not_connected', provider: 'google_search_console', reason: 'No Google access token.' }
  if (!siteUrl) return { status: 'blocked', provider: 'google_search_console', reason: 'No Search Console property selected.' }
  const body = {
    startDate: startDate || daysAgo(28),
    endDate: endDate || daysAgo(1),
    dimensions: ['query', 'page'],
    rowLimit: 250,
  }
  const r = await fetchImpl(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) {
    return { status: 'failed', provider: 'google_search_console', reason: json.error?.message || `GSC HTTP ${r.status}`, property: siteUrl }
  }
  return {
    status: 'measured',
    provider: 'google_search_console',
    property: siteUrl,
    measuredAt: new Date().toISOString(),
    rows: Array.isArray(json.rows) ? json.rows : [],
    evidence: { sourceType: 'search_console', sourceUrl: siteUrl, http_status: r.status },
  }
}

export async function fetchGa4({ accessToken, propertyId, startDate, endDate, fetchImpl = fetch } = {}) {
  if (!accessToken) return { status: 'not_connected', provider: 'google_analytics_4', reason: 'No Google access token.' }
  if (!propertyId) return { status: 'blocked', provider: 'google_analytics_4', reason: 'No GA4 property selected.' }
  const id = String(propertyId).startsWith('properties/') ? propertyId : `properties/${propertyId}`
  const r = await fetchImpl(`https://analyticsdata.googleapis.com/v1beta/${id}:runReport`, {
    method: 'POST',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: startDate || '28daysAgo', endDate: endDate || 'yesterday' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    }),
    signal: AbortSignal.timeout(15000),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) {
    return { status: 'failed', provider: 'google_analytics_4', reason: json.error?.message || `GA4 HTTP ${r.status}`, property: id }
  }
  return {
    status: 'measured',
    provider: 'google_analytics_4',
    property: id,
    measuredAt: new Date().toISOString(),
    rows: Array.isArray(json.rows) ? json.rows : [],
    evidence: { sourceType: 'ga4', sourceUrl: id, http_status: r.status },
  }
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000)
  return d.toISOString().slice(0, 10)
}
