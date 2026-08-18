import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const scheduler = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-scheduler.js', import.meta.url), 'utf8')
// Strip the leading doc comment (which explains, in prose, exactly the patterns the
// code itself must avoid) before asserting on actual code content below.
const schedulerCode = scheduler.replace(/^\/\*\*[\s\S]*?\*\/\n*/, '')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const studioShell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')

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

test('renderStudioDesignAndPublish keeps the user inside the Studio interface instead of closing it and calling the Marketing engine composer', () => {
  // mktCompose() reads/writes ENGINE_DATA['marketing-overview'] and mounts at
  // #marketing-overview-root, which a Design-Studio-only account never renders — it
  // used to close the Studio first (revealing whatever page sits behind it, Settings
  // for a single-product account) while mktCompose() itself silently failed to mount.
  const fn = studioShell.match(/async function renderStudioDesignAndPublish\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'renderStudioDesignAndPublish must exist')
  assert.match(fn, /window\.studioSchedulerCompose\(res\.asset\.public_url\)/,
    'the render+publish flow must hand off to the self-contained studio scheduler, on top of the Studio')
  assert.doesNotMatch(fn.split("typeof window.studioSchedulerCompose === 'function'")[0], /closeMarketSyncStudio\(\)/,
    'the Studio must not be closed before attempting the self-contained compose path')
})

test('a Facebook-only /social/* MFA_REQUIRED error is surfaced as a clear, actionable notice — not swallowed into "no accounts connected"', () => {
  // Every /social/* route requires step-up MFA. loadStudioSchedulerPosts() used to
  // .catch() each fetch down to an empty array unconditionally, so an MFA denial
  // looked identical to "you truly have zero accounts" — and any call that DIDN'T
  // swallow the error (like saving a post) surfaced the raw 'MFA_REQUIRED' code as
  // the entire toast message.
  assert.match(scheduler, /let __studioSchedulerMfaRequired = false;/)
  const loadFn = scheduler.match(/async function loadStudioSchedulerPosts\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(loadFn, /e\?\.message === 'MFA_REQUIRED'/)
  assert.match(loadFn, /__studioSchedulerMfaRequired = true/)
  assert.match(scheduler, /function studioSchedulerMfaNotice\(\)/)
  const renderFn = scheduler.match(/function renderStudioSchedulerList\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(renderFn, /if \(__studioSchedulerMfaRequired\)/)
})

test('the scheduler has a calendar view with clickable, editable posts, toggleable alongside the list view', () => {
  assert.match(scheduler, /function studioSchedulerSetView\(view\)/)
  assert.match(scheduler, /function renderStudioSchedulerCalendar\(\)/)
  assert.match(scheduler, /function studioSchedulerEditPost\(postId\)/)
  const editFn = scheduler.match(/function studioSchedulerEditPost\(postId\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(editFn, /studioSchedulerSaveReschedule/, 'the edit popover must be able to reschedule')
  assert.match(editFn, /studioSchedulerPublishNow/, 'the edit popover must be able to publish now')
  assert.match(editFn, /studioSchedulerCancelPost/, 'the edit popover must be able to cancel')
})

test('a rendered design pre-attaches into the compose form instead of requiring the user to find it again', () => {
  const fn = scheduler.match(/async function studioSchedulerCompose\(preselectedAssetUrl\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'studioSchedulerCompose must accept a preselected asset url')
  assert.match(fn, /a\.public_url === preselectedAssetUrl \? 'checked' : ''/)
})

test('a real "Connected social accounts" settings card exists, distinct from the demo-data mock panel', () => {
  const card = dashboardHtml.match(/<div id="studio-social-connections"[^>]*>[\s\S]*?studioSocialConnectForm\(\)[\s\S]*?<\/button>/)?.[0] || ''
  assert.ok(card, 'the studio-social-connections card must exist')
  assert.match(card, /studioSocialConnectForm\(\)/)
  assert.match(scheduler, /async function studioSocialConnectionsRender\(\)/)
  assert.match(scheduler, /apiGetJson\('\/social\/accounts'\)/)
  assert.match(scheduler, /async function studioSocialConnectSave\(btn\) \{[\s\S]*?apiSendJson\('\/social\/accounts', 'POST'/)
})

test('Design Studio folds the social connections card into My Account, since Administration is hidden for single-product tiers', () => {
  const block = part2.match(/if \(typeof isDesignStudioOnlyWorkspace === 'function'[\s\S]*?\n {6}\}/)?.[0] || ''
  assert.ok(block, 'the Design Studio fold-in block must exist')
  assert.match(block, /SETTINGS_TAB_SECTIONS\.account\.push\('studio-social-connections'\)/)
  assert.match(block, /getElementById\('studio-social-connections'\)\?\.classList\.remove\('hidden'\)/)
  assert.match(block, /studioSocialConnectionsRender\(\)/)
})
