import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const ds = readFileSync(path.join(FRONTEND, 'css', 'ms-design-system.css'), 'utf8')
const dashboard = readFileSync(path.join(FRONTEND, 'dashboard.html'), 'utf8')

// ── Load order ───────────────────────────────────────────────────────────────
// The design system wins by CASCADE ORDER, not by specificity. That is the whole
// reason it is safe: no !important arms race with the 733 that already exist. If
// it ever loads before tailwind-built.css, semantic classes lose to utilities and
// every migrated surface silently reverts.
test('the design system is the LAST stylesheet the dashboard loads', () => {
  const sheets = [...dashboard.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)/g)].map(m => m[1])
  assert.ok(sheets.includes('css/ms-design-system.css'), 'dashboard must load the design system')
  assert.equal(sheets.at(-1), 'css/ms-design-system.css',
    `design system must load last, got order: ${sheets.join(' → ')}`)
})

// ── Phase 1 is additive ──────────────────────────────────────────────────────
// Phase 1 establishes primitives without restyling anything. If a rule here
// targets a legacy utility class, this file stops being a foundation and starts
// being another override layer — the exact failure mode it was written to end.
test('phase 1 restyles no legacy utility selector', () => {
  const banned = [
    /^\s*\.bg-white[^-]/m,
    /^\s*\.dark\\:bg-slate-900/m,
    /^\s*\.rounded-(?:xl|lg|2xl)\b/m,
  ]
  for (const re of banned) {
    assert.doesNotMatch(ds, re,
      'the foundation must not restyle legacy utilities — that belongs to a migration phase')
  }
})

