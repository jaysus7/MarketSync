import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const raw = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')

// The sidebar column is two nested elements: #dept-sidebar (the column) and
// #dashboard-nav (the nav inside it, which carries the literal bg-white /
// dark:bg-slate-900 Tailwind classes). Exactly ONE of them may be a glass panel.
// When both were, they painted two boxes a few pixels apart with a hard seam
// between them — a visible double-nav.
//
// This has now been the same bug twice, from two different causes:
//   1. `.bg-white:not(#studio-artboard-container)` — a class plus a :not() whose
//      argument is an ID — out-specified a bare #dashboard-nav reset, so the nav
//      re-painted its own panel. Fixed then by growing the exemption list.
//   2. `.dark #dept-sidebar` (class + id) out-specified the bare `#dept-sidebar`
//      transparent reset that comes LATER in the file, so dark mode kept glass on
//      the wrapper while #dashboard-nav painted its own inside it. Source order
//      never got a say; specificity decided.
//
// Both causes are specificity accidents, which is why this is stated as an
// outcome: whoever owns the glass, the other one must be transparent.
// Verified by measurement against the real built CSS at 1440px and 600px, in
// both themes: exactly one glass panel on desktop, none on mobile.
test('the sidebar column and its nav are never both glass', () => {
  const glassSelectors = new Set()
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:\s*blur\([^{}]*\}/g)) {
    for (const sel of m[1].split(',')) glassSelectors.add(sel.trim())
  }
  const claims = id => [...glassSelectors].filter(s => s.includes(id))
  assert.deepEqual(claims('#dept-sidebar'), [],
    'the column is layout, not a panel — the one glass surface in it is #dashboard-nav')
  assert.ok(claims('#dashboard-nav').length > 0,
    'the sidebar column still needs exactly one glass panel, and #dashboard-nav is it')
})

// The reset is what makes the wrapper transparent. It is a bare-id rule, so it
// only works while nothing more specific claims the wrapper — the test above is
// what keeps that true.
test('the sidebar wrapper keeps its dedicated transparent reset', () => {
  assert.match(css, /#(?:dept-sidebar|dashboard-nav)\s*\{[^}]*background:\s*transparent\s*!important/,
    'the wrapper reset that makes the column render as a single surface must still exist')
  const reset = css.match(/#dept-sidebar \{[^}]*\}/)
  assert.ok(reset, '#dept-sidebar must still have its reset rule')
  assert.match(reset[0], /backdrop-filter:\s*none\s*!important/,
    'the reset must clear backdrop-filter, not only the background')
})
