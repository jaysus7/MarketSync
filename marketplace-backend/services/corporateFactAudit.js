// ─────────────────────────────────────────────────────────────────────────────
// Corporate-site fact auditing.
//
// The Discoverability platform already knows how to crawl a dealer site, validate a
// published change and score a pillar. What it had no way to check is whether a site's
// *machine-readable identity* still tells the truth: whether llms.txt still describes a
// product the company stopped selling, whether a schema price exists nowhere a human can
// see it, whether the sitemap invites Google into the login page.
//
// Those failures are silent. Nothing errors, nothing 404s, and a crawl scores well while
// the site confidently states a price that changed two releases ago. MarketSync's own
// llms.txt is the worked example: it described a Facebook Marketplace Chrome extension at
// $499/month long after the company sold a dealership operating system.
//
// Every function here is pure and site-agnostic. No hostname is special: a check either
// passes on the evidence given or it does not, so the corporate site is audited by exactly
// the same rules as a customer's. That is deliberate — a "trusted domain" shortcut is how
// an audit stops being evidence.
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_PATH = /(^|\/)(login|signin|sign-in|logout|forgot-password|reset-password|password-reset|dashboard|admin|account\/)/i

const finding = (type, severity, message, extra = {}) => ({ type, severity, message, ...extra })

/** Strip tags and scripts: what a reader actually sees, minus anything machine-only. */
export function visibleText(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function jsonLdBlocks(html = '') {
  const out = []
  for (const m of String(html).matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { out.push(JSON.parse(m[1])) } catch { out.push({ __malformed: true, raw: m[1] }) }
  }
  return out
}

const walk = (node, fn) => {
  if (Array.isArray(node)) return node.forEach(child => walk(child, fn))
  if (node && typeof node === 'object') { fn(node); Object.values(node).forEach(child => walk(child, fn)) }
}

/**
 * llms.txt is the file most likely to go stale, because nothing renders it and no test
 * looks at it. A claim here outlives the product it describes.
 */
export function auditLlmsTxt(text = '', { retiredTerms = [], currentProducts = [], knownUrls = null, pricingUrl = null } = {}) {
  const findings = []
  const body = String(text)
  const lower = body.toLowerCase()

  for (const term of retiredTerms) {
    if (lower.includes(String(term).toLowerCase())) {
      findings.push(finding('llms_txt_retired_claim', 'high', `llms.txt still describes "${term}", which the site no longer sells`, { term }))
    }
  }
  for (const product of currentProducts) {
    if (!lower.includes(String(product).toLowerCase())) {
      findings.push(finding('llms_txt_missing_product', 'medium', `llms.txt does not mention "${product}"`, { product }))
    }
  }
  // A duplicated price is a fact with two owners; one of them will drift.
  const prices = [...body.matchAll(/\$\s?\d[\d,]*(?:\.\d{2})?/g)].map(m => m[0])
  if (prices.length) {
    findings.push(finding('llms_txt_duplicated_price', 'high',
      `llms.txt hardcodes ${prices.length} price(s); it should link to the canonical pricing page instead`, { prices }))
  }
  if (pricingUrl && !body.includes(pricingUrl)) {
    findings.push(finding('llms_txt_no_pricing_link', 'medium', 'llms.txt does not link to the canonical pricing page', { pricingUrl }))
  }
  if (knownUrls) {
    const known = new Set(knownUrls)
    for (const url of new Set([...body.matchAll(/https?:\/\/[^\s)\]]+/g)].map(m => m[0]))) {
      if (!known.has(url)) findings.push(finding('llms_txt_dead_url', 'high', `llms.txt references a URL that does not resolve: ${url}`, { url }))
    }
  }
  return { findings, stale: findings.some(f => f.severity === 'high') }
}

