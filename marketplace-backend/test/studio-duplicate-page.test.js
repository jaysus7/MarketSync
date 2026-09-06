import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/strip-comments.js'

const shell = stripComments(readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8'))
const adapter = stripComments(readFileSync(new URL('../../marketplace-frontend/js/modules/studio/fabric-adapter.js', import.meta.url), 'utf8'))

// Objects you add live on the fabric canvas; they do NOT write back to
// adapter.currentScene. Duplicate used to clone the page out of currentScene —
// the scene as last LOADED — so on a design you had just been working on the
// source page was still empty and "Duplicate" produced a blank page.
test('Duplicate copies the page as it is on screen, not as it was loaded', () => {
  const fn = shell.match(/function duplicateStudioPage\(pageId\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'duplicateStudioPage must exist')

  // The source page must come from the EXPORT, which reads the live canvas.
  assert.match(fn, /const doc = window\.msStudioSceneToDocument\(adapter\.exportScene\(\)\)/)
  assert.match(fn, /const source = doc\.pages\[index\]/,
    'the page being copied must come from the exported doc')
  assert.ok(!/adapter\?\.currentScene.*\.pages\?\.find/.test(fn),
    'cloning out of the stale currentScene is the bug and must not come back')

  // exportScene is what makes that safe: it puts the live objects on the active page.
  assert.match(adapter, /pages: this\.currentScene\.pages \? this\.currentScene\.pages\.map\(page => page\.id === this\.activePageId \? \{ \.\.\.page, objects: elements \} : page\)/)
})

test('the copy is independent of the original', () => {
  const fn = shell.match(/function duplicateStudioPage\(pageId\)[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /JSON\.parse\(JSON\.stringify\(source\)\)/, 'a deep copy, not a reference')
  assert.match(fn, /copy\.id = `page_\$\{Date\.now\(\)\}`/, 'the page needs its own id')
  assert.match(fn, /\(copy\.objects \|\| \[\]\)\.forEach\(/,
    'and so do the objects, or the two pages share ids')
  assert.match(fn, /object\.id = `el_\$\{Date\.now\(\)\}_\$\{n\}`/)
  assert.match(fn, /doc\.pages\.splice\(index \+ 1, 0, copy\)/, 'the copy goes right after its source')
  assert.match(fn, /adapter\.activePageId = copy\.id/, 'and becomes the page you are on')
})

test('the toast says how much was copied', () => {
  // "Page duplicated" gave no way to notice it had copied nothing, which is how
  // this survived: the success message looked identical either way.
  const fn = shell.match(/function duplicateStudioPage\(pageId\)[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /const n = \(copy\.objects \|\| \[\]\)\.length/)
  assert.match(fn, /item\$\{n === 1 \? '' : 's'\} copied/, 'and pluralises honestly')
})
