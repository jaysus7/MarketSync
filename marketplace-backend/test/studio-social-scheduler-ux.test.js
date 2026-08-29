import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const socialJs = readFileSync(new URL('../routes/social.js', import.meta.url), 'utf8')
const studioSchedulerJs = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-scheduler.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')

test('DELETE /social/accounts/:id endpoint is registered in backend routes', () => {
  assert.match(socialJs, /app\.delete\('\/social\/accounts\/:id'/)
})

// studioSchedulerCompose used to route through switchPage('marketing') — a page id
// with no #social-scheduler-root container of its own — while leaving Design Studio's
// full-screen modal mounted on top of it. It now closes Studio first and routes to the
// standalone Social Scheduler page (data-page-content="social-scheduler" in
// dashboard.html), where loadSocialSchedulerPage('create') actually mounts.
test('studioSchedulerCompose closes Design Studio and routes to the standalone Social Scheduler page', () => {
  assert.match(studioSchedulerJs, /switchPage\('social-scheduler'\)/)
  assert.match(dashboardHtml, /data-page-content="social-scheduler"/)
})

test('Social Account Settings uses separate platform cards for every supported network, including Pinterest', () => {
  assert.match(studioSchedulerJs, /const STUDIO_SOCIAL_PLATFORMS/)
  assert.match(studioSchedulerJs, /facebook:/)
  assert.match(studioSchedulerJs, /instagram:/)
  assert.match(studioSchedulerJs, /pinterest:/)
  assert.match(studioSchedulerJs, /linkedin:/)
  assert.match(studioSchedulerJs, /tiktok:/)
  assert.match(studioSchedulerJs, /youtube:/)
  assert.match(studioSchedulerJs, /x:/)
  // No platform select dropdown used for multi-provider pick
  assert.doesNotMatch(studioSchedulerJs, /<select id="ssc-provider"/)
})

test('Connected platforms display Connected status and Disconnect actions', () => {
  assert.match(studioSchedulerJs, /studioSocialDisconnectAccount/)
  assert.match(studioSchedulerJs, /Connected/)
})

test('Scheduler accounts view does not collide with the legacy hidden Studio account list', () => {
  assert.match(studioSchedulerJs, /id="studio-social-list-page"/)
  assert.match(studioSchedulerJs, /document\.getElementById\('studio-social-list-page'\) \|\| document\.getElementById\('studio-social-list'\)/)
})

test('Disconnected platforms in Design Studio composer show + Connect action', () => {
  assert.match(studioSchedulerJs, /\+ Connect/)
  assert.match(studioSchedulerJs, /Connect a social account to publish or schedule this post/)
})
