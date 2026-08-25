import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import { featuresForPlan, productsForPlan } from '../plan-catalog.js'

const FE = fileURLToPath(new URL('../../marketplace-frontend/', import.meta.url))
const read = (rel) => readFileSync(path.join(FE, rel), 'utf8')
const html = read('dashboard.html')
const part2 = read('js/modules/dashboard-part2.js')

// Values built inside a VM context carry that realm's prototypes, which strict
// deepEqual rejects — even for an empty array, which produces a failure whose
// message reads "[]" and looks like a bug in the product. Clone across the
// boundary so assertions compare plainly. (workspace-navigation.test.js hit this
// same trap and documents it.)
const clone = (v) => JSON.parse(JSON.stringify(v))
const registry = (() => {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(read('js/modules/workspace-registry.js'), ctx)
  const w = ctx.window
  return {
    MS_WORKSPACES: clone(w.MS_WORKSPACES),
    MS_ROLE_MOBILE_NAV: clone(w.MS_ROLE_MOBILE_NAV),
    msAllWorkspacePages: () => clone(w.msAllWorkspacePages()),
    msMobileNavForRole: (r) => clone(w.msMobileNavForRole(r)),
  }
})()

// Slice from the START of the map to the FIRST `};` AFTER it. Searching for the
// terminator from position 0 returns a backwards slice that parses to nothing —
// and an empty gate map makes every page look reachable, which is a clean-looking
// result that means nothing. The guard below is what makes this test honest.
const block = (name) => {
  const i = part2.indexOf(name)
  assert.ok(i > -1, `${name} must exist`)
  return part2.slice(i, part2.indexOf('};', i))
}
const parseMap = (t) => Object.fromEntries([...t.matchAll(/'?([\w-]+)'?:\s*'([\w.]+)'/g)].map(m => [m[1], m[2]]))
const parseArr = (t) => Object.fromEntries([...t.matchAll(/'?([\w-]+)'?:\s*\[([^\]]+)\]/g)]
  .map(m => [m[1], [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1])]))

const PAGE_FEATURE = parseMap(block('const PAGE_FEATURE = {'))
const PAGE_ANY = parseArr(block('const PAGE_ANY_FEATURE = {'))
const PAGE_PRODUCT = parseMap(block('const PAGE_PRODUCT = {'))

test('the gate maps actually parsed — an empty parse would pass every check below', () => {
  assert.ok(Object.keys(PAGE_FEATURE).length >= 20, `PAGE_FEATURE parsed ${Object.keys(PAGE_FEATURE).length}`)
  assert.ok(Object.keys(PAGE_ANY).length >= 5, `PAGE_ANY_FEATURE parsed ${Object.keys(PAGE_ANY).length}`)
  assert.ok(Object.keys(PAGE_PRODUCT).length >= 3, `PAGE_PRODUCT parsed ${Object.keys(PAGE_PRODUCT).length}`)
})

