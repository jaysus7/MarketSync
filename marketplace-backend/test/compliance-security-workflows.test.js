import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// ── 1. Compliance Suite (2026 OHSA / WHMIS 2015 / DealerPilot / PIPEDA) ─────
test('Compliance Engine — OHSA, WHMIS 2015 & DealerPilot course definitions', () => {
  const frontendModule = readFileSync(new URL('../../marketplace-frontend/js/modules/compliance-academy.js', import.meta.url), 'utf8')
  assert.ok(frontendModule.includes('WHMIS 2015'), 'WHMIS 2015 course must be present in compliance module')
  assert.ok(frontendModule.includes('DEALERSHIP_TRAINING_COURSES'), 'DealerPilot training catalog must be defined')
  assert.ok(frontendModule.includes('renderPeopleComplianceTab'), 'Compliance tab renderer must be exported')
})

test('Compliance Engine — PII Encryption & Hashing (PIPEDA Compliance)', async () => {
  const { encryptPii, decryptPii, hashPii } = await import('../crypto-pii.js')
  const email = 'customer.test@dealership.com'
  const encrypted = encryptPii(email)
  assert.notEqual(encrypted, email, 'PII must be encrypted')
  const decrypted = decryptPii(encrypted)
  assert.equal(decrypted, email, 'PII must decrypt back to original text')
  const hashed = hashPii(email)
  assert.match(hashed, /^[0-9a-f]{64}$/, 'hashPii must return a 256-bit hex hash')
})

// ── 2. Security & RBAC Suite ──────────────────────────────────────────────────
test('Security Engine — CORS Policy & Chrome Extension Origins', async () => {
  const { isAllowedOrigin } = await import('../cors-policy.js')
  assert.ok(isAllowedOrigin('https://app.marketsync.ca'), 'Production web app origin must be allowed')
  assert.ok(!isAllowedOrigin('https://malicious-site.com'), 'Random third party origins must be blocked')
})

test('Security Engine — Sensitive Route Guard Annotations', () => {
  const security = readFileSync(new URL('../security.js', import.meta.url), 'utf8')
  const middleware = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8')
  assert.ok(middleware.includes('requireAuth'), 'requireAuth middleware must be exported')
  assert.ok(middleware.includes('requireMfa'), 'requireMfa middleware must be exported')
  assert.ok(security.includes('requirePermission') || middleware.includes('requirePermission'), 'RBAC permission guard must be present')
})

// ── 3. Staff Management & Onboarding Workflows ──────────────────────────────
test('Staff Engine — Dashboard html & js reflect unified Staff Roster', () => {
  const html = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
  const js = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')

  assert.ok(html.includes('Staff &amp; Team') || html.includes('Staff & Team'), 'Dashboard HTML must display Staff title')
  assert.ok(html.includes('+ Invite Staff'), 'Invite button must say + Invite Staff')
  assert.ok(!html.includes('<th>Listed</th>'), 'Listed column header must be removed from Staff table')
  assert.ok(!html.includes('<th>Sold</th>'), 'Sold column header must be removed from Staff table')
  assert.ok(html.includes('<th>Location</th>'), 'Location header must be present in Staff table')
  assert.ok(html.includes('<th>Comp Plan</th>'), 'Comp Plan header must be present in Staff table')
  assert.ok(js.includes("isFacebookTeam ? 'Sales Team' : 'Staff & Team'"), 'dashboard.js must render Staff title')
})

// ── 4. AI Commission Engine Payout Calculations ──────────────────────────────
test('Commission Engine — Multi-Tier Gross Payout Calculation', async () => {
  const { computeFrontAmount, computeBackAmount, computeCommission } = await import('../commissions-calc.js')

  // Deal: $45,000 price, $38,000 cost, $1,000 pack => Gross = $6,000
  // Standard Plan: 25% of gross over pack
  const plan = {
    front_tier: 'percentage',
    front_pct: 0.25,
    min_front: 200,
    back_tier: 'flat',
    back_flat: 150
  }
  const deal = { price: 45000, cost: 38000, pack: 1000, fni_revenue: 1200 }

  const front = computeFrontAmount(deal, plan)
  assert.equal(front, 1500, '25% of $6,000 gross should equal $1,500')

  const back = computeBackAmount(deal, plan)
  assert.equal(back, 150, 'Flat F&I commission should equal $150')

  const total = computeCommission(deal, plan)
  assert.equal(total.payout, 1650, 'Total commission should equal $1,500 + $150 = $1,650')
})

// ── 5. Automation & Briefing Submodules ─────────────────────────────────────
test('Automation Submodule — Morning Digest & Weekly Briefing Builders', async () => {
  const { buildDigest, buildWeeklyBriefing } = await import('../routes/submodules/automation-briefings.js')
  assert.ok(typeof buildDigest === 'function', 'buildDigest builder function must be exported')
  assert.ok(typeof buildWeeklyBriefing === 'function', 'buildWeeklyBriefing builder function must be exported')

  const sampleDigest = buildDigest({
    deals: [{ id: '1', customer: 'John Doe', amount: 35000 }],
    leads: [{ id: '101', name: 'Jane Smith' }],
    repStats: { 'rep-1': { name: 'Marcus Vance', units: 14 } }
  })
  assert.ok(sampleDigest.text.includes('Morning Digest'), 'Digest must contain Morning Digest title')
})

// ── 6. Vehicle Window Sticker & Brochure Rendering ──────────────────────────
test('VIN Sticker Submodule — HTML Template Compilation', async () => {
  const { buildWindowStickerHtml, buildBrochureHtml } = await import('../routes/submodules/vinsticker-templates.js')
  assert.ok(typeof buildWindowStickerHtml === 'function', 'Window sticker template builder must be exported')
  assert.ok(typeof buildBrochureHtml === 'function', 'Brochure template builder must be exported')

  const vehicle = {
    year: 2024,
    make: 'Ford',
    model: 'F-150',
    trim: 'Lariat 4x4',
    vin: '1FTFW1ED4RF123456',
    price: 68500
  }
  const stickerHtml = buildWindowStickerHtml(vehicle)
  assert.ok(stickerHtml.includes('2024 Ford F-150'), 'Window sticker HTML must contain vehicle title')
  assert.ok(stickerHtml.includes('1FTFW1ED4RF123456'), 'Window sticker HTML must contain VIN')
})
