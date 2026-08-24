import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')

// The Liquid Glass cascade only ever targeted [data-page-content] .bg-white /
// [data-page-content] .dark\:bg-slate-900 — every card rendered into a page got
// glass, but anything appended straight to <body> (modals, context menus, Design
// Studio's own full-screen chrome — dozens of call sites across the app use
// document.body.appendChild for exactly this) fell outside that scope and stayed
// a plain opaque white/dark-slate-900 card. Un-scoping the selector closes that
// gap app-wide without having to touch each of those call sites individually.
test('Liquid Glass applies to .bg-white/.dark:bg-slate-900 everywhere, not only inside [data-page-content]', () => {
  assert.doesNotMatch(css, /\[data-page-content\]\s*\.bg-white/,
    'no glass rule should still be scoped to [data-page-content] only')
  assert.doesNotMatch(css, /\[data-page-content\]\s*\.dark\\:bg-slate-900/,
    'no glass rule should still be scoped to [data-page-content] only')
  assert.match(css, /(?<!\[data-page-content\]\s*)\.bg-white:not\(#studio-artboard-container\)/,
    'the un-scoped selector must exist and exclude the Studio artboard')
})

// Design Studio's artboard is the one surface that must never be glass — it has to
// render the actual design at true, unblurred color while a dealer is designing on
// it. Every occurrence of the broadened .bg-white/.dark:bg-slate-900 selector — the
// light and dark variants of the final cascade, the dark "restrained" refinement,
// and the reduced-transparency fallback — must carry this exclusion, or the artboard
// would silently pick up a translucent blur and misrepresent the colors of whatever
// graphic is being edited.
test('the Studio artboard is excluded from every broadened glass selector', () => {
  const count = (css.match(/(?:\.bg-white|\.dark\\:bg-slate-900):not\(#studio-artboard-container\)/g) || []).length
  assert.equal(count, 8,
    'expected the exclusion on both light+dark selectors in the final cascade (4), the dark restrained-refinement block (2), and the reduced-transparency fallback (2) — 8 occurrences total')
})
