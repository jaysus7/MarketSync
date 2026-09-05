/**
 * MarketSync Standalone Apps — foundation contract tests.
 *
 * The /apps/*.html launcher pages are the first-touch surface for the
 * eight standalone products (Design Studio, Website Studio, Video
 * Studio, Email & SMS, CRM, Desking, Appraisals, Service Check-in).
 * They must be mobile-first, must not depend on the dashboard bundle,
 * must not silently drop a waitlist signup, and must never fabricate a
 * "live" badge for a product that isn't shipping yet.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readdirSync } from 'node:fs'

const APPS_DIR = new URL('../../marketplace-frontend/apps/', import.meta.url)

const shellCss = await readFile(new URL('shell.css', APPS_DIR), 'utf8')
const shellJs  = await readFile(new URL('shell.js', APPS_DIR), 'utf8')
const index    = await readFile(new URL('index.html', APPS_DIR), 'utf8')

const PRODUCTS = ['design-studio', 'website-studio', 'video-studio',
                  'email-sms', 'crm', 'desking', 'appraisals', 'service-checkin']

for (const slug of PRODUCTS) {
  test(`apps/${slug}.html shares its source with dashboard.html via ?embedded=`, async () => {
    const html = await readFile(new URL(`${slug}.html`, APPS_DIR), 'utf8')
    // Mobile-first viewport with viewport-fit=cover for notched phones.
    assert.match(html, /width=device-width, initial-scale=1, viewport-fit=cover/,
      'launcher must ship the mobile-first viewport tag')
    // Shared-source contract: the launcher must NOT duplicate tool code.
    // It iframes the same /dashboard.html that DealerOS uses so an update
    // to a tool inside dashboard.html propagates to the standalone app
    // automatically — no fork, no drift.
    assert.match(html, /<iframe[^>]+src="\/dashboard\.html\?embedded=/,
      `${slug}.html must iframe /dashboard.html?embedded=<tool>`)
    assert.match(html, /shell\.css\?v=/, 'must load the shared shell stylesheet')
    // Launchers may not directly load DealerOS bundles — the iframe does.
    assert.doesNotMatch(html, /<script[^>]+src="\/?dashboard\.js/,
      `${slug}.html must not load dashboard.js directly — only via the iframe`)
    assert.doesNotMatch(html, /js\/modules\/dashboard-part/,
      `${slug}.html must not load dashboard-part* modules directly`)
    // Signed-out fallback: if the framed dashboard bounces to /login the
    // launcher must swap in its own sign-in card rather than let the top
    // window get redirected out from under the visitor.
    assert.match(html, /id="app-signedout"/,
      `${slug}.html must render the sign-in fallback`)
    assert.match(html, /contentWindow\.location/,
      `${slug}.html must detect the framed /login redirect`)
  })
}

test('every product tile in the picker points at a launcher that exists', () => {
  // The picker's stage tag either says "live" (Open now, primary color)
  // or "dealeros" (In DealerOS · standalone soon). No third state — a
  // product on the picker MUST have a launcher file.
  const files = new Set(readdirSync(new URL('.', APPS_DIR)).filter(f => f.endsWith('.html')))
  for (const slug of PRODUCTS) {
    assert.ok(files.has(`${slug}.html`), `apps/${slug}.html must exist`)
    assert.match(index, new RegExp(`href: '${slug}\\.html'`),
      `picker must link to ${slug}.html`)
  }
})

test('picker lists every app as live now that each iframes the shared dashboard', () => {
  // Every app now runs on the shared-source iframe path — all 8 are
  // "live" as soon as the DealerOS dashboard loads. 1 hero label + 8
  // product tiles = 9 stage:'live' occurrences.
  const liveMatches = [...index.matchAll(/stage: 'live'/g)].length
  assert.equal(liveMatches, 9, `expected 9 stage:'live' occurrences, got ${liveMatches}`)
  assert.doesNotMatch(index, /stage: 'dealeros'/,
    'no product should be tagged dealeros-only now that the shared-source iframe pattern is in place')
})

test('apps in the picker are ordered per the user-locked priority', () => {
  // Order lock: Appraisals · Video · Design · Website · CRM · Email/SMS
  // · Desking · Service. Reordering products is a UX signal to visitors
  // — the tests own it.
  const expected = ['appraisals', 'video-studio', 'design-studio',
                    'website-studio', 'crm', 'email-sms', 'desking', 'service-checkin']
  const found = [...index.matchAll(/slug: '([^']+)'/g)].map(m => m[1])
  assert.deepEqual(found, expected,
    'apps/index.html product order must match the user-locked priority')
})

test('shared shell CSS is mobile-first (base rules assume small screen, desktop layered on)', () => {
  // A design-system red flag would be desktop-first rules and mobile
  // overrides via `max-width` queries. Enforce that all `@media` rules
  // are `min-width` progressive enhancements.
  const mediaRules = [...shellCss.matchAll(/@media\s*\([^)]+\)/g)].map(m => m[0])
  for (const rule of mediaRules) {
    assert.match(rule, /min-width|prefers-color-scheme/,
      `shell.css @media rules must be min-width or prefers-color-scheme (mobile-first), got: ${rule}`)
  }
  // Base body font-size must be a readable mobile default.
  assert.match(shellCss, /body\s*\{[\s\S]*?font-size:\s*16px/,
    'body must set 16px base font — smaller reads too small on 390px devices')
  // Buttons must have a touch-friendly minimum height (~44px per Apple HIG).
  assert.match(shellCss, /\.app-btn\s*\{[\s\S]*?min-height:\s*2\.75rem/,
    'primary tap targets must be at least 44px tall')
})

test('shell.js waitlist has a mailto fallback so no signup is silently dropped', () => {
  // If /api/apps/waitlist ever fails or is disabled, the user still has
  // a working path to reach us — the exact opposite of the "silently
  // convert an error into nothing" pattern the finalization brief bans.
  assert.match(shellJs, /fetch\(['"]\/api\/apps\/waitlist['"]/,
    'shell must POST to /api/apps/waitlist')
  assert.match(shellJs, /mailto:hello@marketsync\.link/,
    'shell must fall back to mailto when the endpoint is unreachable')
})

test('waitlist endpoint validates inputs, dedupes on unique violation, degrades gracefully', async () => {
  const src = await readFile(
    new URL('../routes/apps-waitlist.js', import.meta.url), 'utf8'
  )
  // Public route (no requireAuth) so the launcher page can call it
  // before the visitor has an account.
  assert.match(src, /app\.post\(['"]\/api\/apps\/waitlist['"], async/,
    'waitlist route must be POST /api/apps/waitlist and public')
  assert.doesNotMatch(src, /requireAuth/,
    'waitlist must be reachable without authentication')
  // Product must be one of the eight — no unknown SKUs.
  assert.match(src, /VALID_PRODUCTS = new Set\(/,
    'waitlist must reject unknown product slugs')
  for (const slug of PRODUCTS) {
    assert.match(src, new RegExp(`'${slug}'`),
      `waitlist product list must include ${slug}`)
  }
  // Email must pass a real regex, not a "@" truthiness check.
  assert.match(src, /EMAIL_RE = \//, 'must apply an email regex')
  // Duplicate signup is idempotent, not an error.
  assert.match(src, /return res\.json\(\{ ok: true, deduped: true \}\)/,
    'unique-violation must respond ok:true so the UI stays quiet')
  // Missing table returns 503, letting the frontend fall through to mailto.
  assert.match(src, /'waitlist_unavailable'/,
    'missing table must return the soft-degrade code the frontend expects')
})

test('waitlist migration ships an idempotent DDL with the dedup index and RLS on', async () => {
  const mig = await readFile(
    new URL('../../supabase/migrations/20260905190000_apps_waitlist.sql', import.meta.url), 'utf8'
  )
  assert.match(mig, /create table if not exists public\.apps_waitlist/,
    'migration must be idempotent (create table if not exists)')
  assert.match(mig, /create unique index if not exists apps_waitlist_email_product_uidx[\s\S]*?lower\(email\), product/,
    'migration must add the (lower(email), product) unique index that the dedupe path relies on')
  assert.match(mig, /alter table public\.apps_waitlist enable row level security/,
    'RLS must be on (writes go through service role only)')
})

test('dashboard.js parses ?embedded=<slug> and maps only the 8 known apps', async () => {
  // Shared-source contract: dashboard.html is the single copy of every
  // tool. When a launcher iframes /dashboard.html?embedded=<slug>,
  // dashboard.js must (a) mark the root data-embedded="1" so the chrome
  // hides via CSS, and (b) switchPage to the tool's pageId. Only the 8
  // known apps get through — an arbitrary ?embedded= value must never
  // drive route resolution.
  const dj = await readFile(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
  assert.match(dj, /new URLSearchParams\(window\.location\.search[\s\S]{0,80}embedded/,
    'dashboard.js must parse the ?embedded= URL param')
  assert.match(dj, /document\.documentElement\.setAttribute\('data-embedded', '1'\)/,
    'dashboard.js must stamp data-embedded=1 on the root when embedded')
  for (const [key, target] of [
    ['appraisal',       'appraisal'],
    ['video-studio',    'saas-studio'],
    ['design-studio',   'saas-studio'],
    ['website-studio',  'saas-website'],
    ['crm',             'crm'],
    ['email-sms',       'saas-email-marketing'],
    ['desking',         'sales-desking'],
    ['service-checkin', 'service-ros'],
  ]) {
    assert.match(dj, new RegExp(`'${key}':\\s*'${target}'`),
      `dashboard.js embedded map must route ${key} → ${target}`)
  }
})

test('dashboard.html hides its chrome when data-embedded is set', async () => {
  // The apps must render the tool without any DealerOS chrome. Verify the
  // CSS scoped to html[data-embedded="1"] hides every shell surface.
  const dh = await readFile(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
  for (const sel of ['header.ms-chrome-glass', '#dashboard-nav', '#dept-nav',
                     '#dept-sidebar', '#dept-tabbar', '#report-rail']) {
    // sel must appear inside a rule that's scoped to html[data-embedded="1"]
    // and sets display:none.
    const rule = new RegExp(`html\\[data-embedded="1"\\][\\s\\S]{0,600}${sel.replace(/[.#]/g, m => '\\' + m)}[\\s\\S]{0,600}display:\\s*none`)
    assert.match(dh, rule, `dashboard.html must hide ${sel} in embedded mode`)
  }
})

test('embedded routing wins over the URL hash on boot (apps mount tool first)', async () => {
  // If a launcher lands with both ?embedded= AND some other hash, the
  // embedded page must win — the visitor is in the app, not deep-linked
  // into another dashboard page.
  const p2 = await readFile(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8')
  assert.match(p2, /window\.__msEmbeddedPage\s*\)\s*\|\|\s*msRouteFromHash\(\)/,
    '__msBootTarget must prefer window.__msEmbeddedPage over the URL hash')
})

test('_headers grants same-origin framing on /dashboard.html only', async () => {
  const headers = await readFile(new URL('../../marketplace-frontend/_headers', import.meta.url), 'utf8')
  // The /* catch-all keeps X-Frame-Options: DENY for every other path —
  // never loosen that.
  assert.match(headers, /\/\*\s*\n[\s\S]*?X-Frame-Options: DENY/,
    'catch-all /* block must keep X-Frame-Options: DENY')
  // The /dashboard.html override allows same-origin framing so /apps/*
  // can iframe it, but no wider than that.
  assert.match(headers, /\/dashboard\.html\s*\n(?:\s+[^\n]*\n)*?\s+X-Frame-Options: SAMEORIGIN/,
    'dashboard.html must be framable same-origin')
  assert.match(headers, /\/dashboard\.html[\s\S]*?frame-ancestors 'self'/,
    "dashboard.html CSP must set frame-ancestors 'self'")
})

test('server.js registers the standalone waitlist router', async () => {
  const server = await readFile(
    new URL('../server.js', import.meta.url), 'utf8'
  )
  assert.match(server, /import \{ registerAppsWaitlist \} from '\.\/routes\/apps-waitlist\.js'/,
    'apps-waitlist router must be imported')
  assert.match(server, /registerAppsWaitlist\(app\)/,
    'apps-waitlist router must be registered on the app')
})
