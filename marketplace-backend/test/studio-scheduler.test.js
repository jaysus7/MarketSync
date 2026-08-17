import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const scheduler = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-scheduler.js', import.meta.url), 'utf8')
// Strip the leading doc comment (which explains, in prose, exactly the patterns the
// code itself must avoid) before asserting on actual code content below.
const schedulerCode = scheduler.replace(/^\/\*\*[\s\S]*?\*\/\n*/, '')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const studioShell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')

test('studio-scheduler.js is registered as a script in dashboard.html, after fabric-adapter.js', () => {
  const fabricIdx = dashboardHtml.indexOf('js/modules/studio/fabric-adapter.js')
  const schedIdx = dashboardHtml.indexOf('js/modules/studio/studio-scheduler.js')
  assert.ok(fabricIdx > -1, 'fabric-adapter.js must be present')
  assert.ok(schedIdx > -1, 'studio-scheduler.js must be registered')
  assert.ok(schedIdx > fabricIdx, 'studio-scheduler.js must load after fabric-adapter.js')
})

test('the studio scheduler never reuses ENGINE_DATA/mktReload/engineTab — those assume the Marketing engine page is mounted', () => {
  // A Design-Studio-only account never renders #marketing-overview-root (they land
  // straight in the full-screen editor), so calling engineTab()/mktReload() from here
  // would either no-op against a missing DOM root or misroute via msSyncRoute(). The
  // scheduler must manage its own state and talk to /social/* directly.
  assert.doesNotMatch(schedulerCode, /ENGINE_DATA\[/)
  assert.doesNotMatch(schedulerCode, /mktReload\(\)/)
  assert.doesNotMatch(schedulerCode, /engineTab\('/)
})

test('openStudioScheduler loads accounts and posts directly from /social/*, independent of the Marketing engine fetch', () => {
  assert.match(scheduler, /function openStudioScheduler/)
  assert.match(scheduler, /apiGetJson\('\/social\/accounts'\)/)
  assert.match(scheduler, /apiGetJson\('\/social\/posts'\)/)
  assert.match(scheduler, /window\.openStudioScheduler = openStudioScheduler/)
})

test('studioSchedulerSavePost posts to /social/posts and refreshes the local list, not the Marketing engine', () => {
  const fn = scheduler.match(/async function studioSchedulerSavePost\(btn\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'studioSchedulerSavePost must exist')
  assert.match(fn, /apiSendJson\('\/social\/posts', 'POST'/)
  assert.match(fn, /loadStudioSchedulerPosts\(\)/)
})

test('publish/reschedule/cancel actions hit the same /social/posts endpoints as the Marketing engine composer', () => {
  assert.match(scheduler, /apiSendJson\(`\/social\/posts\/\$\{postId\}\/publish`, 'POST', \{\}\)/)
  assert.match(scheduler, /apiSendJson\(`\/social\/posts\/\$\{postId\}`, 'PUT', \{ scheduled_local: next \}\)/)
  assert.match(scheduler, /apiSendJson\(`\/social\/posts\/\$\{postId\}\/cancel`, 'POST', \{\}\)/)
})

test('the Studio header has a Schedule button wired to openStudioScheduler', () => {
  assert.match(studioShell, /onclick="if\(typeof openStudioScheduler === 'function'\) openStudioScheduler\(\)"/)
  const btn = studioShell.match(/<button onclick="if\(typeof openStudioScheduler[\s\S]*?<\/button>/)?.[0] || ''
  assert.match(btn, />Schedule\s*<\/button>/)
})
