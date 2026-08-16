import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, FE), 'utf8')
const exists = (rel) => existsSync(fileURLToPath(new URL(rel, FE)))

// Public marketing pages that MUST use the shared shell.
// compare.html is intentionally a redirect stub to the canonical pricing.html (the
// pricing-compare page was consolidated there), so it is NOT a shared-shell content page.
const PUBLIC_PAGES = [
  'index.html', 'features.html', 'workflow.html', 'faq.html', 'blog.html',
  'guide.html', 'support.html', 'security.html', 'privacy-policy.html', 'terms.html', 'affiliates.html',
  'ai-chatbot.html', 'dealer-os.html', 'facebook-autoposter.html',
  'ai-listing-copy.html', 'ai-vision-photo-scoring.html', 'automation-followups.html',
  'crm-lead-delivery.html', 'deal-desk.html', 'dealer-groups.html', 'dealer-inventory-sync.html',
  'dealer-website.html', 'equity-mining.html', 'facebook-marketplace-poster.html',
  'facebook-posting-safety.html', 'inventory-intelligence.html', 'market-price-reports.html',
  'marketsync-vs-shiftly-auto.html', 'sales-leaderboard.html', 'sales-pipeline.html',
  'trade-appraisal.html', 'vin-decoder-window-stickers.html',
]

// Application / specialized / auth pages that MUST NOT get the marketing shell.
const EXCLUDED_PAGES = [
  'dashboard.html', 'chat-widget.html', 'site.html', 'post.html', 'esign.html', 'group.html',
  'training.html', 'affiliate.html', 'marketsync-guide.html', 'upgrade.html', 'watch.html',
  'login.html', 'register.html', 'forgot-password.html', 'reset-password.html',
]

