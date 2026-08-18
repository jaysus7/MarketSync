import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const videoStudio = readFileSync(new URL('../../marketplace-frontend/js/modules/video-studio.js', import.meta.url), 'utf8')

test('the camera starts as zoomed out as the hardware allows, not whatever default lens/zoom the browser picks', () => {
  const initFn = videoStudio.match(/async function initCameraFeed\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(initFn, 'initCameraFeed must exist')
  assert.match(initFn, /const videoTrack = stream\.getVideoTracks\(\)\[0\];/)
  assert.match(initFn, /const zoomCap = videoTrack\?\.getCapabilities\?\.\(\)\.zoom;/)
  // Must drive it to the capability's actual minimum, not a hardcoded guess like 1 —
  // some devices report a min above or below 1.
  assert.match(initFn, /applyConstraints\(\{ advanced: \[\{ zoom: zoomCap\.min \}\] \}\)/)
  assert.match(initFn, /\.catch\(\(\) => \{\}\)/, 'must not throw on browsers that do not expose a zoom capability')
})

test('the front camera preview mirrors, like every other camera app; the back camera never does; the recording itself is unaffected either way', () => {
  const transformFn = videoStudio.match(/function vidApplyPreviewTransform\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(transformFn, 'vidApplyPreviewTransform must exist')
  assert.match(transformFn, /const mirror = window\.__videoStudioState\.cameraFacing === 'user';/)
  assert.match(transformFn, /scaleX\(-1\)/)

  const initFn = videoStudio.match(/async function initCameraFeed\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(initFn, /vidApplyPreviewTransform\(\);/, 'must apply the mirror as soon as the stream is attached')

  const toggleFn = videoStudio.match(/function vidToggleCamera\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(toggleFn, 'vidToggleCamera must exist')
  assert.match(toggleFn, /initCameraFeed\(\);/, 'flipping camera must re-open the stream, which re-applies the mirror for the new facing mode')

  const zoomFn = videoStudio.match(/function vidChangeZoom\(val\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(zoomFn, 'vidChangeZoom must exist')
  assert.match(zoomFn, /vidApplyPreviewTransform\(\);/, 'zoom must not clobber the mirror transform by setting style.transform directly')
})

test('opening the studio configures the script/teleprompter BEFORE the camera starts, not while it is already live', () => {
  const openFn = videoStudio.match(/async function openCustomerVideoStudio\(contactId, options = \{\}\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(openFn, 'openCustomerVideoStudio must exist')
  assert.match(openFn, /renderStudioSetupHtml\(contact, options\)/, 'must render the setup screen first')
  assert.doesNotMatch(openFn, /initCameraFeed\(\)/, 'must NOT open the camera immediately — that only happens once the rep taps through from setup')

  const setupFn = videoStudio.match(/function renderStudioSetupHtml\(contact, options\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(setupFn, 'renderStudioSetupHtml must exist')
  assert.match(setupFn, /id="vid-setup-tp-toggle"/, 'the teleprompter on/off choice must be made on the setup screen')
  assert.match(setupFn, /vidEnterCameraView\(\)/, 'the setup screen must be what actually opens the camera')

  const enterFn = videoStudio.match(/function vidEnterCameraView\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(enterFn, 'vidEnterCameraView must exist')
  assert.match(enterFn, /renderStudioCameraHtml/)
  assert.match(enterFn, /initCameraFeed\(\)/, 'the camera must actually start once entering the camera phase')
})

test('the teleprompter default is a persisted preference — hiding it stays off indefinitely, not just for one video', () => {
  assert.match(videoStudio, /const VID_TP_PREF_KEY = 'ms_video_tp_hidden';/)
  const readFn = videoStudio.match(/function vidTeleprompterHiddenByDefault\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(readFn, 'vidTeleprompterHiddenByDefault must exist')
  assert.match(readFn, /localStorage\.getItem\(VID_TP_PREF_KEY\)/)

  const writeFn = videoStudio.match(/function vidSetTeleprompterPref\(hidden\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(writeFn, 'vidSetTeleprompterPref must exist')
  assert.match(writeFn, /localStorage\.setItem\(VID_TP_PREF_KEY/)

  // Toggling in-camera must persist too, not just the setup-screen checkbox —
  // "indefinitely until turned on again" applies wherever the rep flips it.
  const toggleFn = videoStudio.match(/function vidToggleTeleprompter\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(toggleFn, 'vidToggleTeleprompter must exist')
  assert.match(toggleFn, /vidSetTeleprompterPref\(false\)/)
  assert.match(toggleFn, /vidSetTeleprompterPref\(true\)/)

  // The camera screen must actually apply the persisted default when it renders,
  // not just default to always-visible.
  const cameraFn = videoStudio.match(/function renderStudioCameraHtml\(contact, options\) \{[\s\S]*?\n\/\/ Recording stopped/)?.[0] || ''
  assert.ok(cameraFn, 'renderStudioCameraHtml must exist')
  assert.match(cameraFn, /vidTeleprompterHiddenByDefault\(\)/)
})

test('the camera phase fills the whole screen on a phone — no side panel to fight the viewfinder for space', () => {
  const cameraFn = videoStudio.match(/function renderStudioCameraHtml\(contact, options\) \{[\s\S]*?\n\/\/ Recording stopped/)?.[0] || ''
  assert.ok(cameraFn, 'renderStudioCameraHtml must exist')
  // Full viewport height on mobile (100dvh), only becoming a constrained card at
  // the sm: breakpoint — this is the "opens like a native camera app" behavior.
  assert.match(cameraFn, /h-\[100dvh\]/)
  assert.match(cameraFn, /sm:max-w-md/)
  // No lg:flex-row two-column split left — the send/script panel moved out to the
  // review phase, so the viewfinder is the only real content on this screen.
  assert.doesNotMatch(cameraFn, /lg:flex-row/)
  assert.doesNotMatch(cameraFn, /Send Video via SMS Text/, 'sending must not happen while the camera is still live')
})

test('recording stops into a Review screen (with a video preview and the send panel) instead of transitioning nowhere', () => {
  const reviewFn = videoStudio.match(/function renderStudioReviewHtml\(contact, options\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(reviewFn, 'renderStudioReviewHtml must exist')
  assert.match(reviewFn, /Send Video via SMS Text/)
  assert.match(reviewFn, /Send Video via Email/)
  assert.match(reviewFn, /vidRetakeFromReview\(\)/)

  const enterReviewFn = videoStudio.match(/function vidEnterReview\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(enterReviewFn, 'vidEnterReview must exist')
  assert.match(enterReviewFn, /renderStudioReviewHtml/)

  // Stop Recording must wait for the recorder's real onstop event (the actual
  // blob), not a fixed setTimeout guess, before showing the review screen.
  const recordFn = videoStudio.match(/function vidToggleRecord\(\) \{[\s\S]*?\n\}\n\nfunction vidPauseRecord/)?.[0] || ''
  assert.ok(recordFn, 'vidToggleRecord must exist')
  assert.match(recordFn, /recorder\.onstop = \(\) => \{/)
  assert.match(recordFn, /vidEnterReview\(\);/)
  assert.doesNotMatch(recordFn, /setTimeout\(\(\) => \{[\s\S]*?recordedChunks/, 'blob assembly must not rely on a fixed-delay guess any more')
})

test('every recorded video is composited with a small bottom overlay — rep name, dealership phone, and a logo badge — burned into the actual recording, not just shown live', () => {
  assert.match(videoStudio, /id="vid-composite-canvas"/, 'a compositing canvas must exist alongside the live preview')

  const overlayFn = videoStudio.match(/function vidOverlayInfo\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(overlayFn, 'vidOverlayInfo must exist')
  assert.match(overlayFn, /profileContext\?\.dealership\?\.phone/)

  const loopFn = videoStudio.match(/function vidStartCompositeLoop\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(loopFn, 'vidStartCompositeLoop must exist')
  assert.match(loopFn, /ctx\.drawImage\(videoEl, 0, 0, canvas\.width, canvas\.height\)/, 'must draw the real camera frame, not a placeholder')
  assert.match(loopFn, /requestAnimationFrame\(draw\)/)
  assert.match(loopFn, /if \(!window\.__videoStudioState\.recording\) return;/, 'the draw loop must stop itself once recording stops')

  const stopFn = videoStudio.match(/function vidStopCompositeLoop\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(stopFn, 'vidStopCompositeLoop must exist')
  assert.match(stopFn, /cancelAnimationFrame/)

  // The actual recording must come from the composited canvas (with the mic audio
  // track re-attached), not the raw camera stream — otherwise the overlay would
  // only ever be visible live and never end up in the saved file.
  const recordFn = videoStudio.match(/function vidToggleRecord\(\) \{[\s\S]*?\n\}\n\nfunction vidPauseRecord/)?.[0] || ''
  assert.match(recordFn, /canvas\.captureStream\(30\)/)
  // Built as a fresh MediaStream from explicit track arrays, not by mutating the
  // canvas-returned stream via addTrack() — that dropped audio on some mobile
  // Chrome builds (confirmed on a real device).
  assert.match(recordFn, /new MediaStream\(\[\.\.\.canvasStream\.getVideoTracks\(\), \.\.\.stream\.getAudioTracks\(\)\]\)/)
  assert.match(recordFn, /vidStartCompositeLoop\(\)/)
  assert.match(recordFn, /new MediaRecorder\(recordStream, options\)/)
})
