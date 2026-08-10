import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6 PR 6.5 — the Marketing operating workspace.
//
// My Day is COMPOSED from what each slice already produces. That is the whole design: a
// second opinion about "what needs attention" would drift from the department that owns the
// fact, and then two screens would disagree about the same dealership.

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (u, rel) => readFileSync(new URL(rel, u), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const camp = strip(read(BE, 'routes/campaigns.js'))
const social = strip(read(BE, 'routes/social.js'))
const conv = strip(read(BE, 'routes/conversations.js'))
const ws = strip(read(FE, 'js/modules/marketing-workspace.js'))
const registry = read(FE, 'js/modules/workspace-registry.js')
const part2 = read(FE, 'js/modules/dashboard-part2.js')
const html = read(FE, 'dashboard.html')

// ── My Day is composed, not re-derived ──────────────────────────────────────

test('My Day composes the departments rather than re-deriving them', () => {
  const route = camp.match(/app\.get\('\/marketing\/attention'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the composed attention route must exist')
  for (const builder of ['campaignAttention', 'socialAttention', 'conversationAttention', 'reputationAttention']) {
    assert.ok(route.includes(builder), `My Day must compose ${builder}`)
  }
  // Each source is exported as a builder so composing is possible at all.
  assert.match(social, /export async function socialAttention/)
  assert.match(conv, /export async function conversationAttention/)
  assert.match(camp, /export async function campaignAttention/)
})

test('one failing department does not blank the whole day', () => {
  const route = camp.match(/app\.get\('\/marketing\/attention'[\s\S]*?\n  \}\)/)?.[0] || ''
  const guarded = [...route.matchAll(/Attention\(req\.dealershipId\)\.catch\(\(\) => \[\]\)/g)].length
  assert.equal(guarded, 4, 'each source must degrade to empty on its own')
})

test('opportunities are separated from problems, not ranked against them', () => {
  const route = camp.match(/app\.get\('\/marketing\/attention'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /needs_attention/)
  assert.match(route, /opportunities/)
  // "This is working, do more" is not a smaller version of "this is broken".
  assert.match(route, /filter\(i => i\.severity >= 2\)/)
  assert.match(route, /filter\(i => i\.severity < 2\)/)
})

// ── Campaign attention is checkable ─────────────────────────────────────────

test('every campaign attention item is derived from real spend or attribution', () => {
  const fn = camp.match(/export async function campaignAttention[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'campaignAttention must exist')
  for (const kind of ['campaign_needs_approval', 'campaign_spending_no_leads', 'campaign_over_budget',
                      'campaign_performing_well', 'campaign_ended_still_active', 'campaign_gross_incomplete']) {
    assert.ok(fn.includes(kind), `missing attention kind: ${kind}`)
  }
  // The most expensive thing marketing can do unnoticed.
  assert.match(fn, /s\.actual > 0 && p\.leads === 0/)
  // Budget is compared against ACTUAL, never treated as spend.
  assert.match(fn, /s\.budget > 0 && s\.actual > s\.budget/)
  // A missing gross is surfaced rather than averaged away.
  assert.match(fn, /p\.gross_unknown > 0/)
  for (const field of ['kind', 'severity', 'subject', 'reason', 'owner', 'action', 'ref']) {
    assert.ok(fn.includes(`${field}:`), `attention items must carry ${field}`)
  }
})

test('a gross gap is handed to Accounting, not claimed by Marketing', () => {
  const fn = camp.match(/export async function campaignAttention[\s\S]*?\n\}\n/)?.[0] || ''
  const block = fn.match(/campaign_gross_incomplete[\s\S]{0,220}/)?.[0] || ''
  assert.match(block, /owner: 'Accounting'/, 'the department that can fix it owns it')
})

// ── The workspace ───────────────────────────────────────────────────────────

test('Marketing registers on the shared engine shell', () => {
  assert.match(ws, /ENGINES\['marketing-overview'\]\s*=/)
  assert.match(ws, /rootId: 'marketing-overview-root'/)
  for (const prim of ['engKpi', 'engCard', 'engEmpty']) assert.ok(ws.includes(prim), `must reuse ${prim}`)
  assert.doesNotMatch(ws, /function (engKpi|engCard|engEmpty|renderEngine|engineTab)\b/,
    'must not redefine a shared primitive')
  assert.match(ws, /tabLabels: \{ overview: 'My Day'/)
  // Every tab the getter can return needs a label, or the shell prints the raw key.
  const order = ws.match(/get tabOrder\(\)[\s\S]*?\n  \},/)?.[0] || ''
  const labels = ws.match(/tabLabels: \{[^}]*\}/)?.[0] || ''
  for (const t of [...order.matchAll(/'([a-z]+)'/g)].map(m => m[1]).filter(t => t !== 'role')) {
    if (/^[A-Z_]+$/.test(t)) continue
    assert.ok(labels.includes(`${t}:`), `tab "${t}" has no label`)
  }
})

test('the workspace computes no attention of its own', () => {
  // It renders what the server composed. Deciding severity here would be a second opinion.
  assert.doesNotMatch(ws, /severity: [0-9]/, 'severity is the server\'s judgement')
  assert.doesNotMatch(ws, /kind: 'campaign_|kind: 'social_|kind: 'conversation_/,
    'the workspace must not invent attention kinds')
  assert.match(ws, /d\.needsAttention/)
  assert.match(ws, /d\.opportunities/)
})

test('it composes existing endpoints and introduces none', () => {
  // '/marketing/attention' became '/my-day' in 6.10 — the same composition, widened across
  // departments and gated per source.
  const KNOWN = ['/my-day', '/campaigns', '/social/accounts', '/social/posts',
                 '/conversations', '/marketing/roi', '/marketing/assets']
  for (const c of [...ws.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])) {
    assert.ok(KNOWN.includes(c), `unexpected read endpoint: ${c}`)
  }
  const WRITES = ['/campaigns/${id}/status', '/conversations/${conversationId}/takeover',
                  '/social/posts', '/social/posts/${postId}/publish']
  for (const w of [...ws.matchAll(/apiSendJson\([`']([^`']+)[`']/g)].map(m => m[1])) {
    assert.ok(WRITES.includes(w), `unexpected write target: ${w}`)
  }
})

test('the composer offers only accounts the server said this user may publish to', () => {
  const fn = ws.match(/function mktCompose\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'the composer must exist')
  assert.match(fn, /accounts\.filter\(a => a\.can_publish\)/)
  // An account it refused is shown WITH the refusal rather than vanishing.
  assert.match(fn, /accounts\.filter\(a => !a\.can_publish\)/)
  assert.match(fn, /a\.why/)
  assert.doesNotMatch(fn, /profileContext\?\.role/, 'the browser does not re-decide publishing rights')
})

test('publish-now reports what actually happened per account', () => {
  const fn = ws.match(/async function mktPublishNow[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /x\.status === 'published'/)
  assert.match(fn, /x\.status === 'failed' \|\| x\.status === 'skipped'/)
  // A partial result is never rounded up into a success message.
  assert.match(fn, /could not publish to/)
})

test('a failed post shows the provider reason, not just the word failed', () => {
  const view = ws.match(/if \(__mktView === 'social'\)[\s\S]*?\n      \}/)?.[0] || ''
  assert.match(view, /failed\[0\]\?\.error/,
    '"Failed" alone tells nobody whether to reconnect, wait, or give up')
  assert.match(view, /actionLabel: failed\.length \? 'Retry' : 'Publish'/)
})

test('Studio is a library, and says so when it is empty', () => {
  const view = ws.match(/if \(__mktView === 'studio'\)[\s\S]*?\n      \}/)?.[0] || ''
  assert.ok(view, 'the Studio view must exist')
  assert.match(view, /mktUploadAsset/)
  assert.match(view, /engEmpty\('Nothing in Studio yet/)
  assert.match(view, /loading="lazy"/, 'a media grid must not block first paint')
})

test('linked and inferred attribution are never added together', () => {
  const view = ws.match(/if \(__mktView === 'attribution'\)[\s\S]*?\n      \}/)?.[0] || ''
  assert.ok(view, 'the attribution view must exist')
  assert.match(view, /Linked/)
  assert.match(view, /Inferred/)
  assert.match(view, /never added together/)
  // The inferred figures must stay labelled as estimates.
  assert.match(view, /est_roi_pct/)
  assert.match(view, /estimated gross/)
})

test('an incomplete gross is said out loud wherever it is shown', () => {
  assert.match(ws, /gross_complete === false/)
  assert.match(ws, /gross incomplete|incomplete, some deliveries have no posted journal/)
  // And it never silently becomes a number.
  assert.doesNotMatch(ws, /avg_gross|DEFAULT_AVG_GROSS|\* 3500/)
})

test('publishing rights are reported by the server, not decided here', () => {
  const view = ws.match(/if \(__mktView === 'social'\)[\s\S]*?\n      \}/)?.[0] || ''
  assert.match(view, /a\.can_publish/, 'the server says what this user may do')
  assert.match(view, /a\.why/, 'and why, when it refuses')
  assert.doesNotMatch(view, /ownership === 'dealership' \? .*permission|profileContext\?\.role/,
    'the workspace must not re-decide publishing rights')
})

test('a post that partly failed is not reported as published', () => {
  const view = ws.match(/if \(__mktView === 'social'\)[\s\S]*?\n      \}/)?.[0] || ''
  assert.match(view, /const partial = failed\.length > 0 && failed\.length < targets\.length/)
  assert.match(view, /partial \? 'Partly published' : failed\.length \? 'Failed'/)
  // The count is named, not just coloured — "a publication failed" hides how many.
  assert.match(view, /\$\{failed\.length\} failed to publish/)
})

