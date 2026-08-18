import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboardJs = readFileSync(new URL('../../marketplace-frontend/dashboard.js', import.meta.url), 'utf8')
const part14 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part14.js', import.meta.url), 'utf8')
const dashboardHtml = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const gamification = readFileSync(new URL('../../marketplace-backend/routes/submodules/dashboard-gamification.js', import.meta.url), 'utf8')

test('Group Admin, not just Dealer Admin/Owner/Manager, can reach and manage Staff', () => {
  // canManageTeam previously omitted DEALER_GROUP, so a Group Admin could not add
  // staff at all. It now only needs to gate the "Inventory" vs "My Inventory" label
  // (applyProductNav's own allow.delete('sales-team') gate was removed as dead code
  // once no restricted tier put 'sales-team' in its reachable page set any more).
  const matches = [...dashboardJs.matchAll(/const canManageTeam = (\[[^\]]*\])\.includes\(profileContext\?\.role\);/g)]
  assert.equal(matches.length, 1, 'the canManageTeam gate must exist exactly once now')
  assert.match(matches[0][1], /'DEALER_GROUP'/, `canManageTeam must include DEALER_GROUP: ${matches[0][1]}`)
})

test('the page heading reads "Staff", not "Sales Reps" / "Sales Team"', () => {
  assert.match(part14, /title\.textContent = isFacebookTeam \? 'Staff' : 'Users & Team';/)
})

test('neither Facebook Dealer nor Video gets a standalone Staff nav page — staff management lives in Settings for both', () => {
  assert.match(dashboardJs, /facebook_dealer:\s*\['leaderboard', 'inventory'\],/)
  assert.match(dashboardJs, /marketsync_video:\s*\['video-studio', 'leaderboard'\],/)
  assert.match(dashboardJs, /\n\s*video:\s*\['video-studio', 'leaderboard'\],/)
  // The old dedicated nav button and its SALES_REPS/'sales-team' plumbing are gone,
  // not just unreachable — genuinely dead code left behind confuses the next read.
  assert.doesNotMatch(dashboardHtml, /id="nav-sales-team"/)
  assert.doesNotMatch(dashboardJs, /const SALES_REPS/)
  const restrictedFn = dashboardJs.match(/function restrictedNavPages\(\) \{[\s\S]*?\n\}\n/)?.[0] || ''
  assert.ok(restrictedFn, 'restrictedNavPages must exist')
  // No page object or META/fallback-list entry may still route to it — the leftover
  // comment explaining the removal is fine, an actual page reference is not.
  assert.doesNotMatch(restrictedFn, /page: 'sales-team'/)
  assert.doesNotMatch(restrictedFn, /'ai-home', 'inventory', 'sales-team'/)
  assert.match(restrictedFn, /canManageTeam \? \[INV\('Inventory'\), LEADER\] : \[INV\('My Inventory'\), LEADER\]/)
})

test('Facebook Dealer and Video both fold real staff management (Invite Rep/Manager, role table) into the Settings → My Account Team card, the same way Administration folds it in for full DealerOS', () => {
  const part8 = readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part8.js', import.meta.url), 'utf8')
  const accountBlock = part8.match(/if \(tab === 'account'\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
  assert.ok(accountBlock, 'the account-tab branch of settingsTab must exist')
  assert.match(accountBlock, /isFacebookOnlyWorkspace === 'function' && isFacebookOnlyWorkspace\(\)/)
  assert.match(accountBlock, /isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace\(\)/)
  assert.match(accountBlock, /getElementById\('settings-team'\)/)
  assert.match(accountBlock, /getElementById\('dealer-view-panel'\)/)
  // Nodes must be moved (appendChild), not cloned or duplicated, so ids/handlers keep working.
  assert.match(accountBlock, /host\.appendChild\(dv\)/)
  assert.match(accountBlock, /loadDealerManagementMatrix\(\)/)
  // Group Admin must reach it too, not just Dealer Admin/Owner/Manager.
  assert.match(accountBlock, /'DEALER_GROUP'/)
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
