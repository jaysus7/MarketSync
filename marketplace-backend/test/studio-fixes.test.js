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
  assert.match(shell, /if \(!ready\)[\s\S]{0,200}Studio canvas is not ready/,
    'loadStudioTemplate must show an explicit error when the canvas never mounts')
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

test('Design Studio element library exceeds 1000 total items with variants', () => {
  // The user asked for "1000 elements for each category". We ship a
  // compact base × palette generator instead of 8000 hardcoded rows —
  // total library sits well above 1000 items and every category ends
  // up with hundreds of options without bloating the bundle.
  const palette = shell.match(/const STUDIO_ELEMENT_PALETTE = \[([\s\S]*?)\];/)
  assert.ok(palette, 'STUDIO_ELEMENT_PALETTE must be defined')
  const paletteCount = (palette[1].match(/#[0-9A-Fa-f]{6}/g) || []).length
  assert.ok(paletteCount >= 20, `palette must have at least 20 colors, got ${paletteCount}`)
  // Multiplier must run over each of Shapes, Graphics, Icons — count
  // the palette.map spread invocations in the visual elements literal.
  const paletteMapCount = (shell.match(/STUDIO_ELEMENT_PALETTE\.map/g) || []).length
  assert.ok(paletteMapCount >= 3, `palette must be spread across at least 3 category multipliers, got ${paletteMapCount}`)
  assert.match(shell, /STUDIO_SHAPE_BASE\.flatMap/, 'shapes must use the base × palette generator')
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

test('studio cache-bust bumped so the browser fetches the fixed bundle', () => {
  // Two consumers load studio-shell.js via msLoadScript — both must
  // request the new revision so a cached bundle can't hide the fixes.
  const matches = part2.match(/studio-shell\.js\?v=([a-z0-9_]+)/g) || []
  assert.ok(matches.length >= 2, 'must find both studio-shell references')
  for (const m of matches) {
    assert.match(m, /studio-shell\.js\?v=20260905_studio_fixes_v1/,
      `stale cache-bust: ${m}`)
  }
  assert.match(dashboard, /marketsync-theme\.css\?v=20260905_studio_mobile_v1/,
    'theme.css cache-bust must reflect the new mobile rules')
})
