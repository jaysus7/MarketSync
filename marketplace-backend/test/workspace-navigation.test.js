import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Phase 1 DealerOS navigation guard. The workspace registry
// (marketplace-frontend/js/modules/workspace-registry.js) is the single source of
// truth for the desktop sidebar, the workspace tab-bar and the mobile bottom row.
// These tests pin the properties the reorganization must never break:
//   • every nav target resolves to a real page container (no dead links)
//   • no page lost relative to the pre-Phase-1 registry (no feature deletion)
//   • role + entitlement gating survives the regrouping
//   • restricted product tiers (Facebook / AI-only) keep their own flat nav
// See docs/DEALEROS_UI_AUDIT.md for the full mapping.

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')

// The registry is a browser script (flat global scope), so evaluate it in a VM
// with a window stub rather than importing it as a module.
// Values built inside a VM context carry that realm's prototypes, which strict
// deepEqual rejects. Clone data across the boundary so assertions compare plainly.
function loadRegistry() {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(read('js/modules/workspace-registry.js'), ctx)
  const w = ctx.window
  const clone = (v) => JSON.parse(JSON.stringify(v))
  return {
    MS_WORKSPACES: clone(w.MS_WORKSPACES),
    MS_SYSTEM_NAV: clone(w.MS_SYSTEM_NAV),
    MS_ROLE_MOBILE_NAV: clone(w.MS_ROLE_MOBILE_NAV),
    msAllWorkspacePages: (r) => clone(w.msAllWorkspacePages(r)),
    msWorkspaceOfPage: (p, r) => w.msWorkspaceOfPage(p, r),
    msMobileNavForRole: (role) => clone(w.msMobileNavForRole(role)),
    msDepartmentIds: (r) => clone(w.msDepartmentIds(r)),
  }
}