// ── Responsive correctness ───────────────────────────────────────────────────
// Media queries add no specificity, so a breakpoint rule placed next to its
// component gets silently beaten by any later rule for the same selector. This
// really happened: mobile hero padding/radius lost to the .ms-c--hero block
// below it, so hero cards kept 24px padding and a 26px radius on a 390px phone.
test('every width breakpoint lives in the one responsive section at the end', () => {
  const marker = ds.indexOf('8. RESPONSIVE')
  assert.ok(marker > 0, 'the consolidated responsive section must exist')
  const breakpoints = [...ds.matchAll(/@media \(max-width/g)].map(m => m.index)
  assert.ok(breakpoints.length > 0, 'there must be width breakpoints to check')
  for (const at of breakpoints) {
    assert.ok(at > marker,
      `a width breakpoint at index ${at} sits before the responsive section — media queries add no specificity, so it will lose to any later rule for the same selector`)
  }
  // Everything after the marker is a breakpoint override, so nothing there may
  // introduce a brand-new component; that belongs above with its siblings.
  assert.doesNotMatch(ds.slice(marker), /^\.ms-c \{/m,
    'the responsive section overrides components, it does not define them')
})

// A span wider than the column count silently creates implicit columns and
// throws the whole board out of alignment. This really happened: the empty-card
// collapse kept `span 3` on a 2-column phone grid and produced a phantom 3rd
// column measuring 94px.
test('the empty-card collapse never out-spans the grid at any breakpoint', () => {
  const mobile = ds.slice(ds.indexOf('@media (max-width: 767px)'))
  assert.match(mobile, /\.ms-c--feature\[data-empty="true"\] \{ grid-column: span 1; \}/,
    'a 2-column phone grid can only give a collapsed card 1 column')
  const tablet = ds.slice(ds.indexOf('@media (max-width: 1279px)'), ds.indexOf('@media (max-width: 767px)'))
  assert.match(tablet, /\[data-empty="true"\] \{ grid-column: span 3; \}/,
    'a 6-column tablet grid caps a collapsed card at 3 columns')
})

// Spans are declared once and shared by both spellings. Duplicating them onto
// .ms-c--* is how hero cards kept desktop spans on a phone.
test('card variants share the span declarations rather than redeclaring them', () => {
  assert.match(ds, /\.ms-span-hero,\s+\.ms-c--hero\s+\{ grid-column: span 6;/,
    'the span and the card variant must be declared together, in one place')
  const heroBlock = ds.slice(ds.indexOf('.ms-c--hero {'), ds.indexOf('.ms-c--hero {') + 200)
  assert.doesNotMatch(heroBlock, /grid-column/,
    '.ms-c--hero must not redeclare its own span — that defeats the shared overrides')
})

// ── Material system ──────────────────────────────────────────────────────────
// Glass is a material: transparency ALONE is just a pale box. Saturation is what
// keeps it from reading as grey fog over a colourful page.
test('glass is a real material, not just a transparent background', () => {
  const glass = ds.slice(ds.indexOf('.ms-surface--glass {'), ds.indexOf('.ms-surface--sunken'))
  for (const prop of ['backdrop-filter', 'saturate(', 'var(--ms-g-highlight)', 'var(--ms-g-shadow)']) {
    assert.ok(glass.includes(prop), `glass must use ${prop}`)
  }
})

// Content surfaces carry the dense text people actually read. Glass behind a
// table is the fastest way to make an operational product feel cheap.
test('content surfaces are solid — glass is reserved for floating layers', () => {
  const content = ds.slice(ds.indexOf('.ms-surface--content {'), ds.indexOf('.ms-surface--elevated'))
  assert.doesNotMatch(content, /backdrop-filter/)
  assert.match(content, /background: var\(--ms-s-solid\)/)
})

// Glass must degrade rather than ship unreadable text on a transparent panel.
test('glass degrades where it cannot be composited', () => {
  assert.match(ds, /@supports not \(\(backdrop-filter[\s\S]*?\.ms-surface--glass \{[\s\S]*?background: var\(--ms-s-elevated\)/,
    'no backdrop-filter support must fall back to an opaque elevated surface')
  const mobile = ds.slice(ds.indexOf('@media (max-width: 767px)'))
  assert.match(mobile, /\.ms-surface--glass,\s*\n\s*\.ms-c--glass \{ --ms-g-blur: 14px; \}/,
    'both spellings of a glass surface must get the cheaper mobile blur')
})

// ── Accessibility ────────────────────────────────────────────────────────────
test('the foundation ships reduced-motion, forced-colors and focus handling', () => {
  assert.match(ds, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(ds, /@media \(forced-colors: active\)/)
  assert.match(ds, /:focus-visible \{[\s\S]*?outline: 2px solid var\(--ms-accent-brand\)/)
  assert.match(ds, /\.ms-touch \{ min-height: 44px; min-width: 44px; \}/)
})

// Light mode's base must not be white: white cards on a white page is exactly
// the "milky / washed out / no depth" symptom this system was written to fix.
test('light mode has a non-white base so cards can read as surfaces', () => {
  const root = ds.slice(ds.indexOf(':root {'), ds.indexOf(':root.dark'))
  const base = root.match(/--ms-s-base:\s*(#[0-9A-Fa-f]{6})/)
  assert.ok(base, '--ms-s-base must be defined')
  assert.notEqual(base[1].toUpperCase(), '#FFFFFF', 'a white page behind white cards has no depth')
  const dark = ds.slice(ds.indexOf(':root.dark'))
  const dbase = dark.match(/--ms-s-base:\s*(#[0-9A-Fa-f]{6})/)
  assert.notEqual(dbase[1].toUpperCase(), '#000000', 'pure black flattens every shadow to nothing')
})

// ── Consolidation, not duplication ───────────────────────────────────────────
// The foundation aliases the existing brand primitives instead of restating
// hex values, so there is still exactly one definition of Market Blue.
test('semantic tokens alias the existing brand primitives', () => {
  assert.match(ds, /--ms-accent-brand:\s*var\(--ms-blue-500/,
    'brand accent must reference the existing scale, not a fresh literal')
  const theme = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
  assert.match(theme, /--ms-blue-500:/, 'the primitive it aliases must still exist')
})

test('every page loading the design system uses the same cache-bust version', () => {
  const versions = new Set()
  for (const f of readdirSync(FRONTEND).filter(f => f.endsWith('.html'))) {
    const text = readFileSync(path.join(FRONTEND, f), 'utf8')
    for (const m of text.matchAll(/ms-design-system\.css\?v=([\w]+)/g)) versions.add(m[1])
  }
  assert.ok(versions.size <= 1, `expected one cache-bust version, found: ${[...versions].join(', ')}`)
})