/** The sitemap is a request to index. Anything in it that says "do not index me" contradicts it. */
export function auditSitemap(xml = '', pages = {}) {
  const findings = []
  const locs = [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1])
  for (const loc of locs) {
    const path = loc.replace(/^https?:\/\/[^/]+\//, '') || 'index.html'
    if (AUTH_PATH.test(path)) {
      findings.push(finding('sitemap_private_url', 'high', `Sitemap asks for an authentication or private page to be indexed: ${path}`, { url: loc }))
      continue
    }
    const page = pages[path]
    if (!page) { findings.push(finding('sitemap_missing_page', 'high', `Sitemap lists a URL with no page behind it: ${path}`, { url: loc })); continue }
    if (page.redirectsTo) {
      findings.push(finding('sitemap_redirect_stub', 'medium', `Sitemap lists a redirect stub that sends visitors to ${page.redirectsTo}`, { url: loc }))
    } else if (page.canonical && !sameUrl(page.canonical, loc)) {
      findings.push(finding('sitemap_canonicalised_away', 'medium',
        `Sitemap asks to index ${path}, but the page canonicalises to ${page.canonical}`, { url: loc, canonical: page.canonical }))
    }
  }
  return { findings, urls: locs }
}

const sameUrl = (a, b) => String(a).replace(/\/$/, '') === String(b).replace(/\/$/, '')

/**
 * Search/retrieval crawlers and training crawlers are different questions. Blocking a
 * training crawler is a policy choice a company is entitled to make, and reporting it as
 * an SEO failure would push sites into giving away training access to score better.
 */
const TRAINING_AGENTS = ['gptbot', 'google-extended', 'applebot-extended', 'ccbot', 'anthropic-ai', 'claudebot', 'meta-externalagent']
const SEARCH_AGENTS = ['googlebot', 'bingbot', 'oai-searchbot', 'perplexitybot', 'claude-searchbot', 'duckduckbot', 'applebot', 'youbot', 'slurp']

export function classifyRobots(text = '') {
  const groups = []
  let current = null
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const [key, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    const name = key.trim().toLowerCase()
    if (name === 'user-agent') {
      if (!current || current.rules.length) { current = { agents: [], rules: [] }; groups.push(current) }
      current.agents.push(value.toLowerCase())
    } else if (current && (name === 'allow' || name === 'disallow')) {
      current.rules.push({ type: name, path: value })
    }
  }
  const blocked = (agent) => groups.some(g => g.agents.includes(agent) && g.rules.some(r => r.type === 'disallow' && r.path === '/'))
  const declared = new Set(groups.flatMap(g => g.agents))
  return {
    groups,
    sitemaps: [...String(text).matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]),
    search: SEARCH_AGENTS.filter(a => declared.has(a)),
    training: TRAINING_AGENTS.filter(a => declared.has(a)),
    blockedSearch: SEARCH_AGENTS.filter(blocked),
    blockedTraining: TRAINING_AGENTS.filter(blocked),
  }
}

export function auditRobots(text = '', { expectedSitemaps = [] } = {}) {
  const parsed = classifyRobots(text)
  const findings = []
  for (const agent of parsed.blockedSearch) {
    findings.push(finding('robots_blocks_search_crawler', 'critical', `robots.txt blocks the search crawler ${agent}`, { agent }))
  }
  // Deliberately NOT a finding: parsed.blockedTraining. That is policy, not a defect.
  for (const url of expectedSitemaps) {
    if (!parsed.sitemaps.includes(url)) findings.push(finding('robots_missing_sitemap', 'medium', `robots.txt does not reference ${url}`, { url }))
  }
  return { ...parsed, findings }
}

/**
 * Structured data may describe the page; it may not invent facts the page does not show.
 * A price that exists only in JSON-LD is unverifiable by a reader and drifts unnoticed.
 */
