import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '../..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

function loadSchema() {
  const context = { window: {}, globalThis: {}, crypto: { randomUUID: () => 'uuid' }, structuredClone, Date, Math, JSON, Number, String, Array, Object, Set }
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(read('marketplace-frontend/js/design-studio/state/document-schema.js'), context)
  return context.window.msDesignStudioSchema
}

test('Magic Resize creates editable semantic variations without stretching the source', () => {
  const schema = loadSchema()
  const source = { id: 'source', version: 3, width: 1080, height: 1080, format_key: 'square', background: { color: '#fff' }, elements: [
    { id: 'bg', type: 'shape', name: 'Background', x: 0, y: 0, width: 1080, height: 1080 },
    { id: 'title', type: 'text', name: 'Headline', x: 40, y: 60, width: 800, height: 100, fontSize: 64, text: 'Weekend sale' },
    { id: 'photo', type: 'vehicle-image', name: 'Vehicle Photo', x: 40, y: 200, width: 1000, height: 600 },
    { id: 'legal', type: 'text', name: 'Legal disclaimer', x: 40, y: 1000, width: 1000, height: 30, text: 'Terms apply' },
  ] }
  const [story, banner] = schema.createVariations(source, ['story', 'website_banner'])
  assert.deepEqual([story.width, story.height], [1080, 1920])
  assert.deepEqual([banner.width, banner.height], [1920, 720])
  assert.equal(story.variation_of, 'source')
  assert.equal(story.objects.find(object => object.id === 'bg').height, 1920)
  assert.ok(story.objects.find(object => object.id === 'photo').y > story.objects.find(object => object.id === 'title').y)
  assert.ok(banner.objects.find(object => object.id === 'photo').x > banner.width / 2)
})

test('inventory binding uses canonical values and never supplies fake vehicle facts', () => {
  const schema = loadSchema()
  const scene = { elements: [
    { type: 'text', text: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}', binding: { template: '{{vehicle.year}} {{vehicle.make}} {{vehicle.model}}' } },
    { type: 'text', text: '{{vehicle.sale_price|Contact dealer}}', binding: { template: '{{vehicle.sale_price|Contact dealer}}' } },
  ] }
  const empty = schema.refreshBindings(scene, { vehicle: {} })
  assert.equal(empty.elements[0].text.trim(), '')
  assert.equal(empty.elements[1].text, 'Contact dealer')
  const bound = schema.refreshBindings(scene, { vehicle: { year: 2027, make: 'GMC', model: 'Sierra', sale_price: 74995 } })
  assert.equal(bound.elements[0].text, '2027 GMC Sierra')
  assert.equal(bound.elements[1].text, '$74,995')
})

test('automotive template library includes every required category and remains editable', () => {
  const schema = loadSchema()
  const names = new Set(schema.automotiveTemplates.map(template => template.name))
  for (const required of ['New Arrival','Incoming Vehicle','Finance Rate','EV Event','Oil Change','Collision','Employee Spotlight','Brand Awareness']) assert.ok(names.has(required), required)
  assert.ok(schema.automotiveTemplates.length >= 45)
  assert.ok(schema.automotiveTemplates.every(template => template.editable && template.scene.elements.length >= 8))
})

test('AI layouts use protected placeholders and bind facts locally', () => {
  const route = read('marketplace-backend/routes/submodules/ai-design-studio.js')
  assert.match(route, /facts_bound_locally: true/)
  assert.match(route, /studioFactualTemplateText/)
  assert.match(route, /\{\{vehicle\.sale_price\}\}/)
  assert.doesNotMatch(route, /JSON\.stringify\((?:inventory|vehicle|dealership|facts)\)/)
  const frontend = read('marketplace-frontend/js/modules/studio/studio-shell.js')
  assert.match(frontend, /refreshBindings\(response\.scene, studioDesignContext\(vehicle\)\)/)
})

test('Brand Kit, collaboration, approvals, governance, image controls, exports, and mobile editor are wired through existing systems', () => {
  const backend = read('marketplace-backend/routes/marketing-studio.js')
  const migration = read('supabase/migrations/20260830143000_design_studio_professional_workflows.sql')
  const adapter = read('marketplace-frontend/js/modules/studio/fabric-adapter.js')
  const shell = read('marketplace-frontend/js/modules/studio/studio-shell.js')
  const css = read('marketplace-frontend/css/marketsync-theme.css')
  for (const route of ['/marketing/studio/brand-kit', '/collaboration', '/approval-requests', '/decision', '/marketing/studio/template-governance']) assert.ok(backend.includes(route), route)
  for (const table of ['studio_design_comments','studio_design_approvals','studio_template_governance']) assert.ok(migration.includes(table), table)
  for (const method of ['toggleSelectedLock','toggleSelectedVisibility','alignSelected','distributeSelected','adjustSelectedImage']) assert.ok(adapter.includes(method), method)
  for (const format of ["exportStudioFile('png')", "exportStudioFile('jpeg')", "exportStudioFile('transparent')"]) assert.ok(shell.includes(format), format)
  assert.match(css, /@media \(max-width: 768px\)/)
  assert.match(css, /ms-studio-mobile-open/)
  assert.match(adapter, /allowTouchScrolling: false/)
  assert.match(adapter, /enablePointerEvents: true/)
  assert.match(adapter, /upperCanvasEl\.style\.touchAction = 'none'/)
  assert.match(adapter, /scene = this\.normalizeScene\(scene\)/)
})

test('old demo vehicle fallback records are removed from Design Studio', () => {
  const shell = read('marketplace-frontend/js/modules/studio/studio-shell.js')
  assert.doesNotMatch(shell, /demo_v1|F-150 Lariat|F9041/)
  assert.match(shell, /apiGetJson\('\/inventory'\)/)
})

test('creative presets and social copy do not ship invented prices, rates, reviews, warranties, or approval promises', () => {
  const shell = read('marketplace-frontend/js/modules/studio/studio-shell.js')
  const scheduler = read('marketplace-frontend/js/modules/studio/studio-scheduler.js')
  for (const unsafe of ['$29,995', '$499 / MONTH', '9.99% APR', '4.9 ★ VERIFIED REVIEWS', '100% GUARANTEE', '2-MIN PRE-APPROVAL']) assert.equal(shell.includes(unsafe), false, unsafe)
  assert.doesNotMatch(scheduler, /instant financing approvals|warranty included|great finance rates|pre-approved in minutes/i)
})
