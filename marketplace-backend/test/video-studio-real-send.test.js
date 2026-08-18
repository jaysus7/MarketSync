import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const videoStudio = readFileSync(new URL('../../marketplace-frontend/js/modules/video-studio.js', import.meta.url), 'utf8')
const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const salesWorkspace = readFileSync(new URL('../../marketplace-frontend/js/modules/sales-workspace.js', import.meta.url), 'utf8')
const watchHtml = readFileSync(new URL('../../marketplace-frontend/watch.html', import.meta.url), 'utf8')

test('apiSendFormData actually exists — the old send flow called it and it was never defined anywhere, so every video upload silently threw and was swallowed', () => {
  assert.doesNotMatch(videoStudio, /\bsendCustomerVideo\b/, 'the old fake-success sender must be gone, not left as dead code')
  const fn = dashboardJs.match(/async function apiSendFormData\(path, method = 'POST', formData, \{ timeoutMs = \d+ \} = \{\}\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'apiSendFormData must exist in dashboard.js, where the other api* helpers live')
  // Must NOT set Content-Type — the browser has to generate the multipart
  // boundary itself, which only happens if this header is left unset.
  assert.doesNotMatch(fn, /'Content-Type'/)
  assert.match(fn, /body: formData/)
  assert.match(fn, /if \(!r\.ok\) throw new Error\(data\?\.error \|\| `HTTP \$\{r\.status\}`\);/, 'must throw on failure like apiSendJson, not swallow it')
})

test('sending a video now actually calls the real backend endpoints, not a fake always-succeeds toast', () => {
  const sendFn = videoStudio.match(/async function vidSendExistingVideo\(videoId, channel\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(sendFn, 'vidSendExistingVideo must exist')
  assert.match(sendFn, /apiSendJson\(`\/sales-videos\/\$\{videoId\}\/send`, 'POST', \{ channel \}\)/)
  // A real failure (including MFA_REQUIRED) must surface to the rep, not be
  // silently treated as a success.
  assert.match(sendFn, /catch \(e\) \{/)
  assert.match(sendFn, /throw e;/)

  const uploadFn = videoStudio.match(/async function vidEnsureUploadedFor\(contactId\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(uploadFn, 'vidEnsureUploadedFor must exist')
  assert.match(uploadFn, /apiSendFormData\('\/sales-videos', 'POST', formData\)/)
  assert.match(uploadFn, /if \(!res\?\.video\?\.id\) throw new Error/, 'a failed upload must not be treated as success')
})

test('an independent Video account with no CRM contact can still send — typing a name/phone/email creates one instead of silently sending to nobody', () => {
  const ensureFn = videoStudio.match(/async function vidEnsureContact\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(ensureFn, 'vidEnsureContact must exist')
  assert.match(ensureFn, /apiSendJson\('\/crm\/contacts', 'POST', \{/)
  // Reuses the studio's own real CRM contact when the fields are untouched,
  // rather than creating a duplicate every time.
  assert.match(ensureFn, /isRealContact/)
  assert.match(ensureFn, /return contact\.id;/)
  // Repeat clicks with the same typed values must not create a second contact.
  assert.match(ensureFn, /window\.__videoStudioState\.adhocContact/)

  const sendToFn = videoStudio.match(/async function vidSendVideoTo\(channel\) \{[\s\S]*?\n\}\nwindow\.vidSendVideoTo/)?.[0] || ''
  assert.ok(sendToFn, 'vidSendVideoTo must exist')
  // Required field per channel — no silent "sent" with nothing to actually
  // reach the customer through.
  assert.match(sendToFn, /if \(channel === 'sms' && !fields\.phone\)/)
  assert.match(sendToFn, /if \(channel === 'email' && !fields\.email\)/)
  assert.match(sendToFn, /if \(!contactId\) throw new Error/)
})

test('the share link "just is there" — it prepares itself automatically as soon as the Review screen opens, not only after a tap', () => {
  const enterFn = videoStudio.match(/function vidEnterReview\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(enterFn, 'vidEnterReview must exist')
  assert.match(enterFn, /vidAutoPrepareShareLink\(\);/)

  const autoFn = videoStudio.match(/async function vidAutoPrepareShareLink\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(autoFn, 'vidAutoPrepareShareLink must exist')
  assert.match(autoFn, /vidEnsureContact\(\)/)
  assert.match(autoFn, /vidEnsureUploadedFor\(contactId\)/)
  assert.match(autoFn, /vidUpdateShareLinkBox\(video\.share_token\)/)

  // A manual tap of Copy Link must share the SAME upload/contact requests the
  // auto-prepare kicked off, not start a second one — that's both what avoids
  // duplicate contacts/uploads and what makes the tap's clipboard write land
  // within the click's user-activation window instead of racing a fresh upload.
  const uploadFn = videoStudio.match(/async function vidEnsureUploadedFor\(contactId\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(uploadFn, 'vidEnsureUploadedFor must exist')
  assert.match(uploadFn, /window\.__videoStudioState\.uploadPromise/)

  const contactFn = videoStudio.match(/async function vidEnsureContact\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(contactFn, 'vidEnsureContact must exist')
  assert.match(contactFn, /window\.__videoStudioState\.adhocContactPromise/)
})

test('a shareable link can be copied independent of naming a customer — "copy the link, or send to a customer"', () => {
  const buildFn = videoStudio.match(/function vidBuildShareUrl\(shareToken\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(buildFn, 'vidBuildShareUrl must exist')
  assert.match(buildFn, /watch\.html\?t=\$\{encodeURIComponent\(shareToken\)\}/)

  const copyFn = videoStudio.match(/async function vidCopyShareLink\(\) \{[\s\S]*?\n\}\nwindow\.vidCopyShareLink/)?.[0] || ''
  assert.ok(copyFn, 'vidCopyShareLink must exist')
  assert.match(copyFn, /navigator\.clipboard\?\.writeText/)
  assert.match(copyFn, /vidEnsureUploadedFor\(contactId\)/)

  assert.match(videoStudio, /id="vid-copy-link-btn"/)
  assert.match(videoStudio, /id="vid-share-link-box"/)
})

test('the Resend button on the video library sends for real, through the right channel, not a hardcoded SMS', () => {
  assert.match(salesWorkspace, /onclick="vidSendExistingVideo\('\$\{v\.id\}', '\$\{v\.channel === 'email' \? 'email' : 'sms'\}'\)"/)
  assert.doesNotMatch(salesWorkspace, /sendCustomerVideo/)
})

test('the watch page reads the token from ?t= first — the only link shape a plain static file server can actually route', () => {
  // location.pathname for a bare /watch.html?t=X request is just "/watch.html",
  // so path-splitting alone would treat the literal string "watch.html" as the
  // token unless the query string is checked first.
  const idx = watchHtml.indexOf('const token =')
  assert.ok(idx > -1, 'token parsing must exist')
  const tokenLine = watchHtml.slice(idx, idx + 300)
  const searchIdx = tokenLine.indexOf('URLSearchParams(location.search)')
  const pathIdx = tokenLine.indexOf('location.pathname')
  assert.ok(searchIdx > -1 && pathIdx > -1, 'both the query-string and path forms must be present')
  assert.ok(searchIdx < pathIdx, 'the query string (?t=) must be checked before the path fallback')
})