export function auditSchemaAgainstVisible(html = '', { url = null } = {}) {
  const findings = []
  const blocks = jsonLdBlocks(html)
  const seen = visibleText(html).replace(/[,\s]/g, '')
  for (const block of blocks) {
    if (block && block.__malformed) { findings.push(finding('schema_malformed', 'high', 'A JSON-LD block does not parse', { url })); continue }
    walk(block, node => {
      if (node.aggregateRating || node.ratingValue || node.reviewCount || node.review) {
        findings.push(finding('schema_unsupported_rating', 'critical', 'Structured data claims ratings or reviews', { url }))
      }
      if (node.award) findings.push(finding('schema_unsupported_award', 'high', 'Structured data claims an award', { url }))
      if (node.price !== undefined && node.price !== null) {
        const price = String(node.price)
        if (Number(price) === 0) {
          findings.push(finding('schema_free_offer', 'critical', 'Structured data offers the product at 0, claiming it is free', { url, price }))
        } else if (!seen.includes(price.replace(/\.00$/, '').replace(/[,\s]/g, ''))) {
          findings.push(finding('schema_price_not_visible', 'medium', `Structured data prices this at ${price}, which appears nowhere a reader can see`, { url, price }))
        }
      }
    })
  }
  return { findings, blocks: blocks.length }
}

const OG_REQUIRED = ['og:title', 'og:description', 'og:url', 'og:image']

