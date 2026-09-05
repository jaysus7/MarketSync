/**
 * Design Studio — contract tests for the mobile + template + element
 * fixes. The bugs the user reported:
 *   1. Templates don't render on canvas — root cause: openMarketSyncStudio
 *      called initStudioAdapter without await, so loadStudioTemplate
 *      raced the fabric canvas init and silently no-oped.
 *   2. Elements don't render on canvas — root cause: addImage returned
 *      null on any load error (CORS quirks, iconify hiccup) with zero
 *      user feedback; visitor thought the tap did nothing.
 *   3. Mobile studio needs work — layout crammed 6 cards across a
 *      390px viewport with sub-44px tap targets.
 *   4. Not enough elements per category.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const shell = await readFile(
  new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8'
)
const adapter = await readFile(
  new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8'
)
const theme = await readFile(
  new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8'
)
const part2 = await readFile(
  new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8'
)
const dashboard = await readFile(
  new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8'
)

test('openMarketSyncStudio awaits initStudioAdapter — no template race with fabric', () => {
  // Before this fix: initStudioAdapter(scene); (no await) then
  // loadStudioTemplate could reach renderScene before the fabric canvas
  // finished construction, silently no-oping while a "Loaded X"
  // success toast fired. Enforce the await.
  assert.match(shell, /await initStudioAdapter\(scene\);/,
    'openMarketSyncStudio must await initStudioAdapter so template application does not race the canvas init')
})

test('loadStudioTemplate waits for the fabric canvas + reports failure loudly', () => {
  // Fallback safety net for any codepath that reaches loadStudioTemplate
  // without holding the openMarketSyncStudio await — retry until the
  // adapter is present (bounded to ~3s), and surface a real error toast
  // if it never comes up. No more silent success.
  assert.match(shell, /const waitForAdapter = async \(\)/,
    'loadStudioTemplate must wait for the fabric adapter')
  // Silent no-op is the current policy on timeout — a visible toast
  // firing over the studio home was alarming and cellular-slow load
  // was the usual cause. Extended timeout (12s) is enforced instead.
  assert.match(shell, /for \(let i = 0; i < 120; i\+\+\)/,
    'waitForAdapter must be extended to 120 * 100ms = 12s so cellular fabric.js loads finish before the timeout')
  assert.match(shell, /await window\.__studioAdapter\.renderScene\(boundScene\);\s*\} catch/,
    'renderScene errors must be caught and surfaced')
})

test('studioAddVisualElement never silently drops a click', () => {
  // Three failure modes that used to be silent:
  //   1. Item id not in the library     → toast "no longer in the library"
  //   2. No adapter yet (no active doc) → toast "Open or create a design first"
  //   3. Icon URL fails to load         → shape fallback + toast
  for (const guard of [
    /That element is no longer in the library/,
    /Open or create a design first/,
    /icon couldn't load — using a solid shape/,
  ]) {
    assert.match(shell, guard, `missing visible feedback: ${guard}`)
  }
})

test('addImage tries with-CORS first, without-CORS second, before giving up', () => {
  // Some SVG CDNs (iconify included, on some clients) don't return CORS
  // headers reliably. The old code passed { crossOrigin: 'anonymous' }
  // and if that failed returned null — the SVG never landed on the
  // canvas. Two-pass load lets the element render even without CORS.
  assert.match(adapter, /let img = await load\(true\)/,
    'first attempt must set crossOrigin')
  assert.match(adapter, /if \(!img\) img = await load\(false\)/,
    'second attempt must retry without crossOrigin')
})

test('Element library is one row per shape/icon — colour comes from the Color tool', () => {
  // User course-correction: "Shapes should just be one shape and then
  // colours can change with colour options." The prior 240-shape-
  // multiplier was noise, not variety. Enforce: one row per shape,
  // one row per icon, one row per graphic. Freeform transform + the
  // Color tool provide every axis of variation.
  assert.doesNotMatch(shell, /STUDIO_ELEMENT_PALETTE/,
    'palette multiplier must be gone — Color tool handles colour on any element')
  assert.doesNotMatch(shell, /STUDIO_SHAPE_BASE\.flatMap/,
    'shapes must not be multiplied by a palette')
  // Sanity floor: still have real variety in the base library.
  const shapeIds = shell.match(/'shape-[a-z]+',/g) || []
  assert.ok(shapeIds.length >= 10, `expected at least 10 base shape ids, got ${shapeIds.length}`)
  const iconEntries = shell.match(/id: `icon-\$\{icon\}`/g) || []
  assert.ok(iconEntries.length >= 1, 'icons category must be present with a generator')
})

test('Mobile studio layout is real — 44px tap targets, tabbed layout, larger canvas', () => {
  // Regression guard against the pre-fix state where phones showed a
  // 6-column element grid with 28px tap targets. Every one of these
  // rules is scoped to (max-width: 768px) so desktop is untouched.
  const mobileBlock = theme.match(/@media \(max-width: 768px\) \{[\s\S]*?\n\}\n/g)
  const hasStudioMobile = mobileBlock && mobileBlock.some(b => /#ms-studio-master-modal[\s\S]*min-height: 44px/.test(b))
  assert.ok(hasStudioMobile, 'mobile block must set 44px tap-target floor for studio buttons')
  assert.match(theme, /@media \(max-width: 768px\)[\s\S]*?#studio-canvas-viewport[\s\S]*min-height: 46vh/,
    'canvas must claim ≥46vh on phones so the artboard is workable')
  assert.match(theme, /@media \(max-width: 480px\)[\s\S]*?#studio-premade-library[\s\S]*repeat\(2/,
    'element catalog must drop to 2 columns on the smallest phones')
})

test('mobile studio hides desktop-only chrome that was overflowing the header', () => {
  // Screenshot regression: on iPhone-13 width the Desktop/Tablet/Mobile
  // breakpoint switcher clipped and read as "Desk a"; the DealerOS
  // demo pill overlapped the design-name input; UNSAVED was pushed
  // off-screen. Each cause has its own hide rule now.
  assert.match(theme, /#ms-studio-master-modal #ms-mode-switch \{ display: none/,
    'mobile studio must suppress the DealerOS mode-switch pill')
  assert.match(theme, /#ms-studio-master-modal \.studio-command-scroll > div\[title\*="breakpoint"[\s\S]{0,60}display: none/,
    'the breakpoint switcher must be hidden on mobile — nothing to preview from a phone')
  assert.match(theme, /#ms-studio-master-modal \.studio-desktop-action \{ display: none/,
    'desktop-only toolbar actions must move into the Tools panel on mobile')
  assert.match(theme, /#ms-studio-master-modal \.studio-title-badge[\s\S]{0,120}display: none/,
    'the STUDIO badge must be hidden on mobile so the design name has room')
  assert.match(theme, /#ms-studio-master-modal #studio-design-name \{[\s\S]{0,200}text-overflow: ellipsis/,
    'design-name input must ellipsis on overflow instead of pushing UNSAVED off-screen')
  assert.match(theme, /#ms-studio-master-modal nav\[role="tablist"\][\s\S]{0,200}-webkit-overflow-scrolling: touch/,
    'tab-bar must scroll cleanly on touch without a visible scrollbar')
})

test('studio format tiles + design sets swipe horizontally on mobile', () => {
  // Screenshot regression: on iPhone width the "Digital marketing"
  // format tiles stacked in a 2-column vertical grid, forcing pages
  // of scroll to see them all. Every .studio-scroll-row grid now
  // flips to a horizontal, snap-scrolling swipe row on ≤768px so a
  // whole category fits in one thumb-swipe.
  assert.match(shell, /class="studio-scroll-row grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"/,
    'renderStudioHomeFormatShortcuts grid must carry the swipe-row class')
  assert.match(shell, /class="studio-scroll-row grid gap-4 sm:grid-cols-2 xl:grid-cols-4"/,
    'renderStudioHomeDesignSets grid must carry the swipe-row class')
  assert.match(shell, /class="studio-scroll-row grid gap-2 sm:grid-cols-2 lg:grid-cols-3"/,
    'openStudioSizePicker sheet grid must carry the swipe-row class')
  // CSS must actually flip the grid to horizontal flex + snap on mobile.
  // Rule lives inside the mobile block — assert its content directly.
  assert.match(theme, /\.studio-scroll-row \{[\s\S]{0,600}overflow-x: auto[\s\S]{0,600}scroll-snap-type: x mandatory/,
    'mobile .studio-scroll-row must become a horizontal snap-scroll row')
  assert.match(theme, /\.studio-scroll-row > \* \{[\s\S]{0,200}scroll-snap-align: start/,
    'each swipe-row child must snap to start')
})

test('templates grid swipes horizontally + each template renders a distinct preview', () => {
  // #studio-home-template-grid now carries .studio-scroll-row so the
  // ~50 templates pan side-to-side on mobile instead of stacking into
  // pages of vertical scroll.
  assert.match(shell, /id="studio-home-template-grid"[^>]*studio-scroll-row/,
    'templates grid must be a swipe row on mobile')
  // templatePreviewMarkup now (a) uses the first page's objects when
  // the scene is multi-page — otherwise business_card / letterhead /
  // brochure / postcard / presentation all rendered the same generic
  // scene.elements — and (b) hashes the template key to a distinct
  // colour placeholder so photos that fail to load don't collapse
  // every tile into the same brand-panel-only look.
  assert.match(shell, /const firstPage = Array\.isArray\(scene\.pages\) && scene\.pages\[0\]/,
    'preview must prefer the first page objects when the scene is multi-page')
  assert.match(shell, /const palettes = \[[\s\S]{0,600}\]/,
    'preview must ship a placeholder palette')
  assert.match(shell, /seed % palettes\.length/,
    'placeholder colour must be hashed from the template key so each preview is distinct')
  // Photo fallback: the img is now wrapped in a placeholder-backed
  // div so the gradient shows during loading AND on error — no more
  // blank strips while imgs race to load on cellular.
  assert.match(shell, /<div style="\$\{base\}\$\{placeholder\}"><img/,
    'template img must be wrapped in a gradient-backed placeholder div')
  assert.match(shell, /onerror="this\.style\.display='none'"/,
    'failed template photos must hide themselves so the gradient stays visible')
})

test('every shape supports freeform transform (skew/scale/rotate) on canvas', () => {
  // User rule: "every shape can transform freeform". Enforce that
  // fabric-adapter.addShape unlocks skew + both scale axes on every
  // shape it adds, and shows all corner + side + rotation handles.
  assert.match(adapter, /addShape\([\s\S]{0,4000}lockSkewingX: false,\s*lockSkewingY: false/,
    'addShape must unlock skew on both axes for freeform transform')
  assert.match(adapter, /addShape\([\s\S]{0,4000}lockScalingX: false,\s*lockScalingY: false/,
    'addShape must unlock independent axis scaling')
  assert.match(adapter, /addShape\([\s\S]{0,4000}setControlsVisibility\(\{[\s\S]{0,300}mtr: true/,
    'addShape must show corner + side + rotation handles')
})

test('inspector panel has actual styling (no more shapeCya×StylePositAppearan overflow)', () => {
  // Screenshot regression: the inspector rendered as raw inline text
  // — every .studio-inspector-* class had zero CSS. Add real block
  // layout + padding + spacing so the drawer reads correctly on every
  // viewport, and so mobile drawer content doesn't collapse into a
  // run-together label soup.
  for (const cls of [
    '.studio-inspector-heading',
    '.studio-inspector-tabs',
    '.studio-inspector-body',
    '.studio-inspector-section',
    '.studio-control-grid',
  ]) {
    assert.match(theme, new RegExp(`#ms-studio-master-modal ${cls.replace('.','\\.')}[^{]*\\{`),
      `${cls} must have CSS`)
  }
  // Delete action must be prominent, not blended into other buttons.
  assert.match(theme, /\.studio-delete-action \{[\s\S]{0,400}color: #dc2626/,
    'Delete element action must be styled with a danger colour')
})

test('cache-proof: inspector styles ship inline in the modal HTML + demo badge hides via JS', () => {
  // The user's screenshot kept showing the same broken state after
  // multiple deploys — either a Render preview was slow or Safari
  // was serving cached CSS. Two belt-and-suspenders paths for that:
  //
  // 1) The inspector primitives are duplicated INLINE inside the
  //    modal HTML output, so even a stale marketsync-theme.css can't
  //    leave the inspector reading as run-together text.
  assert.match(shell, /<style data-studio-inline="1">/,
    'workspace HTML must embed an inline <style> block for the inspector')
  const inline = shell.match(/<style data-studio-inline="1">([\s\S]*?)<\/style>/)
  assert.ok(inline, 'inline block extractable')
  assert.match(inline[1], /\.studio-inspector-heading\{display:flex!important/,
    'inline block must define .studio-inspector-heading with !important')
  assert.match(inline[1], /\.studio-breakpoint-group\{display:none!important\}/,
    'inline block must hide the breakpoint switcher on mobile without waiting for external CSS')
  //
  // 2) The Demo mode badge (#demo-mode-badge, appended to body by
  //    demo-control-panel.js — different ID from the earlier hide
  //    attempt) is force-hidden by JS on openMarketSyncStudio and
  //    restored on close. Cannot be defeated by CSS caching.
  assert.match(shell, /openMarketSyncStudio[\s\S]{0,600}getElementById\('demo-mode-badge'\)/,
    'openMarketSyncStudio must hide #demo-mode-badge via JS')
  assert.match(shell, /closeMarketSyncStudio[\s\S]{0,400}getElementById\('demo-mode-badge'\)/,
    'closeMarketSyncStudio must restore #demo-mode-badge')
  // The Tailwind hidden md:flex directly on the breakpoint switcher
  // wrapper is a third safety belt — no CSS to fight with.
  assert.match(shell, /class="studio-breakpoint-group hidden md:flex/,
    'breakpoint switcher wrapper must carry Tailwind hidden md:flex')
})

test('studio cache-bust bumped so the browser fetches the fixed bundle', () => {
  // Two consumers load studio-shell.js via msLoadScript — both must
  // request the new revision so a cached bundle can't hide the fixes.
  const matches = part2.match(/studio-shell\.js\?v=([a-z0-9_]+)/g) || []
  assert.ok(matches.length >= 2, 'must find both studio-shell references')
  for (const m of matches) {
    assert.match(m, /studio-shell\.js\?v=20260905_repaint_diag_v1/,
      `stale cache-bust: ${m}`)
  }
  assert.match(dashboard, /marketsync-theme\.css\?v=20260905_repaint_diag_v1/,
    'theme.css cache-bust must reflect the new mobile rules')
})
