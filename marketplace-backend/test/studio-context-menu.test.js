import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')

test('right-clicking the artboard opens a context menu with every editing action', () => {
  assert.match(studio, /upperCanvasEl\.addEventListener\('contextmenu'/, 'must listen for right-click on the fabric canvas')
  assert.match(studio, /e\.preventDefault\(\)/, 'must suppress the native browser context menu')
  for (const method of [
    'copySelected', 'cutSelected', 'pasteClipboard', 'duplicateSelected',
    'bringToFront', 'bringForward', 'sendBackwards', 'sendToBack',
    'groupSelected', 'ungroupSelected', 'deleteSelected',
  ]) {
    assert.match(studio, new RegExp(`'${method}'`), `context menu is missing the "${method}" action`)
  }
})

test('right-clicking an unselected object selects it first', () => {
  const handler = studio.match(/upperCanvasEl\.addEventListener\('contextmenu', \(e\) => \{[\s\S]*?\n {2}\}\);/)?.[0] || ''
  assert.match(handler, /findTarget\(e, false\)/)
  assert.match(handler, /canvas\.setActiveObject\(target\)/)
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
