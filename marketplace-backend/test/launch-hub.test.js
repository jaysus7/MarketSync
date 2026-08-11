import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Phase 7 PR 7.6 — the Dealer Launch Hub.
//
// `buildLaunch`, `evaluate` and `forFeature` are pure and take their requirements as an
// argument, so these run the REAL engine over real state rather than asserting that source text
// exists. That seam is also why entitlement and permission can be tested in BOTH directions.

import { buildLaunch, evaluate, forFeature, REQUIREMENTS, REQUIREMENT_TYPES } from '../routes/launch-hub.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const src = read('routes/launch-hub.js')
const hub = strip(src)
const migration = read('migrations/2026-08-10-phase7-launch.sql')
const server = read('server.js')

// A dealership with everything filled in.
const READY = {
  dealership: {
    legal_name: 'Example Motors Ltd', street_address: '1 Main St', city: 'Toronto',
    province: 'ON', postal_code: 'M1M 1M1', timezone: 'America/Toronto',
    operating_hours: { mon: { open: '09:00', close: '18:00' } },
    hst_number: '123456789RT0001', branding: { logo: 'x' }, site_published: true,
    feed_url: 'https://example.com/feed.xml', lead_routing: { mode: 'round_robin' },
  },
  locations: [{ is_primary: true, active: true }],
  staffCount: 4, glAccountCount: 247, vehicleCount: 30,
  trainingAssignmentCount: 12, publishedPolicyCount: 2, adminCount: 1,
}
const EMPTY = {
  dealership: {}, locations: [],
  staffCount: 0, glAccountCount: 0, vehicleCount: 0,
  trainingAssignmentCount: 0, publishedPolicyCount: 0, adminCount: 0,
}
const ALL_FEATURES = ['os.accounting', 'os.inventory', 'os.website', 'os.service']

// ── Operational and fully configured are different answers ──────────────────

test('a fully set-up dealership is both operational and fully configured', () => {
  const l = buildLaunch(READY, { features: ALL_FEATURES })
  assert.equal(l.operational, true)
  assert.equal(l.fully_configured, true)
  assert.equal(l.outstanding_total, 0)
})

test('a dealership can be operational without being fully configured', () => {
  // It can sell a car before it has picked a logo. Conflating the two produces a progress bar
  // that is either permanently short of 100% or wrong about what matters.
  const state = { ...READY, dealership: { ...READY.dealership, branding: null, lead_routing: null } }
  const l = buildLaunch(state, { features: ALL_FEATURES })
  assert.equal(l.operational, true, 'a logo does not stop a dealership operating')
  assert.equal(l.fully_configured, false)
  assert.ok(l.outstanding_total > 0)
  assert.equal(l.outstanding_to_launch, 0)
})

test('an empty dealership is neither', () => {
  const l = buildLaunch(EMPTY, { features: ALL_FEATURES })
  assert.equal(l.operational, false)
  assert.equal(l.fully_configured, false)
  assert.ok(l.outstanding_to_launch >= 5)
})

test('a missing timezone alone stops the dealership being operational', () => {
  // The one requirement whose absence is invisible: every date silently becomes UTC.
  const state = { ...READY, dealership: { ...READY.dealership, timezone: null } }
  const l = buildLaunch(state, { features: ALL_FEATURES })
  assert.equal(l.operational, false)
  assert.equal(l.items.find(i => i.key === 'timezone').status, 'outstanding')
})

// ── Entitlement decides which requirements exist ────────────────────────────

test('a requirement for a feature the dealership does not have does not exist', () => {
  // A dealership without Service is not "incomplete" for having no service hours.
  const l = buildLaunch(EMPTY, { features: [] })
  assert.ok(!l.items.some(i => i.key === 'service_hours'))
  assert.ok(!l.items.some(i => i.key === 'chart_of_accounts'))
  // …but the launch requirements are everybody's.
  assert.ok(l.items.some(i => i.key === 'timezone'))
})

test('entitlement changes what "fully configured" means', () => {
  const withoutService = { ...EMPTY, dealership: { ...READY.dealership, operating_hours: null } }
  const noService = buildLaunch(withoutService, { features: ['os.accounting'] })
  const withService = buildLaunch(withoutService, { features: ['os.accounting', 'os.service'] })
  assert.ok(!noService.items.some(i => i.key === 'service_hours'))
  assert.equal(withService.items.find(i => i.key === 'service_hours').status, 'outstanding')
})

test('when no entitlement list is supplied, every requirement is evaluated', () => {
  // Defaulting to "hide it" would let a missing access context quietly report a dealership as
  // fully configured.
  const l = buildLaunch(EMPTY)
  assert.ok(l.items.some(i => i.key === 'chart_of_accounts'))
})

