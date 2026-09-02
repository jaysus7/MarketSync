import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8')
const studio = read('marketplace-frontend/js/modules/studio/studio-shell.js')
const adapter = read('marketplace-frontend/js/modules/studio/fabric-adapter.js')
const schema = read('marketplace-frontend/js/design-studio/state/document-schema.js')
const css = read('marketplace-frontend/css/marketsync-theme.css')
const website = read('marketplace-frontend/js/modules/dashboard-part17.js')
const blueprint = read('render.yaml')

test('Studio primitives expose real colour, progressive icon, grouped text and grouped element controls', () => {
  assert.match(studio, /id="studio-shape-colour" type="color"/)
  assert.match(studio, /window\.__studioShapeColor/)
  assert.match(studio, /loadMoreStudioIcons/)
  assert.match(studio, /loading="lazy" decoding="async"/)
  assert.match(studio, /ungroup to edit both text layers/)
  assert.match(studio, /Grouped icon \+ title \+ supporting text/)
  assert.match(adapter, /this\.onSelectionChange\(\[shape\]\)/)
})

test('fonts use a grouped dropdown and the left rail and command bars scroll', () => {
  assert.match(studio, /<select id="studio-font-picker" onchange="studioPickFont\(this\.value\)"/)
  assert.match(studio, /<optgroup label=/)
  assert.match(css, /\[data-studio-region="rail"\][\s\S]*overflow-y: auto/)
  assert.match(css, /\.studio-command-scroll[\s\S]*overflow/)
  assert.match(css, /\.studio-primary-actions[\s\S]*overflow-x: auto/)
})

test('Studio has named social, presentation and print formats instead of square-only templates', () => {
  for (const key of ['letterhead','presentation','business_card','postcard','flyer','brochure']) {
    assert.match(studio, new RegExp(`${key}: \\{ label:`))
    assert.match(schema, new RegExp(`${key}: \\{ label:`))
  }
  for (const purpose of ['Instagram New Arrival Post','Facebook Trade-In Post','LinkedIn Team Spotlight','YouTube Vehicle Review Thumbnail','Dealership Letterhead','Sales Team Business Card']) assert.ok(studio.includes(purpose), purpose)
  assert.match(schema, /templateFormats = \['square','portrait','story','facebook_post','linkedin','x_landscape','youtube','pinterest','marketplace'\]/)
})

test('GIF providers are server-side configurable and the drawer loads GIPHY automatically', () => {
  assert.match(studio, /Powered by GIPHY/)
  assert.match(studio, /if \(tool === 'stickers'\) setTimeout\(searchStudioGifs, 0\)/)
  for (const key of ['GIPHY_API_KEY','TENOR_API_KEY','PEXELS_API_KEY']) assert.match(blueprint, new RegExp(`key: ${key}\\n\\s+sync: false`))
})

test('website templates open the real multi-page renderer and publish after selection', () => {
  assert.match(website, /function showWebsiteTemplateBrowser/)
  assert.match(website, /id="ws-template-preview-frame"/)
  assert.match(website, /type:'ms-preview-apply'/)
  assert.match(website, /data-width="768px"/)
  assert.match(website, /data-width="390px"/)
  assert.match(website, /const saved = await saveWebsite\(btn, 'publish'\)/)
  assert.doesNotMatch(website.slice(website.indexOf('async function applyCompleteTemplate'), website.indexOf('window.openTemplatePicker')), /saveWebsite\(btn, 'draft'\)/)
})

