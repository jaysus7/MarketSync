import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  auditLlmsTxt, auditSitemap, auditRobots, classifyRobots, auditSchemaAgainstVisible,
  auditOpenGraph, auditLinkGraph, auditCanonical, auditFactConsistency,
  coverage, verified100, visibleText, jsonLdBlocks,
} from '../services/corporateFactAudit.js'
import { calculateGeoMetrics } from '../services/aeoGeoTruthService.js'
import { sxoStageEvidence } from '../services/discoverabilityAutopilotService.js'

// Batch 9 turns the Discoverability platform on MarketSync's own public site. These tests
// cover the detectors that made that possible — the ones that catch a site confidently
// stating something that stopped being true — plus the rules that decide whether a score
// may be called Verified 100.
//
// Every detector is fed BOTH a failing and a passing input. A detector only ever tested
// against known-bad data cannot distinguish "clean" from "broken", and would keep passing
// if it were quietly gutted.

const FE = fileURLToPath(new URL('../../marketplace-frontend/', import.meta.url))
const read = (rel) => readFileSync(path.join(FE, rel), 'utf8')
const types = (result) => result.findings.map((f) => f.type)

// ── 1–3. The audit is evidence-driven, and MarketSync gets no special treatment ──────

test('MarketSync is audited by the same rules as any customer site — no hostname shortcut', () => {
  // A "trusted domain" branch is how an audit stops being evidence. The detectors must
  // carry no knowledge of who they are looking at.
  const source = readFileSync(new URL('../services/corporateFactAudit.js', import.meta.url), 'utf8')
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /marketsync\.link/i, 'no detector may hardcode the corporate hostname')
  assert.doesNotMatch(code, /\btrustedDomains?\b|\bskipDomains?\b|\ballowlist\b/i)
})

test('the same finding is produced whoever the site belongs to', () => {
  const stub = (host) => `<html><head><link rel="canonical" href="https://${host}/a.html"></head><body></body></html>`
  const mine = auditOpenGraph(stub('marketsync.link'), { url: 'https://marketsync.link/a.html' })
  const theirs = auditOpenGraph(stub('abcmotors.com'), { url: 'https://abcmotors.com/a.html' })
  assert.deepEqual(types(mine), types(theirs))
  assert.ok(mine.findings.length > 0, 'a page with no social metadata must fail for everyone')
})

test('Batch 9 cannot claim a live crawl it did not run', () => {
  // The proof of a fix is the public response, not the repository. Nothing here may
  // present a file read from disk as live evidence.
  const source = readFileSync(new URL('../services/corporateFactAudit.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /readFileSync|fetch\(/, 'the auditors are pure: callers supply the evidence')
})

// ── 4–8. Stale machine-readable identity and fact drift ─────────────────────────────

const STALE_LLMS = `# MarketSync
> MarketSync helps dealerships post inventory to Facebook Marketplace.
## Pricing
- **Dealer Plan — $499/month**
- **Individual Sales Rep Plan — $79/month**
- Every account starts with a 7-day free trial.
`

test('a stale llms.txt is detected by the claims it still makes', () => {
  const result = auditLlmsTxt(STALE_LLMS, {
    retiredTerms: ['Chrome extension', 'Dealer Plan'],
    currentProducts: ['DealerOS', 'MarketSync Digital'],
    pricingUrl: 'https://marketsync.link/pricing.html',
  })
  assert.ok(result.stale, 'a file naming a retired plan and hardcoding prices is stale')
  assert.ok(types(result).includes('llms_txt_retired_claim'))
  assert.ok(types(result).includes('llms_txt_duplicated_price'))
  assert.ok(types(result).includes('llms_txt_missing_product'))
})

test('the current llms.txt passes the same detector', () => {
  // The real file, not a fixture: this is the check that would have caught the original.
  const result = auditLlmsTxt(read('llms.txt'), {
    retiredTerms: ['Dealer Plan —', 'Individual Sales Rep Plan', '7-day free trial, no credit card'],
    currentProducts: ['DealerOS', 'MarketSync Digital', 'AI Customer Agent', 'Design Studio', 'Campaigns'],
    pricingUrl: 'https://marketsync.link/pricing.html',
    knownUrls: null,
  })
  assert.equal(result.stale, false, `llms.txt is stale again: ${JSON.stringify(result.findings, null, 2)}`)
})

test('llms.txt names no price at all, because a duplicated price is the thing that drifts', () => {
  assert.doesNotMatch(read('llms.txt'), /\$\s?\d/, 'prices belong on the canonical pricing page only')
  assert.match(read('llms.txt'), /https:\/\/marketsync\.link\/pricing\.html/)
})

test('every URL llms.txt publishes resolves to a real page', () => {
  const urls = [...read('llms.txt').matchAll(/https:\/\/marketsync\.link\/([^\s)\]]*)/g)].map((m) => m[1])
  const dead = [...new Set(urls)].filter((u) => u && !existsSync(path.join(FE, u)))
  assert.deepEqual(dead, [], `llms.txt points at pages that do not exist: ${dead.join(', ')}`)
})

