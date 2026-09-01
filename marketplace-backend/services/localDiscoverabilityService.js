const text = value => String(value ?? '').trim()
const norm = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const provenance = (sourceField, value, sourceType = 'database') => ({ value: value ?? null, sourceType, sourceField, verifiedAt: new Date().toISOString() })
const valueOf = item => item && typeof item === 'object' && 'value' in item ? item.value : item

export const LOCAL_SCORE_WEIGHTS = Object.freeze({ canonicalEntityAccuracy: 20, napConsistency: 20, hoursConsistency: 10, gbpConsistency: 15, localSchema: 10, departmentAccuracy: 10, localPageQuality: 5, serviceAreaAccuracy: 5, crawlerAccessibility: 5 })

export function disconnectedGbpProvider() {
  return { provider: 'google_business_profile', status: 'not_connected', locationId: null, fetchedAt: null, business: null, performance: { calls: null, websiteClicks: null, directionRequests: null, views: null, searches: null }, reviews: { count: null, averageRating: null } }
}

export function buildCanonicalLocalEntity(dealer = {}, options = {}) {
  return {
    dealershipId: dealer.id || options.dealershipId || null,
    name: provenance('dealerships.name', dealer.name),
    address: { street: provenance('dealerships.address', dealer.address), city: provenance('dealerships.city', dealer.city), region: provenance('dealerships.province', dealer.province || dealer.state), postalCode: provenance('dealerships.postal_code', dealer.postal_code || dealer.zip_code), country: provenance('dealerships.country', dealer.country || options.country || 'CA') },
    phone: provenance('dealerships.phone', dealer.phone),
    website: provenance('dealerships.website_url', dealer.website_url),
    latitude: provenance('dealerships.latitude', dealer.latitude),
    longitude: provenance('dealerships.longitude', dealer.longitude),
    hours: provenance('dealerships.hours', dealer.hours),
    brands: provenance('dealer_brands', options.brands || []),
    departments: provenance('dealer_departments', options.departments || []),
    serviceAreas: provenance('dealerships.service_areas', options.serviceAreas || []),
    languages: provenance('dealerships.languages', options.languages || ['en-CA'])
  }
}

export function compareLocalIdentity(canonical = {}, observed = {}, sourceType = 'public_website') {
  const fields = ['name', 'phone', 'website']
  const addressFields = ['street', 'city', 'region', 'postalCode', 'country']
  const checks = [...fields.map(field => check(field, canonical[field], observed[field])), ...addressFields.map(field => check(`address.${field}`, canonical.address?.[field], observed.address?.[field]))]
  return { sourceType, checks, status: checks.some(item => item.status === 'fail') ? 'fail' : checks.some(item => item.status === 'unknown') ? 'unknown' : 'pass' }
  function check(field, expected, actual) { const expectedValue = valueOf(expected); const observedValue = valueOf(actual); return { field, expected: expectedValue ?? null, observed: observedValue ?? null, sourceType, status: expectedValue == null || observedValue == null ? 'unknown' : norm(expectedValue) === norm(observedValue) ? 'pass' : 'fail' } }
}

export function normalizeGbpEvidence(payload = {}) {
  if (payload?.connected !== true) return disconnectedGbpProvider()
  return { provider: 'google_business_profile', status: 'connected', locationId: payload.locationId || null, fetchedAt: payload.fetchedAt || new Date().toISOString(), business: { name: payload.business?.name ?? null, address: payload.business?.address ?? null, phone: payload.business?.phone ?? null, website: payload.business?.website ?? null, categories: Array.isArray(payload.business?.categories) ? payload.business.categories : [], hours: payload.business?.hours ?? null, attributes: payload.business?.attributes || {}, status: payload.business?.status ?? null }, performance: Object.fromEntries(['calls', 'websiteClicks', 'directionRequests', 'views', 'searches'].map(key => [key, payload.performance?.[key] ?? null])), reviews: { count: payload.reviews?.count ?? null, averageRating: payload.reviews?.averageRating ?? null } }
}