// ── A feature that is not set up is named ───────────────────────────────────

test('an outstanding feature requirement names what it blocks', () => {
  const state = { ...READY, glAccountCount: 0 }
  const l = buildLaunch(state, { features: ALL_FEATURES })
  assert.deepEqual(l.blocked_features, ['Accounting'])
  assert.equal(l.operational, true, 'Accounting being unconfigured does not stop the dealership')
})

test('a department can ask about itself and get only what it is missing', () => {
  // This is how setup reaches somebody at the moment it matters, rather than as a wall on the
  // way in.
  const l = buildLaunch({ ...READY, glAccountCount: 0 }, { features: ALL_FEATURES })
  const acct = forFeature(l, 'Accounting')
  assert.equal(acct.ready, false)
  assert.equal(acct.missing.length, 1)
  assert.equal(acct.missing[0].key, 'chart_of_accounts')

  const inv = forFeature(l, 'Inventory')
  assert.equal(inv.ready, true)
  assert.equal(inv.missing.length, 0)
})

// ── Role decides who may satisfy a requirement ──────────────────────────────

test('a requirement the caller cannot satisfy is marked, not hidden', () => {
  // Hiding it would leave the dealership with an invisible blocker; nagging somebody who
  // cannot act would be noise. Naming it is the third option.
  const canNothing = buildLaunch(EMPTY, { features: [], can: () => false })
  assert.ok(canNothing.items.every(i => i.actionable_by_you === false))
  assert.ok(canNothing.items.length > 0, 'and they are still listed')

  const canSettings = buildLaunch(EMPTY, { features: [], can: (p) => p === 'settings.manage' })
  assert.equal(canSettings.items.find(i => i.key === 'timezone').actionable_by_you, true)
  assert.equal(canSettings.items.find(i => i.key === 'employees').actionable_by_you, false)
})

test('without a permission checker, actionability is unknown rather than assumed true', () => {
  const l = buildLaunch(EMPTY, { features: [] })
  assert.ok(l.items.every(i => i.actionable_by_you === null))
})

// ── A failed check is not a satisfied one ───────────────────────────────────

test('a requirement whose check throws is unknown, never done and never outstanding', () => {
  // Reporting "not done" because a query failed would send a dealership to re-enter something
  // they had already entered.
  const exploding = [{
    key: 'boom', type: 'REQUIRED_TO_LAUNCH', area: 'Dealership', label: 'Boom',
    why: 'x', permission: 'settings.manage',
    satisfied: () => { throw new Error('database unavailable') },
  }]
  const l = buildLaunch(EMPTY, { features: [], requirements: exploding })
  assert.equal(l.items[0].status, 'unknown')
  assert.deepEqual(l.unknown, ['boom'])
  assert.equal(l.complete, false)
  assert.equal(l.operational, false, 'a hub that could not read everything must not declare readiness')
  assert.equal(l.fully_configured, false)
})

test('a null count from a failed read does not satisfy a requirement', () => {
  const l = buildLaunch({ ...READY, staffCount: null }, { features: ALL_FEATURES })
  assert.equal(l.items.find(i => i.key === 'employees').status, 'outstanding')
})

// ── Readiness is derived, never stored ──────────────────────────────────────

test('nothing stores that setup was completed', () => {
  // A stored tick can be true while the thing it claims is false. Scanned with comments
  // stripped: the migration's comment explains that these columns are deliberately absent, and
  // an explanation must not read as the thing it is warning against.
  const sql = migration.replace(/^\s*--.*$/gm, '')
  for (const [name, s] of [['the engine', hub], ['the migration', sql]]) {
    assert.ok(!/setup_completed|onboarding_step|setup_finished|launch_completed/i.test(s),
      `${name} stores setup completion`)
  }
  // There is no checklist table either — readiness is recomputed on every read.
  assert.ok(!/create table[\s\S]{0,60}(checklist|setup_task|onboarding_step)/i.test(sql))
})

test('every requirement reads real state through a function', () => {
  for (const r of REQUIREMENTS) {
    assert.equal(typeof r.satisfied, 'function', `${r.key} does not check anything`)
    assert.ok(r.label && r.why, `${r.key} does not explain itself`)
    assert.ok(Object.values(REQUIREMENT_TYPES).includes(r.type), `${r.key} has an unknown type: ${r.type}`)
    assert.ok(r.permission, `${r.key} does not say who can satisfy it`)
    assert.ok(r.area, `${r.key} has no area`)
  }
})

