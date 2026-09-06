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
  // Every bg-slate-900/950/800/700/600 and border-slate-800/700 token in the file must be
  // part of a light/dark pair, i.e. the same class list also carries a `dark:` variant of
  // the same property. That is checked per class attribute rather than by looking at the
  // single token immediately to the left, so a dark-only token still fails even when some
  // unrelated bg-* class happens to sit in front of it, and a genuine pair written in
  // either order (`bg-white dark:bg-slate-900`, or the inverted CTA `bg-slate-900
  // dark:bg-white`) is correctly recognised as paired.
  const darkOnly = /\b(bg|border)-slate-(?:900|950|800|700|600)\b(?!\/)/
  const unpaired = []
  for (const attr of studio.match(/class="[^"]*"/g) || []) {
    const classes = attr.slice(7, -1).split(/\s+/).filter(Boolean)
    // Which properties this class list themes: bg / border / text ...
    const themed = new Set(
      classes
        .filter((c) => c.startsWith('dark:'))
        .map((c) => c.replace(/^dark:(?:hover:|focus:|group-hover:)?/, '').split('-')[0])
    )
    for (const cls of classes) {
      if (cls.startsWith('dark:')) continue
      const bare = cls.replace(/^(?:hover:|focus:|group-hover:)/, '')
      const hit = bare.match(darkOnly)
      if (!hit) continue
      if (themed.has(hit[1])) continue // paired with a dark: variant of the same property
      unpaired.push(cls)
    }
  }
  assert.deepEqual(unpaired, [], `found unpaired dark-only slate classes: ${unpaired.join(', ')}`)
})

test('fabric-adapter.js and scene-model.js carry no Tailwind classes needing conversion', () => {
  const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
  const sceneModel = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/scene-model.js', import.meta.url), 'utf8')
  assert.doesNotMatch(adapter, /class="/, 'fabric-adapter.js should not render its own HTML with Tailwind classes')
  assert.doesNotMatch(sceneModel, /class="/, 'scene-model.js should not render its own HTML with Tailwind classes')
})
