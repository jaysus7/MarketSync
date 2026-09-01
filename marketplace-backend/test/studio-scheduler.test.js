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
const dashboard = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')

// Studio no longer ships as static <script> tags. Its canvas stack is heavy and only
// a fraction of accounts open it, so it is lazy-loaded on demand and the scheduler is
// a standalone page module fetched when the social-scheduler page opens. The old
// ordering constraint - scheduler after fabric-adapter in dashboard.html - described an
// arrangement that no longer exists; the ordering that still matters is inside the
// studio chain, where the canvas adapter must be in place before the shell that uses it.
test('the studio stack is lazy-loaded, with the canvas adapter ahead of the shell', () => {
  // Neither is a static tag any more: loading fabric on every dashboard boot is the
  // cost this arrangement exists to avoid.
  assert.equal(dashboardHtml.includes('<script src="js/modules/studio/fabric-adapter.js'), false)
  assert.equal(dashboardHtml.includes('<script src="js/modules/studio/studio-scheduler.js'), false)

  // Full paths: 'studio/studio-shell.js' alone also matches design-studio/studio-shell.js,
  // a different file in the newer editor stack.
  const FABRIC = 'js/modules/studio/fabric-adapter.js'
  const SHELL = 'js/modules/studio/studio-shell.js'
  const fabricAt = [...part2.matchAll(new RegExp(FABRIC.replace(/[/.]/g, '\\$&'), 'g'))].map((m) => m.index)
  const shellAt = [...part2.matchAll(new RegExp(SHELL.replace(/[/.]/g, '\\$&'), 'g'))].map((m) => m.index)
  assert.ok(fabricAt.length > 0, 'fabric-adapter.js must be lazy-loaded by the studio boot chain')
  assert.ok(shellAt.length > 0, 'studio-shell.js must be lazy-loaded by the studio boot chain')
  // Every chain that loads the shell must have put the canvas adapter in place first.
  for (const shellIdx of shellAt) {
    assert.ok(fabricAt.some((fabricIdx) => fabricIdx < shellIdx),
      'the canvas adapter must load before the shell that draws on it')
  }

  // The scheduler loads on its own page and boots only once its script resolves.
  assert.match(part2, /pageId === 'social-scheduler'/)
  assert.match(part2, /msLoadScript\('js\/modules\/studio\/studio-scheduler\.js/)
  assert.match(part2, /\.then\(bootSched\)\.catch\(bootSched\)/,
    'the scheduler must boot after its script resolves, and still boot if it was already loaded')
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

test('the standalone scheduler loads accounts and posts directly from /social/*, independent of the Marketing engine fetch', () => {
  assert.match(scheduler, /async function loadStudioSchedulerPosts/)
  assert.match(scheduler, /apiGetJson\('\/social\/posts'\)/)
  assert.match(scheduler, /apiGetJson\('\/social\/accounts'\)/)
  assert.match(scheduler, /apiGetJson\('\/social\/accounts', \{ retries: 0, timeoutMs: 8000 \}\)/)
  assert.match(scheduler, /renderAccounts\(Array\.isArray\(__studioSchedulerAccounts\)/,
    'Social Accounts must paint cached connection cards before its live request completes')
  assert.match(scheduler, /Live account status is temporarily unavailable/,
    'a failed refresh must leave useful controls visible with a retry action')
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

test('the Studio header has a Schedule button wired through the entitlement-aware launcher', () => {
  assert.match(studioShell, /onclick="if\(typeof openStudioSchedulerWithEntitlementCheck === 'function'\) openStudioSchedulerWithEntitlementCheck\(\)"/)
  const btn = studioShell.match(/<button onclick="if\(typeof openStudioSchedulerWithEntitlementCheck[\s\S]*?<\/button>/)?.[0] || ''
  assert.match(btn, />Schedule\s*<\/button>/)
})

test('standalone Design Studio navigation exposes its merged Scheduler without routing to the standalone Social Scheduler dashboard', () => {
  const branch = dashboard.match(/if \(activeProducts\.length === 1 && \/design_studio\/\.test\(product\)\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.match(branch, /label: 'Design Studio'/)
  assert.match(branch, /label: 'Scheduler'/)
  assert.match(branch, /studioSchedulerLaunch: true/)
  assert.doesNotMatch(branch, /page: 'social-scheduler'/)
  assert.match(part2, /p\.studioSchedulerLaunch[\s\S]*?window\.openStudioSchedulerWithEntitlementCheck\(\)/)
})

test('renderStudioDesignAndPublish keeps the user inside the Studio interface instead of closing it and calling the Marketing engine composer', () => {
  // mktCompose() reads/writes ENGINE_DATA['marketing-overview'] and mounts at
  // #marketing-overview-root, which a Design-Studio-only account never renders — it
  // used to close the Studio first (revealing whatever page sits behind it, Settings
  // for a single-product account) while mktCompose() itself silently failed to mount.
  const fn = studioShell.match(/async function renderStudioDesignAndPublish\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'renderStudioDesignAndPublish must exist')
  assert.match(fn, /window\.studioSchedulerCompose\(editableAssetUrl\)/,
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

// The calendar used to be an overlay stacked inside Design Studio's own modal
// (z-[100000] on top of Studio's z-[99999]) — closing it only removed the overlay,
// leaving the user stranded back in Studio instead of on a dashboard page. It is now
// its own standalone destination (data-page-content="social-scheduler"); linked posts
// still reopen their exact design in Studio's editable canvas, which is a distinct,
// legitimate "go edit this graphic" flow, not the scheduler nesting inside Studio.
test('the calendar is a standalone destination; linked posts still reopen their editable canvas in Design Studio', () => {
  assert.doesNotMatch(scheduler, /overlay\.className = 'absolute inset-0/)
  assert.match(dashboardHtml, /data-page-content="social-scheduler"/)
  const editFn = scheduler.match(/function studioSchedulerEditPost\(postId\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(editFn, /searchParams\.get\('studio_design'\)/)
  assert.match(editFn, /window\.openMarketSyncStudio\(designId\)/)
  assert.match(studioShell, /searchParams\.set\('studio_design', designId\)/)
})

test('a rendered design pre-attaches into the compose form instead of requiring the user to find it again', () => {
  const fn = scheduler.match(/async function studioSchedulerCompose\(preselectedAssetUrl\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'studioSchedulerCompose must accept a preselected asset url')
  assert.match(fn, /studioSchedulerUseAsset\(preselectedAssetUrl\)/)
  const useAssetFn = scheduler.match(/function studioSchedulerUseAsset\(url\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(useAssetFn, /__studioComposerMedia = \[\{ url, type: 'image' \}\]/,
    'the preselected design must actually populate the composer media list')
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
