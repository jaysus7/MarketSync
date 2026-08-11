import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Batch 3 — the Service department workspace.
// The one rule that matters here: the database owns the repair-order state machine
// (audit §32), so this surface must ASK what is legal rather than deciding.

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const wsRaw = read('js/modules/service-workspace.js')
const ws = strip(wsRaw)
const html = read('dashboard.html')
const registry = read('js/modules/workspace-registry.js')
const part2 = read('js/modules/dashboard-part2.js')

test('Service registers on the shared engine shell', () => {
  assert.match(ws, /ENGINES\['service-overview'\]\s*=/)
  assert.match(ws, /rootId: 'service-overview-root'/)
  for (const prim of ['engKpi', 'engCard', 'engEmpty']) assert.ok(ws.includes(prim), `must reuse ${prim}`)
  assert.doesNotMatch(ws, /function (engKpi|engCard|engEmpty|renderEngine|engineTab)\b/,
    'must not redefine a shared primitive')
  assert.match(ws, /overview: 'My Day'/)
})

test('the frontend asks the backend which moves are legal', () => {
  assert.match(ws, /apiGetJson\(`\/service-engine\/ros\/\$\{roId\}\/transitions`\)/,
    'legal actions must come from controls.state_transitions via the backend')
  // The failure this prevents: a second copy of the graph drifting from the database.
  assert.doesNotMatch(ws, /LEGAL_TRANSITIONS|TRANSITION_MAP|from === '[a-z_]+' && to ===/,
    'the UI must not carry its own transition graph')
  assert.match(ws, /moves\.map\(t =>/, 'the action buttons are rendered from what the backend returned')
})

test('it composes existing endpoints and introduces none', () => {
  const KNOWN = ['/service-engine/ros', '/service/appointments', '/service-engine/part-requests']
  for (const c of [...ws.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])) {
    assert.ok(KNOWN.includes(c), `must not introduce a new endpoint: ${c}`)
  }
  // Writes go only through the canonical transition and check-in routes.
  const WRITES = ['/service-engine/ros/${roId}/close', '/service-engine/ros/${roId}/status',
                  '/service/appointments/${appointmentId}/check-in',
                  '/service-engine/lines/${lineId}/progress']
  for (const w of [...ws.matchAll(/apiSendJson\(`([^`]+)`/g)].map(m => m[1])) {
    assert.ok(WRITES.includes(w), `unexpected write target: ${w}`)
  }
})

test('My Day is attention-first and every category is real', () => {
  assert.match(ws, /function svcAttention/)
  assert.match(ws, /Needs attention/)
  assert.match(ws, /salesAttentionRow/, 'should reuse the shared attention row')
  // Each attention reason maps to a canonical state or a real parts blocker.
  for (const state of ['estimate_sent', 'checked_in', 'inspection', 'customer_approved', 'quality_check', 'ready', 'delivered']) {
    assert.ok(ws.includes(`'${state}'`), `attention must key off the canonical state ${state}`)
  }
  assert.match(ws, /\['requested', 'backordered'\]\.includes\(q\.status\)/,
    'waiting-for-parts must come from real parts demand, not a guess')
})

test('closing from the UI still states the money outcome', () => {
  assert.match(ws, /disposition = prompt\(/, 'the advisor must state how it was settled')
  assert.match(ws, /paid_in_full · partial_ar · ar · warranty · internal · goodwill/)
  assert.match(ws, /toState === 'closed' \? \{ reason, disposition: disposition\.trim\(\) \}/)
})

test('check-in relies on server idempotency, not UI bookkeeping', () => {
  const fn = ws.match(/async function svcCheckIn[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /apiSendJson\(`\/service\/appointments\/\$\{appointmentId\}\/check-in`/)
  assert.match(fn, /r\.created \?/, 'the backend says whether an RO was created; the UI just reports it')
})

test('Service is wired into the shell and the registry', () => {
  assert.match(html, /data-page-content="service-overview"/)
  assert.match(html, /id="service-overview-root"/)
  assert.match(part2, /if \(pageId === 'service-overview'\) loadServiceWorkspace\(\)/)
  assert.match(part2, /'service-overview': 'os\.service'/, 'must carry an entitlement key')
  const block = registry.match(/\n  service: \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(block, /\{ page: 'service-overview', label: 'My Day' \}/, 'Service must lead with My Day')
  for (const p of ['service-appointments', 'service-ros']) {
    assert.ok(block.includes(`page: '${p}'`), `existing page "${p}" must stay reachable`)
  }
  const pos = (f) => html.indexOf(`<script src="js/modules/${f}`)
  assert.ok(pos('service-workspace.js') > pos('dashboard-part26.js'), 'must load after the dashboard parts')
})

test('no second label vocabulary — it reuses the converted one', () => {
  assert.doesNotMatch(ws, /const SVC_ACTION_LABEL|const SVC_STATE_LABEL/,
    'dashboard-part12.js already owns the canonical wording; a second copy would drift')
  assert.match(ws, /svcStatusLabel\(/)
})

// ── Batch 3 — the technician surface (My Work) ───────────────────────────────
// A technician and a service advisor can hold the same SERVICE role, so the view
// cannot be chosen by role string. The server's own dividing line is the desk
// permission, and that is what the surface has to follow.

test('the technician surface is keyed off the desk permission, not a role string', () => {
  assert.match(ws, /const svcIsTechnician = \(\) =>[\s\S]*?canDo\('service\.manage_workflow'\)/)
  // The failure this prevents: inventing a TECHNICIAN role that does not exist.
  // The assignable vocabulary is MANAGER/SALES_REP/FNI/SERVICE/ACCOUNTING/CLEANUP.
  assert.doesNotMatch(ws, /'TECHNICIAN'|'SERVICE_TECH'|SVC_TECH_ROLES/,
    'there is no technician role to key off — SERVICE covers advisor and tech alike')
})

test('an unavailable access context lands on the advisor surface, not the tech one', () => {
  // window.canDo fails OPEN (returns true) when /access/context is unavailable, so
  // negating it must yield false — i.e. NOT a technician. Guarding on typeof keeps
  // a missing helper from reading as "technician" too.
  assert.match(ws, /typeof window\.canDo === 'function' && !window\.canDo\(/)
})

test('a technician gets one tab and none of the desk tabs', () => {
  assert.match(ws, /if \(svcIsTechnician\(\)\) return \['overview'\]/)
  const labels = ws.match(/get tabLabels\(\)[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(labels, /svcIsTechnician\(\) \? \{ overview: 'My Day' \}/)
  // work/insights/settings are desk surfaces — they must stay behind the desk branch.
  const order = ws.match(/get tabOrder\(\)[\s\S]*?\n  \},/)?.[0] || ''
  assert.ok(order.indexOf("return ['overview']") < order.indexOf("'insights'"),
    'the technician branch must return before the manager tabs are considered')
})

test('the rail follows the same split as the tabs', () => {
  // The desk shortcuts call svcWorkView(), which forces a tab a technician does not
  // have. Handing those to a technician would strand them on an empty surface.
  const qa = ws.match(/get quickActions\(\)[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(qa, /if \(svcIsTechnician\(\)\) return \[/)
  assert.doesNotMatch(qa.match(/if \(svcIsTechnician\(\)\) return \[[^\]]*\]/)?.[0] || '', /svcWorkView/,
    'a technician must not be given a shortcut into the Work tab')
  assert.match(ws, /nextActions: \(d\) => \{[\s\S]*?svcIsTechnician\(\)/,
    'next actions must be the tech\'s own bench, not the shop triage queue')
})

test('My Work shows only the jobs assigned to this technician', () => {
  const fn = ws.match(/function svcMyJobs\(d\)[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'svcMyJobs must exist')
  assert.match(fn, /l\.tech_id !== me/, 'a job is mine only when the line carries my id')
  assert.match(fn, /profileContext\?\.id \|\| user\?\.id/,
    'must use the same identity CRM already uses for "mine"')
  assert.match(fn, /if \(l\.deleted_at\) continue/, 'soft-deleted lines are not work')
  assert.match(fn, /blocked: 0, in_progress: 1/, 'blocked work sorts to the top — it needs a human')
})

test('the technician acts through the line progress endpoint only', () => {
  const fn = ws.match(/async function svcJob\(lineId, action\)[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /apiSendJson\(`\/service-engine\/lines\/\$\{lineId\}\/progress`, 'POST'/)
  // Blocking without saying why is how a job silently stalls.
  assert.match(fn, /if \(action === 'block'\)[\s\S]*?if \(!reason \|\| !reason\.trim\(\)\) return/)
  // Cause and correction are the technician's evidence and are asked for at completion.
  assert.match(fn, /if \(action === 'complete'\)[\s\S]*?body\.cause[\s\S]*?body\.correction/)
  assert.match(fn, /ENGINE_DATA\['service-overview'\] = undefined/, 'must refetch, not patch local state')
})

test('the technician surface carries no money and no close', () => {
  const view = ws.match(/if \(svcIsTechnician\(\)\) \{[\s\S]*?\n        return;\n      \}/)?.[0] || ''
  assert.ok(view, 'the My Work render must exist')
  for (const desk of ['svcClose', 'svcEstimate', 'svcAuthoriz', 'balance', 'Total']) {
    assert.ok(!view.includes(desk), `My Work must not surface desk concern: ${desk}`)
  }
  assert.match(view, /My work/)
})

test('state signals are not buried in a truncating line (390px)', () => {
  // Found by rendering at 390px: a coloured state signal appended to a `truncate`
  // line is ellipsed out of existence on a phone, so the advisor never sees that an
  // RO is waiting for parts. Status and flags belong on their own line.
  for (const row of ['svcRoRow', 'svcJobRow']) {
    const fn = wsRaw.match(new RegExp(`function ${row}[\\s\\S]*?\\n\\}\\n`))?.[0] || ''
    assert.ok(fn, `${row} must exist`)
    for (const line of fn.split('\n')) {
      if (!line.includes('truncate')) continue
      assert.ok(!/text-orange-500|waiting for parts/.test(line),
        `${row}: the parts-blocked signal must not sit inside a truncating line`)
    }
    assert.match(fn, /waiting for parts/, `${row} must still surface the parts blocker`)
  }
})
