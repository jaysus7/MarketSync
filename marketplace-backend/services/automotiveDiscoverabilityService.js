import { crawlSite, parsePublicHtml } from './discoverabilityCrawlerService.js'

const norm = value => String(value ?? '').trim().toLowerCase()
const textHas = (text, pattern) => pattern.test(String(text || ''))

export const AUTOMOTIVE_SCORE_WEIGHTS = Object.freeze({ entityConsistency: 15, vdpHealth: 20, inventoryFreshness: 15, structuredData: 15, indexability: 15, sitemapCoverage: 10, internalLinking: 5, imageHealth: 5 })

export function detectAutomotivePage(page = {}) {
  const html = page.html || page
  const schemaTypes = (html.schema?.items || []).flatMap(item => Array.isArray(item.type) ? item.type : [item.type]).filter(Boolean).map(norm)
  const content = `${html.visibleText || ''} ${(html.title || '')} ${page.finalUrl || page.requestedUrl || ''}`
  const hasVehicleSchema = schemaTypes.some(type => ['vehicle', 'car', 'product'].includes(type))
  const hasVehicleSignals = hasVehicleSchema || /\b(?:vin|vehicle identification|stock number|mileage|odometer|in stock|certified pre-owned|used vehicle|new vehicle)\b/i.test(content)
  const vdpUrlSignal = /\/(?:vehicle|vehicles|inventory|used|new|cars-for-sale|detail|vdp)\/[^/?#]+/i.test(page.finalUrl || page.requestedUrl || '')
  const isVdp = hasVehicleSignals && (hasVehicleSchema || vdpUrlSignal || /\bvin\b/i.test(content))
  const isSrp = !isVdp && (schemaTypes.some(type => ['itemlist', 'collectionpage', 'searchresultsPage'.toLowerCase()].includes(type)) || /\b(?:inventory|vehicles|cars for sale|search results|browse)\b/i.test(content))
  return { pageType: isVdp ? 'vdp' : isSrp ? 'srp' : 'content', confidence: isVdp ? (hasVehicleSchema ? 0.98 : 0.8) : isSrp ? 0.72 : 0.2, signals: { schemaTypes, hasVehicleSchema, hasVehicleSignals, vdpUrlSignal } }
}

export function extractVehicleEntity(page = {}) {
  const html = page.html || page; const vehicleSchema = (html.schema?.items || []).find(item => ['vehicle', 'car', 'product'].some(type => (Array.isArray(item.type) ? item.type : [item.type]).map(norm).includes(type)))
  const entity = vehicleSchema?.entity || null; const text = html.visibleText || ''
  const vin = entity?.vehicleIdentificationNumber || entity?.vin || (text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)?.[0] || null)
  const price = entity?.offers?.price ?? (text.match(/\$\s*([\d,]+(?:\.\d{2})?)/)?.[1]?.replace(/,/g, '') || null)
  const year = entity?.vehicleModelDate || entity?.productionDate || (text.match(/\b(20\d{2})\b/)?.[1] || null)
  const name = entity?.name || html.title || null
  return { vin, year: year ? Number(year) : null, name, make: entity?.brand?.name || entity?.brand || null, model: entity?.model || null, trim: entity?.vehicleConfiguration || null, price: price == null ? null : Number(price), availability: entity?.offers?.availability || null, url: entity?.offers?.url || page.finalUrl || page.requestedUrl || null, schema: vehicleSchema || null, sourceUrl: page.finalUrl || page.requestedUrl || null }
}

