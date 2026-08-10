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
  assert.match(ws, /tabLabels: \{ overview: 'Today'/)
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
                  '/service/appointments/${appointmentId}/check-in']
  for (const w of [...ws.matchAll(/apiSendJson\(`([^`]+)`/g)].map(m => m[1])) {
    assert.ok(WRITES.includes(w), `unexpected write target: ${w}`)
  }
})

test('Today is attention-first and every category is real', () => {
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
  assert.match(block, /\{ page: 'service-overview', label: 'Today' \}/, 'Service must lead with Today')
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
