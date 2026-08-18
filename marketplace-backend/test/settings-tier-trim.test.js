import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const part2 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
const part8 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part8.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const marketingWorkspace = readFileSync(new URL('../../marketplace-frontend/js/modules/marketing-workspace.js', import.meta.url), 'utf8')
const part25 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part25.js', import.meta.url), 'utf8')
const part10 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part10.js', import.meta.url), 'utf8')

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

test('every single-product tier trims Settings to My Account + Billing (Upgrade lives at the header, not in Settings)', () => {
  // Consolidated into ONE isSingleProductWorkspace()-gated block — this must apply
  // to every single-product tier (Design Studio, AI ChatBot, Video, Website,
  // Social, Email, Facebook), not just the two tiers that happened to get a
  // bespoke isDesignStudioOnlyWorkspace()/isFacebookOnlyWorkspace() block first.
  // 4-space indent matches this block's nesting inside initializeDashboardEcosystem().
  const block = part2.match(/ {4}if \(typeof isSingleProductWorkspace === 'function'[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(block, 'the single-product settings-trim block must exist')
  assert.match(block, /document\.querySelectorAll\('#settings-tabs \[data-admin-only\]'\)\.forEach\(el => el\.classList\.add\('hidden'\)\)/)
  assert.match(block, /SETTINGS_TAB_SECTIONS\.account\.push\('billing-section'\)/)
  assert.match(block, /__settingsTab = 'account'/)
  // settings-my-record (the employment-record card) renders from GET /hr/me, which
  // 404s for every single-product account (they're created through product signup,
  // not the full HR onboarding flow that creates a staff_members row) — including
  // Facebook Dealer, so it is unconditionally dropped for every tier, no exception.
  // It needs BOTH a direct hide AND removal from SETTINGS_TAB_SECTIONS.account —
  // neither alone is enough:
  //   - Direct hide only: applyProductNav() above already triggered one
  //     settingsTab('account') call (via its own switchPage('profile')) using the
  //     unmodified section list, un-hiding the card — the direct hide catches
  //     that. But it's still tracked, so ANY later settingsTab('account') call
  //     (confirmed live: dealerRoleLanding()'s switchPage() a few lines down gets
  //     internally redirected back to 'profile' for every single-product tier,
  //     re-running settingsTab — and the header Profile icon, and #/p/profile
  //     hash-route replays, do the same) re-adds it to the active set and
  //     un-hides it again.
  //   - Array removal only: settingsTab()'s toggle loop only manages ids it still
  //     tracks — remove it without ever hiding it directly first, and it's stuck
  //     in whatever state that FIRST call left it: visible.
  assert.match(block, /document\.getElementById\('settings-my-record'\)\?\.classList\.add\('stab-hide'\)/)
  assert.match(block, /SETTINGS_TAB_SECTIONS\.account = SETTINGS_TAB_SECTIONS\.account\.filter\(id => id !== 'settings-my-record'\)/, 'must ALSO stop tracking the id so later settingsTab() calls never re-show it')
  assert.doesNotMatch(block, /if \(!fbOnly\) \{\s*\n\s*document\.getElementById\('settings-my-record'\)/,
    'the hide must be unconditional now — Facebook Dealer no longer gets an exception')
  // Facebook Solo/Dealer additionally fold in Facebook Posting Safety.
  assert.match(block, /const fbOnly = typeof isFacebookOnlyWorkspace === 'function' && isFacebookOnlyWorkspace\(\)/)
  assert.match(block, /if \(fbOnly[\s\S]*?guardrail-settings-section/)
  assert.match(block, /document\.getElementById\('guardrail-settings-section'\)\?\.classList\.remove\('hidden'\)/)
  // Facebook Dealer (not Solo — a lone rep has no team) additionally folds in the
  // Team roster, since Administration (where it normally lives) is hidden entirely.
  assert.match(block, /const isFbDealer = \/\(\?:\^\|\\s\)facebook_dealer\(\?:\\s\|\$\)\/\.test\(document\.documentElement\.getAttribute\('data-product'\) \|\| ''\)/)
  assert.match(block, /if \(isFbDealer[\s\S]*?settings-team/)
})

test('settingsTab("account") loads the Team roster once it has been folded in for Facebook Dealer', () => {
  const fn = part8.match(/function settingsTab\(tab\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'settingsTab must exist')
  const accountBlock = fn.match(/if \(tab === 'account'\) \{[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.match(accountBlock, /SETTINGS_TAB_SECTIONS\.account\.includes\('settings-team'\)/)
  assert.match(accountBlock, /loadSettingsTeam\(document\.getElementById\('team-picker'\)\?\.value \|\| 'sales'\)/)
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

test('renderSetupBar retires the Open Setup wizard button for every account, not just single-product tiers', () => {
  // The "Open Setup" sidebar button (and the Setup Wizard nudge it opened) used to
  // be shown to full DealerOS DEALER_ADMIN/OWNER/MANAGER accounts, gated off only
  // for single-product tiers. It's retired for everyone now — the host is always
  // cleared, unconditionally, once refreshSetupIndicator() (which itself just hides
  // the "Finish setup" banner) resolves.
  const fn = dashboard.match(/async function renderSetupBar\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'renderSetupBar must exist')
  assert.match(fn, /await refreshSetupIndicator\(\)/, 'renderSetupBar must await refreshSetupIndicator before touching the host')
  assert.doesNotMatch(fn, /isSingleProductWorkspace/, 'no per-tier branching should remain — the button is gone for everyone')
  assert.doesNotMatch(fn, /Open Setup/, 'the Open Setup button markup must be gone')
  assert.match(fn, /if \(host\) host\.innerHTML = ''/, 'the host must always be cleared')
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

test('forceCompactSettingsGrid forces the 3-column grid directly, without relying on the computed shown-count heuristic', () => {
  // settingsTab()'s computed is-multi toggle is fragile for single-product tiers
  // (confirmed live), so this forces the class directly instead.
  assert.match(part2, /function forceCompactSettingsGrid\(\)/)
  const fn = part2.match(/function forceCompactSettingsGrid\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'forceCompactSettingsGrid must exist')
  assert.match(fn, /getElementById\('profile-panel'\)\?\.classList\.add\('is-multi'\)/)
  // The single-product block must call it, after its settingsTab('account') call.
  // 4-space indent matches this block's nesting inside initializeDashboardEcosystem().
  const block = part2.match(/ {4}if \(typeof isSingleProductWorkspace === 'function'[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(block, 'block must exist')
  assert.match(block, /settingsTab\('account'\)/, 'block must call settingsTab first')
  assert.ok(block.indexOf("settingsTab('account')") < block.indexOf('forceCompactSettingsGrid()'), 'forceCompactSettingsGrid() must run after settingsTab')
})

test('.settings-cols.is-multi is a real 3-column CSS grid, not a masonry/multi-column layout', () => {
  assert.match(dashboardHtml, /\.settings-cols \{ display: grid;/)
  assert.match(dashboardHtml, /\.settings-cols\.is-multi \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/)
})

test('Billing and Language share one grid cell, stacked in normal flow, not two independent grid rows', () => {
  // A CSS grid row's height is set by its TALLEST cell — explicit row-2/column-2
  // placement left a visible gap under Billing's much shorter card whenever
  // Profile/Security (row 1's tall cells) ran longer. Nesting Billing + Language
  // inside one shared flex-column wrapper means Language sits snug under Billing
  // regardless of how tall the other columns get.
  const wrapper = dashboardHtml.match(/<div id="billing-language-col"[\s\S]*?(?=<div id="guardrail-settings-section")/)?.[0] || ''
  assert.ok(wrapper, 'billing-language-col wrapper must exist')
  assert.match(wrapper, /class="flex flex-col"/)
  assert.match(wrapper, /id="billing-section"/, 'Billing must be inside the wrapper')
  assert.match(wrapper, /id="settings-language-card"/, 'Language must be inside the wrapper')
  assert.ok(wrapper.indexOf('id="billing-section"') < wrapper.indexOf('id="settings-language-card"'),
    'Billing must come before Language inside the wrapper')
  const card = dashboardHtml.match(/<div id="settings-language-card"[^>]*>/)?.[0] || ''
  assert.ok(card, 'settings-language-card must exist')
  assert.doesNotMatch(card, /aspect-square/, 'must not be forced square')
  assert.doesNotMatch(card, /data-full-width="true"/)
  assert.doesNotMatch(card, /\[grid-row:2\]|\[grid-column:2\]/, 'must not use explicit grid placement any more — normal flow inside the wrapper instead')
})

test('every single-product dashboard hides the floating Intelligence AI dock and the Setup Wizard banner; Team Chat stays for Facebook Dealer only', () => {
  // The AI dock and Setup Wizard coordinate work across a dealership's staff/
  // departments — a single-tool subscriber has neither, full stop. Team Chat is
  // different: Facebook Dealer is a real dealership sales team (unlike a lone
  // Design Studio/AI ChatBot/Facebook Solo subscriber), so it keeps Team Chat.
  const block = part2.match(/ {4}if \(typeof isSingleProductWorkspace === 'function'[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(block, 'block must exist')
  assert.match(block, /getElementById\('ai-dock-btn'\)\?\.classList\.add\('hidden'\)/)
  assert.match(block, /getElementById\('ai-dock-panel'\)\?\.classList\.add\('hidden'\)/)
  assert.match(block, /getElementById\('setup-status-banner'\)\?\.classList\.add\('hidden'\)/)
  assert.match(block, /const isFbDealer = \/\(\?:\^\|\\s\)facebook_dealer\(\?:\\s\|\$\)\/\.test\(document\.documentElement\.getAttribute\('data-product'\) \|\| ''\)/)
  assert.match(block, /getElementById\('team-chat-dock-panel'\)\?\.classList\.toggle\('hidden', !isFbDealer\)/)
})

test('refreshSetupIndicator unconditionally hides the Setup Wizard banner for every account', () => {
  // The "Finish setup" banner is retired entirely, not just for single-product
  // tiers — no role check, no fetch, no re-render, just hide it every call.
  const fn = part2.match(/function refreshSetupIndicator\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'refreshSetupIndicator must exist')
  assert.match(fn, /getElementById\('setup-status-banner'\)\?\.classList\.add\('hidden'\)/)
  assert.doesNotMatch(fn, /fetch\(/, 'must not fetch /launch any more — the banner never renders')
  assert.doesNotMatch(fn, /role/, 'must not branch on role — hidden unconditionally')
})

test('engineRail omits the Team Messages section for single-product workspaces, except Facebook Dealer', () => {
  const fn = part10.match(/function engineRail\(eng, d\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'engineRail must exist')
  assert.match(fn, /const singleProduct = typeof isSingleProductWorkspace === 'function' && isSingleProductWorkspace\(\)\s*\n\s*&& !\/\(\?:\^\|\\s\)facebook_dealer\(\?:\\s\|\$\)\/\.test\(document\.documentElement\.getAttribute\('data-product'\) \|\| ''\)/)
  assert.match(fn, /const msg = singleProduct \? '' : sec\('Team Messages'/)
})

test('Design Studio nav entries use a real icon key, not the non-existent "image" (which silently falls back to a plain dot)', () => {
  // svgIcon(name) does `SVG_ICONS[name] || SVG_ICONS.dot` — SVG_ICONS has no
  // 'image' entry, so `icon: 'image'` always rendered as the fallback dot.
  const svgIconsBlock = dashboard.match(/const SVG_ICONS = \{[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(svgIconsBlock, 'SVG_ICONS must exist')
  assert.doesNotMatch(svgIconsBlock, /\bimage:/, 'SVG_ICONS has no "image" key — this test documents that gap')
  assert.doesNotMatch(dashboard, /icon: 'image'/, 'dashboard.js must not reference the non-existent "image" icon key')
  assert.doesNotMatch(marketingWorkspace, /icon: 'image'/, 'marketing-workspace.js must not reference the non-existent "image" icon key')
  assert.match(dashboard, /label: 'Design Studio', icon: 'camera'/, 'the Design Studio nav entry should use a real icon key')
})

test('the Daily Shift Punch Clock modal is skipped for single-product accounts, checked inside its setTimeout not at the top of the function', () => {
  // checkLoginPunchClockPrompt() is called (synchronously, unawaited) BEFORE
  // applyProductNav() sets data-product — a guard at the top of the function
  // would always read data-product as unset. The actual modal render is already
  // deferred via setTimeout(fn, 1200) for its own reasons; checking
  // isSingleProductWorkspace() inside that callback instead means the check runs
  // after applyProductNav() — called synchronously right after, in the same
  // caller — has always already finished.
  const fn = part25.match(/function checkLoginPunchClockPrompt\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'checkLoginPunchClockPrompt must exist')
  const setTimeoutIdx = fn.indexOf('setTimeout(() => {')
  assert.ok(setTimeoutIdx > -1, 'the modal render must be deferred via setTimeout')
  const beforeSetTimeout = fn.slice(0, setTimeoutIdx)
  const afterSetTimeoutStart = fn.slice(setTimeoutIdx)
  assert.doesNotMatch(beforeSetTimeout, /isSingleProductWorkspace/, 'the check must not run before data-product is guaranteed set')
  assert.match(afterSetTimeoutStart, /if \(typeof isSingleProductWorkspace === 'function' && isSingleProductWorkspace\(\)\) return;/)
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
