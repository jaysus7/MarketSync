import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const socialJs = readFileSync(new URL('../routes/social.js', import.meta.url), 'utf8')
const studioSchedulerJs = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-scheduler.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')

test('DELETE /social/accounts/:id endpoint is registered in backend routes', () => {
  assert.match(socialJs, /app\.delete\('\/social\/accounts\/:id'/)
})

test('studioSchedulerCompose routes directly into Design Studio workspace', () => {
  assert.match(studioSchedulerJs, /switchPage\('marketing'\)/)
})

test('Social Account Settings uses separate platform cards for Facebook, Instagram, LinkedIn, TikTok, YouTube', () => {
  assert.match(studioSchedulerJs, /const STUDIO_SOCIAL_PLATFORMS/)
  assert.match(studioSchedulerJs, /facebook:/)
  assert.match(studioSchedulerJs, /instagram:/)
  assert.match(studioSchedulerJs, /linkedin:/)
  assert.match(studioSchedulerJs, /tiktok:/)
  assert.match(studioSchedulerJs, /youtube:/)
  // No platform select dropdown used for multi-provider pick
  assert.doesNotMatch(studioSchedulerJs, /<select id="ssc-provider"/)
})

test('Connected platforms display Connected status and Disconnect actions', () => {
  assert.match(studioSchedulerJs, /studioSocialDisconnectAccount/)
  assert.match(studioSchedulerJs, /Connected/)
})

test('Disconnected platforms in Design Studio composer show + Connect action', () => {
  assert.match(studioSchedulerJs, /\+ Connect/)
  assert.match(studioSchedulerJs, /Connect a social account to publish or schedule this post/)
})
