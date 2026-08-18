import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const part14 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part14.js', import.meta.url), 'utf8')

test('#ext-header-btn is a real, reachable header link — not inside the dead "never render" compatibility stub', () => {
  // The compatibility div is explicitly documented as never rendering (it exists only
  // so getElementById() calls don't throw for retired-hamburger-era functions). This id
  // used to live inside it, so once a user dismissed the install banner,
  // applyExtensionVisibility() removed 'hidden' from the <a> itself but the ENCLOSING
  // div's own 'hidden' class never lifted — the Chrome extension link was gone for
  // good, with no way back except manually clearing localStorage.
  const deadStub = html.match(/<div class="hidden" aria-hidden="true">[\s\S]*?<\/div>/)?.[0] || ''
  assert.ok(deadStub, 'the dead compatibility stub div must exist')
  assert.doesNotMatch(deadStub, /id="ext-header-btn"/, 'ext-header-btn must not live inside the div that never renders')

  const btn = html.match(/<a id="ext-header-btn"[^>]*>/)?.[0] || ''
  assert.ok(btn, 'a real #ext-header-btn element must exist')
  assert.match(btn, /href="https:\/\/chromewebstore\.google\.com\/detail\/marketsync\/mfoaodaoipaalloccolophjhblgikada"/)
  assert.match(btn, /target="_blank"/)
})

test('applyExtensionVisibility toggles the real header button by relevance and dismissal state', () => {
  const fn = part14.match(/function applyExtensionVisibility\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'applyExtensionVisibility must exist')
  assert.match(fn, /getElementById\('ext-header-btn'\)/)
  assert.match(fn, /headerBtn\?\.classList\.remove\('hidden'\)/, 'dismissing the banner must be able to reveal the header button')
})
