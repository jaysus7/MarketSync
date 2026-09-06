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

// The second "Website Setup & Configuration" landing (wsSetup) was deleted — website
// configuration lives once, under Website Studio → Settings, which renders a fixed-height
// form grid rather than variable-height masonry cards. test/website-setup-landing.test.js
// ('keeps all website configuration under Settings without a second Setup page') is what
// holds that line now, including asserting wsSetup cannot come back. Nothing to lay out
// as masonry here any more, so the masonry check for it is gone with the screen.
