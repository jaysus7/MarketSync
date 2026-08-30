import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveLookup, metadataUrl, isHtmlResponse } from '../../workers/dealer-site-head/src/index.js'


const workerSource = async () => (await import('node:fs')).readFileSync(
  new URL('../../workers/dealer-site-head/src/index.js', import.meta.url), 'utf8')

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const HOSTED = 'sites.marketsync.link'
const opts = { publicSiteHost: HOSTED }
const at = (href) => resolveLookup(new URL(href), opts)

test('the hosted shell resolves by slug', () => {
  assert.deepEqual(at(`https://${HOSTED}/site.html?d=abc-motors`), { by: 'slug', value: 'abc-motors' })
  assert.deepEqual(at(`https://${HOSTED}/?d=abc-motors`), { by: 'slug', value: 'abc-motors' })
  // Case and stray whitespace are normalised the way the backend stores slugs.
  assert.deepEqual(at(`https://${HOSTED}/site.html?d=ABC-Motors`), { by: 'slug', value: 'abc-motors' })
})

test('a connected custom domain resolves by hostname', () => {
  assert.deepEqual(at('https://abcmotors.com/'), { by: 'host', value: 'abcmotors.com' })
  assert.deepEqual(at('https://www.abcmotors.com/'), { by: 'host', value: 'abcmotors.com' })
  assert.deepEqual(at('https://abcmotors.com/index.html'), { by: 'host', value: 'abcmotors.com' })
})

test('the hosted host without a slug identifies no dealership', () => {
  // Guessing here would attach one dealership's metadata to a shared shell.
  assert.equal(at(`https://${HOSTED}/site.html`), null)
  assert.equal(at(`https://${HOSTED}/`), null)
})

test('anything that is not the site shell is left alone', () => {
  for (const href of [
    `https://${HOSTED}/css/tailwind-built.css?d=abc-motors`,
    `https://${HOSTED}/js/modules/site.js`,
    'https://abcmotors.com/img/hero.png',
    'https://abcmotors.com/api/site/abc/lead',
    'https://abcmotors.com/dashboard.html',
  ]) {
    assert.equal(at(href), null, `${href} must not be rewritten`)
  }
})

test('a malformed slug is refused rather than passed through to the API', () => {
  for (const slug of ['../etc/passwd', 'abc motors', 'abc/motors', '-leading', '', 'a'.repeat(80)]) {
    assert.equal(at(`https://${HOSTED}/site.html?d=${encodeURIComponent(slug)}`), null, `slug ${slug} must be refused`)
  }
})

test('each lookup maps to its own endpoint', () => {
  assert.equal(
    metadataUrl('https://api.marketsync.link', { by: 'slug', value: 'abc-motors' }),
    'https://api.marketsync.link/site/abc-motors/head-metadata'
  )
  assert.equal(
    metadataUrl('https://api.marketsync.link/', { by: 'host', value: 'abcmotors.com' }),
    'https://api.marketsync.link/site-head-metadata?host=abcmotors.com'
  )
})

test('only HTML documents are candidates for rewriting', () => {
  const withType = (type) => ({ headers: new Map([['content-type', type]]) })
  // Map exposes .get, which is the only header method the check uses.
  assert.equal(isHtmlResponse(withType('text/html; charset=utf-8')), true)
  assert.equal(isHtmlResponse(withType('application/xhtml+xml')), true)
  assert.equal(isHtmlResponse(withType('application/json')), false)
  assert.equal(isHtmlResponse(withType('image/png')), false)
  assert.equal(isHtmlResponse({ headers: new Map() }), false)
})

test('the worker never branches on user agent', async () => {
  // Serving crawlers different HTML from visitors is cloaking. Assert the source
  // carries no user-agent path at all, rather than trusting review to catch it.
  // Strip comments first: the file explains WHY it must not branch on user agent, and
  // scanning prose would flag that explanation as the thing it warns against.
  const code = stripComments(await workerSource())
  assert.doesNotMatch(code, /user-agent/i)
  assert.doesNotMatch(code, /googlebot|bingbot|crawler|\bbot\b/i)
})

test('every failure path returns the origin response untouched', async () => {
  const source = await workerSource()
  // The fetch handler must hold the origin response before doing anything optional,
  // and every early exit must hand that same response back.
  const handler = source.slice(source.indexOf('async fetch(request'))
  assert.match(handler, /const response = await fetch\(request\)/)
  assert.match(handler, /catch\s*\{[\s\S]*?return response/)
  const returns = [...handler.matchAll(/return (\w+)/g)].map((m) => m[1])
  for (const returned of returns) {
    assert.ok(['response', 'injectHead'].includes(returned) || returned.startsWith('injectHead'),
      `unexpected return value in the fetch handler: ${returned}`)
  }
  // A slow metadata lookup must not hold the page.
  assert.match(source, /AbortController/)
  assert.match(source, /METADATA_TIMEOUT_MS/)
})
