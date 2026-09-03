import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
const theme = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')

test('right-clicking the artboard opens a context menu with every editing action', () => {
  assert.match(studio, /surface\.addEventListener\('contextmenu'/, 'must listen for right-click on the fabric canvas')
  assert.match(studio, /e\.preventDefault\(\)/, 'must suppress the native browser context menu')
  for (const method of [
    'undo', 'redo', 'openTransformControls',
    'copySelected', 'cutSelected', 'pasteClipboard', 'duplicateSelected',
    'bringToFront', 'bringForward', 'sendBackwards', 'sendToBack',
    'groupSelected', 'ungroupSelected', 'deleteSelected',
  ]) {
    assert.match(studio, new RegExp(`'${method}'`), `context menu is missing the "${method}" action`)
  }
})

test('pressing and holding the artboard opens the same menu without breaking drag', () => {
  assert.match(studio, /const STUDIO_LONG_PRESS_MS = 560/)
  assert.match(studio, /addEventListener\('pointerdown'/)
  assert.match(studio, /addEventListener\('pointermove'/)
  assert.match(studio, /Math\.hypot[\s\S]*STUDIO_LONG_PRESS_MOVE_PX/,
    'moving beyond the hold tolerance must cancel the menu so normal drag wins')
  assert.match(studio, /suppressClickUntil/,
    'the synthetic click after a mobile hold must not immediately close the menu')
})

test('Transform opens the canonical position inspector and mobile drawer', () => {
  const transform = studio.match(/function openStudioTransformControls\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(transform, /__studioInspectorTab = 'position'/)
  assert.match(transform, /renderStudioProfessionalInspectorHtml\(\[active\]\)/)
  assert.match(transform, /openStudioMobilePanel\('inspector'\)/)
})

test('right-clicking an unselected object selects it first', () => {
  const selector = studio.match(/function selectStudioContextTarget\(canvas, event\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(selector, /findTarget\(event, false\)/)
  assert.match(selector, /canvas\.setActiveObject\(target\)/)
})

test('the phone action sheet is scrollable and uses full-size touch targets', () => {
  assert.match(theme, /#studio-context-menu \{ max-height: calc\(100dvh - 16px\); overflow-y: auto/)
  assert.match(theme, /@media \(max-width: 768px\)[\s\S]*#studio-context-menu[\s\S]*bottom: max\(8px, env\(safe-area-inset-bottom\)\)/)
  assert.match(theme, /#studio-context-menu \.studio-context-menu-item \{ min-height: 44px;/)
})

test('bringToFront/sendToBack exist on the adapter alongside the existing single-step reorder', () => {
  assert.match(adapter, /bringToFront\(\) \{/)
  assert.match(adapter, /sendToBack\(\) \{/)
  assert.match(adapter, /this\.fabricCanvas\.bringToFront\(active\)/)
  assert.match(adapter, /this\.fabricCanvas\.sendToBack\(active\)/)
})

test('the context menu is torn down when the editor closes', () => {
  const closeFn = studio.match(/function closeMarketSyncStudio\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(closeFn, /closeStudioContextMenu\(\)/)
})
