import crypto from 'node:crypto'

const value = v => v == null ? null : String(v).trim()
const same = (a, b) => value(a)?.toLowerCase() === value(b)?.toLowerCase()
const hash = v => crypto.createHash('sha256').update(String(v || '')).digest('hex')

export const AEO_GEO_WEIGHTS = Object.freeze({ entityAccuracy: 20, factConsistency: 20, answerReadiness: 15, structuredData: 15, crawlerAccessibility: 10, liveMentions: 10, liveCitations: 10 })

export function buildCanonicalFactObject(dealer = {}, inventory = [], options = {}) {
  const source = (field, fact) => ({ fact, sourceType: 'database', sourceField: field, verifiedAt: new Date().toISOString() })
  const active = inventory.filter(v => !/sold|inactive/i.test(String(v.status || ''))); const brands = [...new Set(active.map(v => v.make).filter(Boolean))]
  const facts = []
  if (dealer.name) facts.push(source('dealerships.name', `${dealer.name} is a dealership.`))
  if (dealer.address || dealer.city || dealer.state || dealer.zip_code) facts.push(source('dealerships.address', `${dealer.name || 'The dealership'} is located at ${[dealer.address, dealer.city, dealer.state, dealer.zip_code].filter(Boolean).join(', ')}.`))
  if (dealer.phone) facts.push(source('dealerships.phone', `The dealership phone number is ${dealer.phone}.`))
  return { dealershipName: dealer.name || null, brands, address: dealer.address || null, city: dealer.city || null, provinceState: dealer.state || null, postalCode: dealer.zip_code || null, country: dealer.country || options.country || 'CA', phone: dealer.phone || null, departments: options.departments || [], hours: dealer.hours || null, serviceAreas: options.serviceAreas || [], website: dealer.website_url || null, inventorySummary: { activeCount: active.length, brands }, financingCapabilities: options.financingCapabilities || [], serviceCapabilities: options.serviceCapabilities || [], languages: options.languages || ['en-CA'], acceptedFacts: facts }
}

export function auditFactConsistency(canonical = {}, observations = {}) {
  const fields = ['dealershipName', 'address', 'postalCode', 'phone']; const checks = fields.map(field => ({ field, expected: canonical[field] ?? null, observed: observations[field]?.value ?? observations[field] ?? null, sourceUrl: observations[field]?.sourceUrl || null, status: canonical[field] == null || observations[field] == null ? 'unknown' : same(canonical[field], observations[field]?.value ?? observations[field]) ? 'pass' : 'fail', evidence: observations[field]?.evidence || null }))
  return { checks, status: checks.some(c => c.status === 'fail') ? 'fail' : checks.some(c => c.status === 'unknown') ? 'unknown' : 'pass' }
}

export function validateLlmsText(text, sourceUrl, canonical = {}, options = {}) {
  const raw = String(text || ''); const findings = []; const evidence = rawValue => ({ sourceType: 'crawler', sourceUrl, measuredAt: new Date().toISOString(), rawValue, verified: true })
  if (!raw.trim()) return { status: 'fail', sourceUrl, findings: [{ type: 'llms_txt_empty', evidence: evidence(null) }] }
  if (canonical.dealershipName && !raw.toLowerCase().includes(String(canonical.dealershipName).toLowerCase())) findings.push({ type: 'llms_identity_mismatch', evidence: evidence(canonical.dealershipName) })
  if (canonical.phone && !raw.includes(String(canonical.phone))) findings.push({ type: 'llms_phone_mismatch', evidence: evidence(canonical.phone) })
  for (const vehicle of options.inventory || []) if (vehicle.price != null && raw.includes(String(vehicle.price)) && /sold|inactive/i.test(String(vehicle.status || ''))) findings.push({ type: 'llms_stale_price', evidence: evidence({ vin: vehicle.vin, price: vehicle.price }) })
  for (const url of options.deadUrls || []) if (raw.includes(url)) findings.push({ type: 'llms_dead_url', evidence: evidence(url) })
  return { status: findings.length ? 'fail' : 'pass', sourceUrl, findings, evidence: evidence({ bytes: raw.length }) }
}

