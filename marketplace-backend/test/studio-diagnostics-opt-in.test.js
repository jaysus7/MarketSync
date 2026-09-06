import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const code = shell.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ')

// The diagnostics panel is a debugging tool, not product surface. It used to mount
// for every phone user — a floating button over the editor and a sheet across the
// canvas. It stays in the tree (it found the blank-artboard regression) but only
// appears when someone asks for it.
test('the studio diagnostics panel only mounts when explicitly enabled', () => {
  const mount = code.match(/function studioMountDebugPanel\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(mount, 'the mount function must exist')
  // The opt-in check must come before anything is created.
  const gate = mount.indexOf('studioDebugEnabled()')
  const create = mount.indexOf('createElement')
  assert.ok(gate > -1, 'the mount must consult the opt-in flag')
  assert.ok(create === -1 || gate < create, 'the flag must be checked before any element is built')
  assert.match(mount, /if \(!studioDebugEnabled\(\)\) return;/, 'a disabled panel must return early')
})

test('the opt-in is reachable and reversible, and never throws', () => {
  const fn = code.match(/function studioDebugEnabled\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'studioDebugEnabled must exist')
  assert.match(fn, /studiodebug/, 'a URL flag must turn it on')
  assert.match(fn, /ms_studio_debug/, 'the choice must persist on the device')
  assert.match(fn, /removeItem\('ms_studio_debug'\)/, 'it must be switchable back off')
  assert.match(fn, /catch \(_\)[\s\S]*?return false/,
    'localStorage throws in private mode; a debug panel must never break the studio')
})

test('the panel is still built when enabled — this hides it, it does not delete it', () => {
  assert.match(code, /studio-diag-fab/)
  assert.match(code, /studio-diag-panel/)
  assert.match(code, /function studioDebugRefresh/)
  assert.match(code, /function studioToggleRawCanvasMode/)
})
