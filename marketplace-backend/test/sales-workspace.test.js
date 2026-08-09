import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Sales is the DealerOS reference department (Phase 2). These tests pin the
// properties every later department must copy — and, just as importantly, the
// "compose, don't rebuild" rules: no new endpoint, no second customer/deal model,
// no second workflow engine, no invented backend state.
// See docs/SALES_PHASE2_AUDIT.md.

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')

const sales = read('js/modules/sales-workspace.js')
const html = read('dashboard.html')
const registry = read('js/modules/workspace-registry.js')
const part2 = read('js/modules/dashboard-part2.js')

test('Sales uses the shared engine shell, not a bespoke one', () => {
  assert.match(sales, /ENGINES\['sales'\]\s*=/, "Sales must register on the shared ENGINES registry")
  assert.match(sales, /rootId:\s*'sales-root'/)
  // Reuses the shared primitives rather than redefining them.
  for (const prim of ['engKpi', 'engCard', 'engEmpty', 'renderEngine']) {
    assert.ok(sales.includes(prim), `Sales must reuse the shared primitive ${prim}`)
  }
  assert.doesNotMatch(sales, /function (engKpi|engCard|engEmpty|renderEngine|engineTab)\b/,
    'Sales must not redefine a shared primitive')
})

test('tabs are role-aware: rep gets Today|Work, manager also gets Insights', () => {
  const block = sales.match(/get tabOrder\(\)\s*\{[\s\S]*?\n  \},/)?.[0] || ''
  assert.ok(block, 'tabOrder must be role-aware')
  assert.match(block, /\['overview', 'work'\]/, 'a salesperson sees Today | Work only')
  assert.match(block, /'insights'/, 'a manager additionally sees Insights')
  assert.match(sales, /tabLabels:\s*\{\s*overview:\s*'Today'/, 'the overview tab must read "Today"')
})

test('Today is attention-first, not another analytics dashboard', () => {
  assert.match(sales, /Needs attention/, 'Today must lead with a needs-attention queue')
  assert.match(sales, /function salesAttention/, 'attention queue must be derived')
  // Attention items carry customer, reason, age and a specific primary action.
  assert.match(sales, /who:/); assert.match(sales, /why:/); assert.match(sales, /age:/); assert.match(sales, /action:/)
  // Specific verbs, not a generic "View".
  for (const verb of ['Call', 'Confirm Appointment', 'Desk Deal', 'Prepare delivery', 'Open Customer', 'Log outcome']) {
    assert.ok(sales.includes(verb), `Today should offer the specific action "${verb}"`)
  }
})

test('Work exposes the five operational views', () => {
  const views = sales.match(/const SALES_WORK_VIEWS = \[[\s\S]*?\n\];/)?.[0] || ''
  assert.ok(views, 'SALES_WORK_VIEWS must be declared')
  for (const v of ['opportunities', 'appointments', 'customers', 'deals', 'deliveries']) {
    assert.ok(views.includes(v), `Work must include the ${v} view`)
  }
})

test('canonical stage model is reused — no invented backend state', () => {
  const stages = sales.match(/const SALES_STAGES = \[[^\]]*\]/)?.[0] || ''
  for (const s of ['uncontacted', 'contacted', 'appointment', 'sold', 'fni', 'delivered', 'followup', 'lost']) {
    assert.ok(stages.includes(`'${s}'`), `stage "${s}" must come from the canonical CRM enum`)
  }
  // The brief's "Showed"/"Negotiating" are NOT in the backend enum; inventing them
  // here would create duplicate state (see audit §4).
  assert.doesNotMatch(sales, /'showed'|'negotiating'/i, 'must not invent backend stages')
  assert.match(sales, /CRM_STATUS/, 'labels must come from the existing CRM_STATUS map')
})

