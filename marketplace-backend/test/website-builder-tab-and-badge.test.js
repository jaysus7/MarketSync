import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const part17 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

// A plain "Website" nav click (deptGo('website') with no tab argument) used to leave
// __wsTab untouched, so a stale 'builder' value from a previous openWebsiteBuilder()
// call survived and silently reopened the Builder instead of landing on Overview.
test('deptGo always resets __wsTab to overview for a plain Website nav click', () => {
  const fn = part2.match(/function deptGo\(page, invmode, tab, studio\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'deptGo must exist')
  assert.match(fn, /if \(page === 'website'\) __wsTab = \(\{ setup: 'overview', seo: 'discoverability' \}\[tab\] \|\| tab \|\| 'overview'\);/,
    'deptGo must map legacy tabs and default every plain Website entry to Overview')
})

// The Live Builder's SAVED/UNSAVED status badge is driven by markWsSaved()/markWsUnsaved(),
// which both operate on document.querySelectorAll('.ws-saved-badge') — but the actual badge
// markup never carried that class, so the two functions were permanent no-ops and the badge
// stayed hardcoded to "SAVED" even with real unsaved edits. This is what "Live is broken" meant.
test('the Live Builder save-status badge carries the class markWsSaved/markWsUnsaved actually target', () => {
  assert.match(part17, /class="ws-saved-badge[^"]*">SAVED<\/span>/,
    'the rendered badge must carry ws-saved-badge so markWsSaved/markWsUnsaved can find and update it')
  assert.match(part17, /document\.querySelectorAll\('\.ws-saved-badge'\)/)
})

test('the immersive builder owns one truthful action bar', () => {
  const renderPage = part17.slice(part17.indexOf('function renderWebsitePage()'), part17.indexOf('function wsTab(t)'))
  const liveBuilder = part17.slice(part17.indexOf('function renderLiveBuilder(body)'), part17.indexOf('function wsBlog()'))
  assert.match(renderPage, /if \(isBuilder\)[\s\S]*root\.innerHTML = '<div id="ws-body"/)
  assert.doesNotMatch(renderPage, /ws-builder-header/, 'Studio must not add a second builder header')
  assert.equal((liveBuilder.match(/ws-top-action-bar/g) || []).length, 1)
  assert.match(liveBuilder, /saveWebsite\(this,'draft'\)[\s\S]*Save Draft/)
  assert.match(liveBuilder, /saveWebsite\(this,'publish'\)[\s\S]*Publish/)
})
