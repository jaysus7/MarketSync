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

test('the camera stream is explicitly requested in the shape the device is currently held, not left to the browser default', () => {
  // A camera sensor has no inherent portrait/landscape — without a width/height
  // hint most browsers default to a landscape-shaped stream (e.g. 1920x1080) even
  // when the phone is held upright. Sizing the container after the fact isn't
  // enough on its own; the stream itself must be requested portrait-shaped.
  const initFn = videoStudio.match(/async function initCameraFeed\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(initFn, 'initCameraFeed must exist')
  assert.match(initFn, /matchMedia\('\(orientation: portrait\)'\)\.matches/)
  assert.match(initFn, /width: \{ ideal: isPortraitDevice \? 720 : 1280 \}/)
  assert.match(initFn, /height: \{ ideal: isPortraitDevice \? 1280 : 720 \}/)
  assert.match(initFn, /addEventListener\('loadedmetadata', vidSyncViewfinderAspect\)/)
  assert.match(initFn, /screen\.orientation/, 'must re-request the stream on device rotation, not just on first load')
  assert.match(initFn, /vidRestartCameraForOrientation/, 'rotation must re-request the stream (track dimensions do not update on their own), not just re-read it')

  const restartFn = videoStudio.match(/function vidRestartCameraForOrientation\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(restartFn, 'vidRestartCameraForOrientation must exist')
  assert.match(restartFn, /if \(window\.__videoStudioState\.recording\) return;/, 'rotating mid-recording must never kill the take')
  assert.match(restartFn, /getTracks\(\)\.forEach\(t => t\.stop\(\)\)/, 'the old stream must be stopped before requesting a new one')

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

test('Video also folds in the Team roster, same as Facebook Dealer', () => {
  const block = part2.match(/const isVideoTeam = [\s\S]*?\n {6}\}/)?.[0] || ''
  assert.ok(block, 'the Team-roster fold-in block must exist')
  assert.match(block, /typeof isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace\(\)/)
  assert.match(block, /\(fbOnly \|\| isVideoTeam\) && isAdmin/)
  assert.match(block, /SETTINGS_TAB_SECTIONS\.account\.push\('settings-team'\)/)
})

test('Email sending, Billing and Language are one grid cell, with Security landing beside them — not pushed onto its own row', () => {
  const col = dashboardHtml.match(/<div id="billing-language-col" class="flex flex-col">[\s\S]*?\n {10}<\/div>\n {10}<\/div>/)?.[0] || ''
  assert.ok(col, 'billing-language-col must exist')
  assert.match(col, /id="email-sending-card"/, 'email-sending-card must be nested inside billing-language-col')
  assert.match(col, /id="billing-section"/)
  assert.match(col, /id="settings-language-card"/)
  // Confirm ordering: email-sending-card, then billing-section, then settings-language-card.
  assert.ok(col.indexOf('id="email-sending-card"') < col.indexOf('id="billing-section"'))
  assert.ok(col.indexOf('id="billing-section"') < col.indexOf('id="settings-language-card"'))
})

test('loadTextingStatus shows a clear MFA notice instead of the raw MFA_REQUIRED error code', () => {
  const part8 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part8.js', import.meta.url), 'utf8')
  const fn = part8.match(/async function loadTextingStatus\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'loadTextingStatus must exist')
  assert.match(fn, /e\.message === 'MFA_REQUIRED'/)
  assert.match(fn, /Complete multi-factor authentication/)
})

test('for a Video admin, Language moves beside Text messaging instead of staying stacked under Email/Billing two rows down — the rep view is untouched', () => {
  const block = part2.match(/if \(typeof isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace\(\)[\s\S]*?Facebook Dealer and Video both fold/)?.[0] || ''
  assert.ok(block, 'the Video fold-in block must exist')
  const moveBlock = block.match(/if \(isAdmin\) \{[\s\S]*?insertBefore\(lang, texting\.nextSibling\);[\s\S]*?\n {8}\}\n {6}\}/)?.[0] || ''
  assert.ok(moveBlock, 'the admin-only Language move must be gated on isAdmin, not applied to the rep view')
  assert.match(moveBlock, /getElementById\('settings-texting-card'\)/)
  assert.match(moveBlock, /getElementById\('settings-language-card'\)/)
})
