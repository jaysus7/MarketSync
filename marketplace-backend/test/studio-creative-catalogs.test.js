import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const theme = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')

function evaluateCatalog(name, nextName) {
  const start = studio.indexOf(`const ${name} = `)
  const end = studio.indexOf(`const ${nextName}`, start)
  assert.ok(start >= 0 && end > start, `${name} catalog was not found`)
  const declaration = studio.slice(start, end).trim().replace(`const ${name} = `, 'return ').replace(/;$/, '')
  return Function(declaration)()
}

test('text catalog contains genuinely varied two-layer compositions', () => {
  const catalog = evaluateCatalog('STUDIO_TEXT_TEMPLATES', 'STUDIO_TEXT_CATEGORIES')
  assert.ok(catalog.length >= 24)
  assert.ok(new Set(catalog.map(item => item.layout)).size >= 7)
  assert.ok(new Set(catalog.map(item => item.font)).size >= 10)
  assert.ok(catalog.every(item => item.kicker && item.headline && item.font && item.secondaryFont))

  const addText = studio.slice(studio.indexOf('function studioAddTextTemplate'), studio.indexOf('window.studioAddTextTemplate'))
  assert.equal((addText.match(/adapter\.addText\(/g) || []).length, 2)
  assert.doesNotMatch(addText, /adapter\.addShape\(/, 'text combinations should not all become the same centered button')
  assert.match(addText, /new window\.fabric\.ActiveSelection/)
})

test('elements use purpose-specific geometry and remain grouped compositions', () => {
  const catalog = evaluateCatalog('STUDIO_PREMADE_ELEMENTS', 'STUDIO_ELEMENT_CATEGORY_META')
  assert.ok(catalog.length >= 44)
  assert.ok(new Set(catalog.map(item => item.kind)).size >= 12)
  assert.ok(catalog.every(item => item.icon && item.text && item.subtext))

  const layouts = studio.slice(studio.indexOf('function studioElementLayout'), studio.indexOf('function studioAddPremade'))
  for (const kind of ['badge','ribbon','button','trust','callout','card','header','legal','social','rating','date','quote','stat','arrow']) assert.match(layouts, new RegExp(`${kind}: \\{`))
  assert.ok(new Set([...layouts.matchAll(/width:(\d+)/g)].map(match => match[1])).size >= 10)
  assert.match(studio, /Grouped icon \+ title \+ supporting text/)
})

test('large creative catalogs progressively render and expose visual categories', () => {
  assert.match(studio, /new IntersectionObserver/)
  assert.match(studio, /data-studio-lazy=/)
  assert.match(studio, /root: sentinel\.closest\('\.studio-catalog-scroll'\)/)
  assert.match(studio, /loading="lazy" decoding="async"/)
  assert.match(studio, /Browse categories/)
  assert.match(studio, /Search fonts and combinations/)
  assert.match(theme, /\.studio-element-categories \{ display:grid;/)
  assert.match(theme, /\.studio-icon-categories,[\s\S]*overflow-x:auto/)
  assert.match(theme, /\.studio-text-template-library \{ display:grid;/)
})
