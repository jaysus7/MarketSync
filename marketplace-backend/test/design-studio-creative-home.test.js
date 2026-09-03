import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const shellUrl = new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url)
const shell = readFileSync(shellUrl, 'utf8')

test('blank Design Studio launches open the creative home before the editor', () => {
  const open = shell.match(/window\.openMarketSyncStudio = async function[\s\S]*?\n};/)?.[0] || ''
  assert.match(open, /!designId && !initialOptions\.bypassHome/)
  assert.match(open, /await renderStudioHome\(modal\)/)
  assert.match(shell, /What will you design today\?/)
  assert.match(shell, /Projects & folders/)
  assert.match(shell, /Coordinated collections/)
})

test('create design is size-first and exposes social, stationery, presentation and digital formats', () => {
  assert.match(shell, /function openStudioSizePicker\(mode = 'new'\)/)
  assert.match(shell, /Choose a design size/)
  assert.match(shell, /Print & stationery/)
  assert.match(shell, /Presentations/)
  assert.match(shell, /Digital marketing/)
  assert.match(shell, /startStudioBlankDesign\(formatKey\)/)
  assert.match(shell, /customWidth: width, customHeight: height/)
})

test('editor template cards are constrained to exact active canvas dimensions', () => {
  const fit = shell.match(/function studioTemplateFitsCanvas[\s\S]*?\n}/)?.[0] || ''
  const cards = shell.match(/function renderStudioTemplateCards[\s\S]*?\n}/)?.[0] || ''
  assert.match(fit, /size\.width === canvas\.width && size\.height === canvas\.height/)
  assert.match(cards, /studioTemplateFitsCanvas\(t, canvas\)/)
  assert.doesNotMatch(cards, /filter === 'all'/)
  assert.match(shell, /Only templates that exactly fit the active canvas are shown/)
})

test('creative home ships coordinated editable sets across every supported size', () => {
  const context = { console, setTimeout, clearTimeout, URL }
  context.window = context
  context.globalThis = context
  vm.createContext(context)
  vm.runInContext(`${shell}\n;globalThis.__catalogProof = { formats: Object.keys(STUDIO_SOCIAL_FORMATS), sets: STUDIO_DESIGN_SETS.map(set => set.id), setTemplates: Object.values(STUDIO_TEMPLATES_CATALOG).filter(template => template.design_set), printTemplates: Object.values(STUDIO_TEMPLATES_CATALOG).filter(template => template.design_set && ['business_card','letterhead','postcard','flyer','brochure'].includes(template.format_key)) };`, context)
  const proof = context.__catalogProof
  assert.equal(proof.formats.length, 23)
  assert.equal(proof.sets.length, 4)
  assert.equal(proof.setTemplates.length, 92)
  assert.equal(proof.printTemplates.length, 20)
  assert.ok(proof.setTemplates.every(template => template.scene && Array.isArray(template.scene.elements) && template.scene.elements.length >= 6))
  assert.ok(proof.setTemplates.filter(template => template.format_key === 'business_card').every(template => template.scene.pages.length === 2))
  assert.ok(proof.setTemplates.filter(template => template.format_key === 'presentation').every(template => template.scene.pages.length === 3))
})

test('creative home projects and folders use the canonical tenant APIs', () => {
  assert.match(shell, /apiGetJson\('\/marketing\/studio\/designs'\)/)
  assert.match(shell, /apiGetJson\('\/marketing\/studio\/folders'\)/)
  assert.match(shell, /apiSendJson\('\/marketing\/studio\/folders', 'POST'/)
  assert.doesNotMatch(shell, /studio_projects/)
})
