import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const raw = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
const dashboard = readFileSync(path.join(FRONTEND, 'dashboard.html'), 'utf8')

// Comments explain why the blanket selector is gone and necessarily quote it.
// Every assertion below is about real rules, so strip comments first.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')

// ── The rule this phase exists to delete ─────────────────────────────────────
// `.bg-white:not(#studio-artboard-container)` decided a surface's MATERIAL from
// its COLOUR class, so it caught all 1,297 bg-white call sites: KPI tiles,
// record cards and dense repair-order tables all sat behind blur(20px). It is
// the single line behind milky light mode, cards that all read as equally
// important, and nine compositing layers on a page that needs three.
test('no rule decides glass from a colour utility class', () => {
  // "Blanket" means UNSCOPED: the colour class is the first compound, so the rule
  // reaches every bg-white in the product. A colour class that sits under a named
  // ancestor is a different thing — `.ms-pulse-board .bg-white:not(.ms-kpi)` is the
  // deliberate Pulse exception, and it can only ever reach cards inside that board.
  // liquid-glass-body-modals.test.js pins the full set of scoped survivors.
  assert.doesNotMatch(css, /(^|,)\s*\.bg-white:not\(/m,
    'an unscoped .bg-white glass selector force-glasses every card in the product')
  assert.doesNotMatch(css, /(^|,)\s*\.dark\\:bg-slate-900:not\(/m,
    'the dark-mode twin has the same effect and must not come back either')
})

// `:not()` contributes its argument's specificity, so `.bg-white:not(#id)`
// out-ranks a bare `#id` rule. That is how the old selector survived every
// attempt to exempt a surface by ID, and why exemption lists kept growing.
test('surfaces are not exempted from glass by ID lists', () => {
  assert.doesNotMatch(css, /:not\(#studio-artboard-container\)/,
    'an exemption list is the symptom of a selector that opts everything in by default')
})

// Glass is opt-in, not opt-out: it belongs to surfaces that genuinely float
// above content. Deleting the blanket rule must not take the real chrome with it.
test('floating chrome keeps its glass in both modes', () => {
  const light = css.match(/#nav-desktop,\s*\n#nav-mobile,[\s\S]*?\n\}/)
  assert.ok(light, 'the light-mode floating-chrome rule must still exist')
  assert.match(light[0], /backdrop-filter:\s*blur\(/, 'floating chrome is what glass is for')
  for (const sel of ['#nav-desktop', '#nav-mobile', '#report-rail',
                     '.ms-engine-header', '.ms-glass']) {
    assert.ok(light[0].includes(sel), `${sel} floats above content and must keep glass`)
  }
  // #dept-sidebar is deliberately NOT here: it is the sidebar COLUMN, and the one
  // glass panel inside it is #dashboard-nav. While the wrapper was also listed,
  // `.dark #dept-sidebar` out-specified its own bare-id transparent reset and the
  // column painted a second panel around the nav's — see
  // sidebar-nav-no-double-glass.test.js.
  assert.ok(!light[0].includes('#dept-sidebar'),
    'the sidebar column is layout, not a panel — listing it here recreates the double-nav box')

  const dark = css.match(/\.dark #nav-desktop,[\s\S]*?\n\}/)
  assert.ok(dark, 'the dark-mode floating-chrome rule must still exist')
  assert.ok(dark[0].includes('.ms-glass'), '.ms-glass is the explicit opt-in and must work in dark mode')
  assert.ok(!dark[0].includes('#dept-sidebar'), 'the dark twin must not claim the column either')
})

// Translucency with nothing behind it is pure cost: the compositor promotes a
// layer and blurs a solid colour. Glass must always come with a see-through
// background, in both modes. Backgrounds are often written as a token, so
// resolve custom properties before judging — a check that cannot see through
// var() would pass every rule that uses one.
const translucent = v => /rgba\(|hsla\(|transparent|\/\s*[\d.]/.test(v)

test('every glass rule is actually translucent', () => {
  // Every declared value of each custom property, so a token that is opaque in
  // any one theme is still caught.
  const tokens = new Map()
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!tokens.has(m[1])) tokens.set(m[1], [])
    tokens.get(m[1]).push(m[2].trim())
  }
  const resolve = (v, depth = 0) => {
    if (depth > 4) return v
    return v.replace(/var\((--[\w-]+)[^)]*\)/g, (_, name) =>
      (tokens.get(name) || ['']).map(x => resolve(x, depth + 1)).join(' '))
  }

  let checked = 0
  for (const m of css.matchAll(/\{[^{}]*backdrop-filter:\s*blur\([^{}]*\}/g)) {
    const block = m[0]
    if (/backdrop-filter:\s*none/.test(block)) continue
    const bg = block.match(/(?:^|[;{])\s*background(?:-color)?:\s*([^;}]+)/)
    if (!bg) continue
    checked++
    assert.ok(translucent(resolve(bg[1])),
      `a glass rule paints an opaque background — the blur cannot show anything:\n${block.slice(0, 200)}`)
  }
  assert.ok(checked >= 3, `expected to inspect real glass rules, inspected ${checked}`)
})

// The token check above is only meaningful if it would actually fail. An opaque
// background behind a blur must be rejected however it is spelled.
test('the translucency check rejects an opaque background', () => {
  assert.equal(translucent('#ffffff'), false)
  assert.equal(translucent('linear-gradient(135deg, #f8fafc, #eef3f9)'), false)
  assert.equal(translucent('rgba(255,255,255,.76)'), true)
  assert.equal(translucent('rgb(255 255 255 / 76%)'), true)
})

// Users who ask their OS to reduce transparency get solid surfaces. The old
// block re-listed the blanket colour selectors; with glass opt-in it only has
// to flatten the chrome that actually has glass.
test('reduced-transparency flattens the chrome, not colour classes', () => {
  const at = css.indexOf('prefers-reduced-transparency')
  assert.ok(at > 0, 'the reduced-transparency accommodation must survive this phase')
  const block = css.slice(at, css.indexOf('}\n}', at))
  assert.doesNotMatch(block, /\.bg-white/,
    'flattening by colour class is the same mistake in a different place')
  assert.match(block, /#dept-sidebar/, 'the real glass surfaces still need flattening')
})

// Content surfaces carry dense text people read for minutes at a time. Pulse
// cards are the one deliberate exception and stay scoped to the board.
test('the deliberate Pulse card treatment stays scoped to the board', () => {
  assert.match(css, /\.ms-pulse-board \.bg-white/,
    'Pulse glance widgets keep their treatment — scoped to .ms-pulse-board, not global')
  assert.doesNotMatch(css, /\.ms-pulse-board details\b/,
    'a bare details selector glasses padding-less section wrappers')
})

// A cascade-order design system is only safe if browsers actually fetch the new
// file. Removing rules is invisible to anyone holding a cached stylesheet.
test('the stylesheet ships with a fresh cache-bust', () => {
  const m = dashboard.match(/marketsync-theme\.css\?v=([\w]+)/)
  assert.ok(m, 'dashboard must load the theme with a cache-bust')
  assert.match(m[1], /^\d{8}_/, 'the cache-bust must carry a date so its age is readable')
  assert.notEqual(m[1], '20260825_pulse_wide_restored_v1',
    'removing the blanket glass rule requires a new version or users keep the old CSS')
})