test('every feature requirement names both its entitlement and what it blocks', () => {
  for (const r of REQUIREMENTS.filter(r => r.type === 'REQUIREMENT_FOR_FEATURE' || r.type === 'REQUIRED_FOR_FEATURE')) {
    assert.ok(r.feature, `${r.key} is feature-scoped but names no entitlement`)
    assert.ok(r.blocks, `${r.key} does not say what it blocks`)
  }
})

test('requirement keys are unique', () => {
  const keys = REQUIREMENTS.map(r => r.key)
  assert.equal(new Set(keys).size, keys.length)
})

// ── Setup is not a lock ─────────────────────────────────────────────────────

test('the hub exports no middleware and gates nothing', () => {
  // The brief forbids a blanket application lock on setup completion. The way to keep that
  // true is for this module to be incapable of imposing one.
  assert.ok(!/export function require\w*|next\(\)/.test(hub.replace(/const dealership = [\s\S]*?\n\n/, '')),
    'the hub must not export a gate')
  assert.ok(!/res\.status\(403\)/.test(hub), 'the hub never refuses a request over setup state')
})

test('no other module asks the hub for permission', () => {
  // If setup ever became a lock, it would be by some other file importing this one and
  // branching on it. This pins that out.
  for (const file of ['server.js', 'middleware.js', 'access.js', 'authorization.js']) {
    const s = read(file)
    if (file === 'server.js') {
      assert.ok(!/buildLaunch|forFeature|gather\(/.test(s), 'server.js must only register the hub')
      continue
    }
    assert.ok(!/launch-hub/.test(s), `${file} imports the launch hub — setup must never gate access`)
  }
})

test('the read endpoint is not permission-gated', () => {
  // Everybody can see what their dealership still needs; only changing it is gated.
  assert.match(hub, /app\.get\('\/launch', requireAuth, dealership/)
  assert.ok(!/app\.get\('\/launch', requireAuth, canView/.test(hub))
})

test('changing configuration requires MFA and settings.manage', () => {
  assert.match(hub, /app\.patch\('\/launch\/dealership', requireAuth, requireMfa, canView/)
  assert.match(hub, /app\.post\('\/launch\/locations', requireAuth, requireMfa, canView/)
})

// ── Enter once ──────────────────────────────────────────────────────────────

test('the first location is seeded from the dealership rather than retyped', () => {
  assert.match(hub, /street_address: b\.street_address \?\? \(first \? d\?\.street_address : null\)/)
  assert.match(hub, /is_primary: b\.is_primary !== undefined \? !!b\.is_primary : first/)
})

test('one primary location, enforced by the database', () => {
  assert.match(migration, /create unique index if not exists dealership_locations_one_primary[\s\S]{0,140}where is_primary and active/)
  assert.match(hub, /There is already a primary location/)
})

test('a timezone is validated against the database\'s own zone table', () => {
  // A typo that silently mis-shifts every date is the failure this prevents, and a hard-coded
  // list would go stale the next time a country changes its rules.
  assert.match(migration, /pg_timezone_names/)
  assert.match(migration, /create trigger dealerships_timezone_valid/)
  assert.match(migration, /create trigger dealership_locations_timezone_valid/)
  assert.ok(!/default 'UTC'|default 'America/.test(migration), 'a guessed timezone is worse than a missing one')
})

test('the configuration patch accepts only canonical fields', () => {
  const allowed = hub.match(/const allowed = \[([\s\S]*?)\]/)?.[1] || ''
  assert.ok(allowed.includes('timezone') && allowed.includes('legal_name'))
  for (const forbidden of ['products', 'feature_flags', 'billing_status', 'plan', 'stripe_customer_id']) {
    assert.ok(!allowed.includes(forbidden), `setup must not be able to change ${forbidden}`)
  }
})

// ── My Day ──────────────────────────────────────────────────────────────────

test('setup reaches My Day only when something is actually not working', async () => {
  const { MY_DAY_SOURCES } = await import('../routes/my-day.js')
  const source = MY_DAY_SOURCES.find(s => s.key === 'setup')
  assert.ok(source, 'Setup does not reach My Day')
  assert.equal(source.permission, 'settings.manage')
  // A queue that nags about a logo is a queue people stop reading.
  const fn = hub.match(/export async function launchAttention[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(!/RECOMMENDED|OPTIONAL/.test(fn), 'recommendations must not enter the day')
  assert.match(fn, /setup_required_to_launch/)
  assert.match(fn, /setup_blocks_feature/)
})

test('the hub is registered on the server', () => {
  assert.match(server, /import \{ registerLaunchHub \} from '\.\/routes\/launch-hub\.js'/)
  assert.match(server, /^registerLaunchHub\(app\)/m)
})

// ── The hub is reachable ────────────────────────────────────────────────────
//
// The backend was nearly shipped without any of this. A setup engine a dealership cannot open
// is the exact dead-wiring shape Phase 7 keeps finding, so the whole chain is pinned.

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const readFE = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const html = readFE('dashboard.html')
// Stripped, like every other source scan in this file: a comment explaining that the hub
// deliberately has no disabled navigation must not read as disabled navigation.
const workspaceRaw = readFE('js/modules/launch-workspace.js')
const workspace = strip(workspaceRaw)
const part2 = readFE('js/modules/dashboard-part2.js')

test('the Launch Hub has a page container, a router entry and a script tag', () => {
  assert.match(html, /data-page-content="launch"/)
  assert.match(html, /id="launch-root"/)
  assert.match(part2, /pageId === 'launch'\) loadLaunchHub\(\)/)
  assert.match(html, /<script src="js\/modules\/launch-workspace\.js\?v=[^"]+"><\/script>/)
  assert.match(workspace, /rootId: 'launch-root'/)
})

test('setup is not a permanent nav entry — it is a bar that removes itself', () => {
  // A navigation slot held forever by a job you finish once is furniture. Setup is one
  // line at the foot of the shell that opens a modal and disappears when the dealership
  // is configured. The PAGE stays reachable — deep links and bookmarks still work — it
  // simply does not occupy the sidebar.
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(readFE('js/modules/workspace-registry.js'), ctx)
  const reg = ctx.window.MS_WORKSPACES
  assert.ok(!reg.launch, 'setup must not hold a permanent sidebar slot')
  assert.match(html, /data-page-content="launch"/, 'the page itself must stay reachable')
  assert.match(part2, /pageId === 'launch'\) loadLaunchHub\(\)/)
})

test('setup is not entitlement-gated — a dealership can configure what it just bought', () => {
  const map = part2.match(/const PAGE_FEATURE = \{[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(map, 'PAGE_FEATURE not found')
  assert.ok(!/^\s*launch:/m.test(map))
})

test('the screen shows two answers, never one progress number', () => {
  assert.match(workspace, /Can you operate/)
  assert.match(workspace, /Fully configured/)
  assert.ok(!/progress|percent|%\s*complete/i.test(workspace),
    'one bar would conflate "cannot operate" with "has not picked a logo"')
})

test('the screen blocks nothing', () => {
  assert.match(workspaceRaw, /Nothing here blocks you/)
  assert.ok(!/disabled|location\.href|window\.location =/.test(workspace),
    'the hub must never redirect or disable anything')
})

test('a check that failed renders as "could not check", not as done or outstanding', () => {
  assert.match(workspace, /Could not check/)
  assert.match(workspace, /Could not be checked/)
})

test('a department can show its own setup prompt without a wall', () => {
  // The other half of "not a wall": the department tells you what it needs, in place.
  assert.match(workspace, /function launchFeatureNotice/)
  assert.match(workspace, /if \(!missing \|\| !missing\.length\) return ''/,
    'a configured dealership must see no setup furniture at all')
})

test('a requirement somebody else has to satisfy says so', () => {
  assert.match(workspace, /Somebody with \$\{esc\(i\.permission\)\} has to do this/)
})

test('every launch requirement has a working contextual action', () => {
  for (const requirement of REQUIREMENTS) {
    assert.match(workspaceRaw, new RegExp(`\\b${requirement.key}: \\[`), `${requirement.key} has no UI action`)
  }
  assert.match(workspace, /i\.actionable_by_you !== false && action/)
})

test('incomplete setup shows once, at the bottom, from canonical launch state', () => {
  assert.match(html, /id="setup-status-banner"/)
  // It opens a modal rather than navigating away from whatever you were doing.
  assert.match(html, /onclick="msSetupModal\(\)"/)
  assert.match(part2, /async function msSetupModal/)
  assert.match(part2, /fetch\(`\$\{API\}\/launch`/)
  assert.match(part2, /launch\.fully_configured/)
  assert.match(part2, /i\.type === 'REQUIRED_TO_LAUNCH'/)
  assert.match(workspace, /refreshSetupIndicator\(\)/)
  // Done means gone — no leftover "0 remaining" strip to dismiss.
  assert.match(part2, /if \(launch\.fully_configured\) \{ banner\.classList\.add\('hidden'\)/)
  // And it must sit AFTER the page content, not between the header and every department.
  assert.ok(html.indexOf('id="setup-status-banner"') > html.indexOf('</main>'),
    'the setup bar must be at the foot of the shell, not above every page')
})
