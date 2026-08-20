import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizeHtml, stripScriptsFromHead } from '../html-sanitizer.js'
import { createTrustedDeviceToken, verifyTrustedDeviceToken } from '../mfa-login-challenges.js'
import { recordPasskeyStepUp, hasRecentPasskeyStepUp } from '../passkeys.js'
import { isDisallowedIp, validateOutboundUrl } from '../outbound-http-policy.js'
import { requireStrongStepUp, getSessionFingerprint } from '../middleware.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Security Hardening — Deep Verification Suite', () => {

  // ──────────────────────────────────────────────────────────────────────────
  // Part A: Public Website Builder XSS & Origin Isolation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Part A: HTML Sanitizer & Iframe Sandbox', () => {
    test('strips executable scripts, on* event handlers, and javascript: protocols', () => {
      const dirty = `<div class="card">
        <h1>Welcome</h1>
        <script>alert("xss")</script>
        <img src="x" onerror="alert(1)" onload="alert(2)" />
        <a href="javascript:alert(document.cookie)">Click me</a>
        <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data link</a>
        <p style="color: red; behavior: url(xss.htc); expression(alert(1))">Text</p>
      </div>`

      const clean = sanitizeHtml(dirty)
      assert.ok(!clean.includes('<script>'), 'Must not contain script tags')
      assert.ok(!clean.includes('onerror='), 'Must not contain onerror handler')
      assert.ok(!clean.includes('onload='), 'Must not contain onload handler')
      assert.ok(!clean.includes('javascript:'), 'Must not contain javascript: url')
      assert.ok(!clean.includes('data:text/html'), 'Must not contain data:text/html url')
      assert.ok(!clean.includes('expression('), 'Must not contain CSS expression')
      assert.ok(!clean.includes('behavior:'), 'Must not contain CSS behavior')
      assert.ok(clean.includes('<h1>Welcome</h1>'), 'Preserves safe heading')
      assert.ok(clean.includes('<div class="card">'), 'Preserves safe div and class')
    })

    test('enforces rel="noopener noreferrer" on external links', () => {
      const dirty = '<a href="https://example.com" target="_blank">External</a>'
      const clean = sanitizeHtml(dirty)
      assert.ok(clean.includes('rel="noopener noreferrer"'), 'External link must carry noopener noreferrer')
    })

    test('preserves safe data images while blocking untrusted formats', () => {
      const safeDataImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const dirty = `<img src="${safeDataImg}" alt="pixel" />`
      const clean = sanitizeHtml(dirty)
      assert.ok(clean.includes('src="data:image/png;base64,'), 'Allows valid base64 PNG data URI')

      const badData = '<img src="data:image/svg+xml;utf8,<svg onload=alert(1)>" />'
      const cleanBad = sanitizeHtml(badData)
      assert.ok(!cleanBad.includes('data:image/svg+xml'), 'Blocks SVG data URI in src')
    })

    test('stripScriptsFromHead removes executable script and iframe tags from site head', () => {
      const dirtyHead = `
        <meta name="author" content="Dealer">
        <script src="https://evil.com/hook.js"></script>
        <script>console.log("tracking")</script>
        <iframe src="https://evil.com"></iframe>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css">
      `
      const cleanHead = stripScriptsFromHead(dirtyHead)
      assert.ok(!cleanHead.includes('<script'), 'Must not contain script tags')
      assert.ok(!cleanHead.includes('<iframe'), 'Must not contain iframe tags')
      assert.ok(cleanHead.includes('<meta name="author"'), 'Preserves safe meta tags')
    })

    test('frontend site.html iframe sandbox does not allow same-origin', () => {
      const siteHtmlPath = path.resolve(__dirname, '../../marketplace-frontend/site.html')
      const content = fs.readFileSync(siteHtmlPath, 'utf8')
      assert.ok(content.includes('sandbox="allow-scripts allow-forms allow-popups"'), 'Must have restricted sandbox without allow-same-origin')
      assert.ok(!content.includes('sandbox="allow-scripts allow-forms allow-popups allow-same-origin'), 'Must never combine scripts with allow-same-origin')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Part B: Trusted Device & Strong Step-Up Authentication
  // ──────────────────────────────────────────────────────────────────────────
  describe('Part B: Trusted Device & Session-bound Step-Up', () => {
    test('creates and verifies versioned trusted device token', () => {
      const userId = 'usr_test_123456789'
      const token = createTrustedDeviceToken(userId)
      assert.ok(token, 'Generates non-empty token')

      const valid = verifyTrustedDeviceToken(token, userId)
      assert.strictEqual(valid, true, 'Validates legitimate token')

      const wrongUser = verifyTrustedDeviceToken(token, 'usr_other_999999')
      assert.strictEqual(wrongUser, false, 'Rejects token for different user')

      const invalidToken = token.slice(0, -4) + 'AAAA'
      const tampered = verifyTrustedDeviceToken(invalidToken, userId)
      assert.strictEqual(tampered, false, 'Rejects tampered signature')
    })

    test('session-bound passkey step-up isolates different browser sessions', () => {
      const userId = 'usr_mfa_iso_test'
      const sessionA = 'fp_browser_session_AAA'
      const sessionB = 'fp_browser_session_BBB'

      assert.strictEqual(hasRecentPasskeyStepUp(userId, sessionA), false, 'Initially not stepped up')
      recordPasskeyStepUp(userId, sessionA)

      assert.strictEqual(hasRecentPasskeyStepUp(userId, sessionA), true, 'Session A is now stepped up')
      assert.strictEqual(hasRecentPasskeyStepUp(userId, sessionB), false, 'Session B remains unverified')
    })

    test('requireStrongStepUp middleware blocks non-AAL2 sessions without passkey step-up', async () => {
      let passed = false
      const req = {
        user: { id: 'usr_stepup_test' },
        headers: { authorization: 'Bearer dummy_jwt_session_token_12345' },
      }
      const res = {
        status(code) {
          this.statusCode = code
          return this
        },
        json(payload) {
          this.body = payload
          return this
        }
      }
      const next = () => { passed = true }

      await requireStrongStepUp(req, res, next)
      assert.strictEqual(passed, false, 'Must block without recent step-up')
      assert.strictEqual(res.statusCode, 403, 'Returns 403')
      assert.strictEqual(res.body?.error, 'STRONG_STEP_UP_REQUIRED', 'Returns STRONG_STEP_UP_REQUIRED code')

      // Now satisfy with session passkey step-up
      const fp = getSessionFingerprint(req)
      recordPasskeyStepUp(req.user.id, fp)

      passed = false
      await requireStrongStepUp(req, res, next)
      assert.strictEqual(passed, true, 'Passes when session-bound step-up exists')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Part C: AI Chat Transcript/Memory Authorization
  // ──────────────────────────────────────────────────────────────────────────
  describe('Part C: AI Engine Column Minimization & Permissions', () => {
    test('routes/ai-engine.js does not expose visitor_token in SAFE_CONVO_COLUMNS', () => {
      const aiEnginePath = path.resolve(__dirname, '../routes/ai-engine.js')
      const code = fs.readFileSync(aiEnginePath, 'utf8')
      assert.ok(code.includes('SAFE_CONVO_COLUMNS'), 'Must define SAFE_CONVO_COLUMNS')
      assert.ok(!code.match(/SAFE_CONVO_COLUMNS\s*=\s*['"][^'"]*visitor_token/), 'Must not include visitor_token in SAFE_CONVO_COLUMNS')
      assert.ok(code.includes("requirePermission('customer.view')"), 'GET /ai/conversations must require customer.view')
      assert.ok(code.includes("requirePermission('customer.edit')"), 'POST /ai/conversations/:id/status must require customer.edit')
    })

    test('database migration enforces ai_messages immutability and memory lockdown', () => {
      const migPath = path.resolve(__dirname, '../migrations/2026-08-20-security-hardening-xss-mfa-ai-ssrf.sql')
      assert.ok(fs.existsSync(migPath), 'Migration file must exist')
      const mig = fs.readFileSync(migPath, 'utf8')
      assert.ok(mig.includes('revoke update on table public.ai_messages'), 'Must revoke update on ai_messages')
      assert.ok(mig.includes('revoke insert, update, delete on table public.ai_memory'), 'Must restrict client direct mutations on ai_memory')
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Part D: Centralized SSRF / Outbound Network Policy
  // ──────────────────────────────────────────────────────────────────────────
  describe('Part D: SSRF & Outbound IP Validation', () => {
    test('isDisallowedIp correctly classifies private, loopback, metadata, and special IPs', () => {
      // IPv4 Disallowed
      assert.strictEqual(isDisallowedIp('127.0.0.1'), true, 'Loopback 127.0.0.1 is disallowed')
      assert.strictEqual(isDisallowedIp('127.1.2.3'), true, 'Loopback range 127.0.0.0/8 is disallowed')
      assert.strictEqual(isDisallowedIp('0.0.0.0'), true, 'Current network 0.0.0.0 is disallowed')
      assert.strictEqual(isDisallowedIp('10.0.0.1'), true, 'Private 10.0.0.0/8 is disallowed')
      assert.strictEqual(isDisallowedIp('10.255.255.255'), true, 'Private 10.0.0.0/8 is disallowed')
      assert.strictEqual(isDisallowedIp('100.64.0.1'), true, 'CGNAT 100.64.0.0/10 is disallowed')
      assert.strictEqual(isDisallowedIp('169.254.169.254'), true, 'Cloud metadata 169.254.169.254 is disallowed')
      assert.strictEqual(isDisallowedIp('169.254.1.1'), true, 'Link-local 169.254.0.0/16 is disallowed')
      assert.strictEqual(isDisallowedIp('172.16.0.1'), true, 'Private 172.16.0.0/12 is disallowed')
      assert.strictEqual(isDisallowedIp('172.31.255.255'), true, 'Private 172.16.0.0/12 is disallowed')
      assert.strictEqual(isDisallowedIp('192.168.1.1'), true, 'Private 192.168.0.0/16 is disallowed')
      assert.strictEqual(isDisallowedIp('192.0.2.1'), true, 'TEST-NET-1 is disallowed')
      assert.strictEqual(isDisallowedIp('198.51.100.1'), true, 'TEST-NET-2 is disallowed')
      assert.strictEqual(isDisallowedIp('203.0.113.1'), true, 'TEST-NET-3 is disallowed')
      assert.strictEqual(isDisallowedIp('224.0.0.1'), true, 'Multicast is disallowed')
      assert.strictEqual(isDisallowedIp('240.0.0.1'), true, 'Reserved 240.0.0.0/4 is disallowed')
      assert.strictEqual(isDisallowedIp('255.255.255.255'), true, 'Broadcast is disallowed')

      // IPv6 Disallowed
      assert.strictEqual(isDisallowedIp('::1'), true, 'IPv6 loopback ::1 is disallowed')
      assert.strictEqual(isDisallowedIp('::'), true, 'IPv6 unspecified :: is disallowed')
      assert.strictEqual(isDisallowedIp('fc00::1'), true, 'IPv6 unique local fc00::/7 is disallowed')
      assert.strictEqual(isDisallowedIp('fd12:3456:789a::1'), true, 'IPv6 unique local is disallowed')
      assert.strictEqual(isDisallowedIp('fe80::1'), true, 'IPv6 link-local fe80::/10 is disallowed')
      assert.strictEqual(isDisallowedIp('ff02::1'), true, 'IPv6 multicast is disallowed')

      // IPv4-mapped IPv6
      assert.strictEqual(isDisallowedIp('::ffff:127.0.0.1'), true, 'IPv4-mapped 127.0.0.1 is disallowed')
      assert.strictEqual(isDisallowedIp('::ffff:169.254.169.254'), true, 'IPv4-mapped metadata is disallowed')
      assert.strictEqual(isDisallowedIp('::ffff:10.0.0.1'), true, 'IPv4-mapped 10.0.0.1 is disallowed')

      // Public IPv4 Allowed
      assert.strictEqual(isDisallowedIp('8.8.8.8'), false, 'Public IP 8.8.8.8 is allowed')
      assert.strictEqual(isDisallowedIp('1.1.1.1'), false, 'Public IP 1.1.1.1 is allowed')
      assert.strictEqual(isDisallowedIp('93.184.216.34'), false, 'Public IP 93.184.216.34 is allowed')
    })

    test('validateOutboundUrl rejects internal, invalid, and credentialed URLs', async () => {
      const bad1 = await validateOutboundUrl('http://127.0.0.1:8080/secret')
      assert.strictEqual(bad1.ok, false, 'Rejects loopback IP URL')

      const bad2 = await validateOutboundUrl('http://localhost/admin')
      assert.strictEqual(bad2.ok, false, 'Rejects localhost hostname')

      const bad3 = await validateOutboundUrl('http://169.254.169.254/latest/meta-data/')
      assert.strictEqual(bad3.ok, false, 'Rejects AWS/GCP metadata URL')

      const bad4 = await validateOutboundUrl('http://user:pass@example.com/hook')
      assert.strictEqual(bad4.ok, false, 'Rejects user:pass credentialed URL')

      const bad5 = await validateOutboundUrl('ftp://example.com/file')
      assert.strictEqual(bad5.ok, false, 'Rejects non-HTTP(S) protocol')

      const bad6 = await validateOutboundUrl('http://server.internal/api')
      assert.strictEqual(bad6.ok, false, 'Rejects .internal host')

      const good = await validateOutboundUrl('https://example.com/webhook')
      assert.strictEqual(good.ok, true, 'Accepts valid public HTTPS URL')
    })
  })
})
