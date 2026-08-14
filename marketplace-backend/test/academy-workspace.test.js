import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Phase 7 PR 7.3 — the Academy workspace.
//
// The old Academy screen was reachable only by luck: it had no page container of its own, no
// entry in the workspace registry, and it rendered into the generic `#page-content`. These
// tests walk the whole reachability chain — registry → container → router → script tag → role
// allow-list — because every link in it is somewhere this screen has already been lost.

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')

const html = read('dashboard.html')
const workspace = read('js/modules/academy-workspace.js')
const part2 = read('js/modules/dashboard-part2.js')
const part24 = read('js/modules/dashboard-part24.js')
const dashboardJs = read('dashboard.js')
const verify = read('verify.html')

function loadRegistry() {
  const ctx = { window: {} }
  vm.createContext(ctx)
  vm.runInContext(read('js/modules/workspace-registry.js'), ctx)
  return JSON.parse(JSON.stringify(ctx.window.MS_WORKSPACES))
}

// ── Reachability, link by link ──────────────────────────────────────────────

test('Academy is in the workspace registry', () => {
  const reg = loadRegistry()
  assert.ok(reg.academy, 'Academy is not in MS_WORKSPACES, so nothing renders a way in')
  assert.ok(reg.academy.pages.some(p => p.page === 'academy'))
})

test('Academy is a system-rail entry, not a tenth department', () => {
  const reg = loadRegistry()
  assert.equal(reg.academy.system, true, 'the nine departments are how a dealership is organised')
})

test('Academy is not manager-only', () => {
  const reg = loadRegistry()
  // People is `mgr: true`. Putting Academy under it would hide required training from exactly
  // the people it is required of.
  assert.ok(!reg.academy.mgr, 'everybody has a learning path')
  assert.ok(!reg.academy.roles, 'no role allow-list on the workspace itself')
})

test('the Academy page has a container of its own', () => {
  // The old screen had none and rendered into the shared #page-content.
  assert.match(html, /data-page-content="academy"/)
  assert.match(html, /id="academy-root"/)
})

test('the router points the academy page at the workspace', () => {
  assert.match(part2, /pageId === 'academy'\) loadAcademyWorkspace\(\)/)
  assert.match(workspace, /function loadAcademyWorkspace\(\) \{ renderEngine\('academy'\) \}/)
  assert.match(workspace, /rootId: 'academy-root'/)
})

test('the workspace script is loaded by the dashboard', () => {
  assert.match(html, /<script src="js\/modules\/academy-workspace\.js\?v=[^"]+"><\/script>/)
})

test('the workspace script loads after the engine registry it registers into', () => {
  const engine = html.indexOf('js/modules/dashboard-part10.js')
  const academy = html.indexOf('js/modules/academy-workspace.js')
  assert.ok(engine > -1 && academy > engine, 'ENGINES must exist before academy-workspace.js runs')
})

