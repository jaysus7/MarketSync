import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Phase 4, Service. The Dealership Pulse's five tiles are not a template: an
// advisor's first question is never "how many repair orders are open", it is
// "whose promise have I broken, and what is stuck". Both of those used to be the
// THIRD ROW inside a composite card — the least visible thing on the page.

const FE = fileURLToPath(new URL('../../marketplace-frontend/', import.meta.url))
const read = (rel) => readFileSync(path.join(FE, rel), 'utf8')
const svc = read('js/modules/service-workspace.js')
const part10 = read('js/modules/dashboard-part10.js')
const css = read('css/ms-design-system.css')

// The advisor branch of the overview tab, so a technician's own branch cannot
// accidentally satisfy these assertions.
const board = svc.slice(svc.indexOf('const grid = pulseBoard(['), svc.indexOf("pulseHeader('Service Pulse'"))

test('the audit found a board to check', () => {
  assert.ok(board.length > 2000, `Service board block looks wrong (${board.length} chars)`)
  assert.ok(board.includes("title: 'Past promise time'"))
  assert.ok(board.includes("title: 'Blocked on parts'"))
})

test('promise-time risk and parts holds are cards, not rows buried in a card', () => {
  for (const title of ["title: 'Past promise time'", "title: 'Blocked on parts'"]) {
    const at = board.indexOf(title)
    assert.ok(at !== -1, `${title} must be its own pulseCard`)
  }
  // And they are no longer duplicated as rows inside the composite cards.
  assert.ok(!board.includes("label: 'Past promise time'"),
    'past promise time was promoted to a card; leaving the row too duplicates it')
  assert.ok(!board.includes("label: 'Blocked on parts'"),
    'blocked on parts was promoted to a card; leaving the row too duplicates it')
})

test('the lead tiers are data-driven — a calm shop flattens', () => {
  // The tier expression must read the value, not be a constant.
  assert.match(board, /title: 'Past promise time'[\s\S]{0,200}?tier: overduePromise\.length \? 'hero' : 'standard'/,
    'a hero that is hard-coded shouts at an empty queue')
  assert.match(board, /title: 'Blocked on parts'[\s\S]{0,200}?tier: blocked \? 'feature' : 'standard'/)
  assert.match(board, /title: 'Needs attention'[\s\S]{0,200}?tier: att\.length \? 'tall' : 'standard'/)
})

test('each lead card names the records behind its count', () => {
  const promise = board.slice(board.indexOf("title: 'Past promise time'"), board.indexOf("title: 'Blocked on parts'"))
  assert.ok(promise.includes('svcCustomer(r)'), 'the promise card must name customers')
  assert.ok(promise.includes('svcLateBy(r.promise_time)'), 'it must say how late, not just that it is late')
  assert.ok(promise.includes('svcOpenRecord('), 'each row must open its repair order')
  const parts = board.slice(board.indexOf("title: 'Blocked on parts'"), board.indexOf("title: \"What's waiting\""))
  assert.ok(parts.includes('roById.get(id)'), 'the parts card must resolve the repair order')
  assert.match(parts, /RO x\$\{String\(id\)\.slice\(-2\)\}/,
    'a repair order that cannot be named shows its id, never an invented customer')
  assert.ok(parts.includes("onclick: r ? `svcOpenRecord('${r.id}')` : ''"),
    'a record with no link must not render as a button that does nothing')
})

test('a capped list says so rather than implying it is everything', () => {
  assert.match(svc, /const svcMoreNote = \(shown, total\) => total > shown/)
  assert.ok(board.includes('svcMoreNote(Math.min(SVC_LEAD_ROWS, overduePromise.length), overduePromise.length)'))
  assert.ok(board.includes('svcMoreNote(Math.min(SVC_LEAD_ROWS, blocked), blocked)'))
})

test('the unreachable render block is gone', () => {
  // A second body.innerHTML sat after an unconditional return, so four whole
  // renderers were dead. Unreachable code that looks like a feature is worse
  // than no code: it reads as shipped.
  const overview = svc.slice(svc.indexOf('const grid = pulseBoard(['), svc.indexOf('appointments: svcRenderAppointments'))
  assert.equal((overview.match(/body\.innerHTML = /g) || []).length, 1,
    'the advisor overview must assign body.innerHTML exactly once')
  assert.ok(!overview.includes('svcRenderTriageBar'), 'the dead triage-bar call site must be gone')
  // svcInsightsStrip is the opposite case: its only call site used to be inside
  // the dead block, so the strip had silently vanished from the page while
  // service-workspace.test.js still passed on the source text. It is restored
  // into the live render, and must stay there.
  assert.ok(overview.includes('${svcInsightsStrip(d)}'),
    'the insights strip must render from reachable code, not from a dead block')
})

test('pulseCard tiering does not double-declare material', () => {
  // A tiered card takes background, border, radius and padding from the design
  // system. Carrying the Tailwind card utilities too means two sources for one
  // decision — which is how a card keeps desktop padding on a phone.
  const tiered = part10.slice(part10.indexOf('if (tier) {'), part10.indexOf('return `<div class="w-full bg-white'))
  assert.ok(tiered.includes('ms-c ms-c--'), 'a tiered card must use the design system card')
  assert.ok(!tiered.includes('bg-white'), 'a tiered card must not also carry Tailwind card utilities')
  assert.ok(tiered.includes('data-empty'), 'an empty card must be collapsible by the board')
})

test('semantic spans carry columns only — a reserved row strands space', () => {
  // The defect phase 4 found: hero reserved three rows, its content filled about
  // one and a half, and nothing could backfill the rest.
  const spans = css.slice(css.indexOf('.ms-span-hero'), css.indexOf('.ms-span-full'))
  assert.doesNotMatch(spans, /grid-row:\s*span/,
    'a fixed grid-row reservation leaves dead space no dense packing can fill')
  assert.match(css, /\.ms-span-hero,\s+\.ms-c--hero\s+\{ grid-column: span 6; \}/)
})

test('the design system still needs no !important', () => {
  const declarations = (css.match(/!important;/g) || []).length
  assert.equal(declarations, 0,
    'the design system wins by cascade order; an !important means a legacy rule should have been scoped instead')
})
