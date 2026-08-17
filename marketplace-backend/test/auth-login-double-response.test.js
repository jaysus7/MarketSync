import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../routes/auth.js', import.meta.url), 'utf8')

test('/auth/login sends exactly one response on a normal (non-MFA) login', () => {
  // The MFA-check try block already sends the full success response (including the
  // trusted-device token) for the no-MFA-required / trusted-device path — it doesn't
  // return early there (only the "MFA required" branch does), so it falls out of the
  // try/catch naturally. Duplicate login-logging + audit + res.json() code used to sit
  // right after the catch block and always ran too, on every non-MFA login — sending
  // a second response and throwing ERR_HTTP_HEADERS_SENT, while double-writing both
  // the `logins` table insert and the login audit event. Seen live in staging logs
  // repeating on every login. Verify the loginHandler only calls res.json for the
  // success case OR the MFA-challenge case (mutually exclusive), never both, and
  // that the audit/logins-insert calls only happen once each.
  const start = source.indexOf("app.post('/auth/login'")
  assert.ok(start > -1, '/auth/login route must exist')
  const end = source.indexOf("app.post('/auth/register'")
  assert.ok(end > start, '/auth/register route must exist after /auth/login')
  const handler = source.slice(start, end)

  const successResJsonCount = (handler.match(/res\.json\(\{/g) || []).length
  assert.equal(successResJsonCount, 1, 'the success-path res.json() must appear exactly once (was duplicated after the try/catch)')

  const loginsInsertCount = (handler.match(/supabaseAdmin\.from\('logins'\)\.insert\(/g) || []).length
  assert.equal(loginsInsertCount, 1, 'the logins table insert must happen exactly once per successful login')

  const loginAuditCount = (handler.match(/audit\(req, AuditAction\.USER_LOGIN,/g) || []).length
  assert.equal(loginAuditCount, 1, 'the USER_LOGIN audit call must happen exactly once per successful login')
})
