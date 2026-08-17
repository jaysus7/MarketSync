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
  // settings-my-record (the employment-record card) must be hidden by directly
  // adding 'stab-hide', NOT by removing its id from SETTINGS_TAB_SECTIONS.account —
  // applyProductNav() above already triggers one settingsTab('account') call before
  // this block runs, using the unmodified section list, which un-hides the card. If
  // the id is then dropped from the list entirely instead of force-hidden, nothing
  // ever re-hides it — it stays stuck visible, permanently showing "Loading your
  // record…" (and, since it carries data-full-width="true", knocking the rest of
  // the grid's cards out of their side-by-side row onto their own stacked rows).
  assert.match(block, /document\.getElementById\('settings-my-record'\)\?\.classList\.add\('stab-hide'\)/)
  assert.doesNotMatch(block, /filter\(id => id !== 'settings-my-record'\)/, 'must not rely on removing the id from the tracked section list')
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

test('isSingleProductWorkspace exists and is true for exactly one active product', () => {
  assert.match(dashboard, /function isSingleProductWorkspace\(\)/)
  assert.match(dashboard, /window\.isSingleProductWorkspace = isSingleProductWorkspace/)
})

test('renderSetupBar checks isSingleProductWorkspace at the point it sets host.innerHTML, not just clears it elsewhere', () => {
  // renderSetupBar() is async and its caller never awaits it: it calls
  // await refreshSetupIndicator() (a real network fetch for admin roles) before
  // touching #setup-bar-host, and applyProductNav() — which sets data-product,
  // the attribute isSingleProductWorkspace() reads — runs synchronously later in
  // the same caller. A synchronous clear of #setup-bar-host elsewhere loses that
  // race: renderSetupBar()'s continuation can still repopulate it afterward. The
  // check has to live in renderSetupBar() itself, after its await, to be reliable.
  const fn = dashboard.match(/async function renderSetupBar\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'renderSetupBar must exist')
  assert.match(fn, /await refreshSetupIndicator\(\)/, 'renderSetupBar must await refreshSetupIndicator before touching the host')
  const afterAwait = fn.slice(fn.indexOf('await refreshSetupIndicator()'))
  assert.match(afterAwait, /isSingleProductWorkspace/, 'the single-product check must run after the await, where data-product is guaranteed to already be set')
  assert.match(afterAwait, /if \(!singleProduct && \[.DEALER_ADMIN., .OWNER., .MANAGER.\]\.includes\(profileContext\?\.role\)\)/)
})

