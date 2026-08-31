import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {
  assertSafeUrl,
  crawlSite,
  crawlUrl,
  parsePublicHtml,
  parseRobotsTxt,
  parseSitemapXml,
  verifyExpectedVsPublished
} from '../services/discoverabilityCrawlerService.js'

let server; let origin
before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') return res.end('User-agent: *\nAllow: /\nDisallow: /private\nSitemap: /sitemap.xml\n')
    if (req.url === '/sitemap.xml') return res.end('<?xml version="1.0"?><urlset><url><loc>/</loc></url><url><loc>/missing</loc></url></urlset>')
    if (req.url === '/redirect') { res.writeHead(302, { location: '/' }); return res.end() }
    if (req.url === '/missing') { res.writeHead(404); return res.end('not found') }
    if (req.url === '/private') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<title>Private</title>') }
    if (req.url === '/bad.jpg') { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><html lang="en"><head><title>Dealer Home</title><meta name="description" content="Dealer inventory"><link rel="canonical" href="${origin || ''}/"></head><body><h1>Shop vehicles</h1><a href="/missing">Missing</a><a href="/private">Private</a><img src="/bad.jpg"><script type="application/ld+json">{"@context":"https://schema.org","@type":"AutoDealer","name":"Demo Dealer"}</script></body></html>`)
  }).listen(0, '127.0.0.1', () => { origin = `http://127.0.0.1:${server.address().port}`; server.emit('ready') })
  await new Promise(resolve => server.once('ready', resolve))
})
after(() => server.close())

test('blocks localhost/private IP targets and unsafe redirect destinations', async () => {
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1:8080'), /private|internal/i)
  await assert.rejects(() => assertSafeUrl('http://localhost:8080'), /private|internal/i)
  await assert.rejects(() => assertSafeUrl('file:///etc/passwd'), /http/i)
})

test('records actual status, response timing, hashes, and redirect chain', async () => {
  const page = await crawlUrl(`${origin}/redirect`, { allowPrivateForTests: true, persist: false })
  assert.equal(page.statusCode, 200)
  assert.equal(page.finalUrl, `${origin}/`)
  assert.equal(page.redirectChain[0].statusCode, 302)
  assert.match(page.bodyHash, /^[a-f0-9]{64}$/)
  assert.equal(page.html.title, 'Dealer Home')
})

test('parses metadata, links, images, schema, and evidence-backed findings', () => {
  const page = parsePublicHtml('<html><head><title>x</title></head><body><h1>One</h1><h1>Two</h1><a href="/x">X</a><img src="/x.png"><script type="application/ld+json">{bad</script></body></html>', 'https://dealer.example/')
  assert.equal(page.headings.h1.length, 2)
  assert.equal(page.links[0].url, 'https://dealer.example/x')
  assert.equal(page.images[0].alt, null)
  assert.equal(page.schema.parseErrors.length, 1)
  assert.ok(page.findings.some(f => f.type === 'multiple_h1' && f.evidence.verified))
  assert.ok(page.findings.some(f => f.type === 'missing_canonical'))
})

test('respects robots, enforces page limits, detects broken links/images and duplicate titles', async () => {
  const result = await crawlSite(origin, { allowPrivateForTests: true, maxPages: 4, maxDepth: 2, persist: false, delayMs: 0 })
  assert.ok(result.pages.length <= 4)
  assert.equal(result.pages.find(p => p.requestedUrl.endsWith('/private')).robotsAllowed, false)
  assert.ok(result.findings.some(f => f.type === 'broken_internal_link'))
  assert.ok(result.findings.some(f => f.type === 'broken_image'))
  assert.ok(result.sitemaps[0].parsed.urls.includes(`${origin}/missing`))
})

test('parses sitemap indexes and robots policies without inventing status', () => {
  const sitemap = parseSitemapXml('<sitemapindex><sitemap><loc>https://dealer.example/a.xml</loc></sitemap></sitemapindex>', 'https://dealer.example/')
  assert.equal(sitemap.type, 'index')
  assert.deepEqual(sitemap.urls, ['https://dealer.example/a.xml'])
  const robots = parseRobotsTxt('User-agent: GPTBot\nDisallow: /private\nSitemap: /sitemap.xml', 'https://dealer.example/')
  assert.equal(robots.allowed('https://dealer.example/private', 'gptbot'), false)
  assert.equal(robots.sitemaps[0], 'https://dealer.example/sitemap.xml')
})

test('compares Website Builder expectation to observed public state', () => {
  const checks = verifyExpectedVsPublished({ title: 'Expected', canonical: 'https://dealer.example/' }, { title: 'Observed', canonical: 'https://dealer.example/' })
  assert.equal(checks.find(c => c.field === 'title').matched, false)
  assert.equal(checks.find(c => c.field === 'canonical').matched, true)
})
