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
const part10 = read('js/modules/dashboard-part10.js')
const salesWorkspace = read('js/modules/sales-workspace.js')
const part11 = read('js/modules/dashboard-part11.js')
const pageContainers = new Set([...html.matchAll(/data-page-content="([^"]+)"/g)].map(m => m[1]))

// The ten target workspaces (project instructions §8 / Doc 21 §18, plus Cleanup —
// split out from Inventory into its own department: reconditioning a unit before it
// can go frontline is real, standalone operational work, not an Inventory sub-tab).
const EXPECTED_WORKSPACES = [
  'executive', 'sales', 'inventory', 'cleanup', 'fni', 'service', 'parts', 'accounting', 'marketing', 'people',
]

test('MarketSync Internal OS uses the approved company navigation in order', () => {
  const block = part2.match(/const SAAS_DEPARTMENTS = \{([\s\S]*?)\n\};/)?.[1] || ''
  // Each department now collapses to a single page (Simplify remaining MarketSync
  // departments), so several departments' one nested page reuses the department's
  // own label verbatim (e.g. leads: { label: 'Leads', pages: [{ ..., label: 'Leads' }] }).
  // The regex below matches every `label:` in the block, department-level and
  // nested, so a department whose sole page repeats its name legitimately produces
  // two consecutive identical matches. Collapsing consecutive duplicates preserves
  // this test's real intent (department ORDER) without being fragile to that
  // incidental repetition.
  const rawLabels = [...block.matchAll(/label: '([^']+)'/g)].map(match => match[1])
    .filter(label => ['Pulse', 'Leads', 'Customers', 'Affiliates', 'Money', 'Email Marketing', 'Automations', 'Studio', 'Website', 'Employees'].includes(label))
  const labels = rawLabels.filter((label, i) => label !== rawLabels[i - 1])
  assert.deepEqual(labels, ['Pulse', 'Leads', 'Customers', 'Affiliates', 'Money', 'Email Marketing', 'Automations', 'Studio', 'Website', 'Employees'])
  for (const page of ['saas-email-marketing', 'saas-studio', 'saas-website']) {
    assert.ok(pageContainers.has(page), `${page} must resolve to a real page container`)
    const loader = page.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('')
    assert.match(part2, new RegExp(`pageId === '${page}'\\) load${loader}\\(\\)`))
    assert.match(part10, new RegExp(`function load${loader}\\(`))
  }
  // "Keep dashboard logo large in every mode" (08461ff) deliberately de-scoped the
  // brand-crop rule from marketsync-only to every dashboard mode — so it's no longer
  // gated behind data-dash-mode="marketsync".
  assert.match(html, /#dashboard-brand\{[^}]*overflow:hidden/)
  assert.match(html, /#dashboard-brand img\[alt="MarketSync DealerOS"\][^}]*top:-4\.35rem/)
  assert.match(html, /#ui-role-pill::after\{content:"MARKETSYNC INTERNAL"/)
  assert.match(html, /data-dash-mode="marketsync"[^}]*\.bg-violet-600\)[^}]*#2563eb/)
})

test('each MarketSync Internal page owns specific operational header tabs', () => {
  // saas-command (Pulse) was deliberately collapsed to one tab (hideRail/hideTabBar,
  // tabOrder: ['overview']) — the old Sync Pipeline/API & Webhook Health/Error Logs/
  // Infrastructure sub-tabs no longer exist, so they're no longer pinned here.
  // "Simplify remaining MarketSync departments" (bdcfe6d) went further: Studio's
  // saasToolHeader() call dropped its `tabs:` array entirely (Video Studio/Creative
  // Library/Watermark & Branding/AI Enhancement Rules), replaced by a single action
  // button. Those four labels no longer exist anywhere in source, so they're no
  // longer pinned here either. "Templates" stays pinned — it still exists as a KPI
  // label, coincidentally.
  const expected = [
    'All Leads', 'Pipeline Board', 'Marketplace Sources', 'Routing Rules', 'Export',
    'Directory', 'Onboarding Data', 'Plan Overrides', 'Impersonation & Access', 'Usage Quotas',
    'Affiliate Directory', 'Pending Payouts', 'Referral Links', 'Commission Tiers', 'Payout Logs',
    'Money overview', 'Customer payments', 'Money spent', 'Bills and taxes', 'Canadian and US dollars',
    'Campaigns', 'Automated Drips', 'Audience Lists', 'Template Builder', 'Deliverability & Analytics',
    'Templates',
    'Team Directory', 'Role Permissions', 'Sales Assignments', 'Activity Audit', 'Invitations',
  ]
  const source = part10 + part11 + read('js/modules/dashboard-part13.js')
  for (const label of expected) assert.ok(source.includes(label), `missing tailored Internal header: ${label}`)
  assert.match(part10, /window\.saasExportLeads\s*=/)
  assert.match(part10, /Product usage timeline/)
  assert.match(part10, /Customer growth/)
  // The standalone "SaaS lead priorities" explainer card was removed by the same
  // simplification pass — its intent (one owner, one next action per lead) is now
  // implicit in the "Follow up" card's own copy rather than a separate card.
  assert.match(part10, /saas-connected-website-builder/)
  assert.match(part11, /Take or upload receipt photo/)
  const videoStudio = read('js/modules/video-studio.js')
  assert.match(videoStudio, /MarketSync Product Video Studio/)
  assert.match(videoStudio, /if \(isSaas && String\(v\.department \|\| ''\)\.toLowerCase\(\) === 'service'\) return false/)
})

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

test('every dealer department leads with one role-aware My Day', () => {
  const { MS_WORKSPACES, msDepartmentIds } = loadRegistry()
  // The lead tab is labelled 'Pulse' product-wide (see sales-workspace / parts-workspace
  // tests and the registry). It IS the role-aware My Day surface; the label is 'Pulse'.
  for (const id of msDepartmentIds(MS_WORKSPACES)) {
    const pages = MS_WORKSPACES[id].pages
    // A single-page department (e.g. Cleanup) IS its own My Day — there is no
    // separate Pulse/Work split to carve a dedicated 'Pulse' tab out of.
    if (pages.length === 1) continue
    assert.equal(pages[0]?.label, 'Pulse', `${id} must lead with its Pulse (My Day) tab`)
  }
})

test('system engines are NOT primary departments', () => {
  const { msDepartmentIds, MS_WORKSPACES } = loadRegistry()
  // CRM, Automation, AI, Integrations, Analytics, Marketplace power the workspaces
  // underneath — an employee must never navigate our software architecture.
  for (const forbidden of ['crm', 'automation', 'ai', 'integration', 'analytics', 'marketplace', 'administration']) {
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
  assert.equal(at('appraisal'), 'sales', 'Appraisals → Sales')
  assert.equal(at('equity'), 'inventory', 'Equity Mining → Inventory > Acquire')
  assert.equal(at('recon'), 'cleanup', 'Recon → its own Cleanup department, not buried in Inventory')
  assert.equal(at('inv-intel'), 'inventory', 'Inventory Intelligence stays visibly named inside Inventory')
  assert.equal(at('delivery'), 'fni', 'Delivery → F&I')
  assert.equal(at('sales-team'), 'people', 'Employees → People')
  assert.equal(at('people-compliance'), 'people', 'Compliance → People')
  assert.equal(at('automation-builder'), 'settings', 'Automation → Settings, not a department')
  assert.equal(at('config'), 'settings', 'Configuration → Settings')
})

test('Inventory Intelligence remains visibly discoverable inside Inventory', () => {
  const inv = readFileSync(new URL('../../marketplace-frontend/js/modules/inventory-workspace.js', import.meta.url), 'utf8')
  // The sub-nav that used to list these is gone; discoverability now rests on the
  // Pricing and age section plus the two rail shortcuts. Both still have to be there —
  // an Inventory Intelligence nobody can find is an Inventory Intelligence nobody uses.
  assert.match(inv, /engSection\('Pricing and age'/)
  assert.match(inv, /label: 'Inventory Intelligence'.*engineTab\('inventory-overview','overview'\)/s)
  assert.match(inv, /label: 'Market & Competitors'.*engineTab\('inventory-overview','overview'\)/s)
  assert.match(inv, /engMountPage\(body, 'inv-intel'/)
  assert.match(inv, /engMountPage\(body, 'market'/)
  const reg = readFileSync(new URL('../../marketplace-frontend/js/modules/workspace-registry.js', import.meta.url), 'utf8')
  for (const p of ['inv-intel', 'market']) {
    assert.ok(reg.includes(`page: '${p}'`), `${p} must stay reachable from the registry`)
  }
})

test('one inventory pool — the manual and Facebook views are the same page', () => {
  // Still one pool and one page; the Facebook view simply moved to Marketing, where publishing
  // to a channel belongs. What must never happen is a second vehicle model.
  const { MS_WORKSPACES } = loadRegistry()
  assert.deepEqual(MS_WORKSPACES.inventory.pages.filter(p => p.page === 'inventory').map(p => p.invmode), ['manual'])
  assert.deepEqual(MS_WORKSPACES.marketing.pages.filter(p => p.page === 'inventory').map(p => p.invmode), ['facebook'])
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
  assert.equal(tab('inventory', 'inv-intel').mgr, true, 'Inventory Intelligence stays manager-only')
  assert.equal(tab('inventory', 'inv-intel').label, 'Inventory Intelligence')
  assert.equal(tab('inventory', 'market').label, 'Market & Competitors')
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
  // `ai-inbox` is deliberately ungated too (see dashboard-part2.js PAGE_FEATURE note):
  // messaging is not a plan upsell, same class as academy/launch.
  const EXEMPT = new Set(['commissions', 'academy', 'launch', 'ai-inbox'])
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
  assert.match(part2, /ENGINES\[pageId\]\) \|\| \['config', 'automation-builder', 'api-keys'\]\.includes\(pageId\)\) return hide\(\)/,
    'the registry tab bar must yield to the canonical engine or Settings header')
  const { MS_WORKSPACES } = loadRegistry()
  assert.equal(MS_WORKSPACES.settings.pages[0].label, 'Settings')
  assert.ok(MS_WORKSPACES.settings.pages.slice(1).every(page => page.legacy === true),
    'Automation and API remain deep links inside Settings, not competing primary tabs')
})

test('Management exposes one canonical four-tab command header', () => {
  // Was six. Exceptions was the same needs-attention list Pulse already implies, and Approvals
  // was a subset of it — three places to check and no single answer to "what is waiting on me".
  // Both now live under Pulse.
  const { MS_WORKSPACES } = loadRegistry()
  assert.equal(MS_WORKSPACES.executive.label, 'Pulse')
  assert.deepEqual(MS_WORKSPACES.executive.pages.filter(page => !page.legacy).map(page => page.page), ['command'],
    'legacy Executive pages must not render a competing department tab row')
  assert.match(part11, /tabOrder:\s*\['overview', 'pulse', 'forecast', 'financials'\]/)
  for (const label of ['My Day', 'Pulse', 'Forecast', 'Financials']) {
    assert.match(part11, new RegExp(`['"]${label}['"]`), `Management must expose ${label}`)
  }
  assert.ok(!/exceptions:\s*'Exceptions'/.test(part11), 'Exceptions must not be a tab of its own')
  assert.ok(!/approvals:\s*'Approvals'/.test(part11), 'Approvals must not be a tab of its own')
  assert.match(part11, /apiGetJson\('\/my-day'\)/,
    'Management My Day must consume the shared role-aware attention aggregation')
  assert.match(part11, /d\.day\.needs_attention/,
    'Management must render canonical attention rather than a second task queue')
  assert.match(part11, /This day is incomplete/,
    'a failed attention source must stay visible instead of looking like a quiet day')
  assert.doesNotMatch(part11.match(/ENGINES\['command'\][\s\S]*?function loadCommandCenter/)?.[0] || '', /☀️|🎓/,
    'active Management output must use product icons, not emoji decoration')
})

test('the global header keeps approved sales and account controls without a hamburger or tour', () => {
  assert.doesNotMatch(html, /id="shell-menu-btn"|id="shell-menu"/)
  assert.doesNotMatch(html, /src="tour\.js/)
  for (const id of ['header-desk-btn', 'header-appraise-btn', 'header-profile-btn', 'header-settings', 'logout-btn']) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} must remain directly accessible on desktop`)
  }
  assert.match(html, /id="header-profile-btn"[\s\S]*class="inline-flex/,
    'profile must remain directly reachable in the phone header')
  assert.match(html, /id="header-settings"[\s\S]*class="inline-flex/,
    'settings must remain directly reachable in the phone header')
  assert.match(html, /id="logout-btn"[\s\S]*class="inline-flex/,
    'sign out must remain directly reachable in the phone header')
  assert.doesNotMatch(html, /@media \(max-width: 767px\)[\s\S]*#header-desk-btn/,
    'approved quick actions must not disappear on phones')
})

test('Sales uses one header and composes operational work into My Day', () => {
  // Role-aware getter (see sales-workspace.test.js) — Appraisals is a real Sales tab
  // now (its one home); desk is still reached from the global header, not a tab.
  assert.match(salesWorkspace, /get tabOrder\(\)\s*\{\s*return \['overview', 'work', 'appraisals', 'equity', 'settings'\]/)
  assert.doesNotMatch(salesWorkspace, /tabLabels:\s*\{[^}]*appointments:/)
  assert.match(salesWorkspace, /salesDealsAndDeliveries\(d\)/)
  assert.match(salesWorkspace, /Today's appointments/)
  assert.match(salesWorkspace, /Active opportunities/)
  assert.match(salesWorkspace, /work\(body, d\)[\s\S]*engCard\('Customers'/)
})

test('dealer login lands on the My Day owned by the caller role', () => {
  const landing = part2.match(/function dealerRoleLanding[\s\S]*?\n\}/)?.[0] || ''
  for (const [role, page] of Object.entries({
    SALES_REP: 'sales', FNI: 'fni-overview', SERVICE: 'service-overview',
    ACCOUNTING: 'accounting-overview', CLEANUP: 'recon', MANAGER: 'command',
  })) assert.match(landing, new RegExp(`${role}: '${page}'`))
  assert.match(part2, /switchPage\(dealerRoleLanding\(profileContext\?\.role\)\)/)
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
  for (const role of ['MANAGER', 'OWNER', 'DEALER_ADMIN']) {
    assert.ok(!msMobileNavForRole(role).includes('tasks'), `${role} Executive My Day must not duplicate Tasks in mobile nav`)
  }
  // An unknown role still gets a usable default rather than an empty bar.
  assert.ok(msMobileNavForRole('SOMETHING_NEW').length > 0, 'unknown roles need a fallback row')
})

test('Inventory is just Inventory and Pulse — Appraisals and Cleanup moved out', () => {
  const inv = read('js/modules/inventory-workspace.js')
  // Appraisals → Sales (its one home), Cleanup → its own department, Settings → the
  // header gear like everywhere else. Inventory's engine tabs are down to the two
  // that are actually its own: the vehicle list and its Pulse.
  assert.match(inv, /get tabOrder\(\) \{ return \['work', 'overview'\]; \}/)
  assert.match(inv, /tabLabels:\s*\{ overview: 'Pulse', work: 'Inventory' \}/)
  assert.doesNotMatch(inv, /\bappraisals\(body/, 'Appraisals must not be mounted inside Inventory any more')
  assert.doesNotMatch(inv, /\bcleanup\(body/, 'Cleanup must not be mounted inside Inventory any more')
  assert.doesNotMatch(inv, /\bsettings\(body/, 'Settings must not be a separate Inventory tab any more')
  // Cleanup's own summary card in Pulse still links out to the real Cleanup department.
  assert.match(inv, /switchPage\('recon'\)/)
})

test('Cleanup is its own department, not an Inventory tab', () => {
  const { MS_WORKSPACES } = loadRegistry()
  assert.ok(MS_WORKSPACES.cleanup, 'cleanup must be a top-level workspace')
  assert.deepEqual(MS_WORKSPACES.cleanup.pages.map(p => p.page), ['recon'])
  assert.equal(MS_WORKSPACES.cleanup.pages[0].legacy, undefined, 'recon must be a real tab-bar entry in Cleanup, not a legacy deep-link')
})

test('Marketing top tab reads "Design Studio", not "Studio"', () => {
  // Renamed multiple times and kept reverting — pin it so it stays fixed.
  const mkt = read('js/modules/marketing-workspace.js')
  assert.match(mkt, /tabLabels:\s*\{[^}]*studio: 'Design Studio'/)
  assert.doesNotMatch(mkt, /studio: 'Studio'/)
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


// ── A tab must show information, not point at another page ───────────────────

test('Forecast and Financials render data rather than signposting another page', () => {
  // Both used to take no data at all and render a button saying "open Accounting" / "open the
  // pipeline". A tab whose only content is "go somewhere else" should not be a tab.
  for (const tab of ['forecast', 'financials']) {
    const fn = part11.match(new RegExp(`\\n    ${tab}\\(body[^)]*\\) \\{[\\s\\S]*?\\n    \\},`))?.[0] || ''
    assert.ok(fn, `${tab} tab not found`)
    assert.match(fn, /\(body, d\)/, `${tab} must receive the engine data — it cannot show numbers without it`)
    assert.match(fn, /cmdStat\(/, `${tab} must render real figures`)
  }
})

test('a figure that could not be read shows as unknown, never as zero', () => {
  // A management screen that quietly shows $0 cash is worse than one that says it could not
  // read the ledger.
  assert.match(part11, /Unknown/)
  assert.match(part11, /const cmdUnavailable/)
  assert.match(part11, /This view is incomplete/)
})

test('Management My Day groups every department and shows what ran, not only what is wrong', () => {
  assert.match(part11, /const departments = \[\.\.\.new Set\(attention\.map/,
    'the day must be grouped by department, not a single flat ranked column')
  assert.match(part11, /Running today/)
  assert.match(part11, /Campaigns live/)
  assert.match(part11, /Automations sent today/)
  assert.match(part11, /not_covered/,
    'departments the queue cannot see must be named, so a quiet day is not mistaken for a calm one')
})
