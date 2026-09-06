import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/strip-comments.js'

const src = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-context-toolbar.js', import.meta.url), 'utf8')
const code = stripComments(src)
const css = src.match(/style\.textContent = `([\s\S]*?)`;/)?.[1] || ''

// The toolbar is absolutely positioned against the modal, and BELOW it sit the
// tool rail and the footer. A hardcoded bottom:86px was smaller than the two of
// them together on a phone — a 64px rail plus a 50px footer is 114px — so the
// dark pill sat on top of the rail and swallowed its taps.
test('the context toolbar clears the bottom furniture instead of guessing at it', () => {
  assert.match(code, /function positionToolbar\(\)/, 'the offset must be measured')
  const fn = code.match(/function positionToolbar\(\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.match(fn, /\[data-studio-region="rail"\]/, 'the rail must be measured')
  assert.match(fn, /:scope > footer/, 'and so must the footer')
  assert.match(fn, /setProperty\('--studio-ctx-bottom'/, 'the result must reach the CSS')
  assert.match(fn, /clearance \+ 16/, 'with a gap, so it does not sit flush against the rail')

  // Both the mobile rule and the desktop override must read the measured value,
  // or one layout silently keeps the old hardcoded guess.
  assert.match(css, /#studio-context-toolbar\{[^}]*bottom:var\(--studio-ctx-bottom,86px\)/)
  assert.match(css, /@media \(min-width:900px\)\{#studio-context-toolbar\{bottom:var\(--studio-ctx-bottom,24px\)\}\}/)
})

test('a side rail is not mistaken for a bottom bar', () => {
  // On a wide screen the rail is a tall narrow left-hand column. Counting its
  // height as clearance flung the toolbar clean off the top of the modal
  // (measured: bottom:916px on a 900px modal). Full width is what separates a
  // bottom strip from a side column.
  const fn = code.match(/function positionToolbar\(\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.match(fn, /box\.width >= modalBox\.width \* 0\.9/,
    'only a full-width element counts as bottom furniture')
  assert.ok(!/box\.bottom > modalBottom - box\.height/.test(fn),
    'the height-based test passed for a tall side rail and must not come back')
})

test('the offset is re-measured when the layout can change', () => {
  assert.match(code, /\['resize', 'orientationchange'\]/,
    'rail and footer heights change with orientation and breakpoint')
  // And whenever the toolbar or sheet is actually shown.
  assert.equal((code.match(/positionToolbar\(\);/g) || []).length >= 3, true,
    'position must be applied on open, not only at load')
})
