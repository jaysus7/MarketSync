// Public-site marketing QA — a static crawl of every public page that guards the
// marketing/product-architecture invariants (broken links, CTA plan ids, obsolete
// positioning, stale redirects, and core-page metadata). Fast, no browser required.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { PLAN_IDS, PLAN_ALIASES } from '../plan-catalog.js'

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = f => readFileSync(new URL(f, FE), 'utf8')
const known = new Set([...PLAN_IDS, ...Object.keys(PLAN_ALIASES)])
const pages = readdirSync(FE).filter(f => f.endsWith('.html') && f !== 'dashboard.html')

// The primary marketing/product pages — these must be fully clean.
const CORE = ['index.html', 'pricing.html', 'compare.html', 'features.html', 'workflow.html',
  'faq.html', 'dealer-os.html', 'marketsync-digital.html', 'intelligence.html',
  'marketing-suites.html', 'ai-chatbot.html', 'upgrade.html']

test('no public register CTA references an unknown plan id', () => {
  for (const f of pages) {
    for (const m of read(f).matchAll(/register\.html\?plan=([a-z0-9_-]+)/g)) {
      assert.ok(known.has(m[1]), `${f}: unknown plan id "${m[1]}"`)
    }
  }
})

test('no internal .html link on a public page is broken', () => {
  for (const f of pages) {
    const t = read(f)
    const links = new Set()
    for (const m of t.matchAll(/href="(\/?[a-z0-9_-]+\.html)(?:#[^"]*)?"/gi)) links.add(m[1].replace(/^\//, ''))
    for (const l of links) {
      if (l === 'dashboard.html') continue
      assert.ok(existsSync(new URL(l, FE)), `${f}: broken internal link -> ${l}`)
    }
  }
})

test('no public page reintroduces obsolete product/pricing positioning', () => {
  const banned = [
    [/\bAI Boost\b/, 'AI Boost'],
    [/\$1,799/, 'retired Growth price'],
    [/DealerOS (Starter|Growth)|Dealer OS (Starter|Growth)/, 'retired Starter/Growth tier'],
    [/Core\s*[—-]\s*included with every plan/i, 'Core-included-with-every-plan'],
    [/MarketSync Digital [Ii]ncluded/, 'Pro/Core-includes-Digital'],
  ]
  for (const f of pages) {
    const t = read(f)
    for (const [rx, label] of banned) assert.doesNotMatch(t, rx, `${f}: obsolete positioning (${label})`)
  }
})

test('core marketing pages have a title and meta description and do not page-redirect', () => {
  for (const f of CORE) {
    const t = read(f)
    assert.match(t, /<title>[^<]{3,}<\/title>/i, `${f}: missing <title>`)
    assert.match(t, /<meta\s+name="description"\s+content="[^"]{20,}"/i, `${f}: missing meta description`)
    assert.doesNotMatch(t, /window\.location\.replace/, `${f}: should not page-redirect`)
  }
})

test('the three pillar pages and pricing are reachable and self-consistent', () => {
  for (const f of ['marketsync-digital.html', 'dealer-os.html', 'intelligence.html', 'pricing.html']) {
    assert.ok(existsSync(new URL(f, FE)), `${f} must exist`)
  }
  // Sitemap lists the pillar pages.
  const sm = read('sitemap.xml')
  for (const f of ['marketsync-digital.html', 'dealer-os.html', 'intelligence.html', 'pricing.html', 'compare.html']) {
    assert.match(sm, new RegExp(f), `sitemap.xml missing ${f}`)
  }
})
