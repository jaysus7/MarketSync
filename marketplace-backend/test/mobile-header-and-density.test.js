import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const dashboard = readFileSync(path.join(FRONTEND, 'dashboard.html'), 'utf8')
const part10 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part10.js'), 'utf8')
const part11 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part11.js'), 'utf8')
const theme = readFileSync(path.join(FRONTEND, 'css', 'marketsync-theme.css'), 'utf8')

// ── The logo must not be cut off ─────────────────────────────────────────────
// Both logo PNGs are 1536x1024 with the visible ink spanning x 8.66%..91.28%
// (Logo 2.0) and 7.16%..89.71% (Logo 2.1) — measured from the pixels, not guessed.
// The phone crop puts an image of width W at offset L inside a 10.5rem box, so the
// ink lands at (W*inkLeft + L) .. (W*inkRight + L) and BOTH ends must sit inside
// the box. The old crop (W=13, L=-1.1) needed 10.77rem and had 10.5rem, so the last
// ~4px of "MarketSync" was sliced off mid-letter — which is what made the Demo pill
// beside it look like an overlap.
const INK = { light: { l: 0.0866, r: 0.9128 }, dark: { l: 0.0716, r: 0.8971 } }

test('the phone logo crop shows the whole wordmark for both logo files', () => {
  const block = dashboard.slice(dashboard.indexOf('@media (max-width:639px){'))
  const box = Number(block.match(/#dashboard-brand\{width:([\d.]+)rem/)[1])
  const img = block.match(/#dashboard-brand img\[alt="MarketSync DealerOS"\]\{width:([\d.]+)rem!important;left:(-?[\d.]+)rem/)
  assert.ok(img, 'the phone crop must set an explicit image width and left offset')
  const [w, l] = [Number(img[1]), Number(img[2])]
  for (const [name, ink] of Object.entries(INK)) {
    const left = w * ink.l + l
    const right = w * ink.r + l
    assert.ok(left >= -0.02, `${name} logo is clipped on the LEFT: ink starts at ${left.toFixed(3)}rem`)
    assert.ok(right <= box + 0.02,
      `${name} logo is clipped on the RIGHT: ink ends at ${right.toFixed(3)}rem but the box is ${box}rem — the wordmark loses its last letters`)
  }
})

// ── Department headers must wrap ─────────────────────────────────────────────
// A department header is a title plus two or three action buttons. On a phone they
// cannot share a line, and without a wrap "Open Accounting Workspace →" ran off the
// right edge of the card. Verified at 390/430/768/1400: nothing overflows the card
// and the page never scrolls horizontally.
test('every Pulse department header wraps instead of overflowing', () => {
  const nonWrapping = part11.split('class="flex items-center justify-between border-b').length - 1
  assert.equal(nonWrapping, 0,
    `${nonWrapping} department header(s) still use a non-wrapping flex row and will overflow on a phone`)
  const wrapping = part11.split('class="flex flex-wrap items-center justify-between').length - 1
  assert.ok(wrapping >= 16, `expected the department headers to wrap, found ${wrapping}`)
})

test('the action group inside a department header wraps too', () => {
  assert.match(theme, /\.pulse-dept-section > \.flex\.justify-between > \.flex \{[^}]*flex-wrap:\s*wrap/,
    'the buttons are their own flex row; wrapping the header alone still leaves them on one line')
})

// The AI panel title and its telemetry badge cannot share a line on a phone. With
// no wrap the badge was crushed against the title and broken over three lines.
test('the AI panel header wraps and its badge stays on one line', () => {
  const header = part11.slice(part11.indexOf('Proactive General Manager AI Executive Assistant') - 600,
                              part11.indexOf('STORE-WIDE EXECUTIVE TELEMETRY') + 120)
  assert.match(header, /flex flex-wrap items-center justify-between/,
    'the title/badge row must wrap')
  assert.match(header, /whitespace-nowrap[^"]*bg-sky-500\/20/,
    'the badge is a label, not a paragraph — it must not break mid-phrase')
})

// ── A tone is an alert; an alert about nothing is noise ──────────────────────
// Callers pass a fixed tone per metric, so "Expenses MTD" was amber even at $0,
// and a figure that could not be READ showed "—" in warning amber — colouring an
// unknown as though it were a finding.
test('a KPI only wears its alert colour when the number has a magnitude', () => {
  assert.match(part10, /function engKpiIsQuiet\(val\)/, 'the quiet test must exist')
  const fn = part10.slice(part10.indexOf('function engKpiText'), part10.indexOf('function engKpi(label'))
  assert.match(fn, /!\/\[1-9\]\/\.test/, 'a value with no non-zero digit carries no magnitude')
  // The tag stripping must NOT be `replace(/<[^>]*>/g, '')`: that is incomplete
  // ("<scr<script>ipt>" survives it), CodeQL flags it, and it cannot handle
  // nesting — which is the actual requirement here, since a tag's own attributes
  // must not be read as the value.
  assert.doesNotMatch(fn, /replace\(\/<\[\^>\]\*>\/g/,
    'an incomplete tag-stripping regex must not come back')

  const body = part10.slice(part10.indexOf('function engKpi(label'), part10.indexOf('function engKpi(label') + 700)
  assert.match(body, /const quiet = engKpiIsQuiet\(val\)/)
  assert.match(body, /quiet \? 'text-slate-900 dark:text-white' : \(tone \|\| /,
    'a quiet value must fall back to the neutral tone, not the caller-supplied alert colour')
})

test('the quiet test treats an unknown the same as a zero', () => {
  // Re-implemented from the source so the rule itself is asserted, not just its shape.
  // Execute the real implementation rather than describing it.
  const src = part10.slice(part10.indexOf('function engKpiText'), part10.indexOf('function engKpi(label'))
  const isQuiet = new Function(`${src}; return engKpiIsQuiet(val)`).bind(null)
  const call = (v) => new Function('val', `${src}; return engKpiIsQuiet(val)`)(v)
  void isQuiet
  for (const v of ['$0', '$0.00', '0', '—', '<b>$0</b>', '',
                   '<span class="text-3xl">$0</span>',   // the tag's own 3 must not count
                   '<scr<script>ipt>$0',                  // survives the naive regex, not this
                   null]) {
    assert.equal(call(v), true, `${JSON.stringify(v)} has no magnitude and must be quiet`)
  }
  for (const v of ['$12,400', '3', '0.5%', '-$1,200']) {
    assert.equal(call(v), false, `${JSON.stringify(v)} has a magnitude and must keep its tone`)
  }
})
