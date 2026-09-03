import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const studio = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const theme = readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8')

function evaluateCatalog(name, nextName) {
  const start = studio.indexOf(`const ${name} = `)
  const nextMarker = nextName.startsWith('function ') ? nextName : `const ${nextName}`
  const end = studio.indexOf(nextMarker, start)
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

test('elements are a broad visual asset library rather than repeated callout cards', () => {
  const catalog = evaluateCatalog('STUDIO_VISUAL_ELEMENTS', 'function loadStudioGoogleFonts')
  assert.ok(catalog.length >= 85)
  assert.ok(new Set(catalog.map(item => item.category)).size >= 9)
  assert.ok(new Set(catalog.map(item => item.kind)).size >= 6)
  for (const category of ['Shapes','Graphics','Animations','Icons','Frames','Grids','Charts','Tables','Social']) assert.ok(catalog.some(item => item.category === category))
  assert.ok(catalog.filter(item => item.category === 'Social').every(item => item.library || item.icon === 'share-2'))
  assert.ok(catalog.filter(item => item.category === 'Animations').every(item => ['float','pulse','spin','bounce'].includes(item.animation)))

  const addVisual = studio.slice(studio.indexOf('function studioAddVisualElement'), studio.indexOf('window.studioAddVisualElement'))
  assert.match(addVisual, /studioIconUrl\(item\.icon, item\.library \|\| 'lucide', item\.color \|\| '#2563EB'\)/)
  assert.match(addVisual, /adapter\.setSelectedAnimation\(item\.animation\)/)
  assert.match(addVisual, /new window\.fabric\.ActiveSelection/)
  assert.match(addVisual, /adapter\.addShape/)
  assert.match(studio, /Visual building blocks for the canvas/)
})

test('large creative catalogs progressively render and expose visual categories', () => {
  assert.match(studio, /new IntersectionObserver/)
  assert.match(studio, /data-studio-lazy=/)
  assert.match(studio, /root: sentinel\.closest\('\.studio-catalog-scroll'\)/)
  assert.match(studio, /loading="lazy" decoding="async"/)
  assert.match(studio, /Browse categories/)
  assert.match(studio, /Search fonts and combinations/)
  assert.match(theme, /\.studio-element-categories \{ display:grid;/)
  assert.match(theme, /\.studio-element-library \{ display:grid; grid-template-columns:repeat\(3/)
  assert.match(theme, /\.dark #ms-studio-master-modal \.studio-visual-element-preview/)
  assert.match(theme, /\.studio-icon-categories,[\s\S]*overflow-x:auto/)
  assert.match(theme, /\.studio-text-template-library \{ display:grid;/)
})
