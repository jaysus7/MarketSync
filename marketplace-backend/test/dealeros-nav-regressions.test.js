import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { featuresForPlan } from '../plan-catalog.js'

// Regression coverage for three DealerOS navigation/workspace regressions:
//   1. Cleanup must not live inside Inventory (its own department).
//   2. Service must be a first-class DealerOS department, wired to its canonical workspace.
//   3. Appraise a Car must use a clear, responsive multi-column card layout.
// Plus structural guards against duplicate department ids / canonical routes.

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const registrySrc = read('js/modules/workspace-registry.js')
const part2 = read('js/modules/dashboard-part2.js')
const html = read('dashboard.html')
const serviceWs = read('js/modules/service-workspace.js')
const inventoryWs = read('js/modules/inventory-workspace.js')

function loadRegistry() {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(registrySrc, ctx)
  const w = ctx.window
  const clone = (v) => JSON.parse(JSON.stringify(v))   // re-home vm objects into this realm
  return {
    MS_WORKSPACES: clone(w.MS_WORKSPACES),
    msDepartmentIds: (r) => clone(w.msDepartmentIds(r)),
  }
}

// ── Root architecture: one registry, one canonical page per department ───────

test('MS_WORKSPACES has the intended DealerOS departments, each with a unique id', () => {
  const { MS_WORKSPACES, msDepartmentIds } = loadRegistry()
  // Object keys are inherently unique; assert the department ids are the expected set
  // (no accidental duplicate/alternate department registry sneaking a second copy in).
  const depts = msDepartmentIds(MS_WORKSPACES)
  for (const id of ['executive', 'sales', 'inventory', 'cleanup', 'fni', 'service', 'parts', 'accounting', 'marketing'])
    assert.ok(depts.includes(id), `department "${id}" must exist in the registry`)
  assert.equal(new Set(depts).size, depts.length, 'department ids must be unique')
})

test('no canonical (non-legacy) route is claimed by two departments', () => {
  const { MS_WORKSPACES } = loadRegistry()
  const owner = {}
  for (const [dept, w] of Object.entries(MS_WORKSPACES)) {
    for (const p of w.pages || []) {
      if (p.legacy) continue                       // legacy entries are deep-link aliases, not canonical tabs
      const key = `${p.page}${p.invmode ? ':' + p.invmode : ''}${p.tab ? '#' + p.tab : ''}`
      assert.ok(!owner[key], `canonical route "${key}" is claimed by both ${owner[key]} and ${dept}`)
      owner[key] = dept
    }
  }
})

// ── #1 — Cleanup is its own department, not part of Inventory ────────────────

test('Cleanup is its own department owning the recon page', () => {
  const { MS_WORKSPACES } = loadRegistry()
  assert.ok(MS_WORKSPACES.cleanup, 'cleanup must be a top-level department')
  assert.deepEqual(MS_WORKSPACES.cleanup.pages.map(p => p.page), ['recon'])
  assert.equal(MS_WORKSPACES.cleanup.pages[0].legacy, undefined, 'recon must be a real Cleanup tab, not a deep-link')
})

test('Inventory department carries no Cleanup / recon page', () => {
  const { MS_WORKSPACES } = loadRegistry()
  const invPages = MS_WORKSPACES.inventory.pages.map(p => p.page)
  assert.ok(!invPages.includes('recon'), 'Inventory must not list the recon page')
})

test('Inventory workspace renders no Cleanup navigation, cards or fetches', () => {
  const src = stripComments(inventoryWs)
  assert.doesNotMatch(src, /apiGetJson\('\/recon'\)/, 'Inventory must not fetch recon data')
  assert.doesNotMatch(src, /switchPage\('recon'\)/, 'Inventory must not navigate into the recon/Cleanup board')
  assert.doesNotMatch(src, /Open Recon|Open Cleanup|In recon|Reconditioning|Cleanup/, 'Inventory must not render Cleanup nav/cards/submenu items')
})

