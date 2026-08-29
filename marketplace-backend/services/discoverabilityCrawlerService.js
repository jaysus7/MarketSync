import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import { browserFetch, supabaseAdmin } from '../shared.js'

export const CRAWLER_USER_AGENT = 'MarketSync-DiscoverabilityBot/1.0 (+https://marketsync.link)'
const DEFAULTS = Object.freeze({ maxPages: 50, maxDepth: 3, timeoutMs: 10000, concurrency: 2, retryCount: 1, sameHostOnly: true, respectRobots: true, delayMs: 150 })
const PRIVATE_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal', 'metadata'])

function ipv4ToNumber(ip) { return ip.split('.').reduce((n, octet) => (n * 256) + Number(octet), 0) }
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const n = ipv4ToNumber(ip)
    return n === 0 || (n >= 0x0a000000 && n <= 0x0affffff) || (n >= 0x7f000000 && n <= 0x7fffffff) || (n >= 0xa9fe0000 && n <= 0xa9feffff) || (n >= 0xac100000 && n <= 0xac1fffff) || (n >= 0xc0a80000 && n <= 0xc0a8ffff) || (n >= 0x64400000 && n <= 0x647fffff)
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.')
  }
  return true
}

export async function assertSafeUrl(input, { resolveDns = true, allowPrivateForTests = false } = {}) {
  let url
  try { url = new URL(input) } catch { throw new Error('Invalid crawl URL') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) crawl URLs are allowed')
  if (url.username || url.password) throw new Error('Credentialed crawl URLs are not allowed')
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!allowPrivateForTests && (PRIVATE_HOSTS.has(hostname) || isPrivateIp(hostname))) throw new Error('Private or internal crawl targets are blocked')
  if (resolveDns && net.isIP(hostname) === 0) {
    const records = await dns.lookup(hostname, { all: true })
    if (!records.length || (!allowPrivateForTests && records.some(record => isPrivateIp(record.address)))) throw new Error('Crawl target resolves to a private or internal address')
  }
  return url
}

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function cleanText(value) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }
function attr(tag, name) { const match = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag); return match?.[1]?.trim() || null }
function allTags(html, name) { return [...String(html || '').matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi'))] }
function absoluteUrl(value, base) { try { return new URL(value, base).href } catch { return null } }

export function parseRobotsTxt(text, baseUrl) {
  const groups = []; let current = null; let sitemaps = []
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue
    const [key, ...parts] = line.split(':'); const value = parts.join(':').trim(); const k = key.toLowerCase()
    if (k === 'user-agent') { current = { userAgents: [value.toLowerCase()], allow: [], disallow: [] }; groups.push(current) }
    else if (k === 'allow' && current) current.allow.push(value)
    else if (k === 'disallow' && current) current.disallow.push(value)
    else if (k === 'sitemap') { const url = absoluteUrl(value, baseUrl); if (url) sitemaps.push(url) }
  }
  const matching = agent => groups.filter(g => g.userAgents.includes('*') || g.userAgents.includes(agent.toLowerCase()))
  const allowed = (target, agent = 'marketsync-discoverabilitybot') => {
    let path = new URL(target).pathname || '/'; const candidates = matching(agent).concat(matching('*'))
    const rules = candidates.flatMap(g => [...g.allow.map(pattern => ({ allow: true, pattern })), ...g.disallow.map(pattern => ({ allow: false, pattern }))]).filter(r => r.pattern)
    const best = rules.sort((a, b) => b.pattern.length - a.pattern.length)[0]
    return !best || best.allow || !path.startsWith(best.pattern)
  }
  return { groups, sitemaps: [...new Set(sitemaps)], allowed }
}

function parseJsonLd(html, sourceUrl) {
  const items = []; const parseErrors = []
  for (const block of allTags(html, 'script')) {
    if ((attr(block[0], 'type') || '').toLowerCase() !== 'application/ld+json') continue
    const raw = block[1].trim(); try {
      const parsed = JSON.parse(raw); const values = Array.isArray(parsed) ? parsed : [parsed]
      for (const value of values) for (const entity of value?.['@graph'] ? value['@graph'] : [value]) items.push({ sourceUrl, context: entity?.['@context'] || null, type: entity?.['@type'] || null, entity })
    } catch (error) { parseErrors.push({ sourceUrl, message: error.message, snippet: raw.slice(0, 240) }) }
  }
  return { items, parseErrors }
}

export function parsePublicHtml(html, sourceUrl) {
  const title = cleanText(allTags(html, 'title')[0]?.[1]) || null
  const meta = {}; for (const match of String(html || '').matchAll(/<meta\b([^>]*)>/gi)) { const tag = match[0]; const name = attr(tag, 'name') || attr(tag, 'property'); const content = attr(tag, 'content'); if (name && content != null) meta[name.toLowerCase()] = content }
  const headings = {}; for (const level of ['h1', 'h2', 'h3']) headings[level] = allTags(html, level).map(m => cleanText(m[1])).filter(Boolean)
  const links = [...String(html || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m => ({ url: absoluteUrl(attr(m[0], 'href'), sourceUrl), href: attr(m[0], 'href'), anchor: cleanText(m[2]), rel: attr(m[0], 'rel') || '' })).filter(l => l.url)
  const images = [...String(html || '').matchAll(/<img\b[^>]*>/gi)].map(m => ({ src: absoluteUrl(attr(m[0], 'src') || attr(m[0], 'data-src'), sourceUrl), alt: attr(m[0], 'alt'), width: attr(m[0], 'width'), height: attr(m[0], 'height'), loading: attr(m[0], 'loading') || null })).filter(i => i.src)
  const schema = parseJsonLd(html, sourceUrl)
  const visibleText = cleanText(String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, ' '))
  const canonicalTags = [...String(html || '').matchAll(/<link\b[^>]*>/gi)].filter(m => (attr(m[0], 'rel') || '').toLowerCase().split(/\s+/).includes('canonical')).map(m => absoluteUrl(attr(m[0], 'href'), sourceUrl)).filter(Boolean)
  const findings = []; const evidence = field => ({ sourceType: 'crawler', sourceUrl, measuredAt: new Date().toISOString(), rawValue: field, verified: true })
  if (!title) findings.push({ type: 'missing_title', severity: 'high', evidence: evidence(null) })
  if (title && (title.length < 10 || title.length > 65)) findings.push({ type: 'title_length', severity: 'medium', evidence: evidence(title) })
  if (!meta.description) findings.push({ type: 'missing_meta_description', severity: 'medium', evidence: evidence(null) })
  if (!canonicalTags.length) findings.push({ type: 'missing_canonical', severity: 'high', evidence: evidence(null) })
  if (canonicalTags.length > 1) findings.push({ type: 'multiple_canonicals', severity: 'high', evidence: evidence(canonicalTags) })
  if (!headings.h1.length) findings.push({ type: 'missing_h1', severity: 'medium', evidence: evidence([]) })
  if (headings.h1.length > 1) findings.push({ type: 'multiple_h1', severity: 'medium', evidence: evidence(headings.h1) })
  for (const image of images) if (image.alt == null || image.alt === '') findings.push({ type: 'missing_image_alt', severity: 'low', evidence: evidence(image) })
  for (const link of links) if (link.url.startsWith('http:') && sourceUrl.startsWith('https:')) findings.push({ type: 'insecure_http_asset_or_link', severity: 'medium', evidence: evidence(link.url) })
  return { title, metaDescription: meta.description || null, robots: meta.robots || null, canonical: canonicalTags[0] || null, canonicals: canonicalTags, viewport: meta.viewport || null, language: attr(String(html).match(/<html\b[^>]*>/i)?.[0] || '', 'lang'), openGraph: Object.fromEntries(Object.entries(meta).filter(([k]) => k.startsWith('og:'))), twitter: Object.fromEntries(Object.entries(meta).filter(([k]) => k.startsWith('twitter:'))), headings, visibleTextLength: visibleText.length, links, images, schema, findings }
}

async function fetchWithRedirects(input, options) {
  const maxRedirects = 5; const redirectChain = []; const allowPrivateForTests = process.env.NODE_ENV === 'test' && options.allowPrivateForTests === true; let current = await assertSafeUrl(input, { allowPrivateForTests }); let response
  for (let i = 0; i <= maxRedirects; i++) {
    response = await browserFetch(current.href, { redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs), headers: { 'User-Agent': options.userAgent, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location'); if (!location) break
    redirectChain.push({ from: current.href, statusCode: response.status, to: absoluteUrl(location, current.href) })
    current = await assertSafeUrl(absoluteUrl(location, current.href), { allowPrivateForTests }); if (redirectChain.some(item => item.from === current.href)) throw new Error('Redirect loop detected')
  }
  if (redirectChain.length > maxRedirects) throw new Error('Excessive redirect chain')
  const body = await response.text(); return { response, body, finalUrl: current.href, redirectChain }
}

export async function crawlUrl(input, options = {}) {
  const config = { ...DEFAULTS, ...options }; const started = Date.now(); let result
  for (let attempt = 0; attempt <= config.retryCount; attempt++) { try { result = await fetchWithRedirects(input, config); break } catch (error) { if (attempt === config.retryCount) return { requestedUrl: input, finalUrl: null, statusCode: null, redirectChain: [], contentType: null, responseTimeMs: Date.now() - started, fetchedAt: new Date().toISOString(), robotsAllowed: null, bodyHash: null, error: error.message } } }
  const contentType = result.response.headers.get('content-type') || ''; const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType)
  return { requestedUrl: input, finalUrl: result.finalUrl, statusCode: result.response.status, redirectChain: result.redirectChain, contentType, responseTimeMs: Date.now() - started, fetchedAt: new Date().toISOString(), robotsAllowed: true, bodyHash: sha256(result.body), ...(isHtml ? { html: parsePublicHtml(result.body, result.finalUrl) } : {}), body: result.body.slice(0, 200000) }
}

async function persistCrawl(run, pages, findings) {
  try {
    const { data } = await supabaseAdmin.from('discoverability_crawl_runs').insert({ dealership_id: run.dealershipId || null, base_url: run.baseUrl, status: run.status, options: run.options, started_at: run.startedAt, completed_at: run.completedAt, page_count: pages.length, finding_count: findings.length }).select('id').maybeSingle()
    if (data?.id) { await supabaseAdmin.from('discoverability_crawl_pages').insert(pages.map(page => ({ crawl_run_id: data.id, requested_url: page.requestedUrl, final_url: page.finalUrl, status_code: page.statusCode, content_type: page.contentType, response_time_ms: page.responseTimeMs, redirect_chain: page.redirectChain, robots_allowed: page.robotsAllowed, body_hash: page.bodyHash, metadata: page.html || null, fetched_at: page.fetchedAt }))); if (findings.length) await supabaseAdmin.from('discoverability_crawl_findings').insert(findings.map(f => ({ crawl_run_id: data.id, url: f.sourceUrl, finding_type: f.type, severity: f.severity, evidence: f.evidence }))) }
    return data?.id || null
  } catch { return null }
}

export async function crawlSite(baseUrl, options = {}) {
  const config = { ...DEFAULTS, ...options }; const base = await assertSafeUrl(baseUrl, { allowPrivateForTests: process.env.NODE_ENV === 'test' && config.allowPrivateForTests === true }); const robotsUrl = new URL('/robots.txt', base).href
  let robots = { groups: [], sitemaps: [], allowed: () => true }; try { const r = await crawlUrl(robotsUrl, { ...config, respectRobots: false }); if (r.statusCode === 200) robots = parseRobotsTxt(r.body, base.href) } catch {}
  const queue = [{ url: base.href, depth: 0 }]; const seen = new Set(); const pages = []; const findings = []
  async function worker() {
    while (true) {
      const next = queue.shift(); if (!next || pages.length >= config.maxPages) return
      if (seen.has(next.url) || next.depth > config.maxDepth) continue; seen.add(next.url)
      if (config.respectRobots && !robots.allowed(next.url)) { pages.push({ requestedUrl: next.url, finalUrl: null, statusCode: null, redirectChain: [], contentType: null, responseTimeMs: 0, fetchedAt: new Date().toISOString(), robotsAllowed: false, bodyHash: null }); continue }
      const page = await crawlUrl(next.url, config); if (pages.length >= config.maxPages) return; pages.push(page); if (page.html) { for (const finding of page.html.findings) findings.push({ ...finding, sourceUrl: page.finalUrl })
        for (const link of page.html.links) { const parsed = new URL(link.url); if (config.sameHostOnly && parsed.host !== base.host) continue; if (!seen.has(link.url) && ['http:', 'https:'].includes(parsed.protocol)) queue.push({ url: link.url, depth: next.depth + 1 }) }
      }
      if (config.delayMs) await new Promise(resolve => setTimeout(resolve, config.delayMs))
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(Number(config.concurrency) || 1, 8)) }, () => worker()))
  const byUrl = new Map(pages.map(page => [page.finalUrl || page.requestedUrl, page]))
  for (const page of pages) for (const link of page.html?.links || []) {
    if (config.sameHostOnly && new URL(link.url).host !== base.host) continue
    const destination = byUrl.get(link.url)
    if (destination && (destination.statusCode == null || destination.statusCode >= 400)) findings.push({ type: 'broken_internal_link', severity: 'high', sourceUrl: page.finalUrl, evidence: { sourceType: 'crawler', sourceUrl: page.finalUrl, measuredAt: new Date().toISOString(), rawValue: { href: link.url, statusCode: destination.statusCode }, verified: true } })
  }
  const titles = new Map(); for (const page of pages) { const title = page.html?.title; if (title) titles.set(title, [...(titles.get(title) || []), page.finalUrl]) }
  for (const [title, urls] of titles) if (urls.length > 1) findings.push({ type: 'duplicate_title', severity: 'medium', sourceUrl: urls[0], evidence: { sourceType: 'crawler', sourceUrl: urls[0], measuredAt: new Date().toISOString(), rawValue: { title, urls }, verified: true } })
  const resourceUrls = [...new Set(pages.flatMap(page => (page.html?.images || []).map(image => image.src)).filter(Boolean))].slice(0, config.maxPages * 4)
  for (const resourceUrl of resourceUrls) {
    try {
      const resource = await fetchWithRedirects(resourceUrl, config)
      if (resource.response.status >= 400) findings.push({ type: 'broken_image', severity: 'medium', sourceUrl: resourceUrl, evidence: { sourceType: 'crawler', sourceUrl: resourceUrl, measuredAt: new Date().toISOString(), statusCode: resource.response.status, verified: true } })
    } catch (error) { findings.push({ type: 'broken_image', severity: 'medium', sourceUrl: resourceUrl, evidence: { sourceType: 'crawler', sourceUrl: resourceUrl, measuredAt: new Date().toISOString(), error: error.message, verified: true } }) }
  }
  const sitemapQueue = [...new Set([...robots.sitemaps, new URL('/sitemap.xml', base).href])]; const visitedSitemaps = new Set(); const sitemaps = []
  while (sitemapQueue.length && visitedSitemaps.size < 25) {
    const sitemapUrl = sitemapQueue.shift(); if (visitedSitemaps.has(sitemapUrl)) continue; visitedSitemaps.add(sitemapUrl)
    try {
      const sitemap = await crawlUrl(sitemapUrl, { ...config, respectRobots: false })
      const parsed = sitemap.statusCode === 200 ? parseSitemapXml(sitemap.body, sitemap.finalUrl || sitemapUrl) : null
      sitemaps.push({ requestedUrl: sitemapUrl, statusCode: sitemap.statusCode, parsed })
      if (sitemap.statusCode !== 200) findings.push({ type: 'sitemap_unreachable', severity: 'medium', sourceUrl: sitemapUrl, evidence: { sourceType: 'crawler', sourceUrl: sitemapUrl, measuredAt: new Date().toISOString(), statusCode: sitemap.statusCode, verified: true } })
      else if (parsed?.malformed || parsed?.duplicateUrls?.length) findings.push({ type: 'sitemap_invalid', severity: 'medium', sourceUrl: sitemapUrl, evidence: { sourceType: 'crawler', sourceUrl: sitemapUrl, measuredAt: new Date().toISOString(), rawValue: parsed, verified: true } })
      if (parsed?.type === 'index') sitemapQueue.push(...parsed.urls.filter(url => new URL(url).host === base.host))
    } catch (error) { sitemaps.push({ requestedUrl: sitemapUrl, statusCode: null, error: error.message }) }
  }
  const run = { baseUrl: base.href, options: config, status: 'completed', startedAt: pages[0]?.fetchedAt || new Date().toISOString(), completedAt: new Date().toISOString(), pageCount: pages.length, findingCount: findings.length }
  run.persistenceId = config.persist === false ? null : await persistCrawl(run, pages, findings); return { ...run, robots, robotsPolicies: verifyRobotsPolicies(robots), sitemaps, pages, findings }
}

