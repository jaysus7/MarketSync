import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const raw = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')
// Comments quote the deleted selector to explain why it went; strip them so the
// assertions below can only ever be satisfied by real rules.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')

// This file used to guard the opposite invariant: that Liquid Glass was applied
// to `.bg-white` / `.dark\:bg-slate-900` app-wide, so that modals and menus
// appended straight to <body> would pick it up like page cards did. Deciding a
// surface's MATERIAL from its COLOUR class turned out to be the wrong lever —
// it caught all 1,297 bg-white call sites, including dense tables — so glass is
// now opt-in via .ms-glass. What survives from that work is the requirement the
// original selector existed to serve: a floating layer must not be reachable
// only from inside [data-page-content].
test('glass is available to surfaces appended straight to <body>', () => {
  const rule = css.match(/^[^{}]*\.ms-glass[^{}]*\{[^}]*backdrop-filter[^}]*\}/m)
  assert.ok(rule, '.ms-glass must carry the glass treatment')
  assert.doesNotMatch(rule[0], /\[data-page-content\]/,
    'a modal appended to document.body sits outside [data-page-content] and would miss the treatment')
  assert.doesNotMatch(css, /\[data-page-content\]\s*\.bg-white/,
    'no glass rule should be scoped to [data-page-content] only')
})

// Design Studio's artboard must render the actual design at true, unblurred
// colour while a dealer is designing on it. It used to need an explicit
// `:not(#studio-artboard-container)` on every broadened selector, and that
// exemption list was load-bearing: `:not()` takes its argument's specificity,
// so a bare `#studio-artboard-container` reset could not win on its own.
//
// With glass opt-in the artboard is safe by default — nothing claims it — so
// the invariant is now stated as an outcome rather than an exemption count.
// Verified by measurement against the real built CSS: backdrop-filter `none`,
// solid rgb(255,255,255) in light and rgb(15,23,42) in dark.
// Selector lists contain commas inside :is()/:not(), so a plain split() would
// tear those apart and compare fragments. Split only at depth 0.
const parts = sel => {
  const out = []; let buf = '', depth = 0
  for (const ch of sel) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(buf); buf = '' } else buf += ch
  }
  out.push(buf)
  return out.map(x => x.trim()).filter(Boolean)
}

test('no unscoped glass rule selects by colour utility', () => {
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:\s*blur\([^{}]*\}/g)) {
    for (const sel of parts(m[1])) {
      // A colour class only reaches the artboard when nothing scopes it to some
      // other subtree — i.e. when it is the FIRST compound in the selector.
      assert.doesNotMatch(sel, /^(?:\.dark\s+)?(?:\.bg-white|\.dark\\:bg-slate-900)\b/,
        `an unscoped glass rule selects by colour utility and would catch the artboard:\n  ${sel.slice(0, 160)}`)
    }
  }
})

// Colour-class glass is not fully gone: three subtrees still use it. Each is
// SCOPED to a named ancestor, so none can reach the artboard, a modal, or the
// global shell — and each belongs to a later pass that will migrate it
// deliberately. Pinning the exact set here means a NEW one cannot appear
// quietly; it does not bless the pattern.
const ALLOWED_COLOUR_GLASS_SCOPES = [
  /^\.(?:dark )?\.?ms-pulse-board\b/,          // deliberate: Pulse glance widgets
  /^\.ms-inventory-intelligence\b/,             // migrates with the Inventory pass
  /^\[data-page-content="settings"\]/,          // migrates with the Settings pass
]

test('every surviving colour-class glass rule is scoped to a known subtree', () => {
  const found = new Set()
  for (const m of css.matchAll(/([^{}]+)\{[^{}]*backdrop-filter:\s*blur\([^{}]*\}/g)) {
    for (const sel of parts(m[1])) {
      if (!/\.bg-white|\.dark\\:bg-slate-900/.test(sel)) continue
      found.add(sel.replace(/\s+/g, ' '))
    }
  }
  assert.ok(found.size > 0, 'the scan must actually find the known rules, or it is asserting nothing')
  for (const sel of found) {
    const scoped = ALLOWED_COLOUR_GLASS_SCOPES.some(re => re.test(sel.replace(/^\.dark /, '')))
    assert.ok(scoped,
      `a new colour-class glass rule appeared outside the known scopes — glass is opt-in via .ms-glass:\n  ${sel}`)
  }
})

// The artboard is a content surface: opaque, so what the dealer sees is the
// colour they are actually shipping.
test('the artboard keeps an opaque background', () => {
  assert.doesNotMatch(css, /#studio-artboard-container[^{}]*\{[^}]*backdrop-filter:\s*blur\(/,
    'the artboard must never blur what is behind it')
})
