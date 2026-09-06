import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/strip-comments.js'

const adapter = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const docModel = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/document-model.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')
const code = (src) => stripComments(src)

test('a page background carries a colour, an image and a fit', () => {
  const fn = code(adapter).match(/setSceneBackground\(\{ color, image, fit \} = \{\}\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'setSceneBackground must exist')
  // Each field is optional and independent: setting a colour must not wipe the image.
  assert.match(fn, /if \(color !== undefined\)/)
  assert.match(fn, /if \(image !== undefined\) target\.background\.image = image \|\| null/)
  assert.match(fn, /if \(fit !== undefined\) target\.background\.fit = fit/)
  assert.match(fn, /this\.saveHistory\(\)/, 'a background change must be undoable')
  // It writes to the ACTIVE page, not blindly to the scene root.
  assert.match(fn, /scene\.pages\.find\(p => p\.id === this\.activePageId\)/)
})

test('the exported scene keeps the source URL, not fabric\'s scaled image', () => {
  // The export service renders from this JSON and has no canvas, so a fabric
  // Image object here would be unrenderable.
  const exported = code(adapter).match(/background: \{[\s\S]*?\n      \},/)?.[0] || ''
  assert.ok(exported, 'exportScene must write a background block')
  assert.match(exported, /image: this\.backgroundImageSrc \|\| null/)
  assert.match(exported, /fit: this\.backgroundImageFit \|\| 'cover'/)
  assert.match(exported, /color: this\.fabricCanvas\.backgroundColor/)
})

test('the background image cannot be grabbed while editing', () => {
  const fn = code(adapter).match(/applyBackgroundImage\(src, fit = 'cover', width, height\)[\s\S]*?\n  \}/)?.[0] || ''
  assert.ok(fn, 'applyBackgroundImage must exist')
  assert.match(fn, /selectable: false, evented: false/,
    'a background must not be selectable, or it gets dragged instead of the artwork')
  // cover fills and crops; contain fits the whole image.
  assert.match(fn, /Math\.min\(scaleW, scaleH\)/)
  assert.match(fn, /Math\.max\(scaleW, scaleH\)/)
  assert.match(fn, /if \(this\.backgroundImageSrc !== src\) return;/,
    'a slower image must not overwrite a newer background chosen since')
  assert.match(fn, /if \(!src\) \{[\s\S]*?setBackgroundImage\(null/,
    'clearing must actually remove the image')
})

test('a saved document round-trips the whole background object', () => {
  // clone() on the whole object is what carries image and fit through a save;
  // spelling out only `color` here would silently drop them.
  assert.match(code(docModel), /background: clone\(input\.background \|\| \{ color: '#FFFFFF' \}\)/)
  assert.match(code(docModel), /background: clone\(page\.background \|\| input\.background/)
})

test('Background is reachable and themed', () => {
  assert.match(code(shell), /setStudioTool\('background'\)/, 'it needs a rail button')
  assert.match(code(shell), /if \(tool === 'background'\)/, 'and a panel')
  assert.match(code(shell), /function studioUploadBackgroundImage/)
  // Reuses the media-library upload rather than inventing a second one.
  assert.match(code(shell), /studioUploadBackgroundImage[\s\S]*?\$\{API\}\/marketing\/assets/)
  assert.match(code(shell), /function studioClearBackgroundImage/)
  for (const rule of ['.studio-bg-swatch', '.studio-bg-fit']) {
    assert.ok(css.includes(rule), `${rule} must be styled`)
    assert.ok(css.includes('.dark #ms-studio-master-modal ' + rule), `${rule} needs a dark counterpart`)
  }
})