test('no new endpoints — Sales only reads APIs that already exist', () => {
  const KNOWN = ['/crm/contacts', '/crm/tasks', '/appointments', '/crm/insights', '/delivery/queue']
  const calls = [...sales.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])
  assert.ok(calls.length, 'Sales should read some data')
  for (const c of calls) {
    assert.ok(KNOWN.includes(c), `Sales must not introduce a new endpoint: ${c}`)
  }
  // Read-only composition: the workspace itself must not write.
  assert.doesNotMatch(sales, /apiSendJson\(/, 'Sales workspace must delegate writes to existing pages')
})

test('actions delegate to the existing Sales implementation', () => {
  for (const fn of ['crmOpenForm', 'crmApptForm', 'crmLogForm', 'openDeskForContact', 'switchPage']) {
    assert.ok(sales.includes(fn), `Sales must delegate to the existing ${fn}`)
  }
  // Desking is preserved, never reimplemented.
  assert.doesNotMatch(sales, /function (loadDeskDeal|deskSave|deskPriceRecalc)\b/, 'must not reimplement desking')
})

test('next action is derived, not a second workflow engine', () => {
  assert.match(sales, /function salesNextAction/)
  assert.match(sales, /Derived, never stored/, 'next action must be documented as derived')
  assert.doesNotMatch(sales, /workflow_instances|createWorkflow|new Workflow/i, 'must not create a workflow engine')
})

test('landing payload is one parallel round-trip; heavy views load lazily', () => {
  const fetchBlock = sales.match(/fetch: async \(\) => \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(fetchBlock, /Promise\.all/, 'landing data must load in parallel, not a waterfall')
  assert.doesNotMatch(fetchBlock, /delivery\/queue/, 'deliveries must not load on the landing page')
  assert.doesNotMatch(fetchBlock, /crm\/insights/, 'insights must not load on the landing page')
  assert.match(sales, /__salesDeliveries/, 'deliveries must be lazily fetched inside their view')
})

test('Sales settings stay Sales-specific', () => {
  const block = sales.match(/settings\(body\) \{[\s\S]*?\n    \},/)?.[0] || ''
  assert.ok(block, 'settings tab must exist')
  for (const forbidden of ['api-keys', 'billing', 'sales-team', 'security']) {
    assert.ok(!block.includes(`switchPage('${forbidden}')`), `${forbidden} belongs in global Settings/People, not Sales`)
  }
})

test('Sales page is wired into the shell and the registry', () => {
  assert.match(html, /data-page-content="sales"/, 'sales page container must exist')
  assert.match(html, /id="sales-root"/)
  // Must load after the split parts (it depends on ENGINES + the CRM functions).
  // Compare the <script> tags themselves — the filename is also mentioned in an
  // earlier comment above the page container.
  const scriptPos = (f) => html.indexOf(`<script src="js/modules/${f}`)
  assert.ok(scriptPos('sales-workspace.js') > scriptPos('dashboard-part26.js'),
    'sales-workspace.js must load after the dashboard parts')
  assert.match(part2, /if \(pageId === 'sales'\) loadSalesWorkspace\(\);/, 'switchPage must load the workspace')
  assert.match(part2, /sales: 'os\.crm'/, 'the sales page must carry an entitlement key')
  // Sales leads with Today, and the existing pages remain reachable (no deletion).
  const block = registry.match(/sales: \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(block, /\{ page: 'sales', label: 'Today' \}/, 'Sales must lead with Today')
  for (const p of ['crm', 'appointments', 'tasks', 'leads', 'insights', 'commissions']) {
    assert.ok(block.includes(`page: '${p}'`), `existing Sales page "${p}" must stay reachable`)
  }
})

test('Sales navigation stays free of other departments’ work', () => {
  const block = registry.match(/sales: \{[\s\S]*?\n  \},/)?.[0] || ''
  for (const moved of ['inventory', 'inv-intel', 'market', 'recon', 'appraisal', 'equity', 'reports', 'taskboard', 'operations']) {
    assert.ok(!block.includes(`page: '${moved}'`), `${moved} must not be a Sales destination`)
  }
})
