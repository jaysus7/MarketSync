#!/usr/bin/env node
/**
 * MarketSync deploy verification — smoke-check a live URL after deploy.
 *
 * Runs entirely from Node, no browser required. Confirms:
 *   1. The static site (/apps/*.html) serves and preloads the iframe.
 *   2. dashboard.html allows same-origin framing (X-Frame-Options).
 *   3. Every /apps/*.html renders the shared shell brand.
 *   4. /api/apps/waitlist rejects an invalid product (proves the router
 *      is registered and validation works — does not create rows).
 *   5. /api/apps/entitlements returns 401 for an unauthenticated call
 *      (proves the auth gate is in place).
 *
 * Exit code 0 on all-green, 1 on any red.
 *
 * Usage:
 *   node marketplace-backend/e2e/deploy-verify.mjs \
 *     --frontend https://marketsync.link \
 *     --backend  https://vehicle-marketplace-s0e4.onrender.com
 *
 * Optional flags:
 *   --json    machine-readable report (default: human)
 *   --strict  fail on WARN as well as ERR (default: WARN allowed)
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = arr[i + 1]
      acc.push([key, (next && !next.startsWith('--')) ? next : true])
    }
    return acc
  }, [])
)

const FRONTEND = args.frontend || process.env.E2E_FRONTEND_URL
const BACKEND  = args.backend  || process.env.E2E_BACKEND_URL
const JSON_OUT = !!args.json
const STRICT   = !!args.strict

if (!FRONTEND || !BACKEND) {
  console.error('Usage: node deploy-verify.mjs --frontend <url> --backend <url>')
  process.exit(2)
}

const APPS = [
  'appraisals', 'video-studio', 'design-studio', 'website-studio',
  'crm', 'email-sms', 'desking', 'service-checkin',
]

const findings = [] // {level, name, detail}
const push = (level, name, detail = '') => findings.push({ level, name, detail })

async function safeFetch(url, init) {
  try {
    const res = await fetch(url, { ...init, redirect: 'manual' })
    const text = await res.text()
    return { ok: true, status: res.status, headers: Object.fromEntries(res.headers), body: text }
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) }
  }
}

async function main() {
  // ── 1. Static site: /apps/index.html ─────────────────────────────────
  const picker = await safeFetch(`${FRONTEND}/apps/`)
  if (!picker.ok) push('ERR', 'apps-picker-fetch', picker.error)
  else if (picker.status !== 200) push('ERR', 'apps-picker-status', `HTTP ${picker.status}`)
  else if (!/MarketSync Apps/i.test(picker.body)) push('ERR', 'apps-picker-body', 'title missing')
  else push('OK', 'apps-picker', 'served')

  // ── 2. Every launcher: shared shell + preload target ────────────────
  for (const slug of APPS) {
    const r = await safeFetch(`${FRONTEND}/apps/${slug}.html`)
    if (!r.ok) { push('ERR', `app-${slug}-fetch`, r.error); continue }
    if (r.status !== 200) { push('ERR', `app-${slug}-status`, `HTTP ${r.status}`); continue }
    // Iframe target present
    if (!new RegExp(`src="/dashboard\\.html\\?embedded=[a-z-]+"`).test(r.body)) {
      push('ERR', `app-${slug}-iframe`, 'iframe src missing')
      continue
    }
    // Preload present (fast-load contract)
    if (!/rel="preload"[^>]+as="document"/.test(r.body)) {
      push('WARN', `app-${slug}-preload`, 'preload hint missing — slower first paint')
    }
    // Shared shell CSS + JS
    if (!/shell\.css\?v=/.test(r.body) || !/shell\.js\?v=/.test(r.body)) {
      push('ERR', `app-${slug}-shell`, 'shared shell asset link missing')
      continue
    }
    push('OK', `app-${slug}`, 'served + iframe + shell')
  }

  // ── 3. dashboard.html: framable same-origin ──────────────────────────
  const dash = await safeFetch(`${FRONTEND}/dashboard.html?embedded=appraisal`)
  if (!dash.ok) push('ERR', 'dashboard-fetch', dash.error)
  else if (dash.status !== 200) push('ERR', 'dashboard-status', `HTTP ${dash.status}`)
  else {
    const xfo = String(dash.headers['x-frame-options'] || '').toUpperCase()
    if (xfo === 'DENY') push('ERR', 'dashboard-xfo', 'X-Frame-Options: DENY blocks all framing')
    else if (xfo === 'SAMEORIGIN') push('OK', 'dashboard-xfo', 'SAMEORIGIN')
    else push('WARN', 'dashboard-xfo', `unexpected value: ${xfo || '(not set)'}`)
    const csp = String(dash.headers['content-security-policy'] || '')
    if (/frame-ancestors 'none'/.test(csp)) push('ERR', 'dashboard-csp', "frame-ancestors 'none' blocks framing")
    else if (/frame-ancestors 'self'/.test(csp) || /frame-ancestors \*/.test(csp)) push('OK', 'dashboard-csp', 'framing allowed')
    else push('WARN', 'dashboard-csp', 'frame-ancestors not explicitly set')
  }

  // ── 4. /api/apps/waitlist: router registered + validates ────────────
  const wl = await safeFetch(`${BACKEND}/api/apps/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'deploy-verify@example.com', product: 'not-a-real-app' }),
  })
  if (!wl.ok) push('ERR', 'waitlist-fetch', wl.error)
  else if (wl.status === 404) push('ERR', 'waitlist-route', 'route not registered on backend')
  else if (wl.status === 400) push('OK', 'waitlist-validation', 'rejects invalid product')
  else push('WARN', 'waitlist-validation', `unexpected status ${wl.status}`)

  // ── 5. /api/apps/entitlements: auth gate ─────────────────────────────
  const ent = await safeFetch(`${BACKEND}/api/apps/entitlements`)
  if (!ent.ok) push('ERR', 'entitlements-fetch', ent.error)
  else if (ent.status === 404) push('ERR', 'entitlements-route', 'route not registered on backend')
  else if (ent.status === 401) push('OK', 'entitlements-auth-gate', 'requires auth')
  else push('WARN', 'entitlements-auth-gate', `expected 401, got ${ent.status}`)

  // ── Report ───────────────────────────────────────────────────────────
  const ok    = findings.filter(f => f.level === 'OK').length
  const warn  = findings.filter(f => f.level === 'WARN').length
  const err   = findings.filter(f => f.level === 'ERR').length

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify({ frontend: FRONTEND, backend: BACKEND, ok, warn, err, findings }, null, 2) + '\n')
  } else {
    console.log('')
    console.log('MarketSync deploy verification')
    console.log('  frontend:', FRONTEND)
    console.log('  backend: ', BACKEND)
    console.log('')
    for (const f of findings) {
      const marker = f.level === 'OK' ? '  ✓' : (f.level === 'WARN' ? '  !' : '  ✗')
      console.log(`${marker} [${f.level}] ${f.name}${f.detail ? ' — ' + f.detail : ''}`)
    }
    console.log('')
    console.log(`Summary: ${ok} OK · ${warn} WARN · ${err} ERR`)
  }

  const failed = err > 0 || (STRICT && warn > 0)
  process.exit(failed ? 1 : 0)
}

main().catch(e => {
  console.error('deploy-verify: fatal', e)
  process.exit(2)
})
