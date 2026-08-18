import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const videoStudio = readFileSync(new URL('../../marketplace-frontend/js/modules/video-studio.js', import.meta.url), 'utf8')
const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const part17 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part17.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')

test('Video has a real nav icon — "video" was referenced but never defined in SVG_ICONS, silently falling back to a plain dot', () => {
  const iconsBlock = dashboardJs.match(/const SVG_ICONS = \{[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(iconsBlock, 'SVG_ICONS must exist')
  assert.match(iconsBlock, /\bvideo:\s*'/, 'SVG_ICONS must define a "video" glyph')
  assert.match(dashboardJs, /'video-studio': \{ page: 'video-studio', label: 'Video', icon: 'video' \}/,
    'the single-product Video nav entry must still reference icon: "video"')
})

test('the camera viewfinder sizes itself to the real stream dimensions instead of a fixed 16:9 box', () => {
  // aspect-video (16:9) is only the pre-stream placeholder now — a portrait phone
  // camera reports a portrait track, and forcing that into a fixed landscape box
  // just center-crops it via object-cover.
  const initFn = videoStudio.match(/async function initCameraFeed\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(initFn, 'initCameraFeed must exist')
  assert.match(initFn, /addEventListener\('loadedmetadata', vidSyncViewfinderAspect\)/)
  assert.match(initFn, /screen\.orientation/, 'must re-sync on device rotation, not just on first load')

  const syncFn = videoStudio.match(/function vidSyncViewfinderAspect\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(syncFn, 'vidSyncViewfinderAspect must exist')
  assert.match(syncFn, /box\.style\.aspectRatio = `\$\{videoEl\.videoWidth\} \/ \$\{videoEl\.videoHeight\}`;/)
})

test('the teleprompter is draggable, including on touch devices', () => {
  assert.match(videoStudio, /id="vid-teleprompter-handle"/, 'the teleprompter needs a drag handle')
  const initFn = videoStudio.match(/async function initCameraFeed\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(initFn, /makeWsPanelDraggable\(document\.getElementById\('vid-teleprompter-handle'\), document\.getElementById\('vid-teleprompter-box'\)\)/)

  const dragFn = part17.match(/function makeWsPanelDraggable\(handleEl, targetEl\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(dragFn, 'makeWsPanelDraggable must exist')
  assert.match(dragFn, /addEventListener\('touchstart', onStart/, 'dragging must work on a touchscreen, not just with a mouse')
  assert.match(dragFn, /addEventListener\('touchmove', onMove/)
})

test('the video type is locked to the logged-in role — no manual Sales/Service switch exists any more', () => {
  assert.doesNotMatch(videoStudio, /function vidSwitchDepartment/, 'the manual department-switcher function must be removed')
  assert.doesNotMatch(videoStudio, /onclick="vidSwitchDepartment/, 'no button may call the removed switcher')

  const deptFn = videoStudio.match(/function vidDeptForRole\(explicitDept\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(deptFn, 'vidDeptForRole must exist')
  assert.match(deptFn, /role === 'SERVICE'\) return 'Service';/, 'a SERVICE role must always get a Service video')
  assert.match(deptFn, /role === 'SALES_REP'\) return 'Sales';/, 'a SALES_REP role must always get a Sales video')
})

test('Video folds DMS sync, its own texting, and its own email-sending setup into My Account', () => {
  assert.match(dashboardJs, /function isVideoOnlyWorkspace\(\) \{[\s\S]*?marketsync_video/)
  const block = part2.match(/if \(typeof isVideoOnlyWorkspace === 'function'[\s\S]*?\n {6}\}/)?.[0] || ''
  assert.ok(block, 'the Video fold-in block must exist')
  for (const id of ['crm-dms-card', 'settings-texting-card', 'email-sending-card']) {
    assert.match(block, new RegExp(`'${id}'`), `Video must fold in ${id}`)
  }
  assert.match(block, /loadTextingStatus\(\)/)
})
