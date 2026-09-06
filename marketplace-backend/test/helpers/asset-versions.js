import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')

// The `?v=` cache-bust a given asset is requested with in dashboard.html.
// Tests should compare versions to each other through this rather than pinning a
// literal string: a hardcoded version turns every legitimate release bump into a
// test failure, which is how eight changed files once shipped still carrying the
// previous release's version.
export function assetVersion(path) {
  const m = html.match(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=([A-Za-z0-9_]+)'))
  if (!m) throw new Error(`dashboard.html does not request ${path} with a ?v= cache-bust`)
  return m[1]
}

// The version the current release group shares. dashboard-part2.js is the anchor:
// it carries the Design Studio boot chain, so anything bumped alongside the studio
// must match it.
export const RELEASE_VERSION = assetVersion('js/modules/dashboard-part2.js')
