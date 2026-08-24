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

test('four tabs, role-aware: a rep works in four, a manager also gets Settings', () => {
  const block = sales.match(/get tabOrder\(\)\s*\{[\s\S]*?\n  \},/)?.[0] || ''
  assert.ok(block, 'tabOrder must be role-aware')
  assert.match(block, /'overview'/, 'a salesperson sees the overview tab')
  assert.match(block, /equity/, 'Equity Mining is a rep surface, not a manager report')
  assert.match(block, /'settings'/, 'a manager additionally sees Settings')
  assert.ok(!/'insights'/.test(block) && !/'automation'/.test(block),
    'Insights and Automation must not be tabs of their own')
  assert.match(sales, /overview:\s*'Pulse'/, 'the attention landing must read "Pulse"')
  assert.match(sales, /work:\s*'Customers'/, 'Work must be named for what it holds')
})

test('My Day is attention-first, not another analytics dashboard', () => {
  assert.match(sales, /Needs attention/, 'My Day must lead with a needs-attention queue')
  assert.match(sales, /function salesAttention/, 'attention queue must be derived')
  // Attention items carry customer, reason, age and a specific primary action.
  assert.match(sales, /who:/); assert.match(sales, /why:/); assert.match(sales, /age:/); assert.match(sales, /action:/)
  // Specific verbs, not a generic "View".
  for (const verb of ['Call', 'Confirm Appointment', 'Desk Deal', 'Prepare delivery', 'Open Customer', 'Log outcome']) {
    assert.ok(sales.includes(verb), `Today should offer the specific action "${verb}"`)
  }
})

test('Work exposes the five operational views', () => {
  for (const v of ['contacts', 'tasks', 'appointments', 'deals', 'deliveries']) {
    assert.ok(sales.includes(v), `Work must include the ${v} view`)
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
  // /gamification is the same cross-department leaderboard endpoint the platform's own
  // Performance/Leaderboard page already reads — Sales' Pulse leaderboard card reuses it.
  // /sales-videos is the same real sent-video feed Video Studio already reads — Sales'
  // Pulse "Today's videos sent" card reuses it instead of a hardcoded demo list.
  const KNOWN = ['/crm/contacts', '/crm/tasks', '/appointments', '/crm/insights', '/delivery/queue', '/fni/deals', '/launch/dealership', '/gamification', '/sales-videos']
  const calls = [...sales.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])
  assert.ok(calls.length, 'Sales should read some data')
  for (const c of calls) {
    assert.ok(KNOWN.includes(c), `Sales must not introduce a new endpoint: ${c}`)
  }
  // Sales writes exactly ONE thing: its own lead-routing setting, through the existing
  // /launch/dealership PATCH. The Settings tab used to be a paragraph and two buttons pointing
  // elsewhere; a settings screen that cannot change a setting is a signpost, not a setting.
  const writes = [...sales.matchAll(/apiSendJson\('([^']+)'/g)].map(m => m[1])
  assert.deepEqual([...new Set(writes)], ['/launch/dealership'],
    'Sales may only write its own routing setting; every other write belongs to its own page')
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

test('landing payload stays ONE parallel round-trip even though it now shows more', () => {
  // Insights, deals and deliveries are part of My Day now, so they load with it. The original
  // concern this test encoded — do not make the landing slow — is preserved by them being in
  // the SAME Promise.all rather than a waterfall, and by each failing independently.
  const fetchBlock = sales.match(/fetch: async \(\) => \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(fetchBlock, /Promise\.all/, 'landing data must load in parallel, not a waterfall')
  assert.equal((fetchBlock.match(/Promise\.all/g) || []).length, 1, 'exactly one round-trip')
  assert.equal((fetchBlock.match(/await /g) || []).length, 1, 'no sequential awaits — that would be a waterfall')
  for (const src of ['/crm/insights', '/fni/deals', '/delivery/queue']) {
    assert.ok(fetchBlock.includes(src), `${src} must load with the day, not behind another tab`)
    // Allow a query string between the path and the closing quote.
    assert.match(fetchBlock, new RegExp(`${src.replace(/\//g, '\\/')}[^']*'\\)\\.catch`), `${src} must fail on its own`)
  }
})

test('Sales settings stay Sales-specific', () => {
  const block = sales.match(/settings\(body, d\) \{[\s\S]*?\n    \},/)?.[0] || ''
  assert.ok(block, 'settings tab must exist')
  // And it must show the setting, not a button to go and find it.
  assert.match(block, /salesSaveRouting/, 'lead routing must be editable here')
  assert.match(block, /SALES_ROUTING_MODES\.map/, 'the actual options must render')
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
  // Sales leads with its own Pulse. The obsolete app-wide Insights pseudo-Pulse is retired.
  const block = registry.match(/sales: \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(block, /\{ page: 'sales', label: 'Pulse' \}/, 'Sales must lead with Pulse')
  for (const p of ['crm', 'appointments', 'tasks', 'leads', 'commissions']) {
    assert.ok(block.includes(`page: '${p}'`), `existing Sales page "${p}" must stay reachable`)
  }
  assert.ok(!block.includes("page: 'insights'"), 'Sales must not expose the retired global Insights/Pulse')
})

test('Sales navigation stays free of other departments’ work', () => {
  const block = registry.match(/sales: \{[\s\S]*?\n  \},/)?.[0] || ''
  for (const moved of ['inventory', 'inv-intel', 'market', 'recon', 'reports', 'taskboard', 'operations']) {
    assert.ok(!block.includes(`page: '${moved}'`), `${moved} must not be a Sales destination`)
  }
})