function entityTypeMatches(entity, types) { return types.some(type => (Array.isArray(entity?.['@type']) ? entity['@type'] : [entity?.['@type']]).map(norm).includes(norm(type))) }
export function validateAutomotiveSchemas(page, dealer = {}, inventory = []) {
  const html = page.html || page; const items = html.schema?.items || []; const errors = html.schema?.parseErrors || []; const evidence = sourceUrl => ({ sourceType: 'crawler', sourceUrl, measuredAt: new Date().toISOString(), verified: true })
  const autoDealer = items.find(item => entityTypeMatches(item.entity, ['AutoDealer', 'AutomotiveBusiness', 'Organization']))?.entity || null
  const vehicle = items.find(item => entityTypeMatches(item.entity, ['Vehicle', 'Car', 'Product']))?.entity || null
  const offer = vehicle?.offers || items.find(item => entityTypeMatches(item.entity, ['Offer']))?.entity || null
  const breadcrumb = items.find(item => entityTypeMatches(item.entity, ['BreadcrumbList']))?.entity || null
  const result = { autoDealer: { status: autoDealer ? 'pass' : 'unknown', sourceUrl: page.finalUrl || page.requestedUrl, schemaTypes: items.map(i => i.type).filter(Boolean), parseErrors: errors, evidence: evidence(page.finalUrl || page.requestedUrl) }, vehicle: { status: vehicle ? 'pass' : 'unknown', sourceUrl: page.finalUrl || page.requestedUrl, schemaTypes: items.map(i => i.type).filter(Boolean), parseErrors: errors, evidence: evidence(page.finalUrl || page.requestedUrl) }, offer: { status: offer ? 'pass' : 'unknown', sourceUrl: page.finalUrl || page.requestedUrl, schemaTypes: items.map(i => i.type).filter(Boolean), parseErrors: errors, evidence: evidence(page.finalUrl || page.requestedUrl) }, breadcrumb: { status: breadcrumb ? 'pass' : 'unknown', sourceUrl: page.finalUrl || page.requestedUrl, schemaTypes: items.map(i => i.type).filter(Boolean), parseErrors: errors, evidence: evidence(page.finalUrl || page.requestedUrl) }, parseErrors: errors }
  if (errors.length) for (const key of ['autoDealer', 'vehicle', 'offer', 'breadcrumb']) result[key].status = 'fail'
  if (autoDealer && dealer.name && norm(autoDealer.name) !== norm(dealer.name)) result.autoDealer.status = 'fail'
  if (offer && inventory.length) { const matched = inventory.find(v => v.vin && norm(v.vin) === norm(vehicle?.vehicleIdentificationNumber || vehicle?.vin)); if (matched && offer.price != null && Number(offer.price) !== Number(matched.price)) result.offer.status = 'fail' }
  return result
}

export function compareInventoryToPublic(inventory = [], publicVehicles = [], options = {}) {
  const byVin = new Map(publicVehicles.filter(v => v.vin).map(v => [norm(v.vin), v])); const threshold = Number(options.freshnessThresholdSeconds ?? 900); const comparisons = []; const findings = []
  for (const expected of inventory) {
    const observed = (expected.vin ? byVin.get(norm(expected.vin)) : null) || publicVehicles.find(v => expected.vdp_url && norm(v.url) === norm(expected.vdp_url)) || publicVehicles.find(v => expected.stock_number && norm(v.stockNumber) === norm(expected.stock_number))
    const base = { entityType: 'vehicle', canonicalId: expected.id, vin: expected.vin || null, expected, observed, publicUrls: observed?.url ? [observed.url] : [], consistencyStatus: observed ? 'match' : 'missing' }
    if (!observed) { comparisons.push(base); findings.push({ type: 'missing_vdp', severity: 'high', evidence: { sourceType: 'crawler', rawValue: { vin: expected.vin }, verified: true } }); continue }
    const fields = ['vin', 'year', 'make', 'model', 'trim']; for (const field of fields) if (expected[field] != null && observed[field] != null && norm(expected[field]) !== norm(observed[field])) { base.consistencyStatus = 'mismatch'; findings.push({ type: field === 'vin' ? 'vin_mismatch' : `vehicle_${field}_mismatch`, severity: 'critical', evidence: { sourceType: 'crawler', rawValue: { expected: expected[field], observed: observed[field] }, verified: true, sourceUrl: observed.sourceUrl } }) }
    if (expected.price != null && observed.price != null && Number(expected.price) !== Number(observed.price)) { base.consistencyStatus = 'mismatch'; findings.push({ type: 'public_price_mismatch', severity: 'critical', evidence: { sourceType: 'crawler', rawValue: { expected: expected.price, observed: observed.price }, verified: true, sourceUrl: observed.sourceUrl } }) }
    const expectedSold = /sold|inactive/i.test(String(expected.status || expected.availability || '')); const observedAvailable = /instock|available/i.test(String(observed.availability || observed.status || '')) || /in stock|available/i.test(String(observed.text || '')); if (expectedSold && observedAvailable) findings.push({ type: 'sold_available_contradiction', severity: 'critical', evidence: { sourceType: 'crawler', rawValue: { expectedStatus: expected.status, observedStatus: observed.status || observed.availability }, verified: true, sourceUrl: observed.sourceUrl } })
    if (!observed.image) findings.push({ type: 'missing_primary_image', severity: 'medium', evidence: { sourceType: 'crawler', rawValue: observed, verified: true, sourceUrl: observed.sourceUrl } })
    const freshness = calculateFreshnessLag(expected.updated_at || expected.updatedAt, observed.observedAt || options.observedAt); if (freshness) { base.freshness = freshness; if (freshness.lagSeconds > threshold) findings.push({ type: 'stale_public_inventory', severity: 'high', evidence: { sourceType: 'crawler', rawValue: freshness, verified: true, sourceUrl: observed.sourceUrl } }) }
    comparisons.push(base)
  }
  const expectedVins = new Set(inventory.map(v => norm(v.vin)).filter(Boolean)); for (const observed of publicVehicles) if (observed.vin && !expectedVins.has(norm(observed.vin))) findings.push({ type: 'public_vdp_without_inventory_record', severity: 'high', evidence: { sourceType: 'crawler', rawValue: observed, verified: true, sourceUrl: observed.sourceUrl } })
  return { comparisons, findings }
}

