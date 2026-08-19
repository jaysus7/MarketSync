import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { frontendDashboardSource } from './helpers/split-source.js'

// These assertions guard the dealership's compliance & security posture — the People/HR
// compliance UI, PII-at-rest encryption, CORS, RBAC guards, commission math, and the
// automation/vinsticker builders. They run against the REAL, current module APIs. Much of
// this moved during the dashboard/route split (js/modules/dashboard-part*.js,
// routes/submodules/*), so the frontend checks read the whole split unit via
// frontendDashboardSource(). The runtime imports rely on NODE_ENV=test (set by the npm
// `test` script) so shared.js is importable without live Supabase credentials.

// ── 1. Compliance course catalog (OHSA / WHMIS 2015 / DealerPilot) ───────────
test('Compliance Engine — WHMIS 2015 & DealerPilot course catalog + People/HR tab', () => {
  const dash = frontendDashboardSource()
  assert.match(dash, /WHMIS 2015/, 'WHMIS 2015 course must be present')
  assert.match(dash, /DEALERSHIP_TRAINING_COURSES/, 'DealerPilot training catalog must be defined')
  assert.match(dash, /renderPeopleComplianceTab/, 'People/Compliance tab renderer must be present')
})

// ── 2. PII encryption at rest (PIPEDA) ──────────────────────────────────────
test('Compliance Engine — PII encrypts at rest and round-trips (never plaintext)', async () => {
  // A throwaway fixture key so the crypto exercises real AES-GCM without a live secret.
  process.env.PII_ENCRYPTION_KEY ||= '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
  const { encryptField, decryptField, maskTail } = await import('../crypto-pii.js')
  const email = 'customer.test@dealership.com'
  const encrypted = encryptField(email)
  assert.ok(encrypted?.startsWith('v1:'), 'ciphertext must be versioned (v1:)')
  assert.notEqual(encrypted, email, 'PII must not be stored as plaintext')
  assert.equal(decryptField(encrypted), email, 'PII must decrypt back to the original')
  assert.doesNotMatch(maskTail(email), /dealership/, 'masked value must not leak the address')
})

// ── 3. CORS origin policy ───────────────────────────────────────────────────
test('Security Engine — CORS allows first-party origins and blocks unknown ones', async () => {
  const { corsOriginCheck } = await import('../cors-policy.js')
  const decide = (origin) => new Promise((resolve) => corsOriginCheck(origin, (err, ok) => resolve({ err, ok })))
  assert.deepEqual(await decide('https://marketsync.link'), { err: null, ok: true }, 'first-party origin must be allowed')
  const blocked = await decide('https://malicious-site.com')
  assert.ok(blocked.err === null && blocked.ok === false, 'unknown origins must be blocked')
})

// ── 4. RBAC / auth guards are exported ───────────────────────────────────────
test('Security Engine — auth, MFA and permission guards are available', () => {
  const middleware = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8')
  const authorization = readFileSync(new URL('../authorization.js', import.meta.url), 'utf8')
  assert.match(middleware, /export async function requireAuth/, 'requireAuth must be exported')
  assert.match(middleware, /export async function requireMfa/, 'requireMfa must be exported')
  assert.match(authorization, /export function requirePermission/, 'requirePermission must be exported')
})

// ── 5. People/HR roster surface ──────────────────────────────────────────────
test('Staff Engine — People/HR roster surfaces compensation-aware staff data', () => {
  const dash = frontendDashboardSource()
  assert.match(dash, /renderPeopleComplianceTab/, 'People/Compliance tab must render')
  assert.match(dash, /Comp Plan/, 'staff roster must surface the compensation-plan column')
})

// ── 6. Commission math ───────────────────────────────────────────────────────
test('Commission Engine — front %, flat F&I and total payout', async () => {
  const { computeCommission } = await import('../commissions-calc.js')
  // $45,000 sale − $38,000 cost − $1,000 pack = $6,000 gross; 25% front = $1,500.
  // F&I: $1,200 product × 12.5% = $150. Total = $1,650.
  const result = computeCommission(
    { selling_price: 45000, cost: 38000, fni_items: [{ price: 1200 }] },
    { front: { pack: 1000, percent: 25, method: 'percent' }, back: { method: 'percent', percent: 12.5 }, spiff_per_deal: 0 },
  )
  assert.equal(result.front_amount, 1500, '25% of $6,000 gross should be $1,500')
  assert.equal(result.back_amount, 150, '12.5% of $1,200 F&I should be $150')
  assert.equal(result.total, 1650, 'total payout should be $1,650')
})

// ── 7. Automation briefing builders ──────────────────────────────────────────
test('Automation Submodule — morning digest & weekly briefing builders are exported', async () => {
  const { buildDigest, buildWeeklyBriefing } = await import('../routes/submodules/automation-briefings.js')
  // These builders query Supabase, so we assert they import and are callable rather than
  // exercising them against a live project.
  assert.equal(typeof buildDigest, 'function', 'buildDigest must be exported')
  assert.equal(typeof buildWeeklyBriefing, 'function', 'buildWeeklyBriefing must be exported')
})

// ── 8. VIN sticker / brochure templates ──────────────────────────────────────
test('VIN Sticker Submodule — window sticker HTML compiles with vehicle data', async () => {
  const { buildWindowStickerHtml, buildBrochureHtml } = await import('../routes/submodules/vinsticker-templates.js')
  assert.equal(typeof buildWindowStickerHtml, 'function', 'window sticker builder must be exported')
  assert.equal(typeof buildBrochureHtml, 'function', 'brochure builder must be exported')
  const html = buildWindowStickerHtml(
    { year: 2024, make: 'Ford', model: 'F-150', trim: 'Lariat 4x4', vin: '1FTFW1ED4RF123456', selling_price: 68500 },
    { name: 'Test Motors', country: 'CA' }, {},
  )
  assert.equal(typeof html, 'string', 'sticker builder must return HTML')
  assert.match(html, /1FTFW1ED4RF123456/, 'sticker must include the VIN')
  assert.match(html, /F-150/, 'sticker must include the model')
})
