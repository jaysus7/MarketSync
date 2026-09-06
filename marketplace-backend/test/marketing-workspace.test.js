import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
  assert.match(ws, /tabLabels: \{ overview: 'Pulse'/)
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

test('Marketing Pulse renders connected sources and never demo KPIs', () => {
  const view = ws.match(/function mktPulseOverview\([^)]*\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(view, 'the connected-data Marketing Pulse renderer must exist')
  for (const source of ['needsAttention', 'opportunities', 'campaigns', 'automations', 'accounts', 'posts', 'conversations']) {
    assert.ok(view.includes(`d.${source}`), `Marketing Pulse must read ${source} from its fetched data`)
  }
  assert.match(view, /sourceStatus/)
  assert.match(view, /No value is being estimated/)
  assert.match(view, /belongsToMarketing/, 'dealership-wide My Day data must be scoped to Marketing ownership')
  assert.match(view, /\^\(campaign\|social\|conversation\|reputation\)_/)
  for (const fake of ['9,480', '19.4%', '14,820', '99.4%', '99.8%', '18.2%', '$148.2k', '$94.5k']) {
    assert.ok(!view.includes(fake), `Marketing Pulse must not render hard-coded demo metric ${fake}`)
  }
  // The per-suite demo markup that used to trail the Pulse call is gone entirely, so
  // `overview` is now just: build the caveat, render the connected Pulse, return. That
  // is stronger than the old "unreachable" guarantee — assert the branch cannot come back.
  const overviewStart = ws.indexOf('overview(body, d)')
  const pulseCall = ws.indexOf('mktPulseOverview(body, d, suite, cfg, caveat)', overviewStart)
  assert.ok(pulseCall > overviewStart, 'connected Pulse must render from the overview tab')
  assert.doesNotMatch(ws, /if \(suite === 'sales'\)/, 'legacy per-suite demo markup must stay deleted')
  assert.match(ws.slice(pulseCall, pulseCall + 200), /return;/, 'overview must end at the connected Pulse')
})

test('Marketing Pulse preserves API failure separately from a real zero', () => {
  const fetcher = ws.match(/fetch: async \(\) => \{[\s\S]*?\n  \},\n\n  tabs:/)?.[0] || ''
  assert.ok(fetcher, 'Marketing fetcher must exist')
  assert.match(fetcher, /sourceStatus:/)
  assert.match(fetcher, /sourceErrors:/)
  for (const source of ['myDay', 'campaigns', 'accounts', 'posts', 'conversations', 'roi', 'automations']) {
    assert.ok(fetcher.includes(`safe('${source}'`), `${source} must report availability`)
  }
})

test('it composes existing endpoints and introduces none', () => {
  // The workspace must only call endpoints the backend actually serves. A hand-kept
  // whitelist went stale the moment the Website/Discoverability/Leads tabs landed AND
  // silently let a dead call through (`GET /websites`, which has no route at all and
  // 404'd on every Design Studio open). So index the real Express routes and check
  // every call against them instead — no list to maintain, and a genuinely new or
  // misspelled endpoint still fails.
  const routes = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.js')) {
        for (const m of readFileSync(full, 'utf8')
          .matchAll(/\b(?:app|router)\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) routes.add(m[1])
      }
    }
  }
  walk(new URL('../routes', import.meta.url).pathname)
  assert.ok(routes.size > 100, 'the route index must actually have found the backend routes')

  // `${expr}` path segments are dynamic ids; match them against Express `:param` slots.
  const covered = (endpoint) => {
    const parts = endpoint.replace(/\$\{[^}]*\}/g, ':p').split('?')[0].replace(/\/+$/, '').split('/')
    for (const route of routes) {
      const rp = route.split('/')
      if (rp.length !== parts.length) continue
      if (parts.every((seg, i) => rp[i].startsWith(':') || seg === ':p' || rp[i] === seg)) return true
    }
    return false
  }

  const reads = [...ws.matchAll(/apiGetJson\(['`]([^'`]+)/g)].map((m) => m[1])
  const writes = [...ws.matchAll(/apiSendJson\([`']([^`']+)[`']/g)].map((m) => m[1])
  assert.ok(reads.length && writes.length, 'the workspace must still be composing real calls')
  for (const endpoint of reads) assert.ok(covered(endpoint), `unserved read endpoint: ${endpoint}`)
  for (const endpoint of writes) assert.ok(covered(endpoint), `unserved write target: ${endpoint}`)
})

test('the composer offers only accounts the server said this user may publish to', () => {
  const fn = ws.match(/function mktCompose\([^)]*\)[\s\S]*?\n\}/)?.[0] || ''
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
  const view = ws.slice(ws.indexOf('function mktSocialSection'), ws.indexOf('function mktConversationsView'))
  assert.match(view, /failed\[0\]\?\.error/,
    '"Failed" alone tells nobody whether to reconnect, wait, or give up')
  assert.match(view, />Retry<\/button>/)
})

test('Studio creates canonical assets and schedules through the shared composer', () => {
  const view = ws.slice(ws.indexOf('function mktStudioView'), ws.indexOf('function mktSocialSection'))
  assert.ok(view, 'the Studio view must exist')
  assert.match(view, /mktUploadAsset/)
  assert.match(view, /engEmpty\('Nothing in Studio yet/)
  assert.match(view, /loading="lazy"/, 'a media grid must not block first paint')
  assert.match(view, /mktStudioOpen/)
  assert.match(ws, /apiSendJson\('\/marketing\/studio\/render'/)
  assert.match(ws, /mktCompose\(\{ assetUrl: result\.asset\.public_url/,
    'Studio must hand the rendered canonical asset to the shared Social composer')
})

test('Studio is directly discoverable from Marketing, labelled "Design Studio"', () => {
  // It is a department tab of its own now, not a shortcut into a sub-nav. Renamed
  // from "Visual Studio" to "Design Studio" — pinned here so it stays fixed.
  assert.match(ws, /studio: 'Design Studio'/, 'Studio must be a tab in the Marketing header, labelled "Design Studio"')
  // icon was 'image', a key SVG_ICONS never defined — svgIcon() silently fell back
  // to a plain dot. Fixed to 'camera', a real icon, while pinning the label/tab wiring.
  assert.match(ws, /\{ label: 'Design Studio', icon: 'camera', onclick: "engineTab\('marketing-overview','studio'\)" \}/)
})

test('linked and inferred attribution are never added together', () => {
  const view = ws.slice(ws.indexOf('function mktAttributionView'))
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
  const view = ws.slice(ws.indexOf('function mktSocialSection'), ws.indexOf('function mktConversationsView'))
  assert.match(view, /a\.can_publish/, 'the server says what this user may do')
  assert.match(view, /a\.why/, 'and why, when it refuses')
  assert.doesNotMatch(view, /ownership === 'dealership' \? .*permission|profileContext\?\.role/,
    'the workspace must not re-decide publishing rights')
})

test('a post that partly failed is not reported as published', () => {
  const view = ws.slice(ws.indexOf('function mktSocialSection'), ws.indexOf('function mktConversationsView'))
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
  // The sidebar entry for marketing-overview now opens the Design Studio tab (commits
  // 49d4824 / 50251b0 moved Design Studio onto this page). Pulse did not go away — it is
  // the workspace's own first tab — so assert the page is registered here AND that Pulse
  // is still a reachable destination inside it, rather than pinning the sidebar label.
  assert.match(block, /\{ page: 'marketing-overview',/, 'marketing-overview must stay in the Marketing group')
  assert.match(ws, /suiteItem\('marketing-overview', 'Pulse', 'chart', \{ tab: 'overview' \}\)/,
    'Marketing Pulse must remain reachable from the workspace nav')
  // The existing pages stay reachable — KEEP over REPLACE.
  for (const p of ['email-marketing', 'website', 'ai-home', 'ai-inbox']) {
    assert.ok(block.includes(`page: '${p}'`), `existing page "${p}" must stay reachable`)
  }
  const pos = (f) => html.indexOf(`<script src="js/modules/${f}`)
  assert.ok(pos('marketing-workspace.js') > pos('dashboard-part26.js'), 'must load after the dashboard parts')
})