// ── No nav entry may point at nothing ────────────────────────────────────────
const containers = new Set([...html.matchAll(/data-page-content="([^"]+)"/g)].map(m => m[1]))

test('every workspace nav target resolves to a real page container', () => {
  const dead = registry.msAllWorkspacePages().filter(p => !containers.has(p))
  assert.deepEqual(dead, [], `nav entries pointing at no container: ${dead.join(', ')}`)
})

test("every role's mobile nav resolves to a real page container", () => {
  const roles = Object.keys(registry.MS_ROLE_MOBILE_NAV)
  assert.ok(roles.length >= 8, `expected the distinct-nav roles, found ${roles.length}`)
  for (const role of roles) {
    const nav = registry.msMobileNavForRole(role)
    assert.ok(nav.length > 0, `${role} must have a mobile nav`)
    const dead = nav.map(p => (typeof p === 'string' ? p : p.page)).filter(p => !containers.has(p))
    assert.deepEqual(dead, [], `${role} mobile nav points at no container: ${dead.join(', ')}`)
  }
})

// ── A plan must not be shown a department it did not buy ─────────────────────
// Reachability is computed the same way dashboard-part2 computes it, then checked
// against what the plan actually sells. The tiering is the product's, not this
// test's: Core is operational DealerOS only, Pro adds the operating departments,
// Complete adds accounting/marketing/website/team, and the standalone MarketSync
// products carry no DealerOS engine at all.
const reachable = (page, feats, prods) => {
  if (PAGE_PRODUCT[page] && !prods.includes(PAGE_PRODUCT[page])) return false
  if (PAGE_ANY[page]) return PAGE_ANY[page].some(f => feats.includes(f))
  if (PAGE_FEATURE[page]) return feats.includes(PAGE_FEATURE[page])
  return true
}

test('a standalone MarketSync product cannot reach the DealerOS operating departments', () => {
  for (const plan of ['marketsync-seo', 'marketsync-digital', 'complete-marketing-suite']) {
    const [f, p] = [featuresForPlan(plan), productsForPlan(plan)]
    for (const wid of ['fni', 'service', 'parts', 'inventory', 'people']) {
      const pages = registry.MS_WORKSPACES[wid].pages.map(x => x.page)
      const open = pages.filter(pg => reachable(pg, f, p))
      assert.deepEqual(open, [],
        `${plan} sells no DealerOS engine but can reach ${wid}: ${open.join(', ')}`)
    }
  }
})

test('DealerOS Core does not expose the departments only Pro and Complete sell', () => {
  const [f, p] = [featuresForPlan('dealer-os-core'), productsForPlan('dealer-os-core')]
  for (const wid of ['fni', 'service', 'parts', 'people']) {
    const open = registry.MS_WORKSPACES[wid].pages.map(x => x.page).filter(pg => reachable(pg, f, p))
    assert.deepEqual(open, [], `Core can reach ${wid}: ${open.join(', ')}`)
  }
})

test('DealerOS Complete reaches every department it sells', () => {
  const [f, p] = [featuresForPlan('dealer-os-complete'), productsForPlan('dealer-os-complete')]
  for (const [wid, ws] of Object.entries(registry.MS_WORKSPACES)) {
    const pages = ws.pages.map(x => x.page)
    const blocked = pages.filter(pg => !reachable(pg, f, p))
    assert.deepEqual(blocked, [],
      `Complete is the everything tier but cannot reach ${wid}: ${blocked.join(', ')}`)
  }
})

// ── Ungated pages are pinned, because "always allowed" is a real decision ─────
// dashboard-part2 documents three: academy, launch and ai-inbox — required
// training and messaging are not plan upsells, and gating SETUP would stop a
// dealership configuring what it just bought.
//
// `commissions` is a FOURTH, and it is not an oversight — it is one page id doing
// two jobs. Sales lists it as "My Commission" (a rep's own earnings, correctly
// broad) and Accounting lists it as "Payroll" (administration). Gates are keyed by
// page id, so no single gate expresses both: gating on os.accounting would take a
// rep's own commission away on every plan without accounting, and leaving it open
// means a manager on a plan without accounting sees a lone "Payroll" entry in an
// otherwise-empty Accounting workspace. Splitting the page id is the real fix and
// is a product decision. Pinned here so it stays visible instead of becoming
// folklore, and so a FIFTH ungated page cannot appear unnoticed.
test('the set of ungated pages is exactly the known set', () => {
  const gated = new Set([...Object.keys(PAGE_FEATURE), ...Object.keys(PAGE_ANY), ...Object.keys(PAGE_PRODUCT)])
  const ungated = [...new Set(registry.msAllWorkspacePages().filter(p => !gated.has(p)))].sort()
  assert.deepEqual(ungated, ['academy', 'ai-inbox', 'commissions'],
    `the ungated set changed — every entry here is reachable on every plan: ${ungated.join(', ')}`)
})
