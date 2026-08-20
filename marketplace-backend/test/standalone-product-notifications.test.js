import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classifyNotificationProduct } from '../routes/notifications.js'

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const readFE = (rel) => readFileSync(new URL(rel, FE), 'utf8')

test('classifyNotificationProduct correctly classifies product-specific alerts', () => {
  // Facebook AutoPoster
  assert.equal(classifyNotificationProduct({ type: 'sold_vehicle', title: 'Sold: Silverado' }), 'facebook')
  assert.equal(classifyNotificationProduct({ type: 'pending_sale', title: 'Deposit placed' }), 'facebook')
  assert.equal(classifyNotificationProduct({ type: 'extension_disconnected', title: 'Extension disconnected' }), 'facebook')
  assert.equal(classifyNotificationProduct({ type: 'fb_sold', title: 'Listing sold' }), 'facebook')

  // Video Studio
  assert.equal(classifyNotificationProduct({ type: 'video_viewed', title: 'Customer watched walkaround' }), 'video')
  assert.equal(classifyNotificationProduct({ type: 'video_failed', title: 'Video send failed' }), 'video')

  // Email & SMS
  assert.equal(classifyNotificationProduct({ type: 'customer_replied', title: 'Inbound SMS reply' }), 'email_sms')
  assert.equal(classifyNotificationProduct({ type: 'automation_failed', title: 'Day 1 Followup Bounced' }), 'email_sms')

  // Website
  assert.equal(classifyNotificationProduct({ type: 'form_lead', title: 'Website form submission' }), 'website')
  assert.equal(classifyNotificationProduct({ type: 'publishing_failed', title: 'Scheduled page publish' }), 'website')

  // AI ChatBot
  assert.equal(classifyNotificationProduct({ type: 'human_requested', title: 'Human rep requested in live chat' }), 'ai_chatbot')
  assert.equal(classifyNotificationProduct({ type: 'chat_lead', title: 'ChatBot captured lead' }), 'ai_chatbot')

  // Design Studio
  assert.equal(classifyNotificationProduct({ type: 'scheduled_post_failed', title: 'Social token expired' }), 'design_studio')
  assert.equal(classifyNotificationProduct({ type: 'post_published', title: 'Graphic published to social' }), 'design_studio')

  // SEO
  assert.equal(classifyNotificationProduct({ type: 'indexing_issue', title: 'Search Console indexing alert' }), 'seo')
  assert.equal(classifyNotificationProduct({ type: 'competitor_opp', title: 'Competitor keyword opportunity' }), 'seo')
})

test('standalone dashboard header keeps notification bell visible and hides DealerOS settings gear', () => {
  const dashJs = readFE('dashboard.js')
  // Standalone single-product branch must keep notif-bell visible
  assert.match(dashJs, /if\s*\(active\.length === 1\)\s*\{[\s\S]*?document\.getElementById\('notif-bell'\)\?\.classList\.remove\('hidden'\)/)
  // And hide DealerOS settings gear
  assert.match(dashJs, /if\s*\(active\.length === 1\)\s*\{[\s\S]*?document\.getElementById\('header-settings'\)\?\.classList\.add\('hidden'\)/)
})

test('notification panel in dashboard-part22.js supports product scoping and action tabs', () => {
  const part22 = readFE('js/modules/dashboard-part22.js')
  assert.match(part22, /getActiveProductKey\(\)/)
  assert.match(part22, /switchNotifTab\('needs_action'\)/)
  assert.match(part22, /switchNotifTab\('unread'\)/)
  assert.match(part22, /acknowledgeNotif/)
  assert.match(part22, /handleNotifAction/)
})