const html = read('dashboard.html')
const part2 = read('js/modules/dashboard-part2.js')
const pageContainers = new Set([...html.matchAll(/data-page-content="([^"]+)"/g)].map(m => m[1]))

// The nine target workspaces (project instructions §8 / Doc 21 §18).
const EXPECTED_WORKSPACES = [
  'executive', 'sales', 'inventory', 'fni', 'service', 'parts', 'accounting', 'marketing', 'people',
]

// Every page the PREVIOUS DEPARTMENTS registry could reach. Phase 1 is a
// reorganization: none of these may become unreachable.
const PRE_PHASE1_PAGES = [
  'accounting', 'ai-home', 'api-keys', 'appointments', 'appraisal', 'automation-builder',
  'command', 'config', 'crm', 'delivery', 'email-marketing', 'equity', 'fni', 'insights',
  'inv-intel', 'inventory', 'leaderboard', 'leads', 'market', 'operations', 'people-compliance',
  'recon', 'reports', 'sales-team', 'service-appointments', 'service-parts', 'service-ros',
  'taskboard', 'tasks', 'website',
]

test('registry exposes the nine DealerOS workspaces in workflow order', () => {
  const { MS_WORKSPACES, msDepartmentIds } = loadRegistry()
  assert.ok(MS_WORKSPACES, 'MS_WORKSPACES must be exported')
  assert.deepEqual(msDepartmentIds(MS_WORKSPACES), EXPECTED_WORKSPACES,
    'departments must be exactly the nine target workspaces, in order')
})

test('system engines are NOT primary departments', () => {
  const { msDepartmentIds, MS_WORKSPACES } = loadRegistry()
  // CRM, Automation, AI, Integrations, Analytics, Marketplace power the workspaces
  // underneath — an employee must never navigate our software architecture.
  for (const forbidden of ['crm', 'automation', 'ai', 'integration', 'analytics', 'marketplace', 'administration', 'cleanup']) {
    assert.ok(!msDepartmentIds(MS_WORKSPACES).includes(forbidden),
      `"${forbidden}" must not be a primary department`)
  }
  // Settings exists but only as a system workspace (bottom rail).
  assert.equal(MS_WORKSPACES.settings?.system, true, 'Settings must be flagged system: true')
})

test('every nav target resolves to a real page container', () => {
  const { MS_WORKSPACES, msAllWorkspacePages } = loadRegistry()
  for (const page of msAllWorkspacePages(MS_WORKSPACES)) {
    assert.ok(pageContainers.has(page), `nav target "${page}" has no [data-page-content] container`)
  }
})

test('no feature deletion — every pre-Phase-1 page is still reachable', () => {
  const { MS_WORKSPACES, msAllWorkspacePages } = loadRegistry()
  const now = new Set(msAllWorkspacePages(MS_WORKSPACES))
  for (const page of PRE_PHASE1_PAGES) {
    assert.ok(now.has(page), `page "${page}" was reachable before Phase 1 and must remain reachable`)
  }
})

test('the two orphaned pages are reachable again', () => {
  const { MS_WORKSPACES, msWorkspaceOfPage } = loadRegistry()
  // Both worked but their only access point lived in the retired legacy tree.
  assert.ok(msWorkspaceOfPage('commissions', MS_WORKSPACES), 'commissions must be reachable')
  assert.ok(msWorkspaceOfPage('ai-inbox', MS_WORKSPACES), 'ai-inbox must be reachable')
})

test('required UI moves landed in the right workspace', () => {
  const { MS_WORKSPACES, msWorkspaceOfPage } = loadRegistry()
  const at = (page) => msWorkspaceOfPage(page, MS_WORKSPACES)
  assert.equal(at('appraisal'), 'inventory', 'Appraisals → Inventory > Acquire')
  assert.equal(at('equity'), 'inventory', 'Equity Mining → Inventory > Acquire')
  assert.equal(at('recon'), 'inventory', 'Recon → Inventory (not Sales)')
  assert.equal(at('inv-intel'), 'inventory', 'Inventory Intelligence → Inventory > Pricing')
  assert.equal(at('delivery'), 'fni', 'Delivery → F&I')
  assert.equal(at('sales-team'), 'people', 'Employees → People')
  assert.equal(at('people-compliance'), 'people', 'Compliance → People')
  assert.equal(at('automation-builder'), 'settings', 'Automation → Settings, not a department')
  assert.equal(at('config'), 'settings', 'Configuration → Settings')
})

test('one inventory pool — Vehicles and Syndication are two views of one page', () => {
  const { MS_WORKSPACES } = loadRegistry()
  const modes = MS_WORKSPACES.inventory.pages.filter(p => p.page === 'inventory')
  assert.deepEqual(modes.map(p => p.invmode).sort(), ['facebook', 'manual'],
    'inventory must appear once per view mode, never as a duplicate vehicle model')
})

test('role gating is preserved on regrouped workspaces', () => {
  const { MS_WORKSPACES } = loadRegistry()
  // Manager-only workspaces (unchanged from the previous registry).
  for (const ws of ['executive', 'service', 'parts', 'accounting', 'marketing', 'people']) {
    assert.equal(MS_WORKSPACES[ws].mgr, true, `${ws} must stay manager-only`)
  }
  // Sales and Inventory must stay open to reps — that is the whole point of the move.
  assert.ok(!MS_WORKSPACES.sales.mgr, 'Sales must remain visible to sales reps')
  assert.ok(!MS_WORKSPACES.inventory.mgr, 'Inventory must remain visible to sales reps')
  // F&I keeps its explicit role list.
  assert.deepEqual(MS_WORKSPACES.fni.roles, ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'])
  // Manager-only slices inside rep-visible workspaces keep their per-tab gate.
  const tab = (ws, page) => MS_WORKSPACES[ws].pages.find(p => p.page === page)
  assert.equal(tab('sales', 'leads').mgr, true, 'Pipeline stays manager-only')
  assert.equal(tab('inventory', 'inv-intel').mgr, true, 'Pricing stays manager-only')
  assert.equal(tab('fni', 'delivery').mgr, true, 'Delivery stays manager-only')
})

test('entitlement gating still covers every registry page', () => {
  const { MS_WORKSPACES, msAllWorkspacePages } = loadRegistry()
  const featureBlock = part2.match(/const PAGE_FEATURE = \{[\s\S]*?\n\};/)?.[0] || ''
  const productBlock = part2.match(/const PAGE_PRODUCT = \{[^}]*\}/)?.[0] || ''
  assert.ok(featureBlock, 'PAGE_FEATURE must still exist in dashboard-part2.js')
  // `commissions` intentionally carries no plan gate (it is a rep's own commission,
  // ungated before Phase 1 — adding one would remove access, not preserve it).
  // `academy` is exempt for the same reason: required compliance training is not a plan
  // upsell, and gating it would hide the courses a Starter dealership is required to complete.
  // `launch` likewise: gating SETUP behind an entitlement would stop a dealership configuring
  // the product it just bought.
  const EXEMPT = new Set(['commissions', 'academy', 'launch'])
  const gates = featureBlock + productBlock   // a page may be gated by plan OR product
  for (const page of msAllWorkspacePages(MS_WORKSPACES)) {
    if (EXEMPT.has(page)) continue
    assert.ok(gates.includes(`'${page}'`) || new RegExp(`\\b${page}:`).test(gates),
      `page "${page}" must have a PAGE_FEATURE or PAGE_PRODUCT entitlement entry`)
  }
})

test('DEPARTMENTS is an alias of the registry, not a second copy', () => {
  assert.match(part2, /const DEPARTMENTS = \(typeof MS_WORKSPACES !== 'undefined' && MS_WORKSPACES\)/,
    'dashboard-part2.js must consume MS_WORKSPACES rather than redefining the nav')
})

test('engine workspaces and Settings render one primary header', () => {
  assert.match(part2, /ENGINES\[pageId\]\) \|\| pageId === 'config'\) return hide\(\)/,
    'the registry tab bar must yield to the canonical engine or Settings header')
})

