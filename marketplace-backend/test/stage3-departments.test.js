import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Stage 3 — Inventory and F&I as coherent departments, plus the
// Sales → Inventory → F&I handoffs. These pin that Stage 3 followed the Sales
// pattern (docs/DEALER_OS_UX_ARCHITECTURE.md §11–12) rather than inventing a
// parallel architecture, and that no department duplicates a canonical record.

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')

const inv = read('js/modules/inventory-workspace.js')
const fni = read('js/modules/fni-workspace.js')
const html = read('dashboard.html')
const registry = read('js/modules/workspace-registry.js')
const part2 = read('js/modules/dashboard-part2.js')
const DEPTS = [['Inventory', inv, 'inventory-overview'], ['F&I', fni, 'fni-overview']]

for (const [name, src, id] of DEPTS) {
  test(`${name} registers on the shared engine shell`, () => {
    assert.match(src, new RegExp(`ENGINES\\['${id}'\\]\\s*=`), `${name} must use the shared ENGINES registry`)
    assert.match(src, new RegExp(`rootId:\\s*'${id}-root'`))
    for (const prim of ['engKpi', 'engCard', 'engEmpty']) assert.ok(src.includes(prim), `${name} must reuse ${prim}`)
    // No parallel abstraction for the old conceptual names.
    assert.doesNotMatch(src, /DepartmentShell|AttentionQueue|RecordWorkspace|DepartmentKPI|WorkflowBoard/,
      `${name} must not create components named after the old conceptual vocabulary`)
    assert.doesNotMatch(src, /function (engKpi|engCard|engEmpty|renderEngine|engineTab)\b/,
      `${name} must not redefine a shared primitive`)
  })

  test(`${name} tabs are role-aware and Today-first`, () => {
    const block = src.match(/get tabOrder\(\)\s*\{[\s\S]*?\n  \},/)?.[0] || ''
    assert.ok(block, `${name} tabOrder must be role-aware`)
    assert.match(block, /\['overview', 'work'\]/, `${name}: a non-manager sees Today | Work`)
    assert.match(src, /tabLabels:\s*\{\s*overview:\s*'Today'/, `${name} overview tab must read "Today"`)
  })

  test(`${name} Today is attention-first`, () => {
    assert.match(src, /Needs attention/, `${name} must lead with a needs-attention queue`)
    assert.match(src, /function (inv|fni)Attention/, `${name} must derive its attention queue`)
    assert.match(src, /salesAttentionRow/, `${name} should reuse the Sales attention row renderer`)
  })

  test(`${name} adds no new endpoints`, () => {
    const KNOWN = ['/inventory', '/recon', '/ai/appraisals', '/fni/deals', '/fni/products', '/delivery/queue']
    for (const c of [...src.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])) {
      assert.ok(KNOWN.includes(c), `${name} must not introduce a new endpoint: ${c}`)
    }
    assert.doesNotMatch(src, /apiSendJson\(/, `${name} workspace must delegate writes to existing pages`)
  })

  test(`${name} landing payload is one parallel round-trip`, () => {
    const f = src.match(/fetch: async \(\) => \{[\s\S]*?\n  \},/)?.[0] || ''
    assert.match(f, /Promise\.all/, `${name} landing data must load in parallel`)
  })

  test(`${name} is wired into the shell and the registry`, () => {
    assert.match(html, new RegExp(`data-page-content="${id}"`), `${name} page container must exist`)
    assert.match(html, new RegExp(`id="${id}-root"`))
    assert.match(part2, new RegExp(`if \\(pageId === '${id}'\\)`), `switchPage must load ${name}`)
    assert.match(part2, new RegExp(`'${id}': 'os\\.`), `${name} must carry an entitlement key`)
    const scriptPos = (f) => html.indexOf(`<script src="js/modules/${f}`)
    assert.ok(scriptPos(id.replace('-overview', '') + '-workspace.js') > scriptPos('dashboard-part26.js'),
      `${name} module must load after the dashboard parts`)
  })
}

test('Inventory Work exposes the vehicle lifecycle', () => {
  const views = inv.match(/const INV_WORK_VIEWS = \[[\s\S]*?\n\];/)?.[0] || ''
  for (const v of ['vehicles', 'acquire', 'recon', 'pricing', 'syndication']) {
    assert.ok(views.includes(`'${v}'`), `Inventory Work must include ${v}`)
  }
})

test('F&I Work exposes the deal lifecycle', () => {
  const views = fni.match(/const FNI_WORK_VIEWS = \[[\s\S]*?\n\];/)?.[0] || ''
  for (const v of ['deals', 'credit', 'products', 'contracts', 'delivery']) {
    assert.ok(views.includes(`'${v}'`), `F&I Work must include ${v}`)
  }
})

// ── Handoffs: the same record continues, nothing is copied ───────────────────

test('Sales → Inventory handoff uses the same appraisal record', () => {
  // inventory.source_appraisal_id is the Sales trade/appraisal this vehicle came
  // from. Surfacing it is what makes the handoff visible and verifiable.
  assert.match(inv, /source_appraisal_id/, 'Inventory must surface the originating Sales appraisal')
  assert.match(inv, /from Sales appraisal/, 'the handoff must be visible to the user')
  assert.doesNotMatch(inv, /appraisals\.push|createAppraisal|new Appraisal/i, 'must not create a second appraisal')
})

test('Inventory → recon → delivery handoff is surfaced, not reimplemented', () => {
  assert.match(inv, /r\.deal_id/, 'recon rows must show when a vehicle is already sold')
  assert.match(inv, /switchPage\('recon'\)/, 'Inventory must delegate to the existing recon board')
  assert.doesNotMatch(inv, /function loadReconPage\b/, 'must not reimplement recon')
})

test('Sales → F&I handoff keeps one customer, one vehicle, one deal', () => {
  // A deal carries contact_id + inventory_id: the same customer Sales worked and
  // the same vehicle Inventory acquired.
  assert.match(fni, /contact_id/, 'F&I must reference the canonical customer')
  assert.match(fni, /crmOpenForm\('\$\{x\.contact_id\}'\)/, 'opening the customer must reuse the CRM record')
  assert.match(fni, /openDeskForContact/, 'desking must reuse the existing implementation')
  assert.doesNotMatch(fni, /function (loadDeskDeal|loadFniPage)\b/, 'must not reimplement desking or the F&I page')
  assert.doesNotMatch(fni, /createContact|new Customer|duplicate/i, 'F&I must not create a second customer')
})

test('F&I does not reimplement delivery or accounting logic', () => {
  // It displays the blocker the delivery queue owns and deep-links to it.
  assert.match(fni, /blocker/, 'F&I must surface delivery blockers')
  assert.match(fni, /switchPage\('delivery'\)/, 'and deep-link to the owning queue')
  assert.doesNotMatch(fni, /journal|ledger|postToAccounting/i, 'F&I must not contain accounting logic')
})

test('no invented CRM lifecycle stages anywhere in Stage 3', () => {
  // Standing decision: Showed/Negotiating are NOT backend state.
  for (const [name, src] of [['Inventory', inv], ['F&I', fni]]) {
    assert.doesNotMatch(src, /'showed'|'negotiating'/i, `${name} must not invent CRM stages`)
  }
})

test('Stage 3 leaves the departments’ navigation coherent', () => {
  const block = (w) => registry.match(new RegExp(`\\n  ${w}: \\{[\\s\\S]*?\\n  \\},`))?.[0] || ''
  const invBlock = block('inventory'), fniBlock = block('fni')
  assert.match(invBlock, /\{ page: 'inventory-overview', label: 'Today' \}/, 'Inventory must lead with Today')
  assert.match(fniBlock, /\{ page: 'fni-overview', label: 'Today' \}/, 'F&I must lead with Today')
  // Existing pages stay reachable — Stage 3 deletes nothing.
  for (const p of ['inventory', 'appraisal', 'equity', 'recon', 'inv-intel', 'market']) {
    assert.ok(invBlock.includes(`page: '${p}'`), `Inventory page "${p}" must stay reachable`)
  }
  for (const p of ['fni', 'delivery']) {
    assert.ok(fniBlock.includes(`page: '${p}'`), `F&I page "${p}" must stay reachable`)
  }
})
