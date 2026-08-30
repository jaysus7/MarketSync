import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const ds = readFileSync(path.join(FRONTEND, 'css', 'ms-design-system.css'), 'utf8')
const theme = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')
const part11 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part11.js'), 'utf8')

const tileFn = part11.slice(part11.indexOf('const tile = (label, val, page'),
                            part11.indexOf('const now = new Date()'))

// ms-design-system.css is machine-formatted: a formatter run puts every
// declaration on its own line and drops the spaces around the `>` combinator.
// That is cosmetic — it changes no rule — so these checks read a
// whitespace-normalised copy. Matching the raw text instead made a reformat
// indistinguishable from a deleted style rule, which is what happened here:
// every rule below was present and correct while the assertions read as missing.
// Comments go first so prose inside them can never satisfy a rule check.
const flatCss = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*>\s*/g, ' > ')
  .replace(/\s+/g, ' ')
const dsFlat = flatCss(ds)

// ── Emphasis comes from the data ─────────────────────────────────────────────
// The whole point of this phase: a tile is prominent because its number says
// something needs a person, not because of where it sits in the row. A layout
// that always shouts is the same as one that never does.
test('a tile with nothing in it is never the lead, whatever its flags', () => {
  assert.match(tileFn, /const n = Number\(val\) \|\| 0/,
    'emphasis must be computed from the value, not from the label or position')
  assert.match(tileFn, /n === 0 \? 'quiet'/,
    'a zero must fall to quiet BEFORE the lead and alert branches are considered')
  const zeroFirst = tileFn.indexOf("n === 0 ? 'quiet'")
  const leadAt = tileFn.indexOf("? 'lead'")
  assert.ok(zeroFirst > 0 && zeroFirst < leadAt,
    'the zero check must come first, or a calm store still renders a giant lead tile')
})

test('every emphasis bucket the CSS styles is one the renderer can actually emit', () => {
  const emitted = new Set([...tileFn.matchAll(/'(lead|alert|normal|quiet)'/g)].map(m => m[1]))
  const styled = new Set([...ds.matchAll(/\[data-emphasis="(\w+)"\]/g)].map(m => m[1]))
  for (const e of styled) {
    assert.ok(emitted.has(e), `CSS styles data-emphasis="${e}" but the renderer never emits it`)
  }
  for (const e of emitted) {
    assert.ok(styled.has(e), `the renderer emits data-emphasis="${e}" but no CSS styles it`)
  }
  assert.equal(styled.size, 4, 'expected exactly the four buckets: lead, alert, normal, quiet')
})

