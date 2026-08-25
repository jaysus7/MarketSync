import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'

const FRONTEND = fileURLToPath(new URL('../../marketplace-frontend', import.meta.url))
const part11 = readFileSync(path.join(FRONTEND, 'js', 'modules', 'dashboard-part11.js'), 'utf8')
const ds = readFileSync(path.join(FRONTEND, 'css', 'ms-design-system.css'), 'utf8')

// These builders are pure, so run them for real rather than pattern-matching the
// source. A regex can only confirm the code says something; this confirms it does
// it. The helper block is lifted into a VM with the two globals it touches stubbed.
function loadHelpers() {
  const start = part11.indexOf('function cmdField(')
  const end = part11.indexOf('function cmdAttentionCard(')
  assert.ok(start > 0 && end > start, 'the tile-record helpers must exist')
  const ctx = { esc: s => String(s), document: { querySelectorAll: () => [] } }
  vm.createContext(ctx)
  vm.runInContext(part11.slice(start, end), ctx)
  return ctx
}

const SAMPLE = {
  day: { needs_attention: [
    { title: 'Deal 4471 missing funding docs', department: 'F&I', reason: 'Lender needs proof of income',
      next_action: 'Upload docs', deep_link: '/fni/deals/4471' },
    { subject: 'Trade payoff unverified', department: 'Sales', reason: 'Payoff quote expired', deep_link: null },
  ] },
  fniDeals: [
    { customer_name: 'M. Torres', vehicle: '2021 F-150', stage: 'funding' },
    { customer_name: 'S. Patel', vehicle: '2019 CR-V', status: 'sold' },
  ],
  deliveries: { queue: [{ customer_name: 'D. Kim', vehicle: '2022 Sierra', stock_num: 'A1042' }] },
  reconVehicles: { vehicles: [
    { stock_num: 'B2210', vehicle: '2020 Rav4', stage: 'Wash & Detail', days_in_recon: 9 },
    { id: 'x9', stage: 'Paint' },
  ] },
  serviceRos: { ros: [
    { ro_number: '1042', customer_name: 'M. Torres', vehicle: '2021 F-150', status: 'Awaiting parts' },
    { id: 'r7', status: 'closed' },
  ] },
}

// ── A count must name its records ────────────────────────────────────────────
// The point of this feature: "3" and a jump to a whole page makes the reader do
// the work twice. Each count resolves to the actual customers, units and repair
// orders behind it.
test('every tile in the row resolves to a named record group', () => {
  const { cmdPulseRecords } = loadHelpers()
  const groups = cmdPulseRecords(SAMPLE)
  const keys = [...part11.matchAll(/\$\{tile\([^)]*'(\w+)'\)\}/g)].map(m => m[1])
  assert.ok(keys.length >= 5, `expected the Running-today tiles to declare keys, found ${keys.length}`)
  for (const k of keys) {
    assert.ok(groups[k], `tile "${k}" has no record group, so its count leads nowhere`)
    assert.ok(groups[k].label && groups[k].page && groups[k].pageLabel,
      `record group "${k}" must know what it is and where its full list lives`)
  }
})

test('records carry a real identity — customer, unit or repair order', () => {
  const { cmdPulseRecords } = loadHelpers()
  const g = cmdPulseRecords(SAMPLE)
  assert.equal(g.deals.rows[0].title, 'M. Torres')
  assert.match(g.deals.rows[0].meta, /2021 F-150/)
  assert.match(g.recon.rows[0].title, /B2210/)
  assert.match(g.recon.rows[0].title, /2020 Rav4/)
  assert.match(g.recon.rows[0].meta, /9 days in recon/)
  assert.match(g.service.rows[0].title, /RO 1042/)
  assert.match(g.service.rows[0].title, /M\. Torres/)
  assert.equal(g.deliveries.rows[0].title, 'D. Kim')
})

// A record we cannot name is shown by its id. Inventing a plausible-looking
// label would put a customer name on a screen that no system actually holds.
test('an unnameable record falls back to its id, never to a made-up label', () => {
  const { cmdPulseRecords } = loadHelpers()
  const g = cmdPulseRecords(SAMPLE)
  const anon = g.recon.rows.find(r => /x9/.test(r.title))
  assert.ok(anon, 'a record with no stock number must still be listed')
  assert.match(anon.title, /^Unit x9$/, 'it must be identified by its id, not a placeholder name')
})