export function calculateFreshnessLag(inventoryUpdatedAt, observedPublicAt) { if (!inventoryUpdatedAt || !observedPublicAt) return null; const inventoryMs = Date.parse(inventoryUpdatedAt); const publicMs = Date.parse(observedPublicAt); if (!Number.isFinite(inventoryMs) || !Number.isFinite(publicMs)) return null; return { inventoryUpdatedAt, observedPublicAt, lagSeconds: Math.max(0, Math.round((publicMs - inventoryMs) / 1000)), status: publicMs >= inventoryMs ? 'fresh_after_update' : 'observed_before_inventory_update' } }

export function validateBilingualPages(pages = []) {
  const languages = new Map(pages.filter(page => page.language).map(page => [page.language, page])); if (!languages.has('fr-CA') && !languages.has('fr')) return { status: 'not_applicable', checks: [] }
  const checks = []; for (const page of pages) for (const alternate of page.hreflang || []) { const target = pages.find(candidate => candidate.finalUrl === alternate.href); checks.push({ sourceUrl: page.finalUrl, language: alternate.lang, targetUrl: alternate.href, reciprocal: !!target?.hreflang?.some(link => link.lang === page.language && link.href === page.finalUrl), matched: !!target, evidence: { sourceType: 'crawler', sourceUrl: page.finalUrl, rawValue: alternate, verified: true } }) }
  return { status: checks.every(check => check.reciprocal && check.matched) ? 'pass' : 'fail', checks }
}

export function automotiveScore(checks = []) { const applicable = checks.filter(c => c.applicable !== false); const measured = applicable.filter(c => ['pass', 'fail'].includes(c.status)); const passed = measured.filter(c => c.status === 'pass').length; return { qualityScore: measured.length ? Math.round(passed / measured.length * 100) : null, evidenceCoverage: applicable.length ? Math.round(measured.length / applicable.length * 100) : 100, weights: AUTOMOTIVE_SCORE_WEIGHTS, verified100: measured.length === applicable.length && passed === applicable.length } }

export async function auditAutomotiveWebsite(baseUrl, options = {}) { const crawl = await crawlSite(baseUrl, options); const pages = crawl.pages.filter(page => page.html); const classified = pages.map(page => ({ ...page, automotive: detectAutomotivePage(page), vehicle: extractVehicleEntity(page), schemaValidation: validateAutomotiveSchemas(page, options.dealer, options.inventory) })); const publicVehicles = classified.filter(page => page.automotive.pageType === 'vdp').map(page => ({ ...page.vehicle, observedAt: page.fetchedAt })); const inventoryComparison = compareInventoryToPublic(options.inventory || [], publicVehicles, options); return { ...crawl, automotivePages: classified, publicVehicles, inventoryComparison, score: automotiveScore([]) } }

export { parsePublicHtml }
