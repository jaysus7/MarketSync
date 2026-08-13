import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 4 Batch 3 — the Service-only end-to-end.
//
// The product rule this file exists to enforce: MarketSync is one DealerOS core with
// independently purchasable department engines, and Service must be a COMPLETE
// standalone department — a dealership can buy Service alone and operate it without
// owning Sales, Inventory, F&I, Accounting, Marketing or HR.
//
// So the question here is not "does the workflow work" (fixedops-batch1-e2e.test.js
// pins the chain). It is: what does Service REQUIRE in order to work, and is every one
// of those things core rather than another department?

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (u, rel) => readFileSync(new URL(rel, u), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const eng = strip(read(BE, 'routes/service-engine.js'))
const engRaw = read(BE, 'routes/service-engine.js')
const svcWs = strip(read(FE, 'js/modules/service-workspace.js'))
const partsWs = strip(read(FE, 'js/modules/parts-workspace.js'))
const part2 = read(FE, 'js/modules/dashboard-part2.js')

// The departments a Service-only dealership has NOT bought.
const OTHER_DEPARTMENTS = ['deal-engine', 'inventory-engine', 'fni', 'sales-workspace',
                           'inventory-workspace', 'marketing', 'people']

test('Service depends on core primitives only, never on another department', () => {
  const imports = [...engRaw.matchAll(/^import .*? from '([^']+)'/gm)].map(m => m[1])
  assert.ok(imports.length, 'expected to find imports')
  for (const spec of imports) {
    for (const dept of OTHER_DEPARTMENTS) {
      assert.ok(!spec.includes(dept),
        `Service imports ${spec}; a Service-only dealership does not own ${dept}`)
    }
  }
  // What it MAY depend on, and why each is core rather than a department:
  //   shared/middleware/authorization/audit — the platform itself
  //   events                                — how departments talk without coupling
  //   crm (getContact)                      — the canonical customer, a core record
  //   payments                              — the shared payment primitive (Batch 2)
  //   config-engine / tool-registry / workflow — core services
  for (const core of ['./events.js', './crm.js', './payments.js']) {
    assert.ok(imports.includes(core), `expected Service to reach the core primitive ${core}`)
  }
})

test('Service reaches the customer and the vehicle as canonical records', () => {
  // The alternative — Service keeping its own customer/vehicle tables — is what makes a
  // department un-buyable alongside anything else, because the same car becomes two cars.
  assert.match(eng, /getContact\(/, 'the customer must come from the canonical contact record')
  for (const dup of ['service_customers', 'service_vehicles', 'service_contacts']) {
    assert.doesNotMatch(eng, new RegExp(`from\\('${dup}'\\)`), `Service must not own ${dup}`)
  }
})

test('closing a repair order does not require the Accounting department', () => {
  // Revenue/tax/AR posting happens because Service EMITS an event that the core
  // accounting engine consumes. If Service called accounting directly, a dealership
  // that had not bought Accounting could not close a repair order at all.
  assert.doesNotMatch(engRaw, /^import .*accounting/m,
    'Service must not import the accounting engine — it emits an event instead')
  assert.match(eng, /emitEvent\(/, 'the financial hand-off is an event')
  assert.match(eng, /service\.closed/, 'closing must publish service.closed')
})

test('every Service route is gated on Service permissions alone', () => {
  // A Service-only dealership holds service.* and nothing else. If any route demanded
  // deal.* or inventory.*, that route would be dead for the customer who bought Service.
  const guards = [...eng.matchAll(/requirePermission\('([^']+)'\)/g)].map(m => m[1])
  assert.ok(guards.length >= 5, `expected the Service permission set, saw ${guards.length}`)
  for (const g of guards) {
    assert.ok(g.startsWith('service.'),
      `Service route guarded on "${g}", which a Service-only dealership does not hold`)
  }
  // The five that make up the department, each a different kind of act.
  for (const p of ['service.view', 'service.write_repair_order', 'service.close_repair_order',
                   'service.reopen_repair_order', 'service.manage_workflow']) {
    assert.ok(guards.includes(p), `missing the ${p} gate`)
  }
})

test('the Service surface calls no other department', () => {
  const calls = [...svcWs.matchAll(/api(?:GetJson|SendJson)\([`']([^`'?]+)/g)].map(m => m[1])
  assert.ok(calls.length, 'expected the workspace to call something')
  for (const c of calls) {
    assert.ok(/^\/service(-engine)?\//.test(c),
      `the Service workspace calls ${c}, which is outside the department`)
  }
})

test('Service still works for a shop that has not bought Parts', () => {
  // Parts demand is additive: if the parts endpoint is unavailable the workspace must
  // fall back to an empty list rather than failing to render the shop's day.
  assert.match(svcWs, /grab\('parts demand', apiGetJson\('\/service-engine\/part-requests'\)\)/,
    'the parts read must go through the catching wrapper')
  assert.match(svcWs, /const grab = \(label, p\) => p\.catch\(\(\) => \{ miss\.push\(label\); return null; \}\)/,
    'a missing parts feed must degrade rather than break Today')
  assert.match(svcWs, /partRequests: reqs\?\.requests \|\| \[\]/,
    'an absent parts response must resolve to an empty list')
  for (const guard of [/\(d\.partRequests \|\| \[\]\)/]) {
    assert.match(svcWs, guard, 'every parts read must tolerate absence')
  }
  // Degrading is not the same as hiding: the shop is told the list is short.
  assert.match(svcWs, /function svcUnavailableNote/,
    'a parts feed that failed must be named, not silently rendered as no parts demand')
})

// ── Known deviation, recorded deliberately ───────────────────────────────────
test('Parts currently ships WITH Service rather than as its own purchase', () => {
  // The stated product direction is independently purchasable departments, and Parts is
  // named as one of them. Today there is no os.parts entitlement anywhere in the
  // codebase — the Parts workspace is gated on os.service, so buying Service grants
  // Parts. That is coherent for a shop (a service department must consume parts) but it
  // is NOT the same thing as Parts being separately purchasable.
  //
  // This test pins the current truth so the decision is visible and deliberate. When
  // Parts becomes its own SKU, an os.parts entitlement lands and this test changes with
  // it — rather than the bundling being discovered later in a dealership.
  assert.match(part2, /'parts-overview': 'os\.service'/,
    'Parts is currently entitled by os.service')
  const backend = read(BE, 'routes/service-engine.js')
  assert.ok(!/os\.parts/.test(backend) && !/os\.parts/.test(part2),
    'no os.parts entitlement exists yet — Parts is bundled with Service')
})

test('Parts, though bundled, is built as its own department', () => {
  // Bundled today, separable tomorrow: the Parts surface must already be a real
  // department engine rather than a tab inside Service, or splitting it later means
  // rewriting it.
  assert.match(partsWs, /ENGINES\['parts-overview'\]\s*=/, 'Parts is its own engine')
  const calls = [...partsWs.matchAll(/api(?:GetJson|SendJson)\([`']([^`'?]+)/g)].map(m => m[1])
  for (const c of calls) {
    assert.ok(/^\/service(-engine)?\//.test(c),
      `Parts calls ${c}; it shares Service's canonical records and owns no second ledger`)
  }
  // One stock ledger. A second one is how on-hand quantities start disagreeing.
  assert.doesNotMatch(partsWs, /parts_inventory|parts_stock|own_stock/,
    'Parts must not introduce a second stock model')
})