// ── The grid must tile exactly ───────────────────────────────────────────────
// A span the column count cannot absorb leaves dead tracks — a half-empty second
// row that reads as a rendering bug. The board grid already learned this once
// (the phantom third column at 2 columns wide); the KPI row must not repeat it.
//
// Five tiles: 6 tracks with a double-width lead, 5 tracks without, 1+4 at tablet
// and 1+2+2 on a phone. Verified by measurement — rows/track counts read from
// the live grid at 1440/1100/800/390 in both the busy and calm states.
test('the lead tile is exactly two tracks and the grid grows a track to fit it', () => {
  assert.match(ds, /\.pulse-summary-grid \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/,
    'no lead means five equal tiles in one clean row')
  assert.match(ds, /\.pulse-summary-grid:has\(\[data-emphasis="lead"\]\) \{\s*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/,
    'a double-width lead needs a sixth track or the row leaves a dead one')
  assert.match(dsFlat, /\.pulse-summary-grid > \[data-emphasis="lead"\] \{ grid-column: span 2; \}/)
})

test('narrow layouts give the first tile the whole row so five tiles still tile evenly', () => {
  for (const bp of ['@media (max-width: 1279px)', '@media (max-width: 767px)']) {
    const at = dsFlat.indexOf(bp)
    assert.ok(at > 0, `${bp} must exist`)
    // Up to the next breakpoint, so one @media cannot answer for another.
    const next = dsFlat.indexOf('@media', at + 1)
    const block = next === -1 ? dsFlat.slice(at) : dsFlat.slice(at, next)
    assert.match(block, /\.pulse-summary-grid > :first-child \{ grid-column: 1 \/ -1; \}/,
      `${bp}: five tiles do not divide evenly, so the first must take the full row`)
  }
})

// Media queries add no specificity, so these must sit in the one responsive
// section like every other breakpoint in this file.
test('the KPI breakpoints live in the consolidated responsive section', () => {
  const marker = ds.indexOf('RESPONSIVE')
  for (const m of ds.matchAll(/@media \(max-width[^)]*\)[^{]*\{/g)) {
    assert.ok(m.index > marker,
      `a width breakpoint at ${m.index} sits before the responsive section and will lose to any later rule`)
  }
})

// ── The type scale must stay a scale ─────────────────────────────────────────
// The first version used vw clamps. They looked right at 1440 and bottomed out
// below it: alert and normal both landed on 30px, so the middle tier silently
// stopped existing at exactly the widths where the board is tightest.
test('each emphasis tier is a distinct size, not a clamp that collapses', () => {
  const sizes = {}
  // A tier's rule may carry more than font-size (quiet also drops its weight),
  // so match the declaration inside the block rather than assuming it is alone.
  for (const m of ds.matchAll(/\[data-emphasis="(\w+)"\]\s+\.ms-kpi__value \{[^}]*?font-size:\s*([^;}]+)/g)) {
    if (!(m[1] in sizes)) sizes[m[1]] = m[2].trim()
  }
  for (const tier of ['lead', 'alert', 'normal', 'quiet']) {
    assert.ok(sizes[tier], `${tier} must have a size`)
    assert.doesNotMatch(sizes[tier], /vw/,
      `${tier} uses a viewport clamp; those collapse into each other on a narrow board`)
  }
  const rem = t => parseFloat(sizes[t])
  assert.ok(rem('lead') > rem('alert'), 'lead must outrank alert')
  assert.ok(rem('alert') > rem('normal'), 'alert must outrank normal')
  assert.ok(rem('normal') > rem('quiet'), 'normal must outrank quiet')
})

// ── The accent must actually be able to paint ────────────────────────────────
// `.ms-pulse-board .bg-white` sets border-color and box-shadow with !important.
// That silently killed the amber border the renderer has ALWAYS put on an urgent
// count — the hot state was dead inside the board — and would have killed the
// lead tile's edge too. The fix is to exempt KPI tiles from the board glass, not
// to escalate into another !important.
test('KPI tiles are exempt from the board glass so their own borders paint', () => {
  const glassRules = [...theme.matchAll(/[^{}]*\.ms-pulse-board \.bg-white[^{}]*\{/g)].map(m => m[0])
  assert.ok(glassRules.length >= 2, 'the board glass rules must still exist for real Pulse cards')
  for (const r of glassRules) {
    assert.match(r, /\.bg-white:not\(\.ms-kpi\)/,
      `a board glass rule still claims KPI tiles and will override their border:\n  ${r.trim().slice(0, 120)}`)
  }
})

test('the lead accent does not need !important to win', () => {
  const lead = dsFlat.match(/\.pulse-summary-grid > \[data-emphasis="lead"\] \{[^}]*box-shadow[^}]*\}/)
  assert.ok(lead, 'the lead tile must carry an accent edge')
  assert.doesNotMatch(lead[0], /!important/,
    'the design system wins by cascade order; an !important here means the exemption above failed')
  assert.match(lead[0], /var\(--ms-accent-warn/, 'the edge must use the semantic warn token')
})

test('the warn accent aliases the existing primitive in both themes', () => {
  const defs = [...ds.matchAll(/--ms-accent-warn:\s*var\(([^,)]+)/g)].map(m => m[1].trim())
  assert.equal(defs.length, 2, 'light and dark must each define the warn accent')
  for (const d of defs) {
    assert.match(d, /^--ms-warning-\d00$/, 'it must alias the existing warning scale, not a fresh literal')
    assert.ok(theme.includes(`${d}:`), `${d} must actually exist in the theme`)
  }
})

// The renderer must not go back to sizing tiles with utility classes; that is
// what made all five read as the same thing.
test('tile size comes from the design system, not a hard-coded utility', () => {
  assert.match(tileFn, /class="ms-kpi__value/, 'the number must carry the semantic class')
  assert.doesNotMatch(tileFn, /ms-kpi__value[^"]*text-3xl/,
    'a fixed text-3xl on the value defeats the whole hierarchy')
})

// ── The hierarchy must survive every dashboard mode ──────────────────────────
// Brand modes restyle every rounded, bordered card inside .page-content — and a
// KPI tile is exactly that shape. Measured before the fix: in `marketsync` and
// `digital` the tiles were re-glassed and the lead tile's amber border was
// repainted to the SAME colour as a normal tile, so urgency was invisible in two
// of the four dashboard modes while looking correct in the other two. Size
// survived (the design system wins on cascade order); colour did not.
test('brand modes do not repaint the KPI tile that marks an urgent count', () => {
  const brandRules = [...theme.matchAll(/[^{}]*(?:data-dash-mode="marketsync"|data-ms-suite="digital")[^{}]*\{/g)]
    .map(m => m[0])
    .filter(r => /\.page-content/.test(r) && /\.rounded-(?:xl|2xl)\.border/.test(r))
  assert.ok(brandRules.length >= 4,
    `expected the brand-mode card rules to still exist, found ${brandRules.length}`)
  // The exemption is applied to the whole :is(...) group, so the individual
  // .rounded-xl.border inside it correctly carries no :not() of its own. Check
  // the RULE excludes KPI tiles, not each item within the group.
  for (const rule of brandRules) {
    assert.match(rule, /:not\([^)]*\.ms-kpi[^)]*\)/,
      `a brand-mode rule still claims KPI tiles and will erase the urgency border:\n  ${rule.trim().slice(-160)}`)
  }
})
