import { supabaseAdmin } from '../../shared.js'
import { requireAuth } from '../../middleware.js'

export function registerDashboardGamificationRoutes(app) {
  const _gamCache = new Map()   // dealershipId -> { exp, data }
  const GAM_TTL_MS = 10 * 60 * 1000
  const HR = 60 * 60 * 1000

  // Ascending badge (higher value = better). Returns level (0..N) + progress to next.
  const ascBadge = (key, icon, label, description, value, thresholds, unit = '') => {
    let level = 0
    for (const t of thresholds) if (value >= t) level++
    const next = thresholds[level] ?? null
    const prev = level > 0 ? thresholds[level - 1] : 0
    const progress_pct = next == null ? 100
      : Math.max(0, Math.min(100, Math.round(((value - prev) / (next - prev)) * 100)))
    return { key, icon, label, description, value, unit, level, max_level: thresholds.length, thresholds, next, progress_pct }
  }

  // Descending badge (lower value = better, e.g. hours-to-post). thresholds hardest last.
  const descBadge = (key, icon, label, description, value, thresholds, unit = '') => {
    let level = 0
    if (value != null) for (const t of thresholds) if (value <= t) level++
    const next = thresholds[level] ?? null
    return { key, icon, label, description, value, unit, level, max_level: thresholds.length, thresholds, next, progress_pct: null }
  }

  app.get('/gamification', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ me: null, dealership: null })
    try {
      const cached = _gamCache.get(req.dealershipId)
      if (cached && cached.exp > Date.now()) {
        const me = cached.data.repBadges[req.user.id] || cached.data.emptyMe(req)
        return res.json({ dealership: cached.data.dealership, me })
      }

      const { data: members } = await supabaseAdmin
        .from('profiles').select('id, full_name').eq('dealership_id', req.dealershipId)
      const memberIds = (members || []).map(m => m.id)
      const nameOf = new Map((members || []).map(m => [m.id, m.full_name]))

      const [{ data: listings }, { data: appraisals }, { count: availCount }] = await Promise.all([
        memberIds.length ? supabaseAdmin
          .from('listings')
          .select('posted_by, status, posted_at, inventory:inventory_id(created_at)')
          .in('posted_by', memberIds).limit(20000)
          : Promise.resolve({ data: [] }),
        supabaseAdmin
          .from('trade_appraisals').select('created_by').eq('dealership_id', req.dealershipId).limit(20000),
        supabaseAdmin
          .from('inventory').select('id', { count: 'exact', head: true })
          .eq('dealership_id', req.dealershipId).eq('status', 'available').is('archived_at', null),
      ])

      const now = Date.now()
      const d30Ms = 30 * 86400000

      const stats = {}
      const initRep = (id) => stats[id] || (stats[id] = {
        posted_total: 0, posted_30d: 0, sold_total: 0, sold_30d: 0,
        post_lags_ms: [], appraisals_total: 0,
      })

      for (const mId of memberIds) initRep(mId)

      for (const l of (listings || [])) {
        if (!l.posted_by) continue
        const s = initRep(l.posted_by)
        s.posted_total++
        const pMs = l.posted_at ? new Date(l.posted_at).getTime() : null
        if (pMs && (now - pMs) <= d30Ms) s.posted_30d++
        if (l.status === 'sold') {
          s.sold_total++
          if (pMs && (now - pMs) <= d30Ms) s.sold_30d++
        }
        const invCreated = l.inventory?.created_at
        if (invCreated && pMs) {
          const lag = pMs - new Date(invCreated).getTime()
          if (lag >= 0 && lag < 365 * 86400000) s.post_lags_ms.push(lag)
        }
      }

      for (const a of (appraisals || [])) {
        if (!a.created_by) continue
        initRep(a.created_by).appraisals_total++
      }

      const repBadges = {}
      for (const [id, s] of Object.entries(stats)) {
        const avgLagHrs = s.post_lags_ms.length
          ? Math.round(s.post_lags_ms.reduce((a, b) => a + b, 0) / s.post_lags_ms.length / HR)
          : null

        const badges = [
          ascBadge('first_post', 'rocket', 'First Post', 'Post your first vehicle to Facebook Marketplace.', s.posted_total, [1]),
          ascBadge('post_master', 'flame', 'Post Master', 'Post 25, 100, or 250 vehicles.', s.posted_total, [25, 100, 250]),
          ascBadge('closer', 'trophy', 'Closer', 'Mark 5, 25, or 50 listings as sold.', s.sold_total, [5, 25, 50]),
          ascBadge('appraiser', 'search', 'Lot Scout', 'Complete 10, 50, or 100 trade appraisals.', s.appraisals_total, [10, 50, 100]),
          descBadge('speed_demon', 'zap', 'Speed Demon', 'Average speed from vehicle add to first post (under 48h / 24h / 12h).', avgLagHrs, [48, 24, 12], 'h'),
        ]

        const current_title = s.sold_total >= 50 ? 'Legendary Closer'
          : s.sold_total >= 25 ? 'Top Performer'
          : s.posted_total >= 100 ? 'Pro Merchandiser'
          : s.posted_total >= 25 ? 'Rising Star'
          : 'Rookie'

        repBadges[id] = {
          rep_id: id,
          full_name: nameOf.get(id) || 'Rep',
          current_title,
          stats: {
            posted_total: s.posted_total, posted_30d: s.posted_30d,
            sold_total: s.sold_total, sold_30d: s.sold_30d,
            appraisals_total: s.appraisals_total,
            avg_post_lag_hours: avgLagHrs,
          },
          badges,
        }
      }

      const leaderboard = Object.values(repBadges)
        .sort((a, b) => b.stats.sold_30d - a.stats.sold_30d || b.stats.posted_30d - a.stats.posted_30d)
        .map((r, i) => ({ rank: i + 1, rep_id: r.rep_id, full_name: r.full_name, sold_30d: r.stats.sold_30d, posted_30d: r.stats.posted_30d }))

      const dlTotals = Object.values(stats).reduce((acc, s) => {
        acc.posted += s.posted_total
        acc.sold += s.sold_total
        acc.appraisals += s.appraisals_total
        return acc
      }, { posted: 0, sold: 0, appraisals: 0 })

      const dlBadges = [
        ascBadge('dlr_posts', 'package', 'Lot Coverage', 'Total listings created across the team (500 / 2500 / 10000).', dlTotals.posted, [500, 2500, 10000]),
        ascBadge('dlr_sales', 'trending-up', 'Dealership Velocity', 'Total sales recorded on the platform (100 / 500 / 2500).', dlTotals.sold, [100, 500, 2500]),
        ascBadge('dlr_appraisals', 'award', 'Appraisal Hub', 'Total trade appraisals processed (250 / 1000 / 5000).', dlTotals.appraisals, [250, 1000, 5000]),
      ]

      const data = {
        dealership: { available_inventory: availCount || 0, totals: dlTotals, badges: dlBadges, leaderboard },
        repBadges,
        emptyMe: (req) => ({
          rep_id: req.user.id, full_name: nameOf.get(req.user.id) || 'Rep', current_title: 'Rookie',
          stats: { posted_total: 0, posted_30d: 0, sold_total: 0, sold_30d: 0, appraisals_total: 0, avg_post_lag_hours: null },
          badges: [],
        })
      }

      _gamCache.set(req.dealershipId, { exp: Date.now() + GAM_TTL_MS, data })
      const me = repBadges[req.user.id] || data.emptyMe(req)
      res.json({ dealership: data.dealership, me })
    } catch (e) {
      console.error('/gamification failed:', e.message)
      res.status(500).json({ error: 'Gamification compute failed' })
    }
  })
}
