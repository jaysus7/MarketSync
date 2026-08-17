import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')

// Design Studio used to be hardcoded to a dark theme (only 2 `dark:` occurrences in the
// whole file — both on the header logo swap, not real theming). It now inherits the same
// `.dark` class toggle every other dashboard page uses (dashboard.html's matchMedia
// script + tailwind.config darkMode:'class'), so its Tailwind utility classes must be
// light-default with `dark:` variants, matching the house convention used elsewhere
// (e.g. dashboard-part14.js, marketing-workspace.js).
test('studio-shell.js is no longer hardcoded to a single dark theme', () => {
  const darkMatches = studio.match(/dark:/g) || []
  assert.ok(darkMatches.length > 100, `expected far more than the original ~2 dark: occurrences, got ${darkMatches.length}`)
})

test('major chrome surfaces use light-default + dark: variant pairs', () => {
  // Top bar / footer / side panels — the main app "surface" background.
  assert.match(studio, /bg-white dark:bg-slate-900/, 'header/panel surfaces should pair bg-white with dark:bg-slate-900')
  // Sunken wells (inputs, canvas viewport, deep panels).
  assert.match(studio, /bg-slate-50 dark:bg-slate-950/, 'sunken surfaces should pair bg-slate-50 with dark:bg-slate-950')
  // Secondary/card surfaces.
  assert.match(studio, /bg-slate-100 dark:bg-slate-800/, 'secondary surfaces should pair bg-slate-100 with dark:bg-slate-800')
  // Primary body text on dark chrome.
  assert.match(studio, /text-slate-900 dark:text-white/, 'text-white on slate chrome should pair with text-slate-900 for light mode')
  // Muted text standardized to a single pairing regardless of original 400/500 shade.
  assert.match(studio, /text-slate-500 dark:text-slate-400/, 'muted text should standardize to text-slate-500 dark:text-slate-400')
  // Borders.
  assert.match(studio, /border-slate-200 dark:border-slate-800/, 'border-slate-800 should pair with border-slate-200 for light mode')
  assert.match(studio, /border-slate-300 dark:border-slate-700/, 'border-slate-700 should pair with border-slate-300 for light mode')
})

test('no more bare dark-only slate utility classes remain unpaired', () => {
  // Every bg-slate-900/950/800/700/600 and border-slate-800/700 token in the file should
  // now be preceded by a light-mode class immediately before it (i.e. be part of a pair),
  // or be immediately preceded by "dark:" itself. A bare, unpaired occurrence would mean
  // a spot was missed in the conversion.
  const tokenPattern = /(?<!dark:)(?<!dark:hover:)(?<!dark:focus:)\b(bg|border)-slate-(900|950|800|700|600)\b(?!\/)/g
  const bareMatches = [...studio.matchAll(tokenPattern)]
  assert.equal(bareMatches.length, 0, `found unpaired dark-only slate classes: ${bareMatches.map(m => m[0]).join(', ')}`)
})

test('fabric-adapter.js and scene-model.js carry no Tailwind classes needing conversion', () => {
  const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
  const sceneModel = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/scene-model.js', import.meta.url), 'utf8')
  assert.doesNotMatch(adapter, /class="/, 'fabric-adapter.js should not render its own HTML with Tailwind classes')
  assert.doesNotMatch(sceneModel, /class="/, 'scene-model.js should not render its own HTML with Tailwind classes')
})
