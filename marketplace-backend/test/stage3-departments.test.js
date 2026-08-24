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
const vr = read('js/modules/vehicle-record.js')
// These files legitimately *describe* boundaries they must not cross, so every
// behavioural assertion runs against executable source, never the prose.
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
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

  test(`${name} tabs are role-aware and open on the approved primary view`, () => {
    const block = src.match(/get tabOrder\(\)\s*\{[\s\S]*?\n  \},/)?.[0] || ''
    assert.ok(block, `${name} tabOrder must be role-aware`)
    // Inventory is intentionally list-first; Intelligence is composed inside its My Day.
    // F&I remains My Day-first — and My Day/Pulse is now its ONLY non-manager tab, since
    // Deals folded in rather than staying a second tab. Pin the approved lead without
    // constraining later tabs.
    const expectedLead = name === 'Inventory' ? /\['work', 'overview'/ : /\['overview'/
    assert.match(block, expectedLead, `${name}: a non-manager opens on the approved primary view`)
    assert.match(src, /tabLabels:\s*\{\s*overview:\s*'(?:My Day|Pulse)'/, `${name} overview tab must read "My Day" or "Pulse"`)
  })

  test(`${name} My Day is attention-first`, () => {
    assert.match(src, /Needs attention/, `${name} must lead with a needs-attention queue`)
    assert.match(src, /function (inv|fni)Attention/, `${name} must derive its attention queue`)
    assert.match(src, /salesAttentionRow/, `${name} should reuse the Sales attention row renderer`)
  })

  test(`${name} adds no new endpoints`, () => {
    // /gamification is the same cross-department leaderboard endpoint the platform's own
    // Performance/Leaderboard page already reads — F&I's Pulse leaderboard card reuses it.
    const KNOWN = ['/inventory', '/recon', '/ai/appraisals', '/fni/deals', '/fni/products', '/delivery/queue', '/fni/funding', '/fni/lenders', '/gamification']
    for (const c of [...src.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])) {
      assert.ok(KNOWN.includes(c), `${name} must not introduce a new endpoint: ${c}`)
    }
    // Stage 3B: the workspace now performs canonical transitions, so writes ARE
    // allowed — but only through the Stage 3A endpoints, never by mutating local
    // state. Every write target is checked against that closed list.
    const WRITES = ['/inventory/${id}/take-possession', '/fni/deals/${dealId}/funding',
                    '/fni/deals/${dealId}/lender-decisions/${decisionId}/select']
    for (const w of [...src.matchAll(/apiSendJson\(`([^`]+)`/g)].map(m => m[1])) {
      assert.ok(WRITES.some(k => w.replace(/\$\{[^}]+\}/g, '${id}') === k.replace(/\$\{[^}]+\}/g, '${id}')),
        `${name} may only write through a canonical Stage 3A endpoint, got: ${w}`)
    }
  })

  test(`${name} landing payload is one parallel round-trip`, () => {
    const f = src.match(/fetch: async \(\) => \{[\s\S]*?\n  \},/)?.[0] || ''
    // A workspace that reads more than one endpoint must fan them out in parallel (no
    // waterfall). Inventory now reads inventory only (recon moved to the Cleanup
    // department), so a single awaited call is correct and needs no Promise.all.
    const calls = (f.match(/apiGetJson\(/g) || []).length
    if (calls > 1) assert.match(f, /Promise\.all/, `${name} landing data must load in parallel`)
    else assert.ok(calls <= 1, `${name} single-endpoint landing needs no parallel fetch`)
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
  // Acquisition/Merchandising/Pricing are sections of Pulse (overview); the work tab is
  // the vehicle list itself. Cleanup/reconditioning is its OWN department, never a
  // section of Inventory — so the work tab covers Vehicles and nothing else moved out.
  const fn = code(inv.slice(inv.indexOf('async function invRenderWork'), inv.indexOf("ENGINES['inventory-overview']")))
  for (const heading of ['Vehicles']) {
    assert.ok(fn.includes(heading), `Inventory (work tab) must still cover ${heading}`)
  }
  for (const heading of ['Acquisition', 'Merchandising', 'Pricing and age', 'Cleanup', 'Reconditioning']) {
    assert.ok(!fn.includes(heading), `${heading} must not render in the Inventory list tab`)
  }
  const engineBlock = inv.slice(inv.indexOf("ENGINES['inventory-overview']"))
  for (const heading of ['Acquisition', 'Merchandising', 'Pricing and age']) {
    assert.ok(engineBlock.includes(heading), `Pulse (overview) must cover ${heading}`)
  }
  assert.match(fn, /engMountPage\(body, 'inventory'/, 'adding and removing vehicles happens here')
  assert.doesNotMatch(inv, /INV_WORK_VIEWS|__invWorkView/, 'the sub-nav must not come back')
  // Facebook publishing is a marketing channel and now lives under Marketing. It must not be
  // stranded — the registry keeps it reachable — but it is no longer an Inventory view.
  assert.ok(!fn.includes("'syndication'"), 'Facebook publishing belongs to Marketing')
  const reg = read('js/modules/workspace-registry.js')
  assert.match(reg, /marketing:[\s\S]*?invmode: 'facebook'/, 'and it must still be reachable from Marketing')
})

// ── Stage 3B.2 — Acquisition, Merchandising, Vehicle Record ──────────────────

test('Acquisition groups the intake pipeline in the order a unit arrives', () => {
  const src = code(inv)
  assert.match(src, /function invRenderAcquisition/, 'Acquisition must be a composed view, not a flat list')
  for (const step of ['1 · Appraised', '2 · Awaiting possession — purchased',
                      '2 · Awaiting possession — customer trade', '3 · In your possession']) {
    assert.ok(src.includes(step), `Acquisition must group by pipeline step: ${step}`)
  }
  // The split exists because the two halves have different canonical transitions.
  // Each group may only offer the action that belongs to it.
  assert.match(src, /nonTrade = awaiting\.filter\(invCanTakePossession\)/,
    'the purchased group must be exactly the units eligible for POST /inventory/:id/take-possession')
  assert.match(src, /tradeAwaiting = awaiting\.filter\(v => v\.source_appraisal_id\)/,
    'the trade group must be exactly the units that came from a Sales appraisal')
  assert.match(src, /label: 'Open Appraisal'[\s\S]{0,120}switchPage\('appraisal'\)/,
    'a trade awaiting possession must be routed to its appraisal, never to the generic endpoint')
})

test('acquisition channel is derived, never stored a second time', () => {
  const src = code(inv)
  assert.match(src, /function invAcqChannel\(v\) \{ return v\.source_appraisal_id \? 'trade' : \(v\.source_url \? 'feed' : 'purchased'\); \}/,
    'the channel must be derived from fields the vehicle already carries')
  assert.doesNotMatch(src, /acquisition_channel|acq_channel/,
    'Stage 3B.2 must not invent a persisted acquisition-channel field')
})

test('Merchandising is scored off the canonical vehicle record', () => {
  const src = code(inv)
  const block = src.match(/function invMerchChecks[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(block, 'Inventory must own one merchandising definition')
  for (const key of ['photos', 'price', 'description', 'sticker', 'pitch']) {
    assert.ok(block.includes(`key: '${key}'`), `merchandising must check ${key}`)
  }
  // Every check reads a field that already exists on the vehicle.
  for (const field of ['image_urls', 'v.price', 'v.description', 'window_sticker_url', 'sales_pitch']) {
    assert.ok(src.includes(field), `merchandising must read the canonical field ${field}`)
  }
  assert.match(src, /function invRenderMerch/, 'Merchandising must be its own Work view')
  assert.match(src, /filter\(v => !v\.awaiting_possession\)/,
    'a unit we do not physically have is an Acquisition problem, not a merchandising one')
})

test('the merchandising definition exists once and is reused', () => {
  assert.match(code(vr), /invMerchChecks\(v\)/, 'the Vehicle Record must reuse Inventory’s checks')
  assert.doesNotMatch(code(vr), /function invMerchChecks|function invMerchGaps/,
    'the Vehicle Record must not redefine merchandising and drift from Inventory')
})

test('every vehicle row opens the Vehicle Record', () => {
  assert.match(code(inv), /function invRow\(v, d, sub\)/, 'rows must accept the context that varies per view')
  assert.match(code(inv), /onclick="vehicleOpen\('\$\{v\.id\}'\)"/, 'a vehicle row must open its record')
})

test('Inventory does not render Cleanup / reconditioning — it is its own department', () => {
  const src = code(inv)
  // Regression for the nav simplification that left recon rendering inside Inventory.
  // Cleanup owns reconditioning (workspace-registry.js `cleanup` → recon page); Inventory
  // must not fetch it, derive it, render it, or navigate into it.
  assert.doesNotMatch(src, /apiGetJson\('\/recon'\)/, 'Inventory must not fetch recon data — the Cleanup department owns it')
  assert.doesNotMatch(src, /switchPage\('recon'\)/, 'Inventory must not link into the recon/Cleanup board')
  assert.doesNotMatch(src, /Open Recon|Open Cleanup|In recon|Reconditioning|Cleanup/, 'Inventory must not render Cleanup navigation, cards or submenu items')
  assert.doesNotMatch(src, /invReconOf|reconByInv/, 'Inventory must not derive per-vehicle recon state')
})

test('Vehicle Record is one surface over records that already exist', () => {
  const src = code(vr)
  assert.match(src, /window\.vehicleOpen = vehicleOpen/, 'the record must be openable from anywhere')
  // Reads a closed list of existing endpoints, and writes nothing of its own.
  const gets = [...src.matchAll(/apiGetJson\([`']([^`'?]+)/g)].map(m => m[1])
  const KNOWN = ['/inventory/${id}', '/recon', '/fni/deals']
  for (const g of gets) assert.ok(KNOWN.includes(g), `Vehicle Record must not introduce an endpoint: ${g}`)
  assert.doesNotMatch(src, /apiSendJson/, 'the Vehicle Record must not write directly — it delegates')
  assert.match(src, /await invTakePossession\(id\)/,
    'possession must go through the ONE canonical producer path')
  // Match construction CALLS, not prose — the copy on this surface legitimately
  // talks about vehicles and deals.
  assert.doesNotMatch(src, /\b(createVehicle|createDeal|createAppraisal)\s*\(|new\s+(Vehicle|Deal|Appraisal)\s*\(|vehicles\.push\s*\(/,
    'the Vehicle Record must not create a second vehicle, appraisal or deal')
  assert.doesNotMatch(src, /journal|postToAccounting/i, 'the Vehicle Record must not contain accounting logic')
})

test('Vehicle Record shows the whole lifecycle of one unit', () => {
  for (const section of ['Acquisition', 'Recon', 'Merchandising', 'Pricing', 'Deal & delivery']) {
    assert.ok(vr.includes(`vrSection('${section}'`), `the record must include the ${section} section`)
  }
  // It reuses the engines that own each step rather than reimplementing them.
  assert.match(code(vr), /openVehicleForm\(v\)/, 'editing must reuse the existing vehicle form')
  assert.match(code(vr), /openVehicleHistory\(/, 'history must reuse the existing report surface')
  assert.match(code(vr), /openDeskForContact\('\$\{x\.contact_id\}'\)/, 'desking must reuse the existing implementation')
  assert.doesNotMatch(code(vr), /function (loadReconPage|loadInventoryPage|renderEngine|engCard)\b/,
    'the record must not redefine a shared primitive or another engine')
})

test('Vehicle Record degrades honestly when a section belongs to another department', () => {
  const src = code(vr)
  // A rep without F&I permission gets a 403 on /fni/deals. That section is then
  // absent and SAID to be absent — never faked, never guessed from other fields.
  assert.match(src, /apiGetJson\('\/fni\/deals'\)[\s\S]{0,80}catch\(\(\) => null\)/,
    'optional context must fail soft')
  assert.match(src, /dealsVisible/, 'the record must distinguish "no access" from "no deal"')
  assert.ok(vr.includes("No open deal on this vehicle"), 'no deal must be stated plainly')
  assert.ok(vr.includes("you don&#39;t have access to it") || vr.includes("you don't have access to it"),
    'no access must be stated plainly rather than rendered as an empty section')
})

test('Vehicle Record is wired into the shell after the department that feeds it', () => {
  const pos = (f) => html.indexOf(`<script src="js/modules/${f}`)
  assert.ok(pos('vehicle-record.js') > pos('inventory-workspace.js'),
    'vehicle-record.js must load after inventory-workspace.js')
  assert.ok(pos('inventory-workspace.js') > pos('dashboard-part26.js'),
    'the workspace modules must load after the dashboard parts')
})

test('F&I Deals is the deals it still owns; the rest moved to where the work happens', () => {
  // Deals is no longer a separate tab — its content is folded into overview()
  // (Pulse) itself, one F&I header instead of two.
  const views = fni.slice(fni.indexOf("overview(body, d) {"), fni.indexOf('insights(body, d)'))
  assert.ok(views.includes('In progress'), 'the deals list must remain')
  assert.match(views, /engMountPage\(body, 'fni'/, 'the deals page itself belongs in Pulse, not behind a link')
  // Credit and Menu are things you do ON a deal — the credit application opens from the deal
  // and the menu is part of desking one — so a department-level browse list of each was a
  // second way in to work that already has a home.
  for (const gone of ['credit', 'menu']) {
    assert.ok(!views.includes(`'${gone}'`), `${gone} belongs on the deal, not as a department view`)
  }
  // Contracts and Funding moved UP into My Day: both are "what is outstanding today".
  for (const gone of ['contracts', 'funding']) {
    assert.ok(!views.includes(`'${gone}'`), `${gone} belongs in My Day`)
  }
  assert.match(fni, /function fniContractsAndFunding/, 'and they must actually render there')
  assert.match(fni, /Contracts outstanding/)
  assert.match(fni, /Awaiting funding/)
})

// ── Handoffs: the same record continues, nothing is copied ───────────────────

test('Sales → Inventory handoff uses the same appraisal record', () => {
  // inventory.source_appraisal_id is the Sales trade/appraisal this vehicle came
  // from. Surfacing it is what makes the handoff visible and verifiable.
  assert.match(inv, /source_appraisal_id/, 'Inventory must surface the originating Sales appraisal')
  assert.match(inv, /from Sales appraisal/, 'the handoff must be visible to the user')
  assert.doesNotMatch(inv, /appraisals\.push|createAppraisal|new Appraisal/i, 'must not create a second appraisal')
})

test('Reconditioning lives in the Cleanup department, not reimplemented in Inventory', () => {
  // The canonical recon board is loadReconPage (dashboard-part15.js), reached through the
  // `cleanup` workspace. Inventory neither reimplements it nor reaches into it.
  assert.doesNotMatch(code(inv), /function loadReconPage\b/, 'Inventory must not reimplement recon')
  const reg = read('js/modules/workspace-registry.js')
  assert.match(reg, /cleanup:\s*\{[\s\S]*?page:\s*'recon'/, 'Cleanup department must own the recon page')
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
  // Funding state is canonical now, so the Funding view reads /fni/funding rather
  // than inferring from the delivery queue — but F&I still must not own the ledger.
  assert.match(fni, /apiGetJson\('\/fni\/funding'\)/, 'funding must read canonical state')
  // Check CODE, not prose — these files legitimately *describe* the accounting boundary.
  const fniCode = fni.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(fniCode, /journal|postToAccounting|contracts_in_transit/i,
    'F&I must not contain accounting logic')
  assert.match(fni, /Contracts in Transit from that event/,
    'the accounting boundary must be documented at the call site')
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
  assert.match(invBlock, /\{ page: 'inventory-overview', label: '(?:My Day|Pulse)' \}/, 'Inventory must lead with My Day or Pulse')
  assert.match(fniBlock, /\{ page: 'fni-overview', label: '(?:My Day|Pulse)' \}/, 'F&I must lead with My Day or Pulse')
  // Existing pages stay reachable — Stage 3 deletes nothing.
  for (const p of ['inventory', 'equity', 'inv-intel', 'market']) {
    assert.ok(invBlock.includes(`page: '${p}'`), `Inventory page "${p}" must stay reachable`)
  }
  for (const p of ['fni', 'delivery']) {
    assert.ok(fniBlock.includes(`page: '${p}'`), `F&I page "${p}" must stay reachable`)
  }
})