export function extractVisibleFaqs(html = '') { return [...String(html).matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)].map(match => ({ question: String(match[1]).replace(/<[^>]+>/g, '').trim(), answer: String(match[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() })).filter(item => item.question && item.answer) }

export function validateFaqSchema(visibleFaqs = [], schemaEntities = [], sourceUrl) {
  const schema = schemaEntities.find(entity => String(entity?.['@type'] || '').toLowerCase() === 'faqpage'); const questions = schema?.mainEntity || []; const evidence = { sourceType: 'crawler', sourceUrl, measuredAt: new Date().toISOString(), verified: true }
  if (!schema) return { status: visibleFaqs.length ? 'unknown' : 'not_applicable', evidence, mismatches: [] }
  const mismatches = questions.filter(question => { const visible = visibleFaqs.find(item => item.question === question.name); return !visible || visible.answer !== question.acceptedAnswer?.text }).map(question => ({ question: question.name, evidence }))
  return { status: mismatches.length ? 'fail' : questions.length === visibleFaqs.length ? 'pass' : 'unknown', evidence, mismatches }
}

export function generateGeoQueries(facts = {}) {
  const queries = []; const city = facts.city; for (const brand of facts.brands || []) { if (city) queries.push(`Best ${brand} dealership in ${city}`); if (facts.serviceCapabilities?.length && city) queries.push(`Where can I service a ${brand} near ${city}?`) }
  if (city && (facts.inventorySummary?.activeCount || 0) > 0) queries.push(`Used vehicles for sale in ${city}`)
  if (city && facts.financingCapabilities?.length) queries.push(`${facts.dealershipName || 'Dealer'} financing in ${city}`)
  return [...new Set(queries)].map(query => ({ query, querySetVersion: 'canonical-facts-v1', sourceFacts: facts.acceptedFacts || [] }))
}

export function normalizeBenchmarkEvidence(record = {}) { const allowed = ['live_ai_response', 'live_search', 'synthetic_test', 'manual_verified']; if (!allowed.includes(record.evidenceType)) throw new Error('Unsupported benchmark evidence type'); return { query: value(record.query), engine: value(record.engine), model: value(record.model), locale: value(record.locale), timestamp: record.timestamp || new Date().toISOString(), dealershipMentioned: record.dealershipMentioned == null ? null : Boolean(record.dealershipMentioned), dealershipCited: record.dealershipCited == null ? null : Boolean(record.dealershipCited), citedUrls: Array.isArray(record.citedUrls) ? record.citedUrls : [], responseExcerptHash: record.responseExcerptHash || (record.responseExcerpt ? hash(record.responseExcerpt) : null), competitorsMentioned: Array.isArray(record.competitorsMentioned) ? record.competitorsMentioned : [], factualAccuracy: record.factualAccuracy == null ? null : Boolean(record.factualAccuracy), evidenceType: record.evidenceType, evidence: record.evidence || null } }

export function calculateGeoMetrics(records = []) { const real = records.filter(r => ['live_ai_response', 'live_search', 'manual_verified'].includes(r.evidenceType)); if (!real.length) return { status: 'not_measured', score: null, evidenceCoverage: 0, queriesTested: 0, mentioned: null, cited: null, accurate: null, mentionRate: null, citationRate: null, factualAccuracyRate: null, syntheticRuns: records.filter(r => r.evidenceType === 'synthetic_test').length }
  const count = key => real.filter(r => r[key] === true).length; const rate = n => Math.round(n / real.length * 1000) / 10; return { status: 'measured', score: rate(count('factualAccuracy')), evidenceCoverage: 100, queriesTested: real.length, mentioned: count('dealershipMentioned'), cited: count('dealershipCited'), accurate: count('factualAccuracy'), mentionRate: rate(count('dealershipMentioned')), citationRate: rate(count('dealershipCited')), factualAccuracyRate: rate(count('factualAccuracy')), syntheticRuns: records.filter(r => r.evidenceType === 'synthetic_test').length } }

export function classifyCrawlerPolicy(robots, targetUrl = 'https://example.com/', agents = ['googlebot', 'bingbot', 'oai-searchbot', 'gptbot', 'google-extended', 'applebot-extended']) { return Object.fromEntries(agents.map(agent => [agent, { agent, category: /gptbot|google-extended|applebot-extended/i.test(agent) ? 'training_or_extended_use' : 'search_or_retrieval', allowed: robots?.allowed ? robots.allowed(targetUrl, agent) : null }])) }

export function aeoGeoScore(checks = []) { const applicable = checks.filter(c => c.applicable !== false); const measured = applicable.filter(c => ['pass', 'fail'].includes(c.status)); const passed = measured.filter(c => c.status === 'pass').length; return { qualityScore: measured.length ? Math.round(passed / measured.length * 100) : null, evidenceCoverage: applicable.length ? Math.round(measured.length / applicable.length * 100) : 100, weights: AEO_GEO_WEIGHTS, verified100: measured.length === applicable.length && passed === applicable.length } }
