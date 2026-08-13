/**
 * Command Center — the DealerOS home screen. One read that composes every engine's
 * "what needs attention right now" into today's operations tiles + the live exception
 * feed (from the exception engine). It owns no tables; it only reads across engines,
 * so it's a pure read API (kernel contract §4).
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

// Head-only count with a builder; never throws (a missing table/column → 0).
async function countOf(table, build) {
  try {
    const { count, error } = await build(supabaseAdmin.from(table).select('id', { count: 'exact', head: true }))
    if (error) return 0
    return count || 0
  } catch { return 0 }
}

export function registerCommandCenter(app) {
  app.get('/command-center', requireAuth, requireMfa, requirePermission('accounting.view'), async (req, res) => {
    const did = req.dealershipId
    if (!did) return res.status(403).json({ error: 'no dealership' })
    const today = startOfToday()
    const [leadsWaiting, dealsInProgress, deliveriesToday, reconDelays, serviceBottlenecks, exRes] = await Promise.all([
      // Leads captured but not yet worked (no response logged).
      countOf('leads', q => q.eq('dealership_id', did).eq('status', 'new').is('responded_at', null)),
      // Deals anywhere in the pipeline that aren't finished or dead.
      countOf('deals', q => q.eq('dealership_id', did).not('deal_status', 'in', '(delivered,dead,lost,canceled)')),
      // Deals delivered today.
      countOf('deals', q => q.eq('dealership_id', did).gte('delivered_at', today)),
      // Recon units sitting past ~5 days in a non-terminal stage.
      countOf('recon', q => q.eq('dealership_id', did).not('stage', 'in', '(done,ready,completed,sold,delivered)').lt('created_at', daysAgo(5))),
      // Repair orders open more than ~2 days (parts waits, stalled jobs).
      countOf('repair_orders', q => q.eq('dealership_id', did).not('status', 'in', '(closed,canceled)').lt('opened_at', daysAgo(2))),
      supabaseAdmin.from('exceptions').select('*').eq('dealership_id', did).neq('status', 'resolved').order('created_at', { ascending: false }).limit(200),
    ])
    const exceptions = exRes.data || []
    const byDept = {}
    for (const x of exceptions) { const d = x.department || 'Other'; byDept[d] = (byDept[d] || 0) + 1 }
    res.json({
      tiles: {
        leads_waiting: leadsWaiting,
        deals_in_progress: dealsInProgress,
        deliveries_today: deliveriesToday,
        recon_delays: reconDelays,
        service_bottlenecks: serviceBottlenecks,
      },
      exceptions,
      exceptions_by_department: byDept,
      exception_count: exceptions.length,
    })
  })
}
