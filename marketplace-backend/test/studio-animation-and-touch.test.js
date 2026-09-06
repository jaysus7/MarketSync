import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
const toolbar = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-context-toolbar.js', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ')

// An animation is an EXPORT property. The editor used to run a permanent
// requestAnimationFrame loop that wrote straight onto the real object — left, top,
// angle, opacity, scaleX, scaleY — keeping the untouched values only in a
// non-persisted __animationBase. Saving mid-cycle therefore baked whatever frame it
// was on into the scene, so a "float" element crept further up on every save.
test('no perpetual animation loop remains', () => {
  for (const [name, src] of [['fabric-adapter', adapter], ['studio-context-toolbar', toolbar]]) {
    assert.ok(!/startAnimationLoop/.test(code(src)), `${name} must not keep an endless animation loop`)
    assert.ok(!/__animationBase/.test(code(src)), `${name} must not stash base values on the object`)
  }
  // There was a SECOND loop in the toolbar for slide/rise/shake/wiggle/pop.
  assert.ok(!/__msExtraMotion/.test(code(toolbar)), 'the toolbar must not run its own parallel loop')
  assert.match(code(adapter), /animation\.type === 'wiggle'/, 'every motion type now plays through the one previewer')
})

test('applying an animation previews it once and restores every value', () => {
  const fn = code(adapter).match(/previewAnimation\(object, \{ loop = false \} = \{\}\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'previewAnimation must exist')
  assert.match(fn, /if \(!loop && elapsed >= duration\) \{ restore\(\); return; \}/,
    'a preview must end itself rather than run forever')
  assert.match(fn, /object\.set\(base\)/, 'it must restore the values it started with')
  assert.match(code(adapter), /stopAnimationPreview\(\)/, 'a running preview must be cancellable')

  const setter = code(adapter).match(/setSelectedAnimation\(type = 'none', duration = 1600\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.match(setter, /this\.stopAnimationPreview\(\)/,
    'changing the animation must cancel a running preview, or its frame gets saved')
  assert.match(setter, /this\.previewAnimation\(object\)/, 'the choice must be shown once')
  assert.match(setter, /animation: \{ type, duration/, 'and persisted for export')
})

// Fabric draws selection handles in canvas pixels; the artboard is then CSS-scaled
// to fit the phone. At the 21-38% fit zoom a default 13px corner reaches the screen
// at 3-5px, which is why the corners could not be grabbed.
test('selection handles stay a finger-sized target at any zoom', () => {
  const fn = code(adapter).match(/applyControlSizing\(\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'applyControlSizing must exist')
  assert.match(fn, /Number\(window\.__studioZoomLevel\)/, 'sizing must follow the artboard zoom')
  assert.match(fn, /cornerSize: corner/)
  assert.match(fn, /touchCornerSize: touch/, 'fabric needs the larger touch target too')
  // Dividing by the zoom is the whole point — multiplying would shrink them further.
  assert.match(fn, /const corner = Math\.round\(\d+ \/ zoom\)/)
  assert.match(fn, /const touch = Math\.round\(\d+ \/ zoom\)/)
  // And it has to re-run when the zoom changes, not only on first render.
  assert.match(code(shell), /window\.__studioAdapter\.applyControlSizing\(\)/,
    'changing zoom must re-size the handles')
  assert.match(code(adapter), /this\.applyControlSizing\(\)/, 'and a render must apply them')
})

test('two fingers scale the selected object', () => {
  // Fabric's stock build ignores multi-touch, so a pinch previously did nothing.
  const fn = code(adapter).match(/bindPinchToScale\(\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'bindPinchToScale must exist')
  assert.match(fn, /event\.touches\.length !== 2/, 'it must only act on a two-finger gesture')
  assert.match(fn, /Math\.hypot/, 'scale comes from the distance between the fingers')
  assert.match(fn, /\{ passive: false \}/, 'the listener must be able to preventDefault')
  assert.match(fn, /event\.preventDefault\(\)/, 'or the page pinch-zooms instead of the object')
  assert.match(fn, /lockScalingX \|\| object\.lockScalingY/, 'a locked object must stay locked')
  assert.match(fn, /left: start\.left, top: start\.top/, 'scaling must not walk the object across the page')
  assert.match(fn, /this\.saveHistory\(\)/, 'a pinch must be undoable')
  assert.match(fn, /el\.__msPinchBound/, 'binding must happen once, not per render')
})
