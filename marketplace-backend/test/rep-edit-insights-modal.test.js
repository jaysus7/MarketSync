import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const part14 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part14.js', import.meta.url), 'utf8')

test('the Sales Team table always opens openRepEdit, not the permanently-stubbed openEditEmployeeModal', () => {
  // getPeopleComplianceData() (dashboard-part24.js) is a deliberate stub that always
  // returns [] — "legacy callers receive no invented roster". openEditEmployeeModal
  // reads from it, so calling that function for a /dealership/team row (a profile
  // record, not a People-module employee) always fails its `.find()` and silently
  // no-ops: clicking Edit looked wired but did nothing.
  const wiring = part14.match(/__dealerTeam = team;[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(wiring, 'the rep-detail-btn/rep-edit-btn click wiring must exist')
  assert.doesNotMatch(wiring, /openEditEmployeeModal\(/, 'must not call the People-module modal for Sales Team rows')
  assert.match(wiring, /if \(typeof openRepEdit === 'function'\) openRepEdit\(repId\)/)
})

test('openRepEdit folds per-rep Insights (posts/sold/conversion) into the same modal as Edit', () => {
  const fn = part14.match(/function openRepEdit\(id\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'openRepEdit must exist')
  assert.match(fn, /id="re-insights"/, 'the modal must render an insights section')
  assert.match(fn, /const ov = crmOverlay\(/, 'must capture the overlay so insights can be loaded after render')
  assert.match(fn, /loadRepEditInsights\(m\.id\)/, 'must kick off the insights fetch for this rep')
})

test('loadRepEditInsights sources posts/sold/conversion from the same /gamification data as the Sales Leaderboard', () => {
  const fn = part14.match(/async function loadRepEditInsights\(repId\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'loadRepEditInsights must exist')
  assert.match(fn, /fetch\(`\$\{API\}\/gamification`/)
  assert.match(fn, /data\.departments\?\.facebook/)
  assert.match(fn, /r\.rep_id === repId/)
  assert.match(part14, /window\.loadRepEditInsights = loadRepEditInsights/)
})
