import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const part17 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

// A plain "Website" nav click (deptGo('website') with no tab argument) used to leave
// __wsTab untouched, so a stale 'builder' value from a previous openWebsiteBuilder()
// call survived and silently reopened the Builder instead of landing on Setup.
test('deptGo always resets __wsTab to setup for a plain Website nav click, never leaving a stale builder tab', () => {
  const fn = part2.match(/function deptGo\(page, invmode, tab\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'deptGo must exist')
  assert.match(fn, /if \(page === 'website'\) __wsTab = tab \|\| 'setup';/,
    'deptGo must explicitly set __wsTab (to the given tab, or setup by default) whenever page is website')
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

// The Website workspace's top header bar (shown above every tab — Setup, Classic, Live
// Builder) was hardcoded bg-slate-900/text-white with no light variant, and its buttons
// (Exit Builder, View Site, Published) were hardcoded bg-slate-800/text-slate-300/
// border-slate-700 — dark-only colors with no light counterpart at all, regardless of
// theme. In light mode this painted a permanently-dark bar (and dark-gray buttons) above
// a correctly light-following body: literally "part night mode". The header itself already
// participates in the builder's own --ws-* theme system via the [data-ws-theme]
// .ws-builder-header CSS rule (which sets background/text/border with !important) — so its
// buttons now use the same --ws-* variables instead of hardcoded slate colors, staying
// consistent with that header in both the default (OS-matched) and any explicit
// light/dark override case.
test('the Website workspace header and its controls follow the builder theme instead of being hardcoded dark-only', () => {
  const headerBlock = part17.slice(
    part17.indexOf('TOP APPLICATION HEADER (Dedicated Website Workspace Header)'),
    part17.indexOf('WORKSPACE CONTENT BODY (Sub-Layout dynamically mounted based on active tab)')
  )
  assert.ok(headerBlock, 'the website workspace header block must exist')
  assert.match(headerBlock, /ws-builder-header[\s\S]{0,80}bg-white dark:bg-slate-900/,
    'the header itself must have a real light variant, not a bare dark-only background')
  assert.doesNotMatch(headerBlock, /\bbg-slate-800\b/, 'header controls must not hardcode dark-only slate-800 backgrounds with no light counterpart')
  assert.doesNotMatch(headerBlock, /\btext-slate-300\b/, 'header controls must not hardcode dark-only slate-300 text with no light counterpart')
  assert.doesNotMatch(headerBlock, /\bborder-slate-700\b/, 'header controls must not hardcode dark-only slate-700 borders with no light counterpart')
  assert.match(headerBlock, /bg-\[var\(--ws-panel-raised\)\]/, 'header controls must use the builder theme variables instead')
  assert.match(headerBlock, /text-\[var\(--ws-text-muted\)\]/)
})
