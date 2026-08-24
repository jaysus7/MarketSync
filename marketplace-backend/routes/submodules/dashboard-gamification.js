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

  // Products + their $ for a deal (mirrors routes/fni.js's dealProducts). fni_items
  // is [{name, price}]; addons may carry priced F&I add-ons too. fni_products is a
  // free-text fallback (name only, $0) used only when a deal has no structured items.
  const num = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''))
    return isFinite(n) ? n : 0
  }
  const dealProducts = (d) => {
    const out = []
    const scan = (arr) => {
      for (const it of (Array.isArray(arr) ? arr : [])) {
        if (it == null) continue
        const name = String((typeof it === 'object' ? (it.name ?? it.label ?? it.product ?? it.type) : it) || '').trim()
        if (!name) continue
        const price = typeof it === 'object' ? num(it.price ?? it.amount ?? it.cost ?? it.total) : 0
        out.push({ name, price })
      }
    }
    scan(d.fni_items)
    scan(d.addons)
    if (!out.length && typeof d.fni_products === 'string' && d.fni_products.trim()) {
      for (const nm of d.fni_products.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)) out.push({ name: nm, price: 0 })
    }
    return out
  }
  const isUnit = (d) => d.deal_status === 'sold' || d.deal_status === 'delivered'

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

      // No team on record yet: show the caller alone rather than inventing teammates.
      const team = members && members.length ? members : [
        { id: req.user?.id || 'usr-1', full_name: req.user?.user_metadata?.full_name || 'Current User', role: 'SALES_REP', department: 'Sales' },
      ]

      const memberIds = team.map(m => m.id)
      const nameOf = new Map(team.map(m => [m.id, m.full_name]))

      // Fetch DB data for Facebook, Sales, Appraisals, Inventory, Sales Videos, Service, F&I
      const [{ data: listings }, { data: appraisals }, { count: availCount }, { data: videos }, { data: repairOrders }, { data: deals }] = await Promise.all([
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
        supabaseAdmin
          .from('repair_orders').select('advisor_id, technician_id, status, total, opened_at, closed_at')
          .eq('dealership_id', req.dealershipId).limit(20000),
        supabaseAdmin
          .from('deals').select('created_by, fni_manager_id, selling_price, cost, deal_status, sold_at, inventory_id, fni_items, addons, fni_products, inventory:inventory_id(created_at)')
          .eq('dealership_id', req.dealershipId).limit(20000),
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
          ro_closed: 0, service_rev: 0, service_turn_ms_sum: 0, service_turn_count: 0,
          deal_gross: 0, deal_turn_days_sum: 0, deal_turn_days_count: 0, deal_day_counts: new Map(),
          fni_deal_count: 0, fni_units: 0, fni_gross: 0, fni_products_count: 0, fni_deals_with_product: 0, fni_vsc_count: 0,
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

      // Repair orders: attribute a closed RO to whichever rep(s) are its advisor
      // and/or technician. Only 'closed' ROs count toward revenue/turnaround —
      // open work isn't a finished result yet.
      for (const ro of (repairOrders || [])) {
        if (ro.status !== 'closed') continue
        const repIds = [...new Set([ro.advisor_id, ro.technician_id].filter(Boolean))]
        for (const id of repIds) {
          const s = rawStats[id]
          if (!s) continue
          s.ro_closed++
          s.service_rev += num(ro.total)
          if (ro.opened_at && ro.closed_at) {
            const ms = new Date(ro.closed_at).getTime() - new Date(ro.opened_at).getTime()
            if (ms >= 0) { s.service_turn_ms_sum += ms; s.service_turn_count++ }
          }
        }
      }

      // Deals: gross (selling_price - cost) and turn time attribute to the
      // salesperson (created_by); F&I product mix attributes to the F&I manager
      // on the deal (fni_manager_id — a profile id; the sibling `fni_manager`
      // text field is a free-typed name and not reliable for attribution).
      for (const d of (deals || [])) {
        if (d.created_by && rawStats[d.created_by] && isUnit(d)) {
          const s = rawStats[d.created_by]
          s.deal_gross += num(d.selling_price) - num(d.cost)
          const invCreated = d.inventory?.created_at
          if (invCreated && d.sold_at) {
            const days = (new Date(d.sold_at).getTime() - new Date(invCreated).getTime()) / 86400000
            if (days >= 0 && days < 365) { s.deal_turn_days_sum += days; s.deal_turn_days_count++ }
          }
          if (d.sold_at) {
            const day = new Date(d.sold_at).toISOString().slice(0, 10)
            s.deal_day_counts.set(day, (s.deal_day_counts.get(day) || 0) + 1)
          }
        }
        if (d.fni_manager_id && rawStats[d.fni_manager_id]) {
          const s = rawStats[d.fni_manager_id]
          const products = dealProducts(d)
          s.fni_deal_count++
          if (isUnit(d)) s.fni_units++
          if (products.length) {
            s.fni_deals_with_product++
            s.fni_products_count += products.length
            s.fni_gross += products.reduce((a, p) => a + p.price, 0)
            if (products.some(p => /\b(vsc|service contract|extended warranty)\b/i.test(p.name))) s.fni_vsc_count++
          }
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
        // Lead volume and response time aren't tracked anywhere in this codebase
        // yet (no inbound-lead table keyed to a Facebook post and a rep); report
        // 0/not-available instead of inventing plausible numbers.
        const fb_posted = s.posted_total
        const fb_posted_30d = s.posted_30d
        const fb_leads = 0
        const fb_resp_min = null
        const fb_sold = s.sold_total

        const fbBadges = [
          ascBadge('fb_first_post', '🚀', 'First Post', 'Post your first vehicle to Facebook Marketplace.', fb_posted, [1]),
          ascBadge('fb_post_master', '🔥', 'Social Dominator', 'Post 10, 50, or 200 vehicles to Facebook.', fb_posted, [10, 50, 200]),
          ascBadge('fb_closer', '💰', 'Facebook Closer', 'Sell 3, 15, or 30 vehicles from Facebook.', fb_sold, [3, 15, 30]),
        ]

        deptData.facebook.reps.push({
          rep_id: id, full_name: m.full_name,
          title: fb_posted >= 100 ? 'Social Master' : fb_posted >= 25 ? 'Active Poster' : 'Rookie',
          metrics: { posted: fb_posted_30d, total_posted: fb_posted, leads: fb_leads, resp_time_min: fb_resp_min, sold: fb_sold },
          score: (fb_posted * 100) + (fb_sold * 500),
          badges: fbBadges,
        })

        // --- 2. INTERNAL SALES ---
        const sales_count = s.sold_total
        const sales_30d = s.sold_30d
        const appraisals = s.appraisals_total
        const gross_profit = Math.round(s.deal_gross)
        const days_to_turn = s.deal_turn_days_count ? Math.round((s.deal_turn_days_sum / s.deal_turn_days_count) * 10) / 10 : null
        const hat_trick_best = s.deal_day_counts.size ? Math.max(...s.deal_day_counts.values()) : 0

        const salesBadges = [
          ascBadge('sales_titan', '🏆', 'Sales Titan', 'Close 5, 25, or 50 vehicle deals.', sales_count, [5, 25, 50]),
          ascBadge('hat_trick', '🎩', 'Hat Trick', 'Sell 3+ vehicles in a single day.', hat_trick_best, [1, 2, 3]),
          ascBadge('lot_scout', '🔍', 'Lot Scout', 'Complete 10, 50, or 100 trade appraisals.', appraisals, [10, 50, 100]),
          ascBadge('gross_king', '💵', 'Gross King', 'Generate $10k, $50k, or $150k total sales gross.', gross_profit, [10000, 50000, 150000], '$'),
          descBadge('speed_demon', '⚡', 'Rapid Turnaround', 'Average days to turn stock under 30d / 14d / 7d.', days_to_turn, [30, 14, 7], 'd'),
        ]

        deptData.sales.reps.push({
          rep_id: id, full_name: m.full_name,
          title: sales_count >= 30 ? 'Legendary Closer' : sales_count >= 10 ? 'Top Producer' : 'Floor Rep',
          metrics: { sold_30d: sales_30d, total_sold: sales_count, appraisals, gross_profit, avg_turn_days: days_to_turn },
          score: (sales_count * 500) + (appraisals * 50) + Math.floor(Math.max(0, gross_profit) / 100),
          badges: salesBadges,
        })

        // --- 3. SERVICE DEPARTMENT ---
        // Billed efficiency and CSI need clocked-hours and survey data this
        // codebase doesn't collect yet — reported as not-available rather than
        // guessed at.
        const ro_closed = s.ro_closed
        const tech_eff_pct = null
        const csi_score = null
        const service_rev = Math.round(s.service_rev)
        const avg_turn_hrs = s.service_turn_count ? Math.round((s.service_turn_ms_sum / s.service_turn_count / HR) * 10) / 10 : null

        const serviceBadges = [
          ascBadge('service_mvp', '🛠️', 'Service MVP', 'Close 20, 100, or 300 Repair Orders.', ro_closed, [20, 100, 300]),
          descBadge('bay_master', '⏱️', 'Rapid Bay Turn', 'Average RO turnaround time under 8h / 4h / 2h.', avg_turn_hrs, [8, 4, 2], 'h'),
          ascBadge('service_revenue', '💰', 'Service Producer', 'Generate $25k, $100k, or $250k service revenue.', service_rev, [25000, 100000, 250000], '$'),
        ]

        deptData.service.reps.push({
          rep_id: id, full_name: m.full_name,
          title: ro_closed >= 100 ? 'Master Tech & Advisor' : ro_closed >= 30 ? 'Service Pro' : 'Service Specialist',
          metrics: { ro_closed, tech_eff_pct, csi_score, service_rev, avg_turn_hrs },
          score: (ro_closed * 200) + Math.floor(service_rev / 100),
          badges: serviceBadges,
        })

        // --- 4. F&I DEPARTMENT ---
        const fni_deals = s.fni_deal_count
        const pvr_avg = s.fni_units ? Math.round(s.fni_gross / s.fni_units) : 0
        const vsc_pct = s.fni_deal_count ? Math.round((s.fni_vsc_count / s.fni_deal_count) * 100) : 0
        const products_sold = s.fni_products_count
        const fni_gross = Math.round(s.fni_gross)

        const fniBadges = [
          ascBadge('fni_mastermind', '💎', 'F&I Mastermind', 'Average PVR of $1,500, $2,500, or $3,500+.', pvr_avg, [1500, 2500, 3500], '$'),
          ascBadge('warranty_wizard', '🛡️', 'Warranty Wizard', 'VSC/warranty product attach rate 50%, 70%, or 85%.', vsc_pct, [50, 70, 85], '%'),
          ascBadge('protection_pro', '📜', 'Protection Pro', 'Sell F&I products on 10, 50, 150 deals.', products_sold, [10, 50, 150]),
          ascBadge('gross_titan', '💵', 'F&I Gross Titan', 'Generate $15k, $50k, or $150k total F&I gross.', fni_gross, [15000, 50000, 150000], '$'),
          ascBadge('menu_master', '💯', 'F&I Producer', 'Work 10, 50, or 100 F&I deals.', fni_deals, [10, 50, 100]),
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
