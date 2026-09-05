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
  test(`apps/${slug}.html exists and uses the shared standalone shell`, async () => {
    const html = await readFile(new URL(`${slug}.html`, APPS_DIR), 'utf8')
    // Mobile-first: correct viewport with viewport-fit=cover for notched
    // phones. Never a fixed-width viewport that would break on mobile.
    assert.match(html, /width=device-width, initial-scale=1, viewport-fit=cover/,
      'launcher must ship the mobile-first viewport tag')
    // Every launcher loads only the standalone shell — NOT the DealerOS
    // dashboard.js bundle, whose registry assumes a dealership context.
    assert.doesNotMatch(html, /src="\/?dashboard\.js/,
      `${slug}.html must not load dashboard.js — the standalone shell is dealership-free`)
    assert.doesNotMatch(html, /js\/modules\/dashboard-part/,
      `${slug}.html must not load dashboard-part* modules directly`)
    assert.match(html, /shell\.css\?v=/, 'must load the shared shell stylesheet')
    assert.match(html, /shell\.js\?v=/, 'must load the shared shell script')
    assert.match(html, /MarketSyncApp\.mount\(/,
      'must boot through the shared mount helper')
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

test('picker only marks Design Studio as live — the rest honestly say DealerOS-first', () => {
  // No fabricated "Open now" tags for products whose standalone signup
  // isn't ready. Anything else is dishonest per the finalization brief:
  // "No placeholder values presented as production data."
  const liveMatches = [...index.matchAll(/stage: 'live'/g)].length
  const dealerosMatches = [...index.matchAll(/stage: 'dealeros'/g)].length
  // 1 hero (the picker itself) + 1 product (design-studio) = 2 'live'
  assert.equal(liveMatches, 2, `expected 2 stage:'live' occurrences, got ${liveMatches}`)
  assert.equal(dealerosMatches, 7, `expected 7 stage:'dealeros' occurrences, got ${dealerosMatches}`)
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

test('server.js registers the standalone waitlist router', async () => {
  const server = await readFile(
    new URL('../server.js', import.meta.url), 'utf8'
  )
  assert.match(server, /import \{ registerAppsWaitlist \} from '\.\/routes\/apps-waitlist\.js'/,
    'apps-waitlist router must be imported')
  assert.match(server, /registerAppsWaitlist\(app\)/,
    'apps-waitlist router must be registered on the app')
})