test('the canonical recon board lives once, in the Cleanup workspace', () => {
  const part15 = read('js/modules/dashboard-part15.js')
  assert.match(part15, /function loadReconPage\(/, 'loadReconPage is the one canonical recon board')
  assert.doesNotMatch(stripComments(inventoryWs), /function loadReconPage\b/, 'Inventory must not reimplement it')
})

// ── #2 — Service is a first-class DealerOS department wired to its workspace ──

test('Service is a first-class DealerOS department in the registry', () => {
  const { MS_WORKSPACES } = loadRegistry()
  assert.ok(MS_WORKSPACES.service, 'service department must exist')
  assert.equal(MS_WORKSPACES.service.label, 'Service')
  const pages = MS_WORKSPACES.service.pages.map(p => p.page)
  assert.ok(pages.includes('service-overview'), 'Service must expose its Pulse (service-overview)')
})

test('Service opens the canonical Service workspace, not a second implementation', () => {
  // One engine registration, in service-workspace.js; switchPage routes to it; the page
  // container and script are wired; aliases fold the sub-pages into the one canonical page.
  assert.match(serviceWs, /ENGINES\['service-overview'\]\s*=/, 'canonical Service engine must be service-workspace.js')
  assert.equal((part2.match(/loadServiceWorkspace\(\)/g) || []).length >= 1, true, 'switchPage must load the Service workspace')
  assert.match(part2, /if \(pageId === 'service-overview'\) loadServiceWorkspace\(\)/, 'service-overview must route to loadServiceWorkspace')
  assert.match(part2, /pageId === 'service'.*pageId = 'service-overview'/, 'service/service-ros/service-appointments must fold into the one canonical page')
  assert.match(html, /data-page-content="service-overview"/, 'Service page container must exist')
  assert.match(html, /id="service-overview-root"/, 'Service engine root must exist')
  assert.match(html, /service-workspace\.js/, 'Service workspace script must be loaded')
  // Exactly one Service engine registration across the frontend modules.
  assert.equal((serviceWs.match(/ENGINES\['service-overview'\]\s*=/g) || []).length, 1, 'exactly one canonical Service engine')
})

test('Service is entitlement-gated: DealerOS Pro/Complete get it, Core does not', () => {
  assert.match(part2, /'service-overview': 'os\.service'/, 'Service Pulse must require the os.service entitlement')
  const core = new Set(featuresForPlan('dealer-os-core'))
  const pro = new Set(featuresForPlan('dealer-os-pro'))
  const complete = new Set(featuresForPlan('dealer-os-complete'))
  assert.ok(!core.has('os.service'), 'Core must NOT be entitled to Service')
  assert.ok(pro.has('os.service'), 'Pro must be entitled to Service')
  assert.ok(complete.has('os.service'), 'Complete must be entitled to Service')
})

test('Demo navigation lists both Service and Cleanup as departments', () => {
  const demo = read('js/modules/demo-control-panel.js')
  const list = demo.slice(demo.indexOf('const DEPARTMENTS'), demo.indexOf('];', demo.indexOf('const DEPARTMENTS')))
  assert.match(list, /label: 'Service'/, 'demo navigator must include Service')
  assert.match(list, /page: 'recon', label: 'Cleanup'/, 'demo navigator must include the Cleanup department')
})

test('Service does not leak to a standalone product that is not entitled', () => {
  // A pure Facebook AutoPoster / Design Studio standalone plan has no os.service.
  for (const plan of ['autoposter-dealer', 'design-studio']) {
    const f = new Set(featuresForPlan(plan))
    assert.ok(!f.has('os.service'), `${plan} must not receive Service`)
  }
})

// ── #3 — Appraise a Car uses a clear, responsive multi-column card layout ────

// Isolate the appraisal page-content block so assertions are scoped to it.
const apprBlock = (() => {
  const start = html.indexOf('data-page-content="appraisal"')
  const rest = html.slice(start)
  // up to the Deal Details section that follows the 3-column workflow
  const end = rest.indexOf('Deal Details:')
  return end > 0 ? rest.slice(0, end) : rest.slice(0, 6000)
})()

test('Appraise a Car uses three labelled workflow columns/cards', () => {
  for (const heading of ['Vehicle &amp; VIN', 'Condition &amp; Appraisal', 'Market &amp; Value']) {
    assert.ok(apprBlock.includes(heading), `appraisal workflow must have the "${heading}" column/card`)
  }
})

test('Appraisal workflow is responsive: one column on mobile, more on wider screens', () => {
  // A single responsive grid drives the columns — stacks on mobile, 2-up on tablet, 3-up on desktop.
  assert.match(apprBlock, /grid[^"]*md:grid-cols-2[^"]*xl:grid-cols-3/, 'workflow must stack 1→2→3 columns responsively')
  // No unrelated giant combined header row: actions live in their column, not one long row.
  assert.doesNotMatch(apprBlock, /grid-cols-2 sm:grid-cols-4/, 'inner field grids must not be squeezed to 4-up inside a narrow card')
})

test('Appraisal controls and their IDs are preserved (calculations/API/VIN/MarketCheck intact)', () => {
  for (const id of ['appr-vin', 'appr-decode', 'appr-year', 'appr-make', 'appr-model', 'appr-trim',
                    'appr-mileage', 'appr-condition', 'appr-recon', 'appr-gross', 'appr-book',
                    'appr-drivetrain', 'appr-radius', 'appr-accident', 'appr-run', 'appr-result']) {
    assert.ok(apprBlock.includes(`id="${id}"`), `appraisal control #${id} must be preserved`)
  }
  // The value output (MarketCheck comps / offer) is in the Market & Value column.
  const marketCol = apprBlock.slice(apprBlock.indexOf('Market &amp; Value'))
  assert.ok(marketCol.includes('id="appr-run"') && marketCol.includes('id="appr-result"'),
    'the Appraise action and its result must live in the Market & Value column')
})