export function auditOpenGraph(html = '', { url = null, assetExists = null } = {}) {
  const findings = []
  const tag = (key) => (String(html).match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i')) || [])[1]
  for (const key of OG_REQUIRED) {
    const value = tag(key)
    if (!value || !value.trim()) findings.push(finding('og_missing', 'medium', `${key} is missing`, { url, key }))
  }
  if (!tag('twitter:card')) findings.push(finding('og_missing', 'low', 'twitter:card is missing', { url, key: 'twitter:card' }))
  const image = tag('og:image')
  if (image && assetExists && !assetExists(image)) {
    findings.push(finding('og_broken_image', 'high', `og:image points at an asset that does not exist: ${image}`, { url, image }))
  }
  const ogUrl = tag('og:url')
  const canonical = (String(html).match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1]
  if (ogUrl && canonical && !sameUrl(ogUrl, canonical)) {
    findings.push(finding('og_url_conflicts_canonical', 'medium', `og:url (${ogUrl}) disagrees with the canonical (${canonical})`, { url }))
  }
  return { findings }
}

/**
 * A page nothing links to cannot be found by following the site, however well it ranks in
 * theory. A link to a page that does not exist spends the crawler's budget on a 404.
 */
export function auditLinkGraph(pages = {}, { strategic = [], entry = 'index.html' } = {}) {
  const findings = []
  const names = new Set(Object.keys(pages))
  const inbound = new Map([...names].map(n => [n, 0]))
  for (const [from, page] of Object.entries(pages)) {
    for (const href of page.links || []) {
      const target = String(href).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').replace(/[#?].*$/, '') || 'index.html'
      if (!names.has(target)) { findings.push(finding('broken_internal_link', 'high', `${from} links to ${target}, which does not exist`, { from, target })); continue }
      if (target !== from) inbound.set(target, (inbound.get(target) || 0) + 1)
    }
  }
  for (const page of strategic) {
    if (!names.has(page)) continue
    if (!inbound.get(page) && page !== entry) {
      findings.push(finding('orphan_strategic_page', 'high', `${page} is a strategic page with no internal links pointing at it`, { page }))
    }
  }
  return { findings, inbound: Object.fromEntries(inbound) }
}

export function auditCanonical(page = {}, { url = null } = {}) {
  const findings = []
  const canonical = page.canonical
  if (!canonical) return { findings: [finding('canonical_missing', 'high', 'Page declares no canonical', { url })] }
  if (page.canonicalCount > 1) findings.push(finding('canonical_multiple', 'high', 'Page declares more than one canonical', { url }))
  if (page.redirectsTo && !sameUrl(canonical, page.redirectsTo)) {
    findings.push(finding('canonical_stale', 'high', `Page redirects to ${page.redirectsTo} but canonicalises to ${canonical}`, { url }))
  }
  if (page.knownUrls && !page.knownUrls.includes(canonical)) {
    findings.push(finding('canonical_stale', 'high', `Canonical points at a URL that does not resolve: ${canonical}`, { url }))
  }
  return { findings }
}

/**
 * One fact, many surfaces. When they disagree the site is wrong somewhere, and which copy
 * is right is not something an audit may guess — it reports the contradiction.
 */
export function auditFactConsistency(facts = {}) {
  const findings = []
  for (const [fact, sources] of Object.entries(facts)) {
    const values = new Map()
    for (const { source, value } of sources) {
      if (value === null || value === undefined || value === '') continue
      const key = String(value).trim().toLowerCase()
      values.set(key, [...(values.get(key) || []), source])
    }
    if (values.size > 1) {
      findings.push(finding('fact_inconsistent', 'high',
        `"${fact}" is stated differently across the site`, { fact, values: Object.fromEntries(values) }))
    }
  }
  return { findings }
}

// ── Coverage and Verified 100 ────────────────────────────────────────────────
// A check is one of: measured (pass/fail), not_measured, not_connected, or
// not_applicable. Only the first counts as evidence. not_applicable is excluded from the
// denominator entirely — a question that does not apply cannot lower a score — which is
// exactly why it must not be reachable by choice.

export const CHECK_STATES = Object.freeze(['pass', 'fail', 'not_measured', 'not_connected', 'not_applicable'])
const MEASURED = new Set(['pass', 'fail'])

/** Concepts that genuinely cannot apply to a site, and the reason each may be excused. */
const APPLICABILITY_RULES = Object.freeze({
  vdp_inventory_integrity: site => site.sellsVehiclesOnline === false,
  inventory_freshness: site => site.sellsVehiclesOnline === false,
  local_business_hours: site => site.hasPhysicalStorefront === false,
  local_rank: site => site.hasPhysicalStorefront === false,
})

export function coverage(checks = [], site = {}) {
  const misuse = []
  const applicable = []
  for (const check of checks) {
    if (check.status === 'not_applicable') {
      const rule = APPLICABILITY_RULES[check.id]
      if (!rule || rule(site) !== true) {
        misuse.push(finding('not_applicable_misused', 'critical',
          `"${check.id}" is marked NOT_APPLICABLE, but the concept applies to this site`, { check: check.id }))
        applicable.push(check)
      }
      continue
    }
    applicable.push(check)
  }
  const measured = applicable.filter(c => MEASURED.has(c.status))
  const failed = measured.filter(c => c.status === 'fail')
  return {
    findings: misuse,
    applicable: applicable.length,
    measured: measured.length,
    failures: failed.length,
    quality: measured.length ? Math.round(((measured.length - failed.length) / measured.length) * 100) : null,
    evidenceCoverage: applicable.length ? Math.round((measured.length / applicable.length) * 100) : 100,
    blockers: applicable.filter(c => c.status === 'not_connected' || c.status === 'not_measured')
      .map(c => ({ id: c.id, status: c.status, provider: c.provider || null })),
  }
}

/**
 * Verified 100 is a conclusion drawn from evidence, never a value anyone may set. It takes
 * no `verified` input on purpose: there is no argument to this function that says "pass".
 */
export function verified100(checks = [], site = {}, { criticalFindings = 0, highFindings = 0, validationFailures = 0, syntheticEvidence = 0 } = {}) {
  const c = coverage(checks, site)
  const reasons = []
  if (c.quality !== 100) reasons.push(`quality is ${c.quality === null ? 'unmeasured' : c.quality}, not 100`)
  if (c.evidenceCoverage !== 100) reasons.push(`evidence coverage is ${c.evidenceCoverage}, not 100`)
  if (criticalFindings > 0) reasons.push(`${criticalFindings} critical finding(s) open`)
  if (highFindings > 0) reasons.push(`${highFindings} high finding(s) open`)
  if (validationFailures > 0) reasons.push(`${validationFailures} validation failure(s)`)
  if (syntheticEvidence > 0) reasons.push(`${syntheticEvidence} synthetic evidence record(s) would have to be counted as live`)
  if (c.findings.length) reasons.push(`${c.findings.length} check(s) misuse NOT_APPLICABLE`)
  return {
    verified: reasons.length === 0,
    outcome: reasons.length === 0 ? 'verified_100'
      : (c.quality === 100 && criticalFindings === 0 && highFindings === 0 && validationFailures === 0)
        ? 'controllable_quality_100' : 'incomplete',
    quality: c.quality,
    evidenceCoverage: c.evidenceCoverage,
    blockers: c.blockers,
    reasons,
  }
}