test('a dead URL in llms.txt is caught rather than published', () => {
  const result = auditLlmsTxt('See [Gone](https://x.test/gone.html)', { knownUrls: ['https://x.test/real.html'] })
  assert.ok(types(result).includes('llms_txt_dead_url'))
})

test('one fact stated two ways anywhere on the site is a contradiction, not a preference', () => {
  const bad = auditFactConsistency({
    'AutoPoster dealer price': [
      { source: 'llms.txt', value: '$499/mo' },
      { source: 'facebook-autoposter.html', value: '$149/mo' },
    ],
    'trial length': [{ source: 'index.html', value: '30 days' }, { source: 'llms.txt', value: '7 days' }],
  })
  assert.equal(bad.findings.length, 2)
  assert.ok(types(bad).every((t) => t === 'fact_inconsistent'))

  const good = auditFactConsistency({
    'trial length': [{ source: 'index.html', value: '30 days' }, { source: 'faq.html', value: '30 Days' }],
    'unstated': [{ source: 'a', value: null }, { source: 'b', value: '30 days' }],
  })
  assert.deepEqual(good.findings, [], 'case differences and unstated sources are not contradictions')
})

// ── 9–10. Structured data may describe the page; it may not invent facts ────────────

test('a schema price that appears nowhere a reader can see is reported', () => {
  const html = '<html><body><h1>Dealer Website</h1></body>'
    + '<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"249"}}</script></html>'
  assert.ok(types(auditSchemaAgainstVisible(html)).includes('schema_price_not_visible'))
})

test('a price the page actually shows is not reported', () => {
  const html = '<html><body><h1>Dealer Website</h1><p>$249 CAD/mo</p></body>'
    + '<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"249"}}</script></html>'
  assert.deepEqual(types(auditSchemaAgainstVisible(html)), [])
})

test('claiming the product is free is critical, not a rounding difference', () => {
  const html = '<html><body>Paid product</body>'
    + '<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"0","availability":"https://schema.org/InStock"}}</script></html>'
  const result = auditSchemaAgainstVisible(html)
  assert.ok(types(result).includes('schema_free_offer'))
  assert.equal(result.findings.find((f) => f.type === 'schema_free_offer').severity, 'critical')
})

test('no public page claims a rating, review or award it cannot support', () => {
  const fake = '<html><body>x</body><script type="application/ld+json">'
    + '{"@type":"Product","aggregateRating":{"ratingValue":"4.9","reviewCount":"217"}}</script></html>'
  assert.ok(types(auditSchemaAgainstVisible(fake)).includes('schema_unsupported_rating'))

  // And the real site carries none.
  const pages = [...read('sitemap.xml').matchAll(/<loc>[^<]*\/([^</]*)<\/loc>/g)].map((m) => m[1] || 'index.html')
  const offenders = pages.filter((p) => existsSync(path.join(FE, p))
    && auditSchemaAgainstVisible(read(p), { url: p }).findings
      .some((f) => f.type === 'schema_unsupported_rating' || f.type === 'schema_unsupported_award'))
  assert.deepEqual(offenders, [], `pages claiming ratings or awards: ${offenders.join(', ')}`)
})

