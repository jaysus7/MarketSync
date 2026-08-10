import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6 PR 6.2 — social account identity and publishing authorization.
//
// Built before any composer, deliberately. Publishing is IRREVERSIBLE and EXTERNAL: a post
// made as the wrong account cannot be recalled, so this is the one Phase 6 decision a later
// migration cannot repair.
//
// The rule these defend:
//   dealership-owned → an explicit grant, or the marketing.publish permission
//   user-owned       → its owner, or someone explicitly granted it
//   any account      → same dealership, connected, and actually capable at the provider

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const social = strip(read('routes/social.js'))
const socialRaw = read('routes/social.js')
const migration = read('migrations/2026-08-10-phase6-social-identity.sql')

// ── Ownership is modelled, not implied ──────────────────────────────────────

test('a dealership page and a personal account are different kinds of thing', () => {
  assert.match(migration, /ownership text not null/)
  assert.match(migration, /social_accounts_ownership_valid check \(ownership in \('dealership','user'\)\)/)
  // A user-owned account with no owner would fall through every check below to
  // "anyone in the dealership".
  assert.match(migration, /social_accounts_owner_required check \(ownership <> 'user' or owner_user_id is not null\)/)
})

test('one connection per provider account per dealership', () => {
  // Connecting the same page twice creates two identities with two different grant sets,
  // so a revoked grant on one would not stop publishing through the other.
  assert.match(migration, /create unique index if not exists social_accounts_identity_uk[\s\S]*?\(dealership_id, provider, external_account_id\)/)
})

// ── The authorization decision ──────────────────────────────────────────────