test('an item belonging to another department hands off to it', () => {
  const fn = ws.match(/function mktGo\(kind\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'the routing helper must exist')
  assert.match(fn, /campaign_gross_incomplete'\) return "switchPage\('accounting-overview'\)"/,
    'a gross gap belongs to Accounting')
  assert.match(fn, /conversation_/)
  assert.match(fn, /social_/)
})

test('Marketing is wired into the shell and leads with My Day', () => {
  assert.match(html, /data-page-content="marketing-overview"/)
  assert.match(html, /id="marketing-overview-root"/)
  assert.match(part2, /if \(pageId === 'marketing-overview'\) loadMarketingWorkspace\(\)/)
  assert.match(part2, /'marketing-overview': 'os\.marketing'/, 'must carry an entitlement key')
  const block = registry.match(/\n  marketing: \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(block, /\{ page: 'marketing-overview', label: 'My Day' \}/)
  // The existing pages stay reachable — KEEP over REPLACE.
  for (const p of ['email-marketing', 'website', 'ai-home', 'ai-inbox']) {
    assert.ok(block.includes(`page: '${p}'`), `existing page "${p}" must stay reachable`)
  }
  const pos = (f) => html.indexOf(`<script src="js/modules/${f}`)
  assert.ok(pos('marketing-workspace.js') > pos('dashboard-part26.js'), 'must load after the dashboard parts')
})
