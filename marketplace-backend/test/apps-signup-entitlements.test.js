/**
 * MarketSync Standalone Apps — signup + entitlements + deploy-verify.
 *
 * These are contract tests. The route handlers can't be executed here
 * without a Supabase URL + service role, so this file asserts the
 * shape of what will run: correct request/response contract, correct
 * gating, correct rollback path on failure, migration idempotency,
 * signup UI wiring, and deploy-verify coverage.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routeSrc = await readFile(
  new URL('../routes/apps-waitlist.js', import.meta.url), 'utf8'
)
const signupHtml = await readFile(
  new URL('../../marketplace-frontend/apps/signup.html', import.meta.url), 'utf8'
)
const migration = await readFile(
  new URL('../../supabase/migrations/20260905203000_apps_entitlements.sql', import.meta.url), 'utf8'
)
const deployVerify = await readFile(
  new URL('../e2e/deploy-verify.mjs', import.meta.url), 'utf8'
)

test('POST /api/apps/signup is public, rate-limited, and validates inputs', () => {
  assert.match(routeSrc, /app\.post\(['"]\/api\/apps\/signup['"]/,
    'signup route must exist')
  assert.match(routeSrc, /rateLimit\(['"]apps-signup['"], 3, 60 \* 60 \* 1000/,
    'signup must be rate-limited to 3 per hour (same policy as dealer register)')
  assert.doesNotMatch(routeSrc.match(/app\.post\(['"]\/api\/apps\/signup['"][\s\S]{0,400}/)[0], /requireAuth/,
    'signup must be reachable without an existing session')
  assert.match(routeSrc, /if \(!EMAIL_RE\.test\(email\)\)/, 'must reject invalid email')
  assert.match(routeSrc, /if \(!fullName \|\| fullName\.length < 2\)/, 'must require a name')
  assert.match(routeSrc, /if \(!VALID_PRODUCTS\.has\(appSlug\)\)/, 'must reject unknown app slugs')
  assert.match(routeSrc, /const pwCheck = await validatePassword\(password/,
    'must run the same NIST password policy the dealer signup uses')
})

test('signup creates auth user + personal dealership + profile + entitlement, or rolls back', () => {
  // Personal-dealership path reuses the working RLS/profile pattern so
  // every existing policy that keys off dealership_id keeps working.
  assert.match(routeSrc, /supabaseAdmin\.auth\.admin\.createUser\(\{[\s\S]{0,200}email_confirm: true/,
    'signup must auto-confirm the auth user so the visitor can enter the app immediately')
  assert.match(routeSrc, /\.from\(['"]dealerships['"]\)[\s\S]{0,300}is_personal: true/,
    'signup must create a personal dealership')
  assert.match(routeSrc, /\.from\(['"]profiles['"]\)[\s\S]{0,300}dealership_id: createdDealershipId/,
    'signup must create a profile scoped to the personal dealership')
  assert.match(routeSrc, /\.from\(['"]apps_entitlements['"]\)[\s\S]{0,300}app_slug: appSlug/,
    'signup must grant the requested app in apps_entitlements')
  // Full rollback on failure — never leave orphan supabase users or
  // dealerships if any downstream insert fails.
  assert.match(routeSrc, /if \(createdDealershipId\)[\s\S]{0,120}\.from\(['"]dealerships['"]\)\.delete/,
    'signup must delete the personal dealership on failure')
  assert.match(routeSrc, /if \(createdUserId\)[\s\S]{0,120}auth\.admin\.deleteUser\(createdUserId\)/,
    'signup must delete the auth user on failure')
})

test('duplicate email returns 409, not a generic 500', () => {
  assert.match(routeSrc, /already registered\|duplicate[\s\S]{0,120}status\(409\)[\s\S]{0,120}email_in_use/,
    'duplicate email must map to 409 { error: "email_in_use" } so the UI can render the right message')
})

test('GET /api/apps/entitlements requires auth and degrades when table is missing', () => {
  assert.match(routeSrc, /app\.get\(['"]\/api\/apps\/entitlements['"], requireAuth/,
    'entitlements route must require auth')
  assert.match(routeSrc, /error\.code === ['"]42P01['"][\s\S]{0,180}degraded: true/,
    'entitlements must return { entitlements: [], degraded: true } when the migration has not run')
})

test('apps_entitlements migration is idempotent, RLS-on, self-read only', () => {
  assert.match(migration, /create table if not exists public\.apps_entitlements/,
    'migration must be idempotent')
  assert.match(migration, /alter table public\.apps_entitlements enable row level security/,
    'RLS must be on')
  assert.match(migration, /create policy "apps_entitlements_self_read"[\s\S]{0,200}using \(user_id = auth\.uid\(\)\)/,
    'authenticated users must be able to read their own entitlements')
  assert.doesNotMatch(migration, /create policy [^ ]*[\s\S]{0,100}for insert[\s\S]{0,200}to authenticated/,
    'no INSERT policy for authenticated — writes go through service role only')
  assert.match(migration, /create unique index if not exists apps_entitlements_user_app_uidx/,
    'unique (user_id, app_slug) index prevents duplicate entitlements')
  assert.match(migration, /platform_owner['", ]+['", ]*platform_admin/,
    'platform_owner/platform_admin must be able to read every row for HQ product-usage')
})

test('/apps/signup.html renders the signup form and preselects ?app=', () => {
  assert.match(signupHtml, /<form id="signup"/, 'signup form must exist')
  assert.match(signupHtml, /fetch\(API \+ ['"]\/api\/apps\/signup['"]/,
    'form must POST to /api/apps/signup')
  assert.match(signupHtml, /localStorage\.setItem\(['"]token['"], tk\)/,
    'form must store the access_token under the same key dashboard.js reads (token)')
  assert.match(signupHtml, /localStorage\.setItem\(['"]refresh_token['"], rt\)/,
    'form must persist the refresh token so the session survives reloads')
  assert.match(signupHtml, /const requestedApp = String\(params\.get\(['"]app['"]\)/,
    'form must preselect the app from the ?app= query param')
  // Whitelist matches the 8 apps.
  for (const slug of ['appraisals', 'video-studio', 'design-studio', 'website-studio',
                       'crm', 'email-sms', 'desking', 'service-checkin']) {
    assert.match(signupHtml, new RegExp(`\\['${slug}',`),
      `signup app list must include ${slug}`)
  }
})

test('every launcher points its "Create account" CTA at /apps/signup.html?app=<slug>', async () => {
  for (const slug of ['appraisals', 'video-studio', 'design-studio', 'website-studio',
                       'crm', 'email-sms', 'desking', 'service-checkin']) {
    const html = await readFile(
      new URL(`../../marketplace-frontend/apps/${slug}.html`, import.meta.url), 'utf8'
    )
    assert.match(html, new RegExp(`href="/apps/signup\\.html\\?app=${slug}"`),
      `${slug}.html signup CTA must deep-link to /apps/signup.html?app=${slug}`)
    // The old /register.html?next= link would send single users into
    // the dealer signup flow — which requires a dealership. Regression
    // guard.
    assert.doesNotMatch(html, /href="\/register\.html/,
      `${slug}.html must not route visitors into the dealer registration flow`)
  }
})

test('deploy-verify script covers every deploy contract point', () => {
  // The script is the single source of truth for "did the deploy work?"
  // It must hit every entrypoint that changed in this cycle.
  assert.match(deployVerify, /`\$\{FRONTEND\}\/apps\/`/, 'must fetch the picker page (FRONTEND/apps/)')
  for (const slug of ['appraisals', 'video-studio', 'design-studio', 'website-studio',
                       'crm', 'email-sms', 'desking', 'service-checkin']) {
    assert.match(deployVerify, new RegExp(`'${slug}'`),
      `deploy-verify must check /apps/${slug}.html`)
  }
  assert.match(deployVerify, /X-Frame-Options: DENY blocks all framing/,
    'must fail loudly if dashboard.html is not framable same-origin')
  assert.match(deployVerify, /waitlist-route[\s\S]{0,200}not registered on backend/,
    'must fail if the waitlist route is missing (404)')
  assert.match(deployVerify, /entitlements-auth-gate[\s\S]{0,200}requires auth/,
    'must verify /api/apps/entitlements enforces auth')
  // Non-zero exit on failure so this can gate CI.
  assert.match(deployVerify, /process\.exit\(failed \? 1 : 0\)/,
    'must exit 1 on failure so it can gate a deploy pipeline')
})
