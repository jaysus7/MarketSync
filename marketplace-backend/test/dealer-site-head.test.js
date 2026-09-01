import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildDealerSiteMetadata,
  renderDealerSiteHead,
  injectDealerSiteHead,
  dealerPublicUrl,
  escapeAttribute
} from '../services/dealerSiteHeadService.js'

const ORIGIN = 'https://sites.marketsync.link'

const site = {
  name: 'ABC Motors',
  site_slug: 'abc-motors',
  city: 'Welland',
  province: 'ON',
  seo_title: 'Used Cars & Trucks for Sale in Welland | ABC Motors',
  seo_description: 'Shop quality used vehicles in Welland.',
  seo_image: 'https://cdn.example.test/hero.jpg',
  phone: '905-555-0100'
}

test('the public URL prefers a verified custom domain over the hosted slug', () => {
  assert.equal(dealerPublicUrl({ custom_domain: 'abcmotors.com', custom_domain_verified: true }, ORIGIN), 'https://abcmotors.com')
  // An unverified domain must not be advertised as canonical.
  assert.equal(
    dealerPublicUrl({ custom_domain: 'abcmotors.com', custom_domain_verified: false, site_slug: 'abc-motors' }, ORIGIN),
    `${ORIGIN}/site.html?d=abc-motors`
  )
  assert.equal(dealerPublicUrl({}, ORIGIN), null)
})

test('metadata comes from dealer-configured SEO when present', () => {
  const meta = buildDealerSiteMetadata(site, { publicSiteOrigin: ORIGIN })
  assert.equal(meta.title, 'Used Cars & Trucks for Sale in Welland | ABC Motors')
  assert.equal(meta.description, 'Shop quality used vehicles in Welland.')
  assert.equal(meta.canonical, `${ORIGIN}/site.html?d=abc-motors`)
})

test('a missing title falls back to canonical dealership facts, never invented copy', () => {
  const meta = buildDealerSiteMetadata({ name: 'ABC Motors', city: 'Welland', province: 'ON', site_slug: 'abc' }, { publicSiteOrigin: ORIGIN })
  assert.equal(meta.title, 'ABC Motors | Welland, ON')
  // Nothing was configured and nothing can be derived, so it stays absent.
  assert.equal(meta.description, null)
  assert.equal(meta.keywords, null)
})

test('a dealership with no facts at all yields no metadata rather than placeholders', () => {
  const meta = buildDealerSiteMetadata({}, { publicSiteOrigin: ORIGIN })
  assert.equal(meta.title, null)
  assert.equal(meta.description, null)
  assert.equal(meta.schema, null)
  assert.equal(renderDealerSiteHead(meta), '')
})

test('absent fields emit no tag at all', () => {
  const html = renderDealerSiteHead(buildDealerSiteMetadata({ name: 'ABC Motors', site_slug: 'abc' }, { publicSiteOrigin: ORIGIN }))
  assert.doesNotMatch(html, /name="description"/)
  assert.doesNotMatch(html, /og:image/)
  assert.match(html, /<title>ABC Motors<\/title>/)
})

test('rendered head carries the tags crawlers actually need', () => {
  const html = renderDealerSiteHead(buildDealerSiteMetadata(site, { publicSiteOrigin: ORIGIN }))
  assert.match(html, /<title>Used Cars &amp; Trucks for Sale in Welland \| ABC Motors<\/title>/)
  assert.match(html, /<meta name="description" content="Shop quality used vehicles in Welland\.">/)
  assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}/site\\.html\\?d=abc-motors">`))
  assert.match(html, /<meta property="og:title"/)
  assert.match(html, /<meta property="og:image"/)
  assert.match(html, /application\/ld\+json/)
})

test('schema only claims facts that exist', () => {
  const meta = buildDealerSiteMetadata(site, { publicSiteOrigin: ORIGIN })
  assert.equal(meta.schema['@type'], 'AutoDealer')
  assert.equal(meta.schema.telephone, '905-555-0100')
  assert.equal(meta.schema.address.addressLocality, 'Welland')
  // No phone recorded means no telephone claim.
  const noPhone = buildDealerSiteMetadata({ ...site, phone: null }, { publicSiteOrigin: ORIGIN })
  assert.equal('telephone' in noPhone.schema, false)
})

test('metadata is escaped so dealer content cannot break out of the head', () => {
  const meta = buildDealerSiteMetadata(
    { name: 'X', site_slug: 'x', seo_title: 'Evil" onload="alert(1)', seo_description: '</title><script>alert(1)</script>' },
    { publicSiteOrigin: ORIGIN }
  )
  const html = renderDealerSiteHead(meta)
  // Quotes inside <title> text are harmless; what matters is that they cannot escape an
  // attribute value, and that no raw markup survives anywhere.
  const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/)
  assert.ok(ogTitle, 'og:title must render')
  assert.doesNotMatch(ogTitle[1], /"/, 'attribute value must not contain a raw quote')
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /<\/title><script/)
  assert.equal(escapeAttribute('a"b<c'), 'a&quot;b&lt;c')
})

test('JSON-LD cannot terminate its own script block', () => {
  const meta = buildDealerSiteMetadata({ name: '</script><script>alert(1)</script>', site_slug: 'x' }, { publicSiteOrigin: ORIGIN })
  const html = renderDealerSiteHead(meta)
  assert.doesNotMatch(html, /<\/script><script>alert/)
})

test('injecting into the real shell replaces the placeholder title', () => {
  const shell = readFileSync(new URL('../../marketplace-frontend/site.html', import.meta.url), 'utf8')
  const injected = injectDealerSiteHead(shell, buildDealerSiteMetadata(site, { publicSiteOrigin: ORIGIN }))
  const head = injected.slice(0, injected.indexOf('</head>'))
  assert.doesNotMatch(head, /<title>Inventory<\/title>/, 'placeholder title must be gone')
  assert.match(head, /<title>Used Cars &amp; Trucks for Sale in Welland \| ABC Motors<\/title>/)
  assert.match(head, /rel="canonical"/)
  assert.match(head, /name="description"/)
})

test('the head-metadata endpoint is registered on the public site surface', () => {
  const routes = readFileSync(new URL('../routes/submodules/site-public.js', import.meta.url), 'utf8')
  assert.match(routes, /app\.get\('\/site\/:slug\/head-metadata'/)
  // Unpublished sites must not leak metadata.
  const handler = routes.slice(routes.indexOf("'/site/:slug/head-metadata'"))
  assert.match(handler.slice(0, 900), /site_published/)
})
