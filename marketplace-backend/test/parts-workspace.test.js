import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Batch 3 — Parts as its own department, sharing Service's canonical records.
// The standalone-product question this pins: could a dealership that bought only Parts
// operate here, without owning a second inventory model?

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const ws = strip(read('js/modules/parts-workspace.js'))
const html = read('dashboard.html')
const registry = read('js/modules/workspace-registry.js')
const part2 = read('js/modules/dashboard-part2.js')

test('Parts registers as its own department on the shared shell', () => {
  assert.match(ws, /ENGINES\['parts-overview'\]\s*=/)
  assert.match(ws, /rootId: 'parts-overview-root'/)
  assert.match(ws, /tabLabels: \{ overview: 'My Day'/)
  assert.doesNotMatch(ws, /function (engKpi|engCard|engEmpty|renderEngine|engineTab)\b/,
    'must not redefine a shared primitive')
  const block = registry.match(/\n  parts: \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(block, /\{ page: 'parts-overview', label: 'My Day' \}/, 'Parts must lead with its own My Day')
  assert.ok(block.includes("page: 'service-parts'"), 'the existing catalogue must stay reachable')
})

test('it shares Service’s records rather than owning a second inventory model', () => {
  const KNOWN = ['/service-engine/part-requests', '/service-engine/parts-availability',
                 // Parts markup and labour rate are Service's config — SHARED, deliberately,
                 // rather than a second copy that would drift from the repair order.
                 '/service-engine/config']
  for (const c of [...ws.matchAll(/apiGetJson\('([^'?]+)/g)].map(m => m[1])) {
    assert.ok(KNOWN.includes(c), `must not introduce a new endpoint: ${c}`)
  }
  for (const dup of ['parts_stock', 'parts_catalog', 'dept_parts']) {
    assert.ok(!ws.includes(dup), `must not invent ${dup}`)
  }
})

test('availability is the server’s number, never computed in the browser', () => {
  assert.match(ws, /d\.availableByPart\[p\.id\] = Number\(p\.qty_available\)/,
    'the UI indexes the server value, it does not derive it')
  assert.doesNotMatch(ws, /qty_on_hand\s*-\s*(p\.)?qty_reserved/,
    'availability must never be recomputed in the frontend')
})

test('every quantity change goes through a canonical server path', () => {
  const WRITES = ['/service-engine/part-requests/${requestId}/reserve',
                  '/service-engine/part-requests/${requestId}/issue',
                  '/service-engine/parts/${partId}/receive',
                  '/service-engine/parts/${partId}/return',
                  // Removing stock is an ADJUSTMENT through the ledger, never a delete.
                  '/service-engine/parts/${partId}/adjust',
                  '/service-engine/ros/${roId}/part-requests']
  const seen = [...ws.matchAll(/apiSendJson\(`([^`]+)`/g)].map(m => m[1])
  for (const w of seen) assert.ok(WRITES.includes(w), `unexpected write target: ${w}`)
  assert.ok(seen.length >= 4, 'reserve, issue, receive and return must all be reachable')
  const PLAIN = ['/service-engine/part-requests', '/service-engine/parts', '/service-engine/config']
  for (const w of [...ws.matchAll(/apiSendJson\('([^']+)'/g)].map(m => m[1])) {
    assert.ok(PLAIN.includes(w), `unexpected write target: ${w}`)
  }
})

test('a short reserve is reported as backorder, not as a failure', () => {
  const fn = ws.match(/async function pwReserve[\s\S]*?\n\}/)?.[0] || ''
  assert.match(fn, /r\.backordered > 0 \?/, 'a partial reserve must say what is still short')
  assert.match(fn, /None available — this request is on backorder/,
    'reserving nothing is a real business answer, not an error')
})

test('Parts and Service see the same state', () => {
  // The waiting-repair-orders section groups the SAME request records by the repair
  // order held up by them. It is a section of Requests now rather than a sub-tab, but
  // it must still be a grouping and never a second copy.
  assert.match(ws, /Waiting repair orders/)
  assert.match(ws, /\(byRo\[q\.ro_id\] \|\|= \[\]\)\.push\(q\)/,
    'the RO grouping must reuse the same demand records, not a copy')
  assert.match(ws, /blocked \? ' — BLOCKED' : ''/, 'a blocked RO must be visible to Parts')
})

test('a part request says which department asked for it', () => {
  // part_requests.ro_id used to be NOT NULL, so the only expressible request was a
  // Service request against a repair order — a counter customer or a salesperson
  // prepping a delivery had nowhere to go, and Parts could not see that demand at all.
  assert.match(ws, /const PW_DEPARTMENTS = \[/)
  for (const d of ['service', 'sales', 'customer', 'internal']) {
    assert.ok(ws.includes(`['${d}'`) || ws.includes(`'${d}',`) || ws.includes(`${d}:`), `${d} must be offered`)
  }
  assert.match(ws, /id="pw-req-dept"/, 'one dropdown states the department')
  // Only Service carries a repair order, and the server refuses the mismatch too.
  assert.match(ws, /dept !== 'service'/)
  assert.match(ws, /A Service request needs the repair order it is for/)
})

test('Stage 4 does not pretend to be a purchase-order suite', () => {
  const fn = ws.match(/function pwOrderNote[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'ordering must be handled honestly')
  assert.doesNotMatch(ws, /purchase_order|createPO|vendor_invoice/,
    'procurement is explicitly out of Stage 4 scope')
})

test('Parts is wired into the shell', () => {
  assert.match(html, /data-page-content="parts-overview"/)
  assert.match(html, /id="parts-overview-root"/)
  assert.match(part2, /if \(pageId === 'parts-overview'\) loadPartsWorkspace\(\)/)
  assert.match(part2, /'parts-overview': 'os\.service'/)
  const pos = (f) => html.indexOf(`<script src="js/modules/${f}`)
  assert.ok(pos('parts-workspace.js') > pos('dashboard-part26.js'), 'must load after the dashboard parts')
})

test('availability survives truncation at 390px', () => {
  // Found by rendering at 390px: "N available" is the whole point of the row, and when
  // it trailed a truncating line it was ellipsed out of existence on a phone — exactly
  // when it read zero. Truncation is still wanted (a long vendor name must not wrap to
  // three lines), so the invariant is ORDER: the signal leads, the detail gets cut.
  const raw = read('js/modules/parts-workspace.js')
  let checked = 0
  for (const line of raw.split('\n')) {
    if (!line.includes('truncate') || !/available<\/span>/.test(line)) continue
    checked++
    const div = line.slice(line.indexOf('truncate'))
    const before = div.slice(div.indexOf('>') + 1, div.indexOf('<span'))
    assert.equal(before.trim(), '',
      `availability must lead its truncating line, but "${before.trim()}" precedes it`)
  }
  assert.ok(checked >= 2, `both the request row and the stock row must be covered (saw ${checked})`)
})
