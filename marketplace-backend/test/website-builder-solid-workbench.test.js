import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const builder = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')
const glass = readFileSync(new URL('../../marketplace-frontend/css/ms-liquid-glass.css', import.meta.url), 'utf8')

test('Website Builder chrome uses solid workbench semantics instead of liquid glass', () => {
  const render = builder.slice(builder.indexOf('function renderLiveBuilder(body)'), builder.indexOf('function wsBlog()'))
  assert.doesNotMatch(render, /backdrop-blur/)

  const workbench = glass.slice(glass.indexOf('The website editor is a dense workbench'), glass.indexOf('Generated hero CTAs'))
  assert.match(workbench, /--ws-panel: #111827/)
  assert.match(workbench, /--ws-panel: #ffffff/)
  assert.match(workbench, /backdrop-filter: none !important/)
  assert.doesNotMatch(workbench, /var\(--ms-glass-(?:light|dark|canvas|shadow|blur)/)
})

test('secondary actions retain a dark surface behind their light dark-mode text', () => {
  assert.match(glass,
    /html\[data-ms-glass="global"\]\.dark :is\(button,a\)\.bg-white\s*\{[^}]*background:\s*rgba\(15,23,42,\.92\)\s*!important;/,
    'the important light glass button rule needs an equally-specific dark counterpart')
})
