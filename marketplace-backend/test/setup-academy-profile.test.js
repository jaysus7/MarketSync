import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Three things that were in the wrong place.
//
//   • Setup nagged from above every department and held a sidebar slot forever, for a
//     job a dealership finishes once.
//   • Academy sat in a rail nobody scrolls to, when required training is a TODAY problem.
//   • An employee could not see their own file — their certificates, the contracts they
//     signed, what onboarding asked of them — anywhere in the product.

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (u, rel) => readFileSync(new URL(rel, u), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const html = read(FE, 'dashboard.html')
const part2 = strip(read(FE, 'js/modules/dashboard-part2.js'))
const part11 = strip(read(FE, 'js/modules/dashboard-part11.js'))
const ppl = strip(read(FE, 'js/modules/people-workspace.js'))
const dossier = strip(read(BE, 'routes/people-dossier.js'))
const launchRoute = strip(read(BE, 'routes/launch-hub.js'))

const loadRegistry = () => {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(read(FE, 'js/modules/workspace-registry.js'), ctx)
  return ctx.window
}

// ── Setup ────────────────────────────────────────────────────────────────────
test('setup appears once, at the bottom, and never inside a department', () => {
  const bar = html.indexOf('id="setup-status-banner"')
  assert.ok(bar > -1, 'the setup bar must exist')
  assert.ok(bar > html.indexOf('</main>'), 'it must be below the page content, not above every page')
  // The old placement was a banner between the header and the page, which is what made
  // every department open with a setup nag on top of it.
  assert.ok(html.indexOf('id="setup-status-banner"') > html.indexOf('<main'),
    'it must not sit between the header and the page')
})

test('the bar routes to the one canonical Setup section', () => {
  assert.match(html, /id="setup-status-banner" onclick="switchPage\('launch'\)"/)
  assert.ok(!/checkDepartmentOpen\(pageId\)/.test(part2))
})

test('the modal can actually take the missing information', () => {
  assert.match(part2, /const MS_SETUP_FIELDS = \[/)
  for (const f of ['legal_name', 'street_address', 'city', 'phone', 'timezone', 'hst_number']) {
    assert.ok(part2.includes(`'${f}'`), `the setup form must accept ${f}`)
  }
  assert.match(part2, /apiSendJson\('\/launch\/dealership', 'PATCH', body\)/)
  // A blank box must not wipe a value that is already stored.
  assert.match(part2, /if \(v\) body\[el\.dataset\.field\] = v;/)
  // And it shows what IS stored rather than an empty box beside "not recorded yet".
  assert.match(launchRoute, /launch\.dealership = \{/)
  assert.match(part2, /value="\$\{esc\(String\(cfg\[k\] \?\? ''\)\)\}"/)
})

test('setup holds no permanent nav slot (the finish-setup banner itself is retired)', () => {
  assert.match(part2, /getElementById\('setup-status-banner'\)\?\.classList\.add\('hidden'\)/)
  const { MS_WORKSPACES } = loadRegistry()
  assert.ok(!MS_WORKSPACES.launch, 'a finished-once job must not own a sidebar slot forever')
  // Still reachable — removing the nav entry must not strand the page.
  assert.match(html, /data-page-content="launch"/)
})

// ── Academy ──────────────────────────────────────────────────────────────────
test('Academy belongs to My Day without drawing a second tab row', () => {
  const { MS_WORKSPACES } = loadRegistry()
  const academy = MS_WORKSPACES.executive.pages.find(p => p.page === 'academy')
  assert.ok(academy, 'Academy must be grouped under the first My Day')
  assert.equal(academy.legacy, true,
    'a plain page here would draw a competing tab row above the command engine header')
  // It stays reachable for everybody: My Day is manager-gated, and a rep who cannot open
  // the courses they are required to complete is the same defect as having no courses.
  assert.ok(MS_WORKSPACES.academy, 'Academy must stay reachable outside the manager rail')
})

test('outstanding courses surface in My Day and leave as they are completed', () => {
  assert.match(part11, /function cmdAcademyStrip/)
  assert.match(part11, /apiGetJson\('\/academy\/my-path'\)/)
  assert.match(part11, /\$\{cmdAcademyStrip\(d\)\}/, 'My Day must render it')
  // Completed work leaves the list.
  assert.match(part11, /if \(c\.completed_at \|\| c\.status === 'completed'\) continue/)
  // Nothing outstanding renders NOTHING — a permanent "0 courses" card is furniture.
  assert.match(part11, /if \(!outstanding\.length\) return ''/)
  // But "could not check your training" is not the same message as "nothing due".
  assert.match(part11, /Your training could not be loaded/)
})

// ── The employee's own record ────────────────────────────────────────────────
test('an employee can see their own file without a manager permission', () => {
  assert.match(dossier, /app\.get\('\/hr\/me', requireAuth, async/)
  assert.match(dossier, /\.eq\('user_id', req\.user\.id\)/, 'scoped to the caller, not a parameter')
  // No employment record is a real answer with a real next step.
  assert.match(dossier, /No employment record is linked to your account yet/)
})

test('what an employee sees of their own file is narrower than what HR sees', () => {
  // HR files things about somebody that the person is not entitled to read.
  assert.match(dossier, /if \(self\) q = q\.eq\('employee_visible', true\)/)
  // The manager action list is not something to hand somebody about themselves.
  assert.match(dossier, /delete out\.dossier\.recommendations/)
})

test('the profile is read-only except the password and the picture', () => {
  assert.match(ppl, /async function renderMyRecordCard/)
  assert.match(ppl, /apiGetJson\('\/hr\/me'\)/)
  // It renders their onboarding, training, certificates and signed contracts.
  for (const heading of ['Onboarding', 'Your training', 'Your certificates', 'What you have signed', 'Your documents']) {
    assert.ok(ppl.includes(heading), `the profile must show ${heading}`)
  }
  // An employee who could edit their own start date or job title could edit their way
  // out of a compliance requirement. The card writes nothing.
  const card = ppl.slice(ppl.indexOf('async function renderMyRecordCard'), ppl.indexOf('window.renderMyRecordCard'))
  assert.doesNotMatch(card, /apiSendJson/, 'your own record card must not write anything')
  assert.match(ppl, /anything else on this page is corrected by HR/i)
})

test('downloads are short-lived signed links checked against the row', () => {
  assert.match(dossier, /app\.get\('\/hr\/documents\/:id\/download', requireAuth, async/)
  assert.match(dossier, /createSignedUrl\(doc\.storage_path, 120\)/, 'a link that never expires is a leak')
  // Two callers, two rules, both checked against the stored row.
  assert.match(dossier, /hasPermission\(req, 'staff\.view'\)/)
  assert.match(dossier, /That is not your document/)
  assert.match(dossier, /is not shared with you/)
  // A file still being scanned is not a file to hand out.
  assert.match(dossier, /still being scanned and cannot be downloaded yet/)
  assert.match(dossier, /audit\(req, 'hr\.document_downloaded'/)
  assert.match(ppl, /async function pplDownloadDoc/)
})
