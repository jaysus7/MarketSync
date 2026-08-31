import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const BE = new URL('../', import.meta.url)
const readFE = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const readBE = (rel) => readFileSync(new URL(rel, BE), 'utf8')

const dashboardHtml = readFE('dashboard.html')
const dashboardJs = readFE('dashboard.js')
const part2 = readFE('js/modules/dashboard-part2.js')
const part15 = readFE('js/modules/dashboard-part15.js')
const part16 = readFE('js/modules/dashboard-part16.js')
const authJs = readBE('authorization.js')
const feedsRoute = readBE('routes/feeds.js')
const invRoute = readBE('routes/inventory.js')
const notifsRoute = readBE('routes/notifications.js')

test('Independent Facebook AutoPoster URL feed setup - frontend structure', () => {
  // 1. Inventory page has the feeds panel with source connect & sync controls
  assert.match(dashboardHtml, /id="feeds-panel"/, 'feeds-panel container must exist in dashboard.html')
  assert.match(dashboardHtml, /id="sync-now-btn"/, 'sync-now-btn must exist in dashboard.html')
  assert.match(dashboardHtml, /id="feeds-list"/, 'feeds-list must exist in dashboard.html')
  assert.match(dashboardHtml, /id="add-feed-form"/, 'add-feed-form must exist in dashboard.html')
  assert.match(dashboardHtml, /id="add-feed-url"/, 'add-feed-url input must exist in dashboard.html')

  // 2. isFacebookOnlyWorkspace helper recognizes autoposter-salesperson and facebook product tokens
  assert.match(dashboardJs, /autoposter-salesperson/, 'isFacebookOnlyWorkspace must handle autoposter-salesperson')
  assert.match(dashboardJs, /facebook_solo/, 'isFacebookOnlyWorkspace must handle facebook_solo')
})

test('Independent Facebook AutoPoster feed panel visibility & gating in dashboard-part2.js', () => {
  // canManageFeeds and feeds-panel unhiding covers independent Facebook AutoPoster
  assert.match(part2, /const isSolo = role === 'SALES_REP' && \(isPersonal \|\| !inDealership\);/, 'dashboard-part2.js must define isSolo')
  assert.match(part2, /canManageFeeds = isAdmin \|\| isSolo/, 'canManageFeeds must include isSolo')
  assert.match(part2, /document\.getElementById\('feeds-panel'\)\?\.classList\.remove\('hidden'\)/, 'feeds-panel must be unhidden for AutoPoster')
  // Sync Now is exempt from the admin-only hide for every sales role now, not just
  // Facebook-only workspaces — which still covers the AutoPoster rep this test guards.
  assert.match(part2, /if \(el\.id === 'sync-now-btn'\) return;/, 'sync-now-btn must be accessible for AutoPoster')
})

test('First-time setup and Connected Source rendering in dashboard-part15.js', () => {
  // Onboarding card when 0 feeds exist
  assert.match(part15, /Connect Your Inventory/, 'loadInventoryFeeds must render Connect Your Inventory onboarding card when empty')
  assert.match(part15, /Paste the inventory page or feed URL/, 'onboarding card must display guidance text')
  assert.match(part15, /Connect Inventory/, 'onboarding card must provide Connect Inventory button')

  // Connected source card when feed exists
  assert.match(part15, /Connected Source/, 'loadInventoryFeeds must render Connected Source card')
  assert.match(part15, /Sync Status/, 'loadInventoryFeeds must render Sync Status')
  assert.match(part15, /Last Sync/, 'loadInventoryFeeds must render Last Sync')
  assert.match(part15, /Vehicles Found/, 'loadInventoryFeeds must render Vehicles Found')
  assert.match(part15, /View Sync Issues/, 'loadInventoryFeeds must provide View Sync Issues action')
})

test('Feed actions and sync diagnostics in dashboard-part16.js', () => {
  assert.match(part16, /function viewSyncIssues/, 'viewSyncIssues helper must exist')
  assert.match(part16, /window\.viewSyncIssues = viewSyncIssues/, 'viewSyncIssues must be exposed globally')
  assert.match(part16, /window\.__lastSyncResult/, 'sync result metadata must be recorded for diagnostics')
})

test('Backend authorization for Independent Facebook AutoPoster rep', () => {
  assert.match(authJs, /autoposter-salesperson/, 'authorization.js must authorize autoposter-salesperson')
  assert.match(authJs, /permission === 'inventory\.edit' \|\| permission === 'inventory\.view'/, 'inventory edit and view must be authorized for Facebook AutoPoster')
})

test('Backend feed routes support independent AutoPoster and demo mode', () => {
  // GET /inventory-feeds
  assert.match(feedsRoute, /apexmotors\.ca\/inventory/, 'GET /inventory-feeds must support realistic demo feed fixture')
  // POST /inventory-feeds
  assert.match(feedsRoute, /autoposter-salesperson/, 'POST /inventory-feeds must support autoposter-salesperson')
  assert.match(feedsRoute, /demo-feed-new/, 'POST /inventory-feeds must handle demo mode safely')
  // POST /inventory/sync
  assert.match(invRoute, /unique_vehicles:\s*84/, 'POST /inventory/sync must return 84 active vehicles for demo mode')
})

test('Facebook AutoPoster notifications stream classification and demo fixtures', () => {
  assert.match(notifsRoute, /missing_source_alert/, 'classifyNotificationProduct must classify missing_source_alert as facebook')
  assert.match(notifsRoute, /source_sync_failure/, 'classifyNotificationProduct must classify source_sync_failure as facebook')
  assert.match(notifsRoute, /sold_vehicle/, 'DEMO_PRODUCT_NOTIFICATIONS must include sold_vehicle alert')
  assert.match(notifsRoute, /pending_sale/, 'DEMO_PRODUCT_NOTIFICATIONS must include pending_sale alert')
  assert.match(notifsRoute, /3-day hold countdown/, 'DEMO_PRODUCT_NOTIFICATIONS must include 3-day hold countdown alert')
})
