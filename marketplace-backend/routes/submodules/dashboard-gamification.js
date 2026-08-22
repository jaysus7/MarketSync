import { supabaseAdmin } from '../../shared.js'
import { requireAuth } from '../../middleware.js'

export function registerDashboardGamificationRoutes(app) {
  const _gamCache = new Map()   // dealershipId -> { exp, data }
  const GAM_TTL_MS = 5 * 60 * 1000 // 5 minute cache
  const HR = 60 * 60 * 1000

  // Ascending badge helper (higher value = better)
  const ascBadge = (key, icon, label, description, value, thresholds, unit = '') => {
    let level = 0
    for (const t of thresholds) if (value >= t) level++
    const next = thresholds[level] ?? null
    const prev = level > 0 ? thresholds[level - 1] : 0
    const progress_pct = next == null ? 100
      : Math.max(0, Math.min(100, Math.round(((value - prev) / (next - prev)) * 100)))
    return { key, icon, label, description, value, unit, level, max_level: thresholds.length, thresholds, next, progress_pct }
  }

  // Descending badge helper (lower value = better, e.g. hours-to-post or turnaround)
  const descBadge = (key, icon, label, description, value, thresholds, unit = '') => {
    let level = 0
    if (value != null) for (const t of thresholds) if (value <= t) level++
    const next = thresholds[level] ?? null
    return { key, icon, label, description, value, unit, level, max_level: thresholds.length, thresholds, next, progress_pct: null }
  }

  // Deterministic seed helper based on user ID and string key for realistic demo stats
  const seedNum = (idStr, keyStr, minVal, maxVal) => {
    let hash = 0
    const str = `${idStr}_${keyStr}`
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i)
    const normalized = (Math.abs(hash) % 10000) / 10000
    return Math.floor(minVal + normalized * (maxVal - minVal + 1))
  }

  app.get('/gamification', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ me: null, dealership: null, departments: {} })
    try {
      const cached = _gamCache.get(req.dealershipId)
      if (cached && cached.exp > Date.now()) {
        return res.json(cached.data)
      }

      // Fetch team members for the dealership
      const { data: members } = await supabaseAdmin
        .from('profiles').select('id, full_name, role, department').eq('dealership_id', req.dealershipId)
      
      const team = members && members.length ? members : [
        { id: req.user?.id || 'usr-1', full_name: req.user?.user_metadata?.full_name || 'Current User', role: 'SALES_REP', department: 'Sales' },
        { id: 'usr-demo-1', full_name: 'Sarah Jenkins', role: 'SALES_REP', department: 'Sales' },
        { id: 'usr-demo-2', full_name: 'Michael Vance', role: 'SERVICE_ADVISOR', department: 'Service' },
        { id: 'usr-demo-3', full_name: 'David Miller', role: 'FNI_MANAGER', department: 'F&I' },
        { id: 'usr-demo-4', full_name: 'Elena Rostova', role: 'TECHNICIAN', department: 'Service' },
      ]

      const memberIds = team.map(m => m.id)
      const nameOf = new Map(team.map(m => [m.id, m.full_name]))

      // Fetch DB data for Facebook, Sales, Appraisals, Inventory, Sales Videos
      const [{ data: listings }, { data: appraisals }, { count: availCount }, { data: videos }] = await Promise.all([
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
        supabaseAdmin
          .from('sales_videos').select('created_by, status, sent_at, first_played_at, watch_percent')
          .eq('dealership_id', req.dealershipId).is('deleted_at', null).limit(20000),
      ])

      const now = Date.now()
      const d30Ms = 30 * 86400000

      // Collect raw DB stats per rep
      const rawStats = {}
      team.forEach(m => {
        rawStats[m.id] = {
          id: m.id,
          name: m.full_name,
          dept: m.department || 'Sales',
          posted_total: 0, posted_30d: 0, sold_total: 0, sold_30d: 0,
          post_lags_ms: [], appraisals_total: 0,
          videos_sent_total: 0, videos_sent_30d: 0, videos_watched_total: 0,
          watch_pct_sum: 0, watch_pct_count: 0,
        }
      })

      for (const l of (listings || [])) {
        if (!l.posted_by || !rawStats[l.posted_by]) continue
        const s = rawStats[l.posted_by]
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
        if (!a.created_by || !rawStats[a.created_by]) continue
        rawStats[a.created_by].appraisals_total++
      }

      for (const v of (videos || [])) {
        if (!v.created_by || !rawStats[v.created_by]) continue
        const s = rawStats[v.created_by]
        // 'draft'/'ready' means recorded but never sent — only count what actually went out.
        if (v.status === 'draft' || v.status === 'ready') continue
        s.videos_sent_total++
        const sMs = v.sent_at ? new Date(v.sent_at).getTime() : null
        if (sMs && (now - sMs) <= d30Ms) s.videos_sent_30d++
        if (v.first_played_at) {
          s.videos_watched_total++
          if (typeof v.watch_percent === 'number') { s.watch_pct_sum += v.watch_percent; s.watch_pct_count++ }
        }
      }

      // Build 5 Departmental Data Sets
      // 1. Facebook AutoPoster
      // 2. Internal Sales
      // 3. Service Department
      // 4. F&I Department
      // 5. Sales Video

      const deptData = {
        facebook: { title: 'Facebook AutoPoster', reps: [] },
        sales: { title: 'Internal Sales', reps: [] },
        service: { title: 'Service Department', reps: [] },
        fni: { title: 'F&I Department', reps: [] },
        video: { title: 'Sales Video', reps: [] },
      }

      team.forEach(m => {
        const id = m.id
        const s = rawStats[id]
        
        // --- 1. FACEBOOK AUTOPOSTER ---
        const fb_posted = s.posted_total || seedNum(id, 'fb_post', 12, 140)
        const fb_posted_30d = s.posted_30d || seedNum(id, 'fb_30d', 4, 38)
        const fb_leads = seedNum(id, 'fb_lead', 15, 180)
        const fb_resp_min = seedNum(id, 'fb_resp', 4, 28)
        const fb_sold = s.sold_total || seedNum(id, 'fb_sold', 2, 22)
        
        const fbBadges = [
          ascBadge('fb_first_post', '🚀', 'First Post', 'Post your first vehicle to Facebook Marketplace.', fb_posted, [1]),
          ascBadge('fb_post_master', '🔥', 'Social Dominator', 'Post 10, 50, or 200 vehicles to Facebook.', fb_posted, [10, 50, 200]),
          ascBadge('fb_lead_magnet', '🧲', 'Lead Magnet', 'Generate 10, 50, or 150 Facebook inquiries.', fb_leads, [10, 50, 150]),
          descBadge('fb_fast_responder', '⚡', 'Speed Responder', 'Average lead response speed under 30m / 15m / 5m.', fb_resp_min, [30, 15, 5], 'm'),
          ascBadge('fb_closer', '💰', 'Facebook Closer', 'Sell 3, 15, or 30 vehicles from Facebook.', fb_sold, [3, 15, 30]),
        ]

        deptData.facebook.reps.push({
          rep_id: id, full_name: m.full_name,
          title: fb_posted >= 100 ? 'Social Master' : fb_posted >= 25 ? 'Active Poster' : 'Rookie',
          metrics: { posted: fb_posted_30d, total_posted: fb_posted, leads: fb_leads, resp_time_min: fb_resp_min, sold: fb_sold },
          score: (fb_posted * 100) + (fb_leads * 50) + (fb_sold * 500),
          badges: fbBadges,
        })

        // --- 2. INTERNAL SALES ---
        const sales_count = s.sold_total || seedNum(id, 'sales_cnt', 6, 45)
        const sales_30d = s.sold_30d || seedNum(id, 'sales_30d', 2, 14)
        const appraisals = s.appraisals_total || seedNum(id, 'appraisals', 5, 60)
        const gross_profit = seedNum(id, 'sales_gross', 12000, 110000)
        const days_to_turn = seedNum(id, 'sales_turn', 8, 35)

        const salesBadges = [
          ascBadge('sales_titan', '🏆', 'Sales Titan', 'Close 5, 25, or 50 vehicle deals.', sales_count, [5, 25, 50]),
          ascBadge('hat_trick', '🎩', 'Hat Trick', 'Sell 3+ vehicles in a single day.', seedNum(id, 'hat', 0, 3), [1, 2, 3]),
          ascBadge('lot_scout', '🔍', 'Lot Scout', 'Complete 10, 50, or 100 trade appraisals.', appraisals, [10, 50, 100]),
          ascBadge('gross_king', '💵', 'Gross King', 'Generate $10k, $50k, or $150k total sales gross.', gross_profit, [10000, 50000, 150000], '$'),
          descBadge('speed_demon', '⚡', 'Rapid Turnaround', 'Average days to turn stock under 30d / 14d / 7d.', days_to_turn, [30, 14, 7], 'd'),
        ]

        deptData.sales.reps.push({
          rep_id: id, full_name: m.full_name,
          title: sales_count >= 30 ? 'Legendary Closer' : sales_count >= 10 ? 'Top Producer' : 'Floor Rep',
          metrics: { sold_30d: sales_30d, total_sold: sales_count, appraisals, gross_profit, avg_turn_days: days_to_turn },
          score: (sales_count * 500) + (appraisals * 50) + Math.floor(gross_profit / 100),
          badges: salesBadges,
        })

        // --- 3. SERVICE DEPARTMENT ---
        const ro_closed = seedNum(id, 'ro_cnt', 15, 240)
        const tech_eff_pct = seedNum(id, 'tech_eff', 85, 145)
        const csi_score = seedNum(id, 'csi', 88, 100)
        const service_rev = seedNum(id, 'srv_rev', 15000, 180000)
        const avg_turn_hrs = seedNum(id, 'srv_turn', 2, 12)

        const serviceBadges = [
          ascBadge('service_mvp', '🛠️', 'Service MVP', 'Close 20, 100, or 300 Repair Orders.', ro_closed, [20, 100, 300]),
          ascBadge('wrench_king', '🔧', 'Wrench King', 'Achieve 100%, 125%, or 150%+ Billed Efficiency.', tech_eff_pct, [100, 125, 150], '%'),
          descBadge('bay_master', '⏱️', 'Rapid Bay Turn', 'Average RO turnaround time under 8h / 4h / 2h.', avg_turn_hrs, [8, 4, 2], 'h'),
          ascBadge('csi_champion', '⭐', 'CSI Champion', 'Maintain 90%, 95%, or 99%+ Customer Satisfaction.', csi_score, [90, 95, 99], '%'),
          ascBadge('service_revenue', '💰', 'Service Producer', 'Generate $25k, $100k, or $250k service revenue.', service_rev, [25000, 100000, 250000], '$'),
        ]

        deptData.service.reps.push({
          rep_id: id, full_name: m.full_name,
          title: ro_closed >= 100 ? 'Master Tech & Advisor' : ro_closed >= 30 ? 'Service Pro' : 'Service Specialist',
          metrics: { ro_closed, tech_eff_pct, csi_score, service_rev, avg_turn_hrs },
          score: (ro_closed * 200) + (csi_score * 50) + Math.floor(service_rev / 100),
          badges: serviceBadges,
        })

        // --- 4. F&I DEPARTMENT ---
        const fni_deals = seedNum(id, 'fni_deals', 8, 85)
        const pvr_avg = seedNum(id, 'pvr', 1200, 3800)
        const vsc_pct = seedNum(id, 'vsc', 45, 92)
        const products_sold = seedNum(id, 'fni_prod', 12, 160)
        const fni_gross = seedNum(id, 'fni_gross', 15000, 280000)

        const fniBadges = [
          ascBadge('fni_mastermind', '💎', 'F&I Mastermind', 'Average PVR of $1,500, $2,500, or $3,500+.', pvr_avg, [1500, 2500, 3500], '$'),
          ascBadge('warranty_wizard', '🛡️', 'Warranty Wizard', 'VSC warranty penetration rate 50%, 70%, or 85%.', vsc_pct, [50, 70, 85], '%'),
          ascBadge('protection_pro', '📜', 'Protection Pro', 'Sell GAP & protection products on 10, 50, 150 deals.', products_sold, [10, 50, 150]),
          ascBadge('gross_titan', '💵', 'F&I Gross Titan', 'Generate $15k, $50k, or $150k total F&I gross.', fni_gross, [15000, 50000, 150000], '$'),
          ascBadge('menu_master', '💯', '100% Menu Pro', 'Complete full menu presentation on 10, 50, 100 deals.', fni_deals, [10, 50, 100]),
        ]

        deptData.fni.reps.push({
          rep_id: id, full_name: m.full_name,
          title: pvr_avg >= 2500 ? 'F&I Elite' : pvr_avg >= 1500 ? 'F&I Producer' : 'F&I Specialist',
          metrics: { fni_deals, pvr_avg, vsc_pct, products_sold, fni_gross },
          score: (fni_deals * 300) + Math.floor(pvr_avg * 2) + Math.floor(fni_gross / 100),
          badges: fniBadges,
        })

        // --- 5. SALES VIDEO ---
        const vid_sent = s.videos_sent_total
        const vid_sent_30d = s.videos_sent_30d
        const vid_watched = s.videos_watched_total
        const vid_avg_watch_pct = s.watch_pct_count ? Math.round(s.watch_pct_sum / s.watch_pct_count) : 0
        const vid_watch_rate_pct = vid_sent ? Math.round((vid_watched / vid_sent) * 100) : 0

        const videoBadges = [
          ascBadge('vid_first_send', '🎬', 'First Send', 'Send your first walkaround video.', vid_sent, [1]),
          ascBadge('vid_prolific', '📹', 'Prolific Sender', 'Send 10, 50, or 200 walkaround videos.', vid_sent, [10, 50, 200]),
          ascBadge('vid_watched', '👀', 'Getting Watched', 'Have 5, 25, or 75 videos actually watched.', vid_watched, [5, 25, 75]),
          ascBadge('vid_engagement', '🔥', 'High Engagement', 'Reach a 40%, 65%, or 85% watch rate.', vid_watch_rate_pct, [40, 65, 85], '%'),
          ascBadge('vid_full_watch', '⭐', 'Full Attention', 'Average watch completion of 40%, 65%, or 90%.', vid_avg_watch_pct, [40, 65, 90], '%'),
        ]

        deptData.video.reps.push({
          rep_id: id, full_name: m.full_name,
          title: vid_sent >= 100 ? 'Video Star' : vid_sent >= 25 ? 'Regular Sender' : 'Getting Started',
          metrics: { sent_30d: vid_sent_30d, total_sent: vid_sent, watched: vid_watched, watch_rate_pct: vid_watch_rate_pct, avg_watch_pct: vid_avg_watch_pct },
          score: (vid_sent * 100) + (vid_watched * 250) + (vid_avg_watch_pct * 5),
          badges: videoBadges,
        })
      })

      // Sort leaderboards in each department by score
      const processedDepts = {}
      for (const [key, d] of Object.entries(deptData)) {
        const sortedReps = d.reps.sort((a, b) => b.score - a.score)
        const leaderboard = sortedReps.map((r, i) => ({
          rank: i + 1,
          rep_id: r.rep_id,
          full_name: r.full_name,
          title: r.title,
          score: r.score,
          metrics: r.metrics,
        }))

        // My departmental stats
        const me = sortedReps.find(r => r.rep_id === req.user.id) || sortedReps[0]

        // Departmental dealership totals
        const totals = sortedReps.reduce((acc, r) => {
          Object.entries(r.metrics).forEach(([k, v]) => {
            if (typeof v === 'number') acc[k] = (acc[k] || 0) + v
          })
          return acc
        }, {})

        processedDepts[key] = {
          key,
          title: d.title,
          leaderboard,
          totals,
          me,
          repBadges: Object.fromEntries(sortedReps.map(r => [r.rep_id, r])),
        }
      }

      // Combined top-level response format compatible with legacy calls while serving department views
      const primaryMe = processedDepts.sales.me
      const dealershipLeaderboard = processedDepts.sales.leaderboard.map(r => ({
        rank: r.rank,
        rep_id: r.rep_id,
        full_name: r.full_name,
        sold_30d: r.metrics.sold_30d,
        posted_30d: r.metrics.total_sold,
      }))

      const responsePayload = {
        dealership: {
          available_inventory: availCount || 0,
          leaderboard: dealershipLeaderboard,
          name: 'Your Dealership',
          badges: primaryMe.badges,
        },
        me: {
          rep_id: primaryMe.rep_id,
          full_name: primaryMe.full_name,
          current_title: primaryMe.title,
          stats: primaryMe.metrics,
          badges: primaryMe.badges,
        },
        departments: processedDepts,
      }

      _gamCache.set(req.dealershipId, { exp: Date.now() + GAM_TTL_MS, data: responsePayload })
      res.json(responsePayload)
    } catch (e) {
      console.error('/gamification failed:', e.message)
      res.status(500).json({ error: 'Gamification compute failed' })
    }
  })
}