test('every specialized staff role can reach the Academy', () => {
  // __staffAllowedPages is an allow-set: a page missing from it is unreachable for that role,
  // and these are the roles with the most required training.
  const block = dashboardJs.match(/const STAFF_ROLE_NAV = \{[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(block, 'STAFF_ROLE_NAV not found')
  for (const role of ['FNI', 'SERVICE', 'ACCOUNTING', 'CLEANUP']) {
    const line = block.split('\n').find(l => l.trim().startsWith(`${role}:`))
    assert.ok(line, `${role} missing from STAFF_ROLE_NAV`)
    assert.ok(line.includes("'academy'"), `${role} cannot reach the Academy`)
  }
})

test('the Academy is not gated behind a plan entitlement', () => {
  // An unmapped page is always allowed. Required compliance training is not an upsell.
  const map = part2.match(/const PAGE_FEATURE = \{[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(map, 'PAGE_FEATURE not found')
  assert.ok(!/^\s*academy:/m.test(map), 'academy must not be entitlement-gated')
})

// ── The fake diploma is gone ────────────────────────────────────────────────

test('the click-to-issue diploma path no longer exists', () => {
  // Comments are stripped first: a comment recording that the path WAS removed must not read
  // as the path still being there.
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|<!--).*$/gm, '')
  for (const [name, src] of [['dashboard-part24.js', part24], ['dashboard.html', html]]) {
    assert.ok(!/openAcademyCertificateModal|ACADEMY_COURSES|Issue Diploma/.test(strip(src)),
      `${name} still carries the certificate-on-click path`)
  }
})

test('no hard-coded certificate number or holder survives', () => {
  assert.ok(!/MS-CERT-2026-98421/.test(html))
  assert.ok(!/id="cert-student-name"/.test(html))
  assert.ok(!/id="academy-certificate-modal"/.test(html))
})

test('the workspace never marks a course complete or a credential earned', () => {
  // Completion is external evidence (AGENTS.md A20): the server owns it, and this screen
  // renders the server's answer rather than deciding.
  assert.ok(!/apiSendJson\([^)]*complete/i.test(workspace))
  assert.ok(!/status\s*[:=]\s*'completed'/.test(workspace),
    'the workspace must not assign a completed status to anything')
  assert.ok(!/\/academy\/certifications\/[^']*\/issue/.test(workspace),
    'issuing is a manager action behind MFA, not something Your Learning does')
})

// ── Your Learning shows a path, not a library ───────────────────────────────

test('the three path sections are Required, Department Foundations and Advanced', () => {
  assert.match(workspace, /\['required', 'Required'/)
  assert.match(workspace, /\['foundations', 'Department Foundations'/)
  assert.match(workspace, /\['advanced', 'Advanced'/)
})

test('the library is fetched on demand, never rendered by default', () => {
  assert.match(workspace, /async function acadRunLibrary/)
  // The default render must not pull the library down with the path.
  const fetchBlock = workspace.match(/fetch: async \(\) => \{[\s\S]*?\n  \},/)?.[0] || ''
  assert.ok(fetchBlock, 'engine fetch not found')
  assert.ok(!fetchBlock.includes('/academy/library'), 'a wall of courses is not a learning experience')
})

test('the path tabs are labelled for a person, not for the engine', () => {
  assert.match(workspace, /tabLabels: \{ overview: 'Your Learning', work: 'Certifications' \}/)
  const labels = workspace.match(/tabLabels: \{([^}]+)\}/)[1]
  for (const key of ['overview', 'work']) {
    assert.ok(labels.includes(`${key}:`), `tab ${key} has no label`)
  }
})

test('a failed path is reported rather than rendered as an empty one', () => {
  // "Empty success is a failure mode" — a person with no courses and a person whose path
  // failed to load must not see the same screen.
  assert.match(workspace, /if \(d\.error\)/)
  assert.match(workspace, /Your path could not be loaded/)
})

test('machine states are translated before a person reads them', () => {
  assert.match(workspace, /not_started: 'Not started'/)
  assert.match(workspace, /in_progress: 'In progress'/)
})

test('what a certification still costs comes from the server, not from an assumption', () => {
  // The screen and the server's refusal must reason from the same fact, or the button
  // promises a credential the API declines.
  assert.match(workspace, /outstandingFor = \(cert\) => \(cert\.courses \|\| \[\]\)\.filter/)
})

// ── 390px ───────────────────────────────────────────────────────────────────

test('a credential ID is never rendered inside a truncating line', () => {
  // Found by rendering at 390px: the ID landed in a `truncate` sub-line and came out as
  // "Credential MS-SALES-8fJq2…" — which reads as a whole identifier and is not one. Same
  // lesson as the Parts availability row: what the line is FOR must survive the cut, and an
  // ID cannot survive a cut at all, so it belongs where it can wrap.
  for (const line of workspace.split('\n')) {
    if (!line.includes('truncate')) continue
    assert.ok(!/credential_id/.test(line),
      `a credential id is rendered in a truncating line: ${line.trim().slice(0, 90)}`)
  }
  // …and it is shown in full where it can wrap.
  assert.match(workspace, /break-all[^`]*credential_id|credential_id[^`]*break-all/)
})

test('the certification row leads with the certification, not with a label', () => {
  assert.match(workspace, /Expires \$\{acadDate\(held\.expires_on\)\}/)
  assert.ok(!/`Credential \$\{held\.credential_id\}/.test(workspace))
})

// ── The credential is public, and only what is public ───────────────────────

test('the credential modal renders from the public verification endpoint', () => {
  assert.match(workspace, /apiGetJson\(`\/verify\/\$\{encodeURIComponent\(credentialId\)\}`\)/)
})

test('the credential modal shows the credential id and its verification link', () => {
  assert.match(workspace, /Credential ID/)
  assert.match(workspace, /verify\.html\?id=/)
  assert.match(workspace, /Add to LinkedIn/)
  assert.match(workspace, /linkedin\.com\/profile\/add\?startTask=CERTIFICATION_NAME/)
})

test('the LinkedIn share carries the credential id and the verification URL', () => {
  // Without these the badge is a name on a profile that nobody can check.
  assert.match(workspace, /certUrl=\$\{encodeURIComponent\(url\)\}/)
  assert.match(workspace, /certId=\$\{encodeURIComponent\(credentialId\)\}/)
})

// ── The public verification page ────────────────────────────────────────────

test('verify.html is on the shared public shell', () => {
  assert.match(verify, /id="ms-public-header"/)
  assert.match(verify, /id="ms-public-footer"/)
  assert.match(verify, /<script src="\/assets\/public-shell\.js" defer><\/script>/)
})

test('verify.html escapes everything it renders', () => {
  // It renders a string a stranger chose, fetched over the network.
  assert.match(verify, /function esc\(s\)/)
  const renders = [...verify.matchAll(/'\s*\+\s*(c\.[a-z_]+)/g)].map(m => m[1])
  assert.equal(renders.length, 0, `unescaped credential fields rendered: ${renders.join(', ')}`)
})

test('verify.html is not indexable', () => {
  // Indexing shared credentials would turn them into a browsable directory of who works where.
  assert.match(verify, /<meta name="robots" content="noindex, nofollow">/)
})

test('verify.html tells the difference between "no such credential" and "check failed"', () => {
  assert.match(verify, /r\.status === 404/)
  assert.match(verify, /No credential with that ID/)
  assert.match(verify, /could not be completed/)
})

test('verify.html keeps the credential id in the URL so the link stays shareable', () => {
  assert.match(verify, /history\.replaceState/)
  assert.match(verify, /new URLSearchParams\(location\.search\)\.get\('id'\)/)
})