test('no public page prices something a reader cannot see', () => {
  // Four feature pages each carried an Offer of USD $299 — a figure that belongs to
  // MarketSync Identity Verify on the pricing page, quoted in a currency that page
  // never uses, for products the catalog does not sell separately. Nothing rendered
  // it, so nothing contradicted it. This is the check that would have said so.
  const pages = [...read('sitemap.xml').matchAll(/<loc>[^<]*\/([^</]*)<\/loc>/g)].map((m) => m[1] || 'index.html')
  const offenders = []
  for (const p of pages) {
    if (!existsSync(path.join(FE, p))) continue
    for (const f of auditSchemaAgainstVisible(read(p), { url: p }).findings) {
      if (f.type === 'schema_price_not_visible' || f.type === 'schema_free_offer') offenders.push(`${p}: ${f.message}`)
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'))
})

test('the link graph counts absolute hrefs, or every page looks orphaned', () => {
  // The site writes its internal links absolutely (https://marketsync.link/x.html).
  // A caller that only extracts relative hrefs reports every strategic page as an
  // orphan — which is exactly what happened while auditing, and would have sent
  // someone adding navigation the site already had.
  const graph = auditLinkGraph({
    'index.html': { links: ['https://example.test/features.html', '/pricing.html', 'faq.html'] },
    'features.html': { links: [] },
    'pricing.html': { links: [] },
    'faq.html': { links: [] },
  }, { strategic: ['features.html', 'pricing.html', 'faq.html'] })
  assert.deepEqual(graph.findings, [], 'absolute, root-relative and bare hrefs all count as inbound links')
  assert.equal(graph.inbound['features.html'], 1, 'an absolute href is an inbound link')
})

test('malformed JSON-LD is a finding, not a silent skip', () => {
  const html = '<html><script type="application/ld+json">{"@type": broken}</script></html>'
  assert.ok(types(auditSchemaAgainstVisible(html)).includes('schema_malformed'))
})

// ── 11–12. The sitemap is a request to index ────────────────────────────────────────

const sitemapOf = (...paths) => `<urlset>${paths.map((p) => `<url><loc>https://x.test/${p}</loc></url>`).join('')}</urlset>`

test('a sitemap that invites Google into an authentication page is caught', () => {
  const result = auditSitemap(sitemapOf('login.html', 'reset-password.html', 'dashboard.html'),
    { 'login.html': {}, 'reset-password.html': {}, 'dashboard.html': {} })
  assert.equal(result.findings.length, 3)
  assert.ok(types(result).every((t) => t === 'sitemap_private_url'))
})

test('a sitemap of real, canonical, public pages passes', () => {
  const result = auditSitemap(sitemapOf('index.html', 'pricing.html'), {
    'index.html': { canonical: 'https://x.test/index.html' },
    'pricing.html': { canonical: 'https://x.test/pricing.html' },
  })
  assert.deepEqual(result.findings, [])
})

test('a URL that canonicalises elsewhere must not also be listed for indexing', () => {
  const stub = auditSitemap(sitemapOf('social-scheduler.html'),
    { 'social-scheduler.html': { redirectsTo: '/design-studio.html' } })
  assert.ok(types(stub).includes('sitemap_redirect_stub'))
  const away = auditSitemap(sitemapOf('a.html'), { 'a.html': { canonical: 'https://x.test/b.html' } })
  assert.ok(types(away).includes('sitemap_canonicalised_away'))
})

test("the live sitemap contains no auth page, dead URL or page that canonicalises away", () => {
  const pages = {}
  for (const m of read('sitemap.xml').matchAll(/<loc>[^<]*\/([^</]*)<\/loc>/g)) {
    const name = m[1] || 'index.html'
    if (!existsSync(path.join(FE, name))) continue
    const html = read(name)
    pages[name] = {
      canonical: (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1],
      redirectsTo: (html.match(/http-equiv=["']refresh["'][^>]+url=([^"'>]+)/i) || [])[1],
    }
  }
  const result = auditSitemap(read('sitemap.xml'), pages)
  assert.deepEqual(result.findings, [], JSON.stringify(result.findings, null, 2))
})

// ── 13–14. Crawler policy: search and training are different questions ──────────────

test('robots.txt agents are classified as search or training, not lumped together', () => {
  const parsed = classifyRobots(read('robots.txt'))
  assert.ok(parsed.search.includes('oai-searchbot'), 'retrieval crawlers must be recognised')
  assert.ok(parsed.training.includes('gptbot'), 'training crawlers must be recognised')
  assert.equal(parsed.search.some((a) => parsed.training.includes(a)), false, 'the two sets are disjoint')
  assert.ok(parsed.sitemaps.length >= 1, 'robots.txt must point at the sitemap')
})

test('blocking a training crawler is a policy choice, never reported as an SEO failure', () => {
  const blocksTraining = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n'
  const result = auditRobots(blocksTraining)
  assert.deepEqual(result.blockedTraining, ['gptbot'])
  assert.deepEqual(result.findings, [], 'a site may decline training use without losing points')

  const blocksSearch = 'User-agent: Googlebot\nDisallow: /\n'
  const bad = auditRobots(blocksSearch)
  assert.ok(types(bad).includes('robots_blocks_search_crawler'))
  assert.equal(bad.findings[0].severity, 'critical')
})

test('the live robots.txt blocks no search crawler and references its sitemap', () => {
  const result = auditRobots(read('robots.txt'), { expectedSitemaps: ['https://marketsync.link/sitemap.xml'] })
  assert.deepEqual(result.findings, [], JSON.stringify(result.findings))
})

// ── 15–17. Link graph and canonical integrity ───────────────────────────────────────

test('a link to a page that does not exist is a finding', () => {
  const result = auditLinkGraph({
    'index.html': { links: ['/pricing.html', '/gone.html'] },
    'pricing.html': { links: [] },
  })
  assert.ok(types(result).includes('broken_internal_link'))
  assert.equal(result.findings[0].target, 'gone.html')
})

test('a strategic page nothing links to is an orphan, however well it is written', () => {
  const orphaned = auditLinkGraph(
    { 'index.html': { links: ['/pricing.html'] }, 'pricing.html': { links: [] }, 'dealer-os.html': { links: [] } },
    { strategic: ['dealer-os.html'] })
  assert.ok(types(orphaned).includes('orphan_strategic_page'))

  const linked = auditLinkGraph(
    { 'index.html': { links: ['/dealer-os.html'] }, 'dealer-os.html': { links: [] } },
    { strategic: ['dealer-os.html'] })
  assert.deepEqual(linked.findings, [])
})

test('a page that redirects one way and canonicalises another is stale', () => {
  const stale = auditCanonical({ canonical: 'https://x.test/old.html', redirectsTo: 'https://x.test/new.html' })
  assert.ok(types(stale).includes('canonical_stale'))
  const agreeing = auditCanonical({ canonical: 'https://x.test/new.html', redirectsTo: 'https://x.test/new.html' })
  assert.deepEqual(agreeing.findings, [])
  assert.ok(types(auditCanonical({})).includes('canonical_missing'))
  assert.ok(types(auditCanonical({ canonical: 'https://x.test/a', canonicalCount: 2 })).includes('canonical_multiple'))
})

// ── 18. Social preview metadata ─────────────────────────────────────────────────────

test('missing, broken or self-contradicting social metadata is reported', () => {
  const bare = auditOpenGraph('<html><head></head></html>')
  assert.ok(types(bare).filter((t) => t === 'og_missing').length >= 4)

  const broken = auditOpenGraph('<meta property="og:image" content="https://x.test/none.png">',
    { assetExists: () => false })
  assert.ok(types(broken).includes('og_broken_image'))

  const conflicting = auditOpenGraph(
    '<link rel="canonical" href="https://x.test/a.html"><meta property="og:url" content="https://x.test/b.html">')
  assert.ok(types(conflicting).includes('og_url_conflicts_canonical'))
})

test('every indexable public page carries a complete social card', () => {
  const pages = [...read('sitemap.xml').matchAll(/<loc>[^<]*\/([^</]*)<\/loc>/g)].map((m) => m[1] || 'index.html')
  const bad = []
  for (const p of pages) {
    if (!existsSync(path.join(FE, p))) continue
    const html = read(p)
    if (/http-equiv=["']refresh["']/i.test(html)) continue
    const result = auditOpenGraph(html, {
      url: p,
      assetExists: (image) => existsSync(path.join(FE, image.replace(/^https?:\/\/[^/]+\//, ''))),
    })
    const real = result.findings.filter((f) => f.severity !== 'low')
    if (real.length) bad.push(`${p}: ${real.map((f) => f.message).join('; ')}`)
  }
  assert.deepEqual(bad, [], bad.join('\n'))
})

// ── FAQ structured data may only describe what the page shows ──────────────────────

test('every FAQPage question and answer is visibly present on the page', () => {
  // Compare each question against its OWN visible Q&A, never against a page-wide blob:
  // stripping tags from the whole page turns inline markup — "(<strong>X</strong>)" —
  // into "( X )", which reads as a mismatch when the copy is identical. A check that
  // cries wolf gets muted, and then a real schema-only claim walks straight past it.
  const norm = (t) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

  for (const page of ['faq.html']) {
    const html = read(page)
    const visible = new Map()
    for (const m of html.matchAll(/<div class="qa[^"]*"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/div>/g)) {
      visible.set(norm(m[1]), norm(m[2]))
    }
    assert.ok(visible.size > 0, `${page} renders no visible Q&A pairs`)

    const problems = []
    let checked = 0
    for (const block of jsonLdBlocks(html)) {
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (!node || typeof node !== 'object') return
        if (node['@type'] === 'Question') {
          checked += 1
          const q = norm(node.name || '')
          const a = norm((node.acceptedAnswer || {}).text || '')
          if (!visible.has(q)) problems.push(`${page}: schema asks "${q}", which the page never shows`)
          else if (visible.get(q) !== a) problems.push(`${page}: the answer to "${q}" differs from the page`)
        }
        Object.values(node).forEach(walk)
      }
      walk(block)
    }
    assert.equal(checked, visible.size,
      `${page} emits ${checked} FAQ questions but shows ${visible.size} — schema and page must describe the same set`)
    assert.deepEqual(problems, [], problems.join('\n'))
  }
})

// ── Accessibility of the public pages (Batch 9 STEP 20) ────────────────────────────

// `named` mirrors how a browser actually resolves an accessible name, because a
// looser check invents work and a stricter one hides it. Three ways count: an
// explicit aria-label/labelledby, an id a <label for> can point at, or sitting
// inside an open <label>. A placeholder is NOT one of them — it disappears the
// moment someone types, and that was the real gap on the lead form.
const isNamed = (html, tag, at) => {
  if (/aria-label|aria-labelledby|\bid\s*=/.test(tag)) return true
  if (/type\s*=\s*["'](hidden|submit|button|image)["']/.test(tag)) return true
  const before = html.slice(0, at)
  return before.lastIndexOf('<label') > before.lastIndexOf('</label>')
}

test('every form control on a public page has an accessible name', () => {
  const pages = [...read('sitemap.xml').matchAll(/<loc>[^<]*\/([^</]*)<\/loc>/g)].map((m) => m[1] || 'index.html')
  const unnamed = []
  for (const p of pages) {
    if (!existsSync(path.join(FE, p))) continue
    const body = read(p).replace(/<script[\s\S]*?<\/script>/g, '')
    for (const m of body.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)) {
      if (!isNamed(body, m[0], m.index)) unnamed.push(`${p}: ${m[0].slice(0, 90)}`)
    }
  }
  assert.deepEqual(unnamed, [], `controls a screen reader cannot name:\n${unnamed.join('\n')}`)
})

test('a placeholder alone does not count as an accessible name', () => {
  // Guards the check itself: if `named` ever accepted a placeholder, the test above
  // would pass on a page full of unlabelled inputs.
  const bare = '<form><input name="email" placeholder="Work email"></form>'
  assert.equal(isNamed(bare, '<input name="email" placeholder="Work email">', bare.indexOf('<input')), false)
  const wrapped = '<label>Work email <input name="email"></label>'
  assert.equal(isNamed(wrapped, '<input name="email">', wrapped.indexOf('<input')), true)
  const labelled = '<input aria-label="Work email">'
  assert.equal(isNamed(labelled, labelled, 0), true)
})

test('every public page declares a document language and exactly one h1', () => {
  const pages = [...read('sitemap.xml').matchAll(/<loc>[^<]*\/([^</]*)<\/loc>/g)].map((m) => m[1] || 'index.html')
  const problems = []
  for (const p of pages) {
    if (!existsSync(path.join(FE, p))) continue
    const html = read(p)
    if (!/<html[^>]+lang=/.test(html)) problems.push(`${p}: no lang on <html>`)
    const h1 = (html.replace(/<script[\s\S]*?<\/script>/g, '').match(/<h1\b/g) || []).length
    if (h1 !== 1) problems.push(`${p}: ${h1} <h1> elements`)
  }
  assert.deepEqual(problems, [], problems.join('\n'))
})

// ── 19–20. AEO and GEO: measured, or not counted ────────────────────────────────────

test('an AEO answer that contradicts the canonical fact is a finding', () => {
  const result = auditFactConsistency({
    'What does MarketSync cost?': [
      { source: 'faq.html', value: 'from $1,499' },
      { source: 'pricing.html', value: 'from $399' },
    ],
  })
  assert.ok(types(result).includes('fact_inconsistent'))
})

test('synthetic GEO runs never count toward live evidence', () => {
  const syntheticOnly = calculateGeoMetrics([
    { evidenceType: 'synthetic_test', dealershipMentioned: true, dealershipCited: true, factualAccuracy: true },
    { evidenceType: 'synthetic_test', dealershipMentioned: true, dealershipCited: true, factualAccuracy: true },
  ])
  assert.equal(syntheticOnly.status, 'not_measured')
  assert.equal(syntheticOnly.evidenceCoverage, 0)
  assert.equal(syntheticOnly.score, null, 'a perfect synthetic run must not produce a score')
  assert.equal(syntheticOnly.syntheticRuns, 2)

  const live = calculateGeoMetrics([{ evidenceType: 'live_ai_response', dealershipMentioned: true, dealershipCited: true, factualAccuracy: true }])
  assert.equal(live.status, 'measured')
  assert.equal(live.evidenceCoverage, 100)
})

// ── 21–25. Coverage arithmetic: what counts, what does not, and what may be excused ──

const site = { sellsVehiclesOnline: false, hasPhysicalStorefront: false }

test('a disconnected provider lowers evidence coverage instead of scoring zero', () => {
  const result = coverage([
    { id: 'metadata', status: 'pass' },
    { id: 'canonical', status: 'pass' },
    { id: 'search_performance', status: 'not_connected', provider: 'google_search_console' },
  ], site)
  assert.equal(result.quality, 100, 'an unmeasured check cannot be counted as a failure')
  assert.equal(result.evidenceCoverage, 67)
  assert.deepEqual(result.blockers, [{ id: 'search_performance', status: 'not_connected', provider: 'google_search_console' }])
})

test('NOT_APPLICABLE leaves the denominator rather than lowering the score', () => {
  const result = coverage([
    { id: 'metadata', status: 'pass' },
    { id: 'vdp_inventory_integrity', status: 'not_applicable' },
  ], site)
  assert.equal(result.applicable, 1)
  assert.equal(result.evidenceCoverage, 100)
  assert.deepEqual(result.findings, [], 'a corporate site genuinely has no vehicle detail pages')
})

test('NOT_APPLICABLE cannot be used to hide a check that does apply', () => {
  const result = coverage([
    { id: 'metadata', status: 'not_applicable' },
    { id: 'local_rank', status: 'not_applicable' },
  ], { sellsVehiclesOnline: true, hasPhysicalStorefront: true })
  assert.equal(result.findings.length, 2, 'both are concepts that apply to this site')
  assert.ok(types(result).every((t) => t === 'not_applicable_misused'))
  assert.equal(result.applicable, 2, 'a misused exemption is put back into the denominator')
})

test('an uninstrumented funnel stage reduces coverage; a measured zero does not', () => {
  const partial = sxoStageEvidence([], ['landing_page_view', 'form_submitted'])
  assert.equal(partial.stages.landing_page_view.status, 'measured_zero')
  assert.equal(partial.stages.landing_page_view.count, 0, 'measured zero is a real count')
  assert.equal(partial.stages.deal_sold.status, 'not_instrumented')
  assert.equal(partial.stages.deal_sold.count, null, 'what was never measured must not read as zero')
  assert.ok(partial.evidenceCoverage < 100)

  const measured = sxoStageEvidence([], ['landing_page_view', 'srp_view', 'vdp_view', 'form_submitted',
    'lead_created', 'appointment_created', 'deal_sold', 'vehicle_delivered'])
  assert.equal(measured.evidenceCoverage, 100, 'a fully instrumented funnel reporting zeros is fully measured')
})

// ── 31–34. Verified 100 is a conclusion, never a setting ────────────────────────────

const clean = [{ id: 'metadata', status: 'pass' }, { id: 'canonical', status: 'pass' }]

test('Verified 100 takes no argument that could assert it', () => {
  // The guarantee is structural: there is no input to this function meaning "passed".
  const source = readFileSync(new URL('../services/corporateFactAudit.js', import.meta.url), 'utf8')
  const signature = source.slice(source.indexOf('export function verified100'))
  const params = signature.slice(signature.indexOf('(') + 1, signature.indexOf('{\n'))
  assert.doesNotMatch(params, /\bverified\b|forced|override|pass(ed)?\s*=/i,
    `verified100 accepts a parameter that could assert the result: ${params}`)
  const forced = verified100(clean, site, { criticalFindings: 0, highFindings: 0, verified: true, override: true })
  assert.equal(forced.verified, true, 'this input is clean on its own evidence')
  const dirty = verified100([...clean, { id: 'schema', status: 'fail' }], site, { verified: true, override: true })
  assert.equal(dirty.verified, false, 'an unrelated flag cannot rescue a real failure')
})

test('Quality 100 requires zero controllable failures', () => {
  assert.equal(verified100(clean, site).quality, 100)
  const failing = verified100([...clean, { id: 'schema', status: 'fail' }], site)
  assert.ok(failing.quality < 100)
  assert.equal(failing.verified, false)
  assert.match(failing.reasons.join(' '), /quality is \d+, not 100/)
})

test('Evidence 100 requires every applicable check to be measured', () => {
  const blocked = verified100([...clean, { id: 'search_performance', status: 'not_connected', provider: 'gsc' }], site)
  assert.equal(blocked.quality, 100)
  assert.ok(blocked.evidenceCoverage < 100)
  assert.equal(blocked.verified, false)
  // This is the honest outcome the spec names: controllable work finished, evidence blocked.
  assert.equal(blocked.outcome, 'controllable_quality_100')
  assert.deepEqual(blocked.blockers.map((b) => b.id), ['search_performance'])
})

test('a single synthetic record, or one open finding, is enough to withhold Verified 100', () => {
  assert.equal(verified100(clean, site, { syntheticEvidence: 1 }).verified, false)
  assert.equal(verified100(clean, site, { criticalFindings: 1 }).verified, false)
  assert.equal(verified100(clean, site, { highFindings: 1 }).verified, false)
  assert.equal(verified100(clean, site, { validationFailures: 1 }).verified, false)
  assert.equal(verified100(clean, site).outcome, 'verified_100')
})

test('a misused NOT_APPLICABLE withholds Verified 100 even when everything else is clean', () => {
  const gamed = verified100([{ id: 'metadata', status: 'not_applicable' }, { id: 'canonical', status: 'pass' }],
    { sellsVehiclesOnline: true, hasPhysicalStorefront: true })
  assert.equal(gamed.verified, false)
  assert.match(gamed.reasons.join(' '), /misuse NOT_APPLICABLE/)
})

// ── 35. Production is not touched by any of this ────────────────────────────────────

test('the corporate audit reads nothing and writes nothing', () => {
  const source = readFileSync(new URL('../services/corporateFactAudit.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /supabase|writeFile|execSync|process\.env/i,
    'the auditors are pure functions: no database, no filesystem, no environment')
})

test('visibleText ignores anything a reader cannot see', () => {
  const html = '<html><head><style>.a{color:red}</style></head><body><!-- hidden -->'
    + '<script>var price = 999</script><p>Real&nbsp;copy</p></body></html>'
  const seen = visibleText(html)
  assert.equal(seen, 'Real copy')
  assert.doesNotMatch(seen, /999|hidden|color/, 'script, style and comment content is not visible content')
})