// Finished work is not outstanding work. A sold deal or closed RO in these lists
// would inflate the count the tile is meant to explain.
test('closed and sold records are excluded from what still needs doing', () => {
  const { cmdPulseRecords } = loadHelpers()
  const g = cmdPulseRecords(SAMPLE)
  assert.equal(g.deals.rows.length, 1, 'the sold deal must not appear')
  assert.ok(!g.deals.rows.some(r => /Patel/.test(r.title)))
  assert.equal(g.service.rows.length, 1, 'the closed repair order must not appear')
})

// ── Honesty about what is being shown ────────────────────────────────────────
// The counts come from the server's command-centre tiles; the records come from
// separate record endpoints. One can be entitled or reachable when the other is
// not, so a shorter list under a bigger number must say so rather than reading
// as "that is all of them".
test('a record list shorter than its count says so', () => {
  const { cmdPulseRecords, cmdPulseTilePanel } = loadHelpers()
  const g = cmdPulseRecords(SAMPLE)
  const panel = cmdPulseTilePanel('recon', g.recon, 5)
  assert.match(panel, /Showing 2 of 5/, 'the panel must reconcile its own list against the tile count')
  const exact = cmdPulseTilePanel('recon', g.recon, 2)
  assert.doesNotMatch(exact, /Showing 2 of 2/, 'no shortfall notice when the list is complete')
})

test('a group with no readable records says that instead of showing nothing', () => {
  const { cmdPulseRecords, cmdPulseTilePanel } = loadHelpers()
  const empty = cmdPulseRecords({})
  const panel = cmdPulseTilePanel('deals', empty.deals, 4)
  assert.match(panel, /No individual records are readable/,
    'an empty list under a non-zero count must be explained, not silent')
  assert.match(panel, /Open Sales/, 'it must still offer the page that does hold them')
})

// A row with nowhere to go must not look clickable.
test('a record without a deep link renders unclickable rather than as a dead button', () => {
  const { cmdPulseRecords, cmdPulseTilePanel } = loadHelpers()
  const g = cmdPulseRecords(SAMPLE)
  const linked = g.attention.rows.find(r => r.open)
  const unlinked = g.attention.rows.find(r => !r.open)
  assert.ok(linked && unlinked, 'the sample must cover both cases')
  const panel = cmdPulseTilePanel('attention', g.attention, 2)
  assert.match(panel, /<div [^>]*class="ms-kpi-record/, 'the unlinked record must render as a div')
  assert.match(panel, /<button [^>]*onclick[^>]*class="ms-kpi-record/, 'the linked record must render as a button')
})

test('the deep link is carried through to the record row', () => {
  const { cmdPulseRecords } = loadHelpers()
  const g = cmdPulseRecords(SAMPLE)
  const row = g.attention.rows.find(r => r.open)
  assert.match(row.open, /cmdOpenAttention\(/, 'an attention record opens via the existing deep-link handler')
  assert.match(row.open, /fni%2Fdeals%2F4471/, 'the link must be encoded, not interpolated raw into the handler')
})

// ── Wiring ───────────────────────────────────────────────────────────────────
test('the toggle is reachable from the inline handlers the tiles use', () => {
  assert.match(part11, /Object\.assign\(window, \{[^}]*cmdPulseTileToggle/,
    'an onclick="cmdPulseTileToggle(...)" needs the function on window or the tile does nothing')
})

test('a tile with records expands in place instead of navigating away', () => {
  const tileFn = part11.slice(part11.indexOf('const tile = (label, val, page'),
                              part11.indexOf('const now = new Date()'))
  assert.match(tileFn, /const expandable = n > 0 && !!records\[key\]/,
    'only a tile that actually has records may claim to show them')
  assert.match(tileFn, /expandable \? `cmdPulseTileToggle/,
    'a tile with records opens them here; the count is the question and the records are the answer')
  assert.match(tileFn, /: `switchPage\('\$\{page\}'\)`/,
    'a tile with nothing to expand must still take you to its page')
})

// The affordance is chrome, not data — on a zero tile it would be an invitation
// to open an empty list.
test('a quiet tile does not advertise records it has none of', () => {
  assert.match(ds, /\[data-emphasis="quiet"\] \.ms-kpi__hint \{ display: none; \}/)
})
