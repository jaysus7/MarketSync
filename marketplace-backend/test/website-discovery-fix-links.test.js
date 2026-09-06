// Every non-PASS Discoverability check card must render a real fix button,
// and the recommendations panel must synthesize cards for unresolved
// UNKNOWN checks so "AI recommendations" recommends fixing what the check
// grid shows as unresolved. Pins the wiring against future drift.

import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const src = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

test('wsDiscoveryCheck renders an action button when status is not pass', () => {
  const start = src.indexOf('function wsDiscoveryCheck(label')
  assert.ok(start > 0, 'wsDiscoveryCheck must exist')
  const block = src.slice(start, start + 1200)
  // Signature must accept the action argument.
  assert.match(block, /function wsDiscoveryCheck\(label, status, detail, action\)/, 'must accept action arg')
  // Non-PASS + action.onclick → renders a Fix button. PASS or missing action → no button.
  assert.match(block, /status !== 'pass'[\s\S]{0,200}action\.onclick/, 'guards the button on status + action.onclick')
  assert.match(block, /class=\\?"mt-2 inline-flex[\s\S]{0,120}text-white/, 'renders a real button with the site button style')
})

test('wsRunPublicCrawl calls the real /discoverability/validation/scan endpoint', () => {
  const start = src.indexOf('async function wsRunPublicCrawl')
  assert.ok(start > 0, 'wsRunPublicCrawl must exist')
  const block = src.slice(start, start + 500)
  assert.match(block, /apiSendJson\(['"]\/discoverability\/validation\/scan['"], 'POST'/, 'must POST to the real scan endpoint')
  assert.match(block, /loadWebsiteDiscoverability\(true\)/, 'must refresh evidence after a successful scan')
})

test('every check tuple carries an action so UNKNOWN never leaves the user stranded', () => {
  const start = src.indexOf('function wsDiscoveryChecks(data = {})')
  const end = src.indexOf('function wsDeriveScanRecommendations', start)
  assert.ok(start > 0 && end > start, 'wsDiscoveryChecks + wsDeriveScanRecommendations must exist')
  const block = src.slice(start, end)
  for (const label of ['Title', 'Meta', 'H1', 'Canonical', 'Schema', 'Crawlability', 'Internal links', 'Search opportunity', 'AI visibility']) {
    // Each tuple should be [label, status, detail, action] — assert an
    // action reference sits on the same tuple as the label.
    const idx = block.indexOf(`'${label}'`)
    assert.ok(idx > 0, `check tuple for ${label} must exist`)
    const line = block.slice(idx, block.indexOf('\n', idx) + 1)
    assert.match(line, /Action$/m.test(line) ? /Action\]/ : /(editAction|scanAction|gscAction|canonicalAction|aiRefreshAction)\]/,
      `tuple for ${label} must carry an action reference`)
  }
})

test('wsDeriveScanRecommendations synthesizes cards from unresolved UNKNOWN checks', () => {
  const start = src.indexOf('function wsDeriveScanRecommendations')
  assert.ok(start > 0, 'wsDeriveScanRecommendations must exist')
  const block = src.slice(start, start + 1000)
  // Only surfaces rows that (a) aren't PASS and (b) carry a real action.
  assert.match(block, /status !== 'pass' && action && action\.onclick/, 'must filter by real actionable rows')
  // Skips anything already covered by a persisted engine recommendation —
  // avoids duplicating suggestions in the panel.
  assert.match(block, /covered = new Set/, 'must dedupe against existing recs')
  // Each synthesized card carries _synthetic + _action so the renderer
  // knows to draw a fix button instead of Apply/Approve.
  assert.match(block, /_synthetic: true/, 'must tag cards as synthesized')
  assert.match(block, /_action: action/, 'must carry the real action reference')
})

test('renderer draws the synthesized action button in the recommendations panel', () => {
  const start = src.indexOf('function renderWebsiteDiscoverability')
  const end = src.indexOf('async function loadWebsiteDiscoverability', start)
  const block = src.slice(start, end)
  // Merged into the recs list.
  assert.match(block, /wsDeriveScanRecommendations\(checkRows, basePersisted\)/, 'must merge synthesized recs with persisted ones')
  // Renders a button using the synthesized _action.onclick + label.
  assert.match(block, /rec\._synthetic && rec\._action/, 'must gate on _synthetic + _action')
  assert.match(block, /rec\._action\.onclick/, 'must use the synthesized onclick verbatim')
})
