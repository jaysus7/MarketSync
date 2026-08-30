import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboardPart9 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part9.js', import.meta.url), 'utf8')
const dashboardPart17 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')

// Both settings hubs render a variable number of variable-height cards (different
// description lengths, different action-button counts, different meta rows). A rigid
// CSS grid forces every card in a row to match the row's tallest card, leaving uneven
// gaps below the shorter ones — the opposite of the "masonry" layout both were labeled
// as. CSS multi-column (`columns-*` + `break-inside-avoid` on each item) actually packs
// variable-height items without that dead space, matching the working reference
// implementation in dashboard-part18.js's openMarketingEmailSettings().

test('the top-level Settings hub uses real column-based masonry, not a rigid grid', () => {
  const hub = dashboardPart9.slice(dashboardPart9.indexOf('function loadConfigHub'), dashboardPart9.indexOf('function loadConfigHub') + 3000)
  assert.match(hub, /columns-1 md:columns-2 gap-3/, 'Settings hub container should use CSS multi-column, not grid-cols')
  assert.doesNotMatch(hub, /grid grid-cols-1 md:grid-cols-2 gap-3/, 'Settings hub should no longer use a rigid grid container')
  assert.match(hub, /break-inside-avoid mb-3 rounded-xl/, 'each Settings hub section card should avoid breaking across columns')
})

// Website Setup went the other way, deliberately and later: its own source marks the
// grid as "replaces uneven masonry columns". The dead-space objection above does not
// apply to it because its cards are built for a grid — `flex flex-col justify-between
// h-full` stretches each card to its row and pins the action to the bottom, so a
// shorter card fills its cell instead of leaving a gap. This asserts that pairing,
// since the grid without it is exactly the layout the hub above rejects.
test('Website Setup & Configuration uses an even grid whose cards fill their row', () => {
  const setup = dashboardPart17.slice(dashboardPart17.indexOf('function wsSetup'), dashboardPart17.indexOf('function wsSetup') + 6000)
  assert.match(setup, /grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5/, 'Website Setup should use an even responsive grid')
  assert.match(setup, /flex flex-col justify-between gap-4 h-full/,
    'each card must stretch to its row and pin its action to the bottom, or the grid leaves dead space under short cards')
  assert.doesNotMatch(setup, /columns-1 md:columns-2/, 'the multi-column masonry it replaced must not come back alongside the grid')
})
