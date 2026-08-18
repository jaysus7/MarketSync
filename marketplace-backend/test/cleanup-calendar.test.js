import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part15 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part15.js', import.meta.url), 'utf8')

test('the Cleanup department board has a List/Calendar toggle', () => {
  assert.match(part15, /let __reconView = 'list'/, 'view state exists, defaulting to the list')
  assert.match(part15, /data-recon-view="\$\{id\}"/)
  assert.match(part15, /tabBtn\('list', 'List'\)/)
  assert.match(part15, /tabBtn\('calendar', 'Calendar'\)/)
  // Clicking a toggle switches the view and re-renders.
  assert.match(part15, /__reconView = b\.dataset\.reconView; renderReconBoard\(\)/)
})

test('the calendar view lays vehicles out by delivery date with month navigation', () => {
  const fn = part15.match(/function renderReconCalendar\(cards, esc\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'renderReconCalendar must exist')
  // Groups cards by their local delivery day.
  assert.match(fn, /c\.delivery_at/)
  assert.match(fn, /reconDateKey\(new Date\(c\.delivery_at\)\)/)
  // A real month grid (weekday offset + days in month).
  assert.match(fn, /new Date\(year, month \+ 1, 0\)\.getDate\(\)/)
  assert.match(fn, /grid-cols-7/)
  // Prev / next / today navigation.
  assert.match(part15, /data-recon-cal="prev"/)
  assert.match(part15, /data-recon-cal="next"/)
  assert.match(part15, /data-recon-cal="today"/)
  // Cars with no delivery date are still shown, not hidden.
  assert.match(fn, /No delivery date yet/)
  // Chips open the same stock card as the list rows.
  assert.match(fn, /data-recon-open="\$\{c\.inventory_id\}"/)
})
