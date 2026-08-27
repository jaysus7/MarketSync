import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Phase 9C — Controlled Pilot & Production Launch Readiness E2E
//
// Governing rules: AGENTS.md A14 (Security/Compliance), A17 (Branch discipline), A19 (Runtime proof)
// Validates deployment blueprints, environment variable contracts, launch gates, and secret protection.

const BE = fileURLToPath(new URL('../', import.meta.url))
const REPO = path.join(BE, '..')
const read = (rel) => readFileSync(path.join(BE, rel), 'utf8')
const readRoot = (rel) => readFileSync(path.join(REPO, rel), 'utf8')

const renderYaml = readRoot('render.yaml')
const serverJs = read('server.js')
const launchRoute = read('routes/launch-hub.js')

// ── 1. Production Blueprint & Deployment Gate ────────────────────────────────

test('render.yaml enforces production settings and main branch promotion gate', () => {
  assert.match(renderYaml, /name:\s*marketsync-backend/, 'defines backend service')
  assert.match(renderYaml, /name:\s*marketsync-site/, 'defines static site service')
  assert.match(renderYaml, /branch:\s*main/, 'production deploys exclusively from main')
  assert.match(renderYaml, /healthCheckPath:\s*\/health/, 'configures /health endpoint')
  assert.match(renderYaml, /NODE_ENV[\s\S]*?value:\s*production/, 'production environment set')
  assert.match(renderYaml, /FRONTEND_URL[\s\S]*?value:\s*https:\/\/marketsync\.link/, 'production frontend URL set')
})

test('render.yaml declares all secrets with sync: false or generateValue', () => {
  const secretKeys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'ANTHROPIC_API_KEY',
    'PII_ENCRYPTION_KEY',
    'RESEND_API_KEY',
  ]
  for (const key of secretKeys) {
    const keyRegex = new RegExp(`key:\\s*${key}[\\s\\S]*?sync:\\s*false`)
    assert.match(renderYaml, keyRegex, `secret ${key} must have sync: false`)
  }
  assert.match(renderYaml, /key:\s*OAUTH_STATE_SECRET[\s\S]*?generateValue:\s*true/, 'OAUTH_STATE_SECRET is generated')
})

// ── 2. Server Health Check & Production Startup Invariants ───────────────────

test('server.js exports active /health check and validates route registration', () => {
  assert.match(serverJs, /app\.get\('\/health',/, 'exposes /health endpoint')
  assert.match(serverJs, /res\.json\(\{\s*ok:\s*true/, 'returns ok: true status')
  assert.match(serverJs, /VALIDATE_STARTUP/, 'supports automated startup smoke testing')
})

// ── 3. Launch Hub Readiness & Pilot Onboarding Gate ─────────────────────────

test('Launch Hub categorizes configuration readiness without blocking core operational flows', () => {
  assert.match(launchRoute, /REQUIRED_TO_LAUNCH/, 'defines REQUIRED_TO_LAUNCH tier')
  assert.match(launchRoute, /REQUIRED_FOR_FEATURE/, 'defines REQUIRED_FOR_FEATURE tier')
  assert.match(launchRoute, /RECOMMENDED/, 'defines RECOMMENDED tier')
  assert.match(launchRoute, /OPTIONAL/, 'defines OPTIONAL tier')
  assert.match(launchRoute, /app\.get\('\/launch', requireAuth/, 'protects launch status endpoint with requireAuth')
  assert.match(launchRoute, /operational:\s*outstanding\(launch\)\.length === 0/, 'evaluates operational readiness independently')
})

// ── 4. Zero Secrets In Source Code ──────────────────────────────────────────

test('no live production API keys or service role tokens committed in repository files', () => {
  const forbiddenPatterns = [
    /sk_live_[0-9a-zA-Z]{24,}/,
    /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[0-9a-zA-Z_-]+\.[0-9a-zA-Z_-]+/,
  ]
  const sourceFiles = [
    'server.js',
    'render.yaml',
    'routes/auth.js',
    'routes/billing.js',
    'routes/accounting.js',
    'routes/affiliate.js',
  ]
  for (const rel of sourceFiles) {
    const content = rel === 'render.yaml' ? readRoot(rel) : read(rel)
    for (const pat of forbiddenPatterns) {
      assert.doesNotMatch(content, pat, `live secret detected in ${rel}`)
    }
  }
})