export function verifyExpectedVsPublished(expected = {}, observed = {}) {
  const checks = ['title', 'metaDescription', 'canonical', 'indexable']; return checks.map(field => ({ field, expected: expected[field] ?? null, observed: observed[field] ?? null, matched: expected[field] == null ? null : String(expected[field]) === String(observed[field]), source: 'website_builder_vs_live' }))
}

export function parseSitemapXml(xml, baseUrl) {
  const text = String(xml || ''); const isIndex = /<sitemapindex\b/i.test(text); const locs = [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => absoluteUrl(m[1], baseUrl)).filter(Boolean)
  const lastmods = [...text.matchAll(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/gi)].map(m => m[1].trim())
  const malformed = !/<(?:urlset|sitemapindex)\b/i.test(text) || /<loc>[^<]*<loc>/i.test(text)
  return { type: isIndex ? 'index' : 'urlset', urls: locs, entries: locs.map((url, index) => ({ url, lastmod: lastmods[index] || null })), duplicateUrls: locs.filter((url, i) => locs.indexOf(url) !== i), malformed }
}

export function verifyRobotsPolicies(robots) {
  const groups = robots?.groups || []; const policyFor = agent => groups.filter(group => group.userAgents.includes('*') || group.userAgents.includes(agent.toLowerCase())).flatMap(group => ({ allow: group.allow, disallow: group.disallow }))
  return { search: { googlebot: policyFor('googlebot'), bingbot: policyFor('bingbot') }, aiSearch: { 'gptbot': policyFor('gptbot'), 'oai-searchbot': policyFor('oai-searchbot'), 'perplexitybot': policyFor('perplexitybot'), 'claudebot': policyFor('claudebot'), 'claude-searchbot': policyFor('claude-searchbot') }, classification: 'Robots policies are reported as observed; AI training-crawler blocking is not an SEO failure by itself.' }
}