test('every single-product tier (not just Design Studio) gets the simplified header: Profile + Sign out only', () => {
  const fn = dashboard.match(/function applyProductNav\(products\) \{[\s\S]*?\nwindow\.applyProductNav = applyProductNav;/)?.[0] || ''
  assert.ok(fn, 'applyProductNav must exist')
  const block = fn.match(/if \(active\.length === 1\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(block, 'the single-product header-simplification block must exist, gated on active.length === 1 (not a specific product)')
  for (const id of ['header-settings', 'notif-bell', 'header-social-icons']) {
    assert.match(block, new RegExp(`document\\.getElementById\\('${id}'\\)\\?\\.classList\\.add\\('hidden'\\)`), `${id} must be hidden for single-product tiers`)
  }
  assert.match(block, /document\.getElementById\('setup-bar-host'\)\?\.replaceChildren\(\)/, 'Open Setup must be cleared for single-product tiers')
  // Must come before the design_studio-specific block, and not be scoped to it —
  // this has to apply to every single-product tier (Facebook, AI ChatBot, Video,
  // Website, ...), not just Design Studio.
  assert.ok(fn.indexOf("active.length === 1) {") < fn.indexOf("active[0] === 'design_studio'"), 'the general single-product block must not be nested inside the design_studio-specific one')
})

test('Design Studio sidebar is the one launcher button, not a second Settings row — Settings lives under the header Profile icon for every single-product tier', () => {
  const fn = dashboard.match(/function restrictedNavPages\(\) \{[\s\S]*?\nwindow\.restrictedNavPages = restrictedNavPages;/)?.[0] || ''
  const branch = fn.match(/if \(activeProducts\.length === 1 && \/design_studio\/\.test\(product\)\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(branch, 'the design_studio branch of restrictedNavPages must exist')
  const itemCount = (branch.match(/\{ page:/g) || []).length
  assert.equal(itemCount, 1, 'Design Studio should return exactly one nav entry, not a separate Settings row')
  assert.doesNotMatch(branch, /label: 'Settings'/, 'Settings must not be a sidebar row — it lives under the header Profile icon')
})

test('the Facebook-tier sidebar no longer carries its own Settings row (dropped from dashboard.html)', () => {
  assert.doesNotMatch(dashboardHtml, /data-page="profile" title="Settings" class="nav-item fb-only-nav/, 'the fb-only-nav Settings button must be removed — Settings is header-only now')
})

test('header Profile icon is the single settings entry point: clicking it opens My Account directly', () => {
  const btn = dashboardHtml.match(/<button id="header-profile-btn"[^>]*>/)?.[0] || ''
  assert.match(btn, /onclick="switchPage\('profile'\);settingsTab\('account'\)"/)
})

test('forceCompactSettingsGrid merges Language into #profile-panel and forces the 3-column grid directly', () => {
  // Language is authored in #settings-panel-extra, a SEPARATE grid container from
  // #profile-panel (Profile/Billing/Security) — the page moves #profile-panel into
  // place at runtime (ensurePanelsInOriginalLocations()), so relying on
  // settingsTab()'s computed is-multi toggle for two independent grids produced two
  // stacked single-row blocks instead of one compact 3-column layout. Forcing the
  // merge + class directly removes the dependency on that heuristic entirely.
  assert.match(part2, /function forceCompactSettingsGrid\(\)/)
  const fn = part2.match(/function forceCompactSettingsGrid\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'forceCompactSettingsGrid must exist')
  assert.match(fn, /getElementById\('profile-panel'\)/)
  assert.match(fn, /getElementById\('settings-language-card'\)/)
  assert.match(fn, /profilePanel\.appendChild\(languageCard\)/)
  assert.match(fn, /profilePanel\?\.classList\.add\('is-multi'\)/)
  // Both single-product blocks must call it, after their settingsTab('account') call.
  const designStudioBlock = part2.match(/if \(typeof isDesignStudioOnlyWorkspace === 'function'[\s\S]*?\n {4}\}/)?.[0] || ''
  const facebookBlock = part2.match(/if \(typeof isFacebookOnlyWorkspace === 'function'[\s\S]*?\n {4}\}/)?.[0] || ''
  for (const block of [designStudioBlock, facebookBlock]) {
    assert.ok(block, 'block must exist')
    assert.match(block, /settingsTab\('account'\)/, 'block must call settingsTab first')
    assert.ok(block.indexOf("settingsTab('account')") < block.indexOf('forceCompactSettingsGrid()'), 'forceCompactSettingsGrid() must run after settingsTab')
  }
})

test('.settings-cols.is-multi is a real 3-column CSS grid, not a masonry/multi-column layout', () => {
  assert.match(dashboardHtml, /\.settings-cols \{ display: grid;/)
  assert.match(dashboardHtml, /\.settings-cols\.is-multi \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/)
})

test('settings-my-record is full-width and the other My Account cards are not, confirming why it must be force-hidden rather than left visible', () => {
  const record = dashboardHtml.match(/<div id="settings-my-record"[^>]*>/)?.[0] || ''
  assert.match(record, /data-full-width="true"/, 'settings-my-record spans the whole grid row while visible')
  for (const id of ['profile-form', 'billing-section', 'security-section']) {
    const tag = dashboardHtml.match(new RegExp(`<(?:div|form) id="${id}"[^>]*>`))?.[0] || ''
    assert.ok(tag, `${id} must exist`)
    assert.doesNotMatch(tag, /data-full-width="true"/, `${id} should be free to sit side-by-side in the grid`)
  }
})
