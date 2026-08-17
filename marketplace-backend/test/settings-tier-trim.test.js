import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const part8 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part8.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')

test('isFacebookOnlyWorkspace exists and excludes dealer_os accounts, like isDesignStudioOnlyWorkspace', () => {
  assert.match(dashboard, /function isFacebookOnlyWorkspace\(\)/)
  const fn = dashboard.match(/function isFacebookOnlyWorkspace\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /facebook_solo/)
  assert.match(fn, /facebook_dealer/)
  assert.match(fn, /!\/\(\?:\^\|\\s\)dealer_os\(\?:\\s\|\$\)\/\.test\(products\)/)
  assert.match(dashboard, /window\.isFacebookOnlyWorkspace = isFacebookOnlyWorkspace/)
})

test('every real, non-account Settings tab button is [data-admin-only]', () => {
  // The design-studio/facebook trims below hide Settings tabs by selecting
  // `#settings-tabs [data-admin-only]` — this only works because every tab button
  // except "My Account" actually carries that attribute. If a future tab is added
  // without it, this test catches the leak before a restricted tier does.
  const tabBar = dashboardHtml.match(/<div id="settings-tabs"[\s\S]*?<\/div>/)?.[0] || ''
  const buttons = [...tabBar.matchAll(/<button data-stab="([a-z]+)"([^>]*)>/g)]
  assert.ok(buttons.length >= 8, 'expected at least 8 Settings tab buttons')
  for (const [, stab, attrs] of buttons) {
    if (stab === 'account') continue
    assert.match(attrs, /data-admin-only/, `#settings-tabs [data-stab="${stab}"] must carry data-admin-only`)
  }
})

test('Design Studio standalone trims Settings to My Account + Billing (Upgrade lives at the header, not in Settings)', () => {
  const block = part2.match(/if \(typeof isDesignStudioOnlyWorkspace === 'function'[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(block, 'isDesignStudioOnlyWorkspace settings-trim block must exist')
  assert.match(block, /document\.querySelectorAll\('#settings-tabs \[data-admin-only\]'\)\.forEach\(el => el\.classList\.add\('hidden'\)\)/)
  assert.match(block, /SETTINGS_TAB_SECTIONS\.account\.push\('billing-section'\)/)
  assert.match(block, /__settingsTab = 'account'/)
})

test('Facebook-only tiers trim Settings to My Account + Billing + Facebook Posting Safety', () => {
  const block = part2.match(/if \(typeof isFacebookOnlyWorkspace === 'function'[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(block, 'isFacebookOnlyWorkspace settings-trim block must exist')
  assert.match(block, /document\.querySelectorAll\('#settings-tabs \[data-admin-only\]'\)\.forEach\(el => el\.classList\.add\('hidden'\)\)/)
  assert.match(block, /'billing-section', 'guardrail-settings-section'/)
  assert.match(block, /document\.getElementById\('guardrail-settings-section'\)\?\.classList\.remove\('hidden'\)/)
  assert.match(block, /__settingsTab = 'account'/)
})

test('billing-section is not itself [data-admin-only] (so folding it into My Account is meaningful)', () => {
  const billing = dashboardHtml.match(/<div id="billing-section"[^>]*>/)?.[0] || ''
  assert.ok(billing, 'billing-section must exist')
  assert.doesNotMatch(billing, /data-admin-only/)
})

test('SETTINGS_TAB_SECTIONS.admin owns billing-section, confirming the fold-in is necessary', () => {
  assert.match(part8, /admin: \[[^\]]*'billing-section'/)
})
