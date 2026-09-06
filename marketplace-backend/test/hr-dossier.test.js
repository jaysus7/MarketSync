import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// HR's Staff list, and the one-person record it opens.
//
// The rule this file exists to enforce is the one the Phase 7 brief set down and that a
// screen like this is most tempted to break: NO OPAQUE EMPLOYEE SCORE. A number nobody
// can explain becomes a reason to discipline or fire a person. Every recommendation
// here has to carry the records it was computed from.
//
// The second rule is A19's: a section that could not be READ must never render as a
// section that is EMPTY. "No safety training completed" and "training could not be
// loaded" mean opposite things to a manager about to have a conversation.

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (u, rel) => readFileSync(new URL(rel, u), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const dossier = strip(read(BE, 'routes/people-dossier.js'))
const auth = strip(read(BE, 'routes/auth.js'))
const ws = strip(read(FE, 'js/modules/people-workspace.js'))
const registry = read(FE, 'js/modules/workspace-registry.js')
const server = read(BE, 'server.js')

test('the department reads HR without renaming what everything is keyed to', () => {
  assert.match(registry, /label: 'HR'/)
  assert.match(ws, /title: 'HR/)
  // The id, the page and the entitlement key must NOT move — deep links, os.team,
  // staff.* permissions and the mobile nav are all keyed to them.
  assert.match(registry, /\n  people: \{/)
  assert.match(registry, /page: 'people-overview'/)
  const part2 = read(FE, 'js/modules/dashboard-part2.js')
  assert.match(part2, /'people-overview': 'os\.team'/, 'the entitlement key must not move with the label')
})

test('Team is Staff, and Settings exists', () => {
  assert.match(ws, /work: 'Staff'/)
  assert.match(ws, /settings: 'Settings'/)
  // Insights folded into Compliance and Time/Reports became first-class tabs; Settings
  // is manager-only. Pulse still leads and Staff still comes second.
  const order = ws.match(/get tabOrder\(\)[\s\S]*?\n  \},/)?.[0] || ''
  assert.match(order, /'overview', 'work', 'time', 'reports', 'settings'/, 'managers get Settings')
  assert.match(order, /'overview', 'work', 'time', 'reports'\]/, 'non-managers get the same tabs without Settings')
  assert.match(ws, /settings: pplRenderSettings/)
  assert.match(ws, /function pplRenderSettings/)
})

test('every staff row opens the person', () => {
  assert.match(ws, /onclick="pplOpenPerson\(/)
  assert.match(ws, /async function pplOpenPerson/)
  assert.match(ws, /apiGetJson\(`\/hr\/employees\/\$\{staffId\}\/dossier`\)/,
    'one server read, not eight fetches cross-joined in the browser')
  // A login with no employment record has no dossier to open, and says so.
  assert.match(ws, /That row has no employment record to open yet/)
})

test('the dossier is assembled from records, and is registered', () => {
  assert.match(server, /registerPeopleDossier\(app\)/)
  assert.match(dossier, /app\.get\('\/hr\/employees\/:id\/dossier', requireAuth, canView/)
  for (const tbl of ['staff_training_assignments', 'staff_certifications',
                     'staff_policy_acknowledgements', 'staff_documents', 'staff_lifecycle_tasks']) {
    assert.ok(dossier.includes(tbl), `the dossier must read ${tbl}`)
  }
})

// ── The rule that matters most ───────────────────────────────────────────────
test('there is no opaque employee score, and every recommendation shows its work', () => {
  // A single number standing for a person is exactly what the Phase 7 brief forbids.
  for (const forbidden of ['score:', 'employee_score', 'performance_score', 'rating:', 'grade:']) {
    assert.ok(!dossier.includes(forbidden), `no opaque employee metric (${forbidden})`)
  }
  // Every recommendation carries the records it came from.
  assert.match(dossier, /const add = \(severity, headline, why, basis, action\) =>/)
  assert.match(dossier, /out\.push\(\{ severity, headline, why, basis, action \}\)/)
  const calls = [...dossier.matchAll(/\n    add\(/g)].length
  assert.ok(calls >= 5, `expected several derived recommendations, saw ${calls}`)
  // And the screen shows the basis rather than hiding it.
  assert.match(ws, /Based on: \$\{esc\(r\.basis\)\}/)
  assert.match(ws, /There is no employee score here/)
})

test('standing is context, never a verdict', () => {
  // The two boards measure different jobs and must not be merged into one rank.
  assert.match(dossier, /out\.internal/)
  assert.match(dossier, /out\.autoposter/)
  assert.doesNotMatch(dossier, /combined_rank|overall_rank|total_points\s*=/,
    'two boards measuring two jobs must not become one number')
  assert.match(ws, /never merged into one rank/)
  // Empty boards are offered as a conversation, not as underperformance.
  assert.match(dossier, /before it is read as performance/)
})

test('a section that could not be read never renders as an empty one', () => {
  assert.match(dossier, /const unread = \(why\) => \(\{ items: null, unavailable: why \}\)/)
  assert.match(dossier, /const readOk = \(items\) => \(\{ items: items \|\| \[\], unavailable: null \}\)/)
  // The screen honours the distinction.
  assert.match(ws, /function pplList/)
  assert.match(ws, /if \(sec\.items == null\) return/)
  assert.match(ws, /This record is incomplete/)
  // And an unreadable section produces NO recommendation — silence beats a false all-clear.
  assert.match(dossier, /Some sections could not be loaded, so this is not a clean bill of health/)
})

test('compensation is withheld with a reason, never shown as absent', () => {
  assert.match(dossier, /staff\.compensation\.view/)
  assert.match(dossier, /req\.mfaVerified/)
  assert.match(dossier, /employmentWithheld = 'Compensation needs the staff\.compensation\.view permission\.'/)
  assert.match(ws, /d\.employment_withheld/)
})

// ── Editing, resetting, offboarding ──────────────────────────────────────────
test('an employee can be corrected after onboarding, within limits', () => {
  assert.match(dossier, /app\.patch\('\/hr\/employees\/:id', requireAuth, requireMfa, canManage/)
  // Identity-shaped fields only. Status and pay have their own gated routes.
  const editable = dossier.match(/const EDITABLE = \[[\s\S]*?\]/)?.[0] || ''
  for (const gone of ['employment_status', 'pay_rate', 'compliance_status', 'user_id', 'dealership_id']) {
    assert.ok(!editable.includes(gone), `${gone} must not be editable through this route`)
  }
  assert.match(dossier, /Somebody cannot manage themselves/)
  assert.match(dossier, /That manager is not in this dealership/)
  assert.match(dossier, /audit\(req, 'hr\.employee_updated'/)
})

test('a password reset emails them a link and never sets a password', () => {
  assert.match(dossier, /app\.post\('\/hr\/employees\/:id\/password-reset', requireAuth, requireMfa, canManage/)
  // The single most important line: HR must not be able to choose somebody's password.
  assert.doesNotMatch(dossier, /updateUserById/,
    'an admin who could set a colleague\'s password could sign in as them')
  // It resets against the address on the LOGIN, not one typed into the HR record —
  // otherwise editing the HR email would be an account-takeover path.
  assert.match(dossier, /auth\.admin\.getUserById\(person\.user_id\)/)
  assert.match(dossier, /issuePasswordReset\(\{ userId: person\.user_id, email: authUser\.user\.email/)
  // A failure to send is reported, not swallowed into a success message.
  assert.match(dossier, /The reset email was not sent/)
  assert.match(dossier, /audit\(req, 'hr\.password_reset_sent'/)
})

test('the reset flow is the existing one, not a second copy', () => {
  // Two reset paths means two places to get expiry, hashing or single-use wrong.
  assert.match(auth, /export async function issuePasswordReset/)
  assert.match(auth, /createHash\('sha256'\)\.update\(rawToken\)\.digest\('hex'\)/)
  assert.match(auth, /15 \* 60 \* 1000/, 'the 15-minute expiry stays with the token issuer')
  assert.doesNotMatch(dossier, /password_reset_tokens/,
    'the dossier must not mint its own reset tokens')
})

test('offboarding names what they still own before revoking anything', () => {
  const fn = ws.slice(ws.indexOf('async function pplOffboard'))
  assert.match(fn, /owned-work/, 'it must ask what they still hold')
  assert.match(fn, /Nothing was offboarded/, 'a failed check must abort, not proceed blind')
  assert.match(fn, /They still own:/, 'the open work must be named, not just counted')
  assert.match(fn, /Reassign this work first/)
  assert.match(fn, /Offboarding needs a reason on the record/)
  assert.match(fn, /apiSendJson\(`\/hr\/employees\/\$\{staffId\}\/offboard`/)
})

test('HR Settings shows what the department asks of people', () => {
  assert.match(ws, /Policies everybody signs/)
  assert.match(ws, /Onboarding templates/)
  // Nothing configured is a real answer with a real consequence, and it says the consequence.
  assert.match(ws, /Nothing is being asked of anybody to sign/)
  assert.match(ws, /a new hire gets no task list at all/)
  // Unreadable is not the same as none, here too.
  assert.match(ws, /This could not be loaded, so it is not shown/)
})
