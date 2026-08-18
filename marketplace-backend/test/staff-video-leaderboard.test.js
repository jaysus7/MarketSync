import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const part14 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part14.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const gamification = readFileSync(new URL('../../marketplace-backend/routes/submodules/dashboard-gamification.js', import.meta.url), 'utf8')

test('Group Admin, not just Dealer Admin/Owner/Manager, can reach and manage Staff', () => {
  // Two independent hardcoded gates existed for the Staff/Sales Reps page — one that
  // prunes it from the reachable-page set, one that decides the mobile nav entry — and
  // both omitted DEALER_GROUP, so a Group Admin could not add staff at all.
  const matches = [...dashboardJs.matchAll(/const canManageTeam = (\[[^\]]*\])\.includes\(profileContext\?\.role\);/g)]
  assert.equal(matches.length, 2, 'both canManageTeam gates must exist')
  for (const m of matches) {
    assert.match(m[1], /'DEALER_GROUP'/, `canManageTeam must include DEALER_GROUP: ${m[1]}`)
  }
})

test('the nav/page label reads "Staff", not "Sales Reps" / "Sales Team"', () => {
  assert.match(dashboardJs, /const SALES_REPS = \{ page: 'sales-team', label: 'Staff', icon: 'user' \};/)
  assert.match(dashboardHtml, /id="nav-sales-team" data-page="sales-team" title="Staff"/)
  const navBtn = dashboardHtml.match(/id="nav-sales-team"[\s\S]*?<\/button>/)?.[0] || ''
  assert.match(navBtn, /<span>Staff<\/span>/)
  assert.match(part14, /title\.textContent = isFacebookTeam \? 'Staff' : 'Users & Team';/)
})

test('Video is entitled to the Staff page and the Leaderboard, not just Video Studio', () => {
  assert.match(dashboardJs, /marketsync_video:\s*\['video-studio', 'leaderboard', 'sales-team'\],/)
  assert.match(dashboardJs, /\n\s*video:\s*\['video-studio', 'leaderboard', 'sales-team'\],/)
})

test('the backend /gamification endpoint computes a real Sales Video department from sales_videos', () => {
  assert.match(gamification, /from\('sales_videos'\)\.select\('created_by, status, sent_at, first_played_at, watch_percent'\)/)
  assert.match(gamification, /\.eq\('dealership_id', req\.dealershipId\)\.is\('deleted_at', null\)\.limit\(20000\)/)
  // Only videos that actually went out count — a recorded-but-unsent draft is not activity.
  assert.match(gamification, /if \(v\.status === 'draft' \|\| v\.status === 'ready'\) continue/)
  assert.match(gamification, /video: \{ title: 'Sales Video', reps: \[\] \}/)
  assert.match(gamification, /deptData\.video\.reps\.push\(/)
  const videoBlock = gamification.match(/\/\/ --- 5\. SALES VIDEO ---[\s\S]*?deptData\.video\.reps\.push\(\{[\s\S]*?\n {8}\}\)/)?.[0] || ''
  assert.ok(videoBlock, 'the Sales Video metrics block must exist')
  for (const key of ['sent_30d', 'total_sent', 'watched', 'watch_rate_pct', 'avg_watch_pct']) {
    assert.match(videoBlock, new RegExp(key), `Sales Video metrics must include ${key}`)
  }
})

test('the frontend leaderboard renders a Video department tab, ranking columns, and single-product presentation', () => {
  assert.match(dashboardHtml, /switchLeaderboardDept\('video'\)" id="lb-dept-video"/)
  assert.match(part14, /\['facebook', 'sales', 'service', 'fni', 'video'\]\.forEach/)
  const metricBlock = part14.match(/else if \(deptKey === 'video'\) \{[\s\S]*?\n {4}\}/)?.[0] || ''
  assert.ok(metricBlock, 'the video metric-column branch must exist')
  assert.match(metricBlock, /m\.total_sent/)
  assert.match(metricBlock, /m\.watched/)
  assert.match(metricBlock, /m\.watch_rate_pct/)
  assert.match(metricBlock, /m\.avg_watch_pct/)

  const presentationFn = part14.match(/function applyLeaderboardProductPresentation\(\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(presentationFn, 'applyLeaderboardProductPresentation must exist')
  assert.match(presentationFn, /isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace\(\)/)
  assert.match(presentationFn, /window\.__activeLbDept = 'video'/)
  // A video-only account has no deal-desk/appraisal activity — the legend and header
  // columns for those must not be left showing.
  assert.match(presentationFn, /lb-non-fb.*classList\.add\('hidden'\)/)
})