test('registry loads before dashboard.js', () => {
  const reg = html.indexOf('workspace-registry.js')
  const dash = html.indexOf('src="dashboard.js')
  assert.ok(reg > -1, 'workspace-registry.js must be included in dashboard.html')
  assert.ok(reg < dash, 'workspace-registry.js must load before dashboard.js')
})

test('restricted product tiers keep their own flat navigation', () => {
  const dashboardJs = read('dashboard.js')
  // Facebook Solo / Facebook Dealer / AI Chatbot must be untouched by the DealerOS
  // workspace nav — deptNavEligible() short-circuits before the registry is used.
  assert.match(part2, /__productAllowedPages == null/, 'product tiers must bypass the workspace nav')
  assert.match(part2, /if \(__fbOnly\)/, 'Facebook-only tier must bypass the workspace nav')
  assert.match(dashboardJs, /facebook_solo:\s*\['leaderboard', 'inventory'\]/, 'Facebook Solo page set unchanged')
  assert.match(dashboardJs, /facebook_dealer:\s*\['leaderboard', 'inventory', 'sales-team'\]/, 'Facebook Dealer page set unchanged')
  assert.match(dashboardJs, /ai_chatbot:\s*\['ai-home'\]/, 'AI Chatbot page set unchanged')
})

test('mobile navigation is role-aware and derives from the registry', () => {
  const { MS_ROLE_MOBILE_NAV, MS_WORKSPACES, msMobileNavForRole, msAllWorkspacePages } = loadRegistry()
  const known = new Set(msAllWorkspacePages(MS_WORKSPACES))
  for (const [role, pages] of Object.entries(MS_ROLE_MOBILE_NAV)) {
    assert.ok(pages.length <= 4, `${role} mobile row must fit 4 destinations + More`)
    for (const p of pages) {
      assert.ok(known.has(p), `${role} mobile nav references "${p}", which is not in the registry`)
    }
  }
  // The documented role examples from the project instructions. Phase 2 made the
  // Sales workspace ("sales" — Today) the rep's landing destination instead of the
  // `insights` analytics page: a salesperson should open actionable work, not a
  // dashboard. Leads is manager-gated, so it is not on a rep's bar.
  assert.deepEqual(msMobileNavForRole('SALES_REP'), ['sales', 'crm', 'appointments', 'tasks'])
  assert.deepEqual(msMobileNavForRole('SERVICE'), ['service-ros', 'service-appointments', 'crm', 'tasks'])
  // An unknown role still gets a usable default rather than an empty bar.
  assert.ok(msMobileNavForRole('SOMETHING_NEW').length > 0, 'unknown roles need a fallback row')
})

test('mobile row still renders through the shared gating helpers', () => {
  const dashboardJs = read('dashboard.js')
  assert.match(dashboardJs, /msMobileNavForRole/, 'mobile row must consume the registry role map')
  assert.match(dashboardJs, /deptPageAllowed\(tab\)/, 'mobile entries must pass the same gates as desktop')
})

test('hash routing is additive and cannot break the token bootstrap', () => {
  const dashboardJs = read('dashboard.js')
  assert.match(part2, /#\/w\/\$\{ws\}\/\$\{pageId\}/, 'workspace route format must be #/w/<workspace>/<page>')
  assert.match(part2, /window\.addEventListener\('popstate', msApplyRoute\)/, 'Back/Forward must be wired')
  assert.match(part2, /function msBootRoute/, 'refresh-into-workspace must be supported')
  // The extension token bootstrap consumes and strips #tk= at parse time in
  // dashboard.js, long before the router reads location.hash. The router must not
  // read, write or clear the token itself.
  assert.match(dashboardJs, /\[#&\]tk=/, 'extension token bootstrap must remain')
  const routerBlock = part2.match(/function msSyncRoute[\s\S]*?window\.msBootRoute = msBootRoute;/)?.[0] || ''
  assert.ok(routerBlock, 'router block must be present')
  assert.doesNotMatch(routerBlock, /localStorage|token/, 'the router must not touch token handling')
  // The route matcher only accepts its own #/w/ and #/p/ shapes, so a #tk= hash
  // (or any other foreign hash) is ignored rather than treated as a page.
  assert.match(part2, /\^#\\\/\(\?:w\\\/\[\^\/\]\+\\\/\|p\\\/\)/, 'route regex must be anchored to its own shapes')
})