test('there is exactly one authorization decision, and it is on the server', () => {
  assert.match(social, /export async function canActOnAccount\(req, accountId, action = 'publish'\)/)
  // Every route acting on an EXISTING account must go through it. A route that decides for
  // itself is how the rules drift apart.
  //
  // POST /social/accounts is the one exception, and legitimately so: the account does not
  // exist yet, so there is nothing to authorize against. It carries its own ownership
  // checks instead, asserted separately below.
  const routes = [...social.matchAll(/app\.(post|delete)\('(\/social\/[^']+)'[\s\S]*?\n  \}\)/g)]
  const actsOnExisting = routes.filter(r => r[2] !== '/social/accounts')
  assert.ok(actsOnExisting.length >= 3, `expected the mutating social routes, saw ${actsOnExisting.length}`)
  for (const r of actsOnExisting) {
    assert.match(r[0], /canActOnAccount\(/, `${r[2]} must authorize through canActOnAccount`)
  }
})

test('a salesperson cannot publish to the dealership page without a grant', () => {
  const fn = social.match(/export async function canActOnAccount[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(fn, 'the decision must exist')
  // Dealership-owned: grant OR the department permission. Nothing else.
  assert.match(fn, /if \(granted\) return \{ allowed: true[\s\S]{0,400}hasPermission\(req, 'marketing\.publish'\)/)
  assert.match(fn, /You have not been given access to publish as/)
  // Role alone must never be the reason — that is how a salesperson inherits the page.
  assert.doesNotMatch(fn, /profile\?\.role|req\.profile\.role|SALES_REP|MANAGER/,
    'authorization must not turn on a role string')
})

test('a personal account belongs to its owner, and seniority does not override that', () => {
  const fn = social.match(/export async function canActOnAccount[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /if \(acct\.ownership === 'user'\)/)
  assert.match(fn, /acct\.owner_user_id === userId\) return \{ allowed: true/)
  assert.match(fn, /belongs to another user and has not been shared with you/)
  // The user-owned branch must RETURN before the dealership branch, so marketing.publish
  // cannot silently grant someone else's personal Instagram.
  const userBranch = fn.indexOf("ownership === 'user'")
  const permBranch = fn.indexOf("hasPermission(req, 'marketing.publish')")
  assert.ok(userBranch > 0 && permBranch > userBranch,
    'the personal-account branch must resolve before the department permission')
})

test('a disconnected or incapable account is refused with a reason', () => {
  const fn = social.match(/export async function canActOnAccount[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /acct\.status !== 'connected'/)
  assert.match(fn, /Reconnect the account first/)
  // Never claim a capability the provider does not have — an honest refusal beats a
  // button that fails at the edge.
  assert.match(fn, /caps\[capKey\] === false/)
  assert.match(fn, /does not support/)
})

test('a cross-tenant account is indistinguishable from a missing one', () => {
  const fn = social.match(/export async function canActOnAccount[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(fn, /acct\.dealership_id !== dealershipId/)
  assert.match(fn, /That social account was not found/,
    'the response must not reveal that another dealership holds it')
})

// ── Publishing ──────────────────────────────────────────────────────────────

test('every target of a post is authorized individually', () => {
  const route = social.match(/app\.post\('\/social\/posts'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the compose route must exist')
  assert.match(route, /for \(const t of targets\)[\s\S]{0,200}canActOnAccount\(/)
  // One refusal fails the request. Silently dropping a channel would publish something
  // other than what the user reviewed.
  assert.match(route, /if \(refusals\.length\) return res\.status\(403\)/)
  assert.doesNotMatch(route, /filter\(.*allowed\)/, 'refused targets must not be quietly skipped')
})

test('scheduling is authorized as scheduling, not as publishing', () => {
  const route = social.match(/app\.post\('\/social\/posts'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /b\.scheduled_for \? 'schedule' : 'publish'/)
})

test('a post cannot be queued twice to the same account', () => {
  assert.match(migration, /create unique index if not exists social_post_targets_uk[\s\S]*?\(post_id, social_account_id\)/)
})

test('a post that loses its targets is rolled back, not left looking scheduled', () => {
  const route = social.match(/app\.post\('\/social\/posts'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /from\('social_posts'\)\.delete\(\)\.eq\('id', post\.id\)/)
})

test('approving requires being able to approve for every account targeted', () => {
  const route = social.match(/app\.post\('\/social\/posts\/:id\/approve'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.ok(route, 'the approve route must exist')
  assert.match(route, /for \(const t of tg \|\| \[\]\)[\s\S]{0,200}canActOnAccount\(req, t\.social_account_id, 'approve'\)/)
  assert.match(route, /\.eq\('status', 'needs_approval'\)/, 'and must guard against a lost update')
})

test('granting access you do not hold is refused', () => {
  const route = social.match(/app\.post\('\/social\/accounts\/:id\/grants'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /You cannot grant access you do not have/)
  // A grant to someone outside the dealership would be access nobody here is accountable for.
  assert.match(route, /target\.dealership_id !== req\.dealershipId/)
})

test('connecting an account on another user\'s behalf needs permission', () => {
  const route = social.match(/app\.post\('\/social\/accounts'[\s\S]*?\n  \}\)/)?.[0] || ''
  assert.match(route, /ownerUserId !== req\.user\?\.id && !\(await hasPermission\(req, 'marketing\.publish'\)/)
  assert.match(route, /cannot connect an account on behalf of another user/)
  assert.match(route, /owner\.dealership_id !== req\.dealershipId/)
})

// ── Token custody ───────────────────────────────────────────────────────────

test('tokens are encrypted with the existing helper and never returned', () => {
  assert.match(socialRaw, /import \{ encryptJson, PII_ENCRYPTION_VERSION \} from '\.\.\/crypto-pii\.js'/,
    'reuse the credential encryption dealer_integrations already uses')
  assert.match(social, /row\.credentials_enc = encryptJson\(b\.credentials\)/)
  // Every read names its columns, so a token cannot leak by a later '*' select.
  assert.match(social, /const SAFE_COLUMNS = \[/)
  assert.doesNotMatch(social, /SAFE_COLUMNS[\s\S]*?'credentials_enc'/, 'credentials must not be in the safe list')
  const selects = [...social.matchAll(/from\('social_accounts'\)\s*\n?\s*\.select\(([^)]*)\)/g)].map(m => m[1].trim())
  for (const s of selects) {
    assert.ok(!s.includes("'*'"), `social_accounts must never be selected with * (saw ${s})`)
    assert.ok(!s.includes('credentials'), `a select must not name credentials (saw ${s})`)
  }
})

// ── Attention state, for My Day to compose later ────────────────────────────

test('this slice emits real attention items', () => {
  // The builder, not the route: Marketing's My Day composes these directly, so the
  // guarantee lives in the exported function rather than in one HTTP handler.
  const route = social.match(/export async function socialAttention[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(route, 'the attention builder must exist')
  assert.match(social, /app\.get\('\/social\/attention'/, 'and still be reachable over HTTP')
  for (const kind of ['social_account_disconnected', 'social_post_needs_approval', 'social_publish_failed']) {
    assert.ok(route.includes(kind), `missing attention kind: ${kind}`)
  }
  // Each item carries what My Day will need to render it without re-deriving anything.
  for (const field of ['kind', 'severity', 'subject', 'reason', 'owner', 'action', 'ref']) {
    assert.ok(route.includes(`${field}:`), `attention items must carry ${field}`)
  }
  assert.match(route, /Reconnect Account/, 'the action must be the real next action')
})

// ── Tenant isolation ────────────────────────────────────────────────────────

test('every social route is dealership-scoped and permission-gated', () => {
  const routes = [...social.matchAll(/app\.(get|post|delete)\('(\/social\/[^']+)'[\s\S]*?\n  \}\)/g)]
  assert.ok(routes.length >= 6, `expected the social routes, saw ${routes.length}`)
  for (const r of routes) {
    // Either the route scopes directly, or it delegates to a helper that does. Both
    // helpers are asserted dealership-scoped above and below, so delegation is not a gap.
    assert.match(r[0], /req\.dealershipId|publishableAccounts\(|canActOnAccount\(/,
      `${r[2]} must scope to the dealership`)
    assert.match(r[0], /can(View|Edit)/, `${r[2]} must be permission-gated`)
  }
  // The delegated helper really is scoped — otherwise the allowance above would be a hole.
  const helper = social.match(/export async function publishableAccounts[\s\S]*?\n\}\n/)?.[0] || ''
  assert.match(helper, /\.eq\('dealership_id', req\.dealershipId\)/)
  assert.match(helper, /canActOnAccount\(req, a\.id, action\)/,
    'and it must still authorize each account rather than listing them all')
  assert.match(social, /requirePermission\('marketing\.view'\)/)
  assert.match(social, /requirePermission\('marketing\.edit'\)/)
})

test('social tables carry row level security', () => {
  for (const t of ['social_accounts', 'social_account_grants', 'social_posts', 'social_post_targets']) {
    assert.match(migration, new RegExp(`alter table public\\.${t} enable row level security`),
      `${t} must have RLS enabled`)
  }
})