export function compareGbpToCanonical(canonical = {}, gbp = {}) {
  if (gbp.status !== 'connected') return { status: 'unknown', checks: [], performance: gbp.performance, reviews: gbp.reviews }
  const result = compareLocalIdentity(canonical, { name: gbp.business?.name, phone: gbp.business?.phone, website: gbp.business?.website, address: gbp.business?.address }, 'google_business_profile')
  return { ...result, checks: result.checks.map(item => ({ ...item, severity: item.status === 'fail' && ['phone', 'address.street', 'address.postalCode'].includes(item.field) ? 'high' : 'medium' })), performance: gbp.performance, reviews: gbp.reviews }
}

export function compareHours(expected, observed, sourceType = 'public_website') { if (expected == null || observed == null) return { status: 'unknown', sourceType, expected: expected ?? null, observed: observed ?? null }; return { status: JSON.stringify(expected) === JSON.stringify(observed) ? 'pass' : 'fail', sourceType, expected, observed } }

export function normalizeLocalRankEvidence(record = {}) { const evidenceType = record.evidenceType || 'live_search'; if (!['live_search', 'synthetic_test', 'manual_verified'].includes(evidenceType)) throw new Error('Unsupported local rank evidence type'); const live = evidenceType !== 'synthetic_test'; return { query: text(record.query) || null, location: text(record.location) || null, gridPoint: record.gridPoint || null, provider: text(record.provider) || null, measuredAt: record.measuredAt || new Date().toISOString(), organicPosition: live ? (record.organicPosition ?? null) : null, localPackPosition: live ? (record.localPackPosition ?? null) : null, mapPosition: live ? (record.mapPosition ?? null) : null, evidenceType, status: live ? 'measured' : 'synthetic_test' } }

export function generateLocalQueries(entity = {}) { const city = valueOf(entity.address?.city); const brands = valueOf(entity.brands) || []; const departments = (valueOf(entity.departments) || []).map(norm); const result = brands.flatMap(brand => city ? [`${brand} dealer ${city}`, ...(departments.includes('service') ? [`${brand} service ${city}`] : [])] : []); if (city) result.push(`used cars ${city}`); if (city && departments.includes('parts')) result.push(`auto parts ${city}`); if (city && departments.includes('service')) result.push(`oil change ${city}`); return [...new Set(result)] }

export function auditLocalPage(page = {}, entity = {}) { const visible = text(page.visibleText || page.text); const city = norm(valueOf(entity.address?.city)); const hasAddress = Boolean(city && norm(visible).includes(city)); const hasDirections = /directions|route|map/i.test(visible) || /maps|directions/i.test(String(page.html || '')); const hasPhone = /\+?\d[\d ()-]{7,}/.test(visible); return { url: page.url || page.finalUrl || null, hasAddress, hasDirections, hasPhone, usefulLocalContent: hasAddress && (hasDirections || hasPhone), status: hasAddress && (hasDirections || hasPhone) ? 'pass' : 'fail' } }

export function localScore(checks = []) { const applicable = checks.filter(check => check.applicable !== false); const measured = applicable.filter(check => ['pass', 'fail'].includes(check.status)); const passed = measured.filter(check => check.status === 'pass').length; return { qualityScore: measured.length ? Math.round(passed / measured.length * 100) : null, evidenceCoverage: applicable.length ? Math.round(measured.length / applicable.length * 100) : 100, weights: LOCAL_SCORE_WEIGHTS, verified100: measured.length === applicable.length && passed === applicable.length } }

export function classifyLocalRecommendation(issueType) { return ['schema_formatting', 'internal_link_repair', 'missing_authoritative_nap'].includes(issueType) ? { executionClass: 'auto_fixable', riskLevel: 'low' } : { executionClass: 'approval_required', riskLevel: 'high' } }