// Legacy duplicated-shell markers that migration must have removed.
const LEGACY_MARKERS = [
  { re: /<header class="sticky top-0 z-40 bg-slate-50\/80 dark:bg-\[#0B0F19\]\/80 backdrop-blur-md/, name: 'inline sticky marketing header' },
  { re: /<footer class="max-w-7xl mx-auto px-6 py-12 mt-12 border-t/, name: 'inline marketing footer' },
  { re: /function checkSystemTheme/, name: 'inline checkSystemTheme() theme code' },
  { re: /function msToggleMenu/, name: 'inline msToggleMenu() menu code' },
  { re: /src="\/site-nav\.js"/, name: 'legacy site-nav.js include' },
]

// ── Shell assets exist ───────────────────────────────────────────────
test('shared shell assets exist on disk', () => {
  for (const a of ['assets/public-shell.js', 'assets/public-shell.css', 'assets/auth.js']) {
    assert.ok(exists(a), `missing shell asset: ${a}`)
  }
})

test('public-shell.js references a public-shell.css that exists', () => {
  const js = read('assets/public-shell.js')
  const m = js.match(/CSS_HREF\s*=\s*'([^']+)'/)
  assert.ok(m, 'CSS_HREF not found in public-shell.js')
  const rel = m[1].replace(/^\//, '')
  assert.ok(exists(rel), `public-shell.js points at missing CSS: ${m[1]}`)
})

// ── Every public page is on the shell ────────────────────────────────
for (const page of PUBLIC_PAGES) {
  test(`public page uses the shared shell: ${page}`, () => {
    const s = read(page)
    assert.match(s, /<script src="\/assets\/public-shell\.js" defer><\/script>/, `${page} does not load public-shell.js`)
    assert.match(s, /<script src="\/assets\/auth\.js" defer><\/script>/, `${page} does not load auth.js`)
    assert.match(s, /id="ms-public-header"/, `${page} missing #ms-public-header mount`)
    assert.match(s, /id="ms-public-footer"/, `${page} missing #ms-public-footer mount`)
    // pre-paint theme snippet (no light-mode flash)
    assert.match(s, /prefers-color-scheme: dark[\s\S]{0,80}classList\.add\(['"]dark['"]\)/,
      `${page} missing pre-paint system-theme snippet`)
  })

  test(`public page has no duplicated legacy shell markup: ${page}`, () => {
    const s = read(page)
    for (const { re, name } of LEGACY_MARKERS) {
      assert.doesNotMatch(s, re, `${page} still contains ${name}`)
    }
  })

  test(`public page mounts appear exactly once: ${page}`, () => {
    const s = read(page)
    assert.equal((s.match(/id="ms-public-header"/g) || []).length, 1, `${page} has ≠1 header mount`)
    assert.equal((s.match(/id="ms-public-footer"/g) || []).length, 1, `${page} has ≠1 footer mount`)
  })

  test(`public page has no duplicate HTML ids: ${page}`, () => {
    const s = read(page)
    const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    const seen = new Set()
    const dup = new Set()
    for (const id of ids) { if (seen.has(id)) dup.add(id); seen.add(id) }
    assert.equal(dup.size, 0, `${page} duplicate ids: ${[...dup].join(', ')}`)
  })

  test(`public page keeps referenced shell assets resolvable: ${page}`, () => {
    const s = read(page)
    for (const m of s.matchAll(/src="(\/assets\/[^"]+)"/g)) {
      assert.ok(exists(m[1].replace(/^\//, '')), `${page} references missing asset ${m[1]}`)
    }
  })
}

// ── Application pages were not converted ─────────────────────────────
for (const page of EXCLUDED_PAGES) {
  test(`application/auth page NOT converted to marketing shell: ${page}`, () => {
    if (!exists(page)) return // tolerate pages that don't exist in this checkout
    const s = read(page)
    assert.doesNotMatch(s, /\/assets\/public-shell\.js/, `${page} must not load the marketing shell`)
    assert.doesNotMatch(s, /id="ms-public-header"/, `${page} must not carry the marketing header mount`)
  })
}

// ── Page-specific functionality preserved on representative pages ────
test('index.html preserves analytics and cookie consent on the shared shell', () => {
  const s = read('index.html')
  assert.match(s, /googletagmanager\.com\/gtag\/js/, 'gtag analytics dropped')
  assert.match(s, /cdn-cookieyes\.com/, 'CookieYes dropped')
  assert.match(s, /id="ms-public-header"/, 'index not on the shared shell')
})

test('legacy shell pages keep their content stylesheet and scroll-reveal', () => {
  for (const page of ['ai-chatbot.html', 'dealer-os.html', 'facebook-autoposter.html']) {
    const s = read(page)
    assert.match(s, /site-marketing\.css/, `${page} dropped its content stylesheet`)
    assert.match(s, /ms-reveal/, `${page} lost its scroll-reveal content`)
  }
})

test('canonical + Open Graph metadata preserved on migrated pages', () => {
  for (const page of ['features.html', 'security.html', 'faq.html']) {
    const s = read(page)
    assert.match(s, /rel="canonical"/, `${page} lost canonical link`)
    assert.match(s, /property="og:title"/, `${page} lost Open Graph title`)
  }
})

// ── Automatic system dark mode (no manual toggle) ────────────────────
test('shell theme is automatic system dark/light with a live listener and no manual toggle', () => {
  const js = read('assets/public-shell.js')
  assert.match(js, /matchMedia\('\(prefers-color-scheme: dark\)'\)/, 'shell does not read the OS theme')
  assert.match(js, /classList\.toggle\('dark'/, 'shell does not apply the dark class')
  assert.match(js, /addEventListener\('change'/, 'shell does not listen for OS theme changes')
  // No manual light/dark toggle control.
  assert.doesNotMatch(js, /toggleTheme|theme-toggle|data-theme-toggle/, 'shell must not add a manual theme toggle')

  const css = read('assets/public-shell.css')
  assert.match(css, /@media \(prefers-color-scheme:\s?dark\)/, 'shell CSS has no system dark styling')
})

// ── Centralized session check (a token string alone is not "signed in") ─
test('auth.js validates sessions rather than trusting a bare token', async () => {
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  }
  const mod = await import(new URL('assets/auth.js', FE))
  const MSAuth = mod.default || globalThis.MSAuth
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const jwt = (payload) => `${b({ alg: 'HS256' })}.${b(payload)}.sig`
  const now = Math.floor(Date.now() / 1000)

  for (const k of Object.keys(store)) delete store[k]
  assert.equal(MSAuth.isAuthenticated(), false, 'no token should be unauthenticated')

  store.token = jwt({ exp: now + 3600, user_metadata: { full_name: 'Jay Massie' } })
  assert.equal(MSAuth.isAuthenticated(), true, 'valid unexpired JWT should be authenticated')
  assert.equal(MSAuth.getFirstName(), 'Jay', 'first name should resolve from the session')

  store.token = jwt({ exp: now - 3600 })
  delete store.refresh_token
  assert.equal(MSAuth.isAuthenticated(), false, 'expired JWT with no refresh token is NOT a session')

  store.refresh_token = 'r'
  assert.equal(MSAuth.isAuthenticated(), true, 'expired JWT WITH refresh token is still a live session')
})
