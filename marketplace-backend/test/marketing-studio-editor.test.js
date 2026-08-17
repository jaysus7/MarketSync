import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pexelsApiKey, pexelsSearchEndpoint, studioDesignSpec, studioOverlaySvg } from '../routes/marketing-studio.js'

const route = readFileSync(new URL('../routes/marketing-studio.js', import.meta.url), 'utf8')

test('Studio supports the approved social aspect formats and clamps unsafe style input', () => {
  assert.deepEqual(studioDesignSpec({ format: 'portrait', accent_color: '#123abc', overlay: 200 }).width, 1080)
  const spec = studioDesignSpec({ format: 'bogus', accent_color: 'url(javascript:bad)', text_color: 'red', overlay: -3 })
  assert.equal(spec.format, 'square')
  assert.equal(spec.accentColor, '#6d28d9')
  assert.equal(spec.textColor, '#ffffff')
  assert.equal(spec.overlay, 0)
})

test('Studio overlay escapes dealer-authored SVG text', () => {
  const svg = studioOverlaySvg(studioDesignSpec({ headline: '<script>alert(1)</script>', cta: 'Shop & save' }))
  assert.doesNotMatch(svg, /<script>/)
  assert.match(svg, /&lt;script&gt;/)
  assert.match(svg, /Shop &amp; save/)
})

test('Pexels library uses raw-key authentication and distinct search endpoints', () => {
  assert.equal(pexelsApiKey('  raw-key-123  '), 'raw-key-123')
  assert.equal(pexelsApiKey('Bearer raw-key-123'), 'raw-key-123')
  assert.equal(pexelsSearchEndpoint('photo'), 'https://api.pexels.com/v1/search')
  assert.equal(pexelsSearchEndpoint('video'), 'https://api.pexels.com/videos/search')
})

test('Studio backgrounds are tenant-scoped canonical assets, never arbitrary fetched URLs', () => {
  const render = route.match(/app\.post\('\/marketing\/studio\/render'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(render, /from\('marketing_assets'\)/)
  assert.match(render, /eq\('dealership_id', req\.dealershipId\)/)
  assert.match(render, /download\(source\.storage_path\)/)
  assert.doesNotMatch(render, /fetch\(req\.body/)
  assert.match(render, /from\('marketing_assets'\)\.insert/)
})
