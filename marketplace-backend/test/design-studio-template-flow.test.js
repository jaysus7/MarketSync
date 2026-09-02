import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../routes/marketing-studio.js', import.meta.url), 'utf8')

test('Design Studio exposes the exact six workspace tabs over the canonical canvas', () => {
  const declaration = shell.match(/const DESIGN_STUDIO_TABS = \[([\s\S]*?)\n\];/)?.[1] || ''
  assert.deepEqual([...declaration.matchAll(/\['([^']+)', '([^']+)'/g)].map(match => match[2]), [
    'Create', 'Templates', 'Projects', 'Brand', 'Media', 'Inventory',
  ])
  assert.match(shell, /role="tablist" aria-label="Design Studio"/)
  assert.match(shell, /setDesignStudioTab\('\$\{id\}'\)/)
})

test('tenant and stock templates load through the existing protected endpoint', () => {
  assert.match(shell, /apiGetJson\('\/marketing\/studio\/templates'\)/)
  assert.match(routes, /app\.get\('\/marketing\/studio\/templates', requireAuth, requireMfa, canView/)
  const endpoint = routes.slice(routes.indexOf("app.get('/marketing/studio/templates'"), routes.indexOf('// ── GIF Search Proxy'))
  assert.match(endpoint, /dealership_id\.eq\.\$\{req\.dealershipId\}/)
  assert.match(endpoint, /STOCK_STUDIO_TEMPLATES/)
  assert.doesNotMatch(endpoint, /GLOBAL_TEMPLATES/)
})

test('template cards preview before applying to the editable scene', () => {
  const cards = shell.match(/function renderStudioTemplateCards[\s\S]*?\n\}/)?.[0] || ''
  assert.match(cards, /previewStudioTemplate/)
  assert.doesNotMatch(cards, /onclick="loadStudioTemplate/)
  assert.match(shell, /Use this template/)
  assert.match(shell, /async function applyStudioTemplate/)
  assert.match(shell, /await loadStudioTemplate\(templateKey\)/)
  assert.match(shell, /__studioAdapter\.renderScene\(boundScene\)/)
  assert.match(shell, /__msStudioStore\?\.update\(documentScene\)/)
})

test('applied templates persist their canonical source and remain editable projects', () => {
  const save = shell.match(/async function saveStudioDesign\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(save, /source_template_key/)
  assert.match(save, /template_id: templateId/)
  assert.match(save, /\/marketing\/studio\/designs/)
  assert.match(shell, /apiGetJson\('\/marketing\/studio\/designs'\)/)
  assert.match(shell, /openStudioProject/)
  assert.match(shell, /window\.openMarketSyncStudio\(designId, \{ tab: 'create' \}\)/)
})
