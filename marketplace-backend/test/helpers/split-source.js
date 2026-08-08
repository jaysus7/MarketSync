import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Source-scanning tests assert that security guards / entitlement tables / content
// live in a given file. Several of those files were later SPLIT into pieces:
//   marketplace-frontend/dashboard.js  → js/modules/dashboard-part*.js
//   routes/dashboard.js                → routes/submodules/dashboard-*.js
//   routes/ai.js                       → routes/submodules/ai-*.js
//   routes/auth.js                     → routes/submodules/auth-*.js
// The split is load-order-critical and concatenation reproduces the original unit,
// so a scanner must read the WHOLE logical unit, not just the pre-split entry file.
// These helpers return that concatenation.

const BE = new URL('../../', import.meta.url)              // marketplace-backend/
const FE = new URL('../../../marketplace-frontend/', import.meta.url)

const readIf = (url) => { try { return readFileSync(url, 'utf8') } catch { return '' } }

const byLeadingNumber = (a, b) =>
  (parseInt(a.match(/\d+/)?.[0] || '0', 10) - parseInt(b.match(/\d+/)?.[0] || '0', 10))

function concatDir(dirUrl, rx, sort = byLeadingNumber) {
  let files
  try { files = readdirSync(fileURLToPath(dirUrl)) } catch { return '' }
  return files.filter((f) => rx.test(f)).sort(sort).map((f) => readIf(new URL(f, dirUrl))).join('\n')
}

// marketplace-frontend/dashboard.js + js/modules/dashboard-part*.js (in numeric order).
export function frontendDashboardSource() {
  return readIf(new URL('dashboard.js', FE)) + '\n' +
    concatDir(new URL('js/modules/', FE), /^dashboard-part\d+\.js$/)
}

// A backend route file plus every submodule extracted from it
// (routes/submodules/<name>-*.js), e.g. backendRouteSource('dashboard') pulls in
// dashboard-reports.js and dashboard-gamification.js.
export function backendRouteSource(name) {
  return readIf(new URL(`routes/${name}.js`, BE)) + '\n' +
    concatDir(new URL('routes/submodules/', BE), new RegExp(`^${name}-.*\\.js$`), (a, b) => a.localeCompare(b))
}
