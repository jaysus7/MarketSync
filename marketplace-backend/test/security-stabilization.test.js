import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Phase 6S — security stabilization.
//
// These are regression tests for the confirmed findings. Where the fix is a real function
// (token generation, SSRF policy) the test runs it. Where the fix is "this route now carries
// a guard", the test checks the route, because there is no way to run Express here.

import { randomToken } from '../security.js'
import { isSafeHttpUrl } from '../feed-probe-policy.js'

const BE = new URL('../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, BE), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const aiRuntime = strip(read('routes/ai-runtime.js'))
const sitePublic = strip(read('routes/submodules/site-public.js'))
const crm = strip(read('routes/crm.js'))
const feeds = strip(read('routes/feeds.js'))
const sync = strip(read('routes/sync.js'))
const integrations = strip(read('routes/integrations.js'))
const square = strip(read('routes/square.js'))
const billing = strip(read('routes/billing.js'))
const leads = strip(read('routes/leads.js'))
const part23 = read('../marketplace-frontend/js/modules/dashboard-part23.js')

// ── Unguessable means unguessable ───────────────────────────────────────────

test('randomToken is high-entropy and never repeats', () => {
  const seen = new Set()
  for (let i = 0; i < 2000; i++) seen.add(randomToken(18))
  assert.equal(seen.size, 2000, 'every token must be distinct')
  assert.ok(randomToken(18).length >= 24)
  assert.match(randomToken(18), /^[A-Za-z0-9_-]+$/, 'base64url survives a URL and an SMS')
})

test('the anonymous visitor token is not Math.random', () => {
  // This token IS a credential: resolveConversation() looks a conversation up by it, so a
  // predictable one reads another visitor's transcript.
  const line = aiRuntime.match(/const visitorToken = .*/)?.[0] || ''
  assert.match(line, /randomToken\(/)
  assert.doesNotMatch(line, /Math\.random/)
})

test('no security-relevant identifier is generated from Math.random', () => {
  // Meeting rooms (the URL is the only access control on a customer's appointment) and the
  // storage path for customer attachments in a PUBLIC bucket.
  assert.doesNotMatch(sitePublic.match(/const rand = .*/)?.[0] || '', /Math\.random/)
  assert.match(crm.match(/const path = `\$\{req\.dealershipId\}\/\$\{contact\.id\}.*/)?.[0] || '', /randomToken\(/)
})

test('display-only ids may still use Math.random', () => {
  // Deliberate: widget and section ids are cosmetic. Replacing them would be churn with no
  // security value, and pretending otherwise would hide which changes actually mattered.
  assert.match(sitePublic, /id: String\(w\.id \|\| `w\$\{i\}_\$\{Math\.random\(\)/)
})

// ── SSRF: refuse the targets that were never a dealer website ───────────────

test('the URL policy blocks internal targets and allows real dealer sites', async () => {
  for (const bad of [
    'http://169.254.169.254/latest/meta-data/',   // cloud metadata — the one that matters
    'http://localhost/feed.json',
    'http://127.0.0.1/inventory',
    'http://10.0.0.5/feed',
    'http://192.168.1.10/feed',
    'http://172.16.4.4/feed',
    'file:///etc/passwd',
    'http://user:pass@example.com/feed',           // embedded credentials
  ]) {
    assert.equal(await isSafeHttpUrl(bad), false, `must refuse ${bad}`)
  }
  assert.equal(await isSafeHttpUrl('https://dealer.example.com/inventory.xml'), true)
})

test('the persisted feed URL is checked, not just the probed one', () => {
  // /feeds/probe always checked. /feeds/add never did — and it is the one that stores a URL
  // the server then fetches on a schedule forever.
  const add = feeds.match(/const \{ feed_url: rawUrl[\s\S]{0,600}/)?.[0] || ''
  assert.match(add, /await isSafeFeedProbeUrl\(rawUrl\)/)
  assert.match(add, /private or internal network/)
})

test('the SSRF policy is the existing one, not a second weaker copy', () => {
  const security = read('security.js')
  assert.doesNotMatch(security, /assertPublicHttpUrl/,
    'feed-probe-policy.js already resolves DNS; a regex twin would be worse and divergent')
})

// ── Rate limiting where abuse is actually possible ──────────────────────────

test('externally reachable routes carry a limit', () => {
  for (const [src, re] of [
    [sync, /app\.get\('\/sync', rateLimit\(/],
    [sync, /app\.post\('\/cron\/sync-all', rateLimit\(/],
    [sync, /app\.post\('\/cron\/drip', rateLimit\(/],
    [square, /app\.post\('\/square\/webhook', rateLimit\(/],
  ]) assert.match(src, re)
})

test('routes that spend money or call a provider carry a cost guard', () => {
  assert.match(billing, /const verifyLimit = rateLimit\('billing-verify'/)
  assert.equal((billing.match(/verifyLimit,/g) || []).length, 5, 'all five verify routes')
  assert.match(integrations, /rateLimit\('integration-test'/)
  assert.match(integrations, /rateLimit\('gbp-post'/)
})

test('auth and MFA rate limits are untouched', () => {
  // CodeQL flagged these as "missing rate limiting" because it does not model this repo's
  // rateLimit() factory. They were always limited; the point of this test is that a future
  // "fix" for those alerts cannot quietly remove what is already there.
  const mfa = read('routes/submodules/auth-mfa-passkeys.js')
  const auth = read('routes/auth.js')
  for (const name of ['mfa-verify', 'mfa-phone-verify', 'passkey-login-begin', 'passkey-login-finish', 'mfa-challenge']) {
    assert.ok(mfa.includes(`'${name}'`), `${name} must keep its rate limit`)
  }
  assert.match(auth, /rateLimit\('login', 5, 15 \* 60 \* 1000, \{ email: true \}\)/)
  assert.match(auth, /rateLimit\('forgot'/)
  assert.match(auth, /rateLimit\('reset'/)
})

// ── Input the server walks must be bounded ──────────────────────────────────

test('the lead CSV parser cannot be handed an unbounded string', () => {
  assert.match(leads, /csv\.length > 8 \* 1024 \* 1024/)
  assert.match(leads, /413/)
})

test('a repeated query param cannot reach code expecting a string', () => {
  // Express turns ?dealership_id=a&dealership_id=b into an array.
  assert.match(sync, /Array\.isArray\(req\.query\.dealership_id\)/)
})

test('a user-controlled value is never in a log format position', () => {
  assert.match(sync, /console\.error\('\[sync\] background sync failed for %s: %s', targetDealershipId/)
})

// ── Stored XSS ──────────────────────────────────────────────────────────────

test('the print window escapes its title', () => {
  // vlabel carries the vehicle make/model/trim, which arrives from dealer-supplied external
  // feeds — so markup in a trim name would have run in the dealer's browser.
  assert.match(part23, /<title>\$\{esc\(title\)\}<\/title>/)
})

test('the print body keeps escaping every value it renders', () => {
  assert.match(part23, /const fld = \(label, value, w\) =>[\s\S]{0,200}esc\(String\(value\)\)/)
})
