/**
 * Marketplace home summary — powers the Facebook Solo / Dealer product workspaces'
 * home screen. Composes real numbers we actually track (active listings, leads, sold,
 * response time) from the Inventory + Leads engines. Views/messages come from Facebook
 * itself, which we don't ingest yet, so they're returned null (the UI shows "—" rather
 * than a fabricated number) until an FB insights sync is wired.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
async function countOf(table, build) {
  try { const { count, error } = await build(supabaseAdmin.from(table).select('id', { count: 'exact', head: true })); return error ? 0 : (count || 0) }
  catch { return 0 }
}

export function registerMarketplaceHome(app) {
  app.get('/marketplace/summary', requireAuth, async (req, res) => {
    const did = req.dealershipId
    if (!did) return res.status(403).json({ error: 'no dealership' })
    const since = daysAgo(30)
    const [active, leads30, sold30, respRows] = await Promise.all([
      countOf('inventory', q => q.eq('dealership_id', did).is('archived_at', null).neq('status', 'sold')),
      countOf('leads', q => q.eq('dealership_id', did).gte('created_at', since)),
      countOf('inventory', q => q.eq('dealership_id', did).eq('status', 'sold').gte('sold_at', since)),
      supabaseAdmin.from('leads').select('created_at, responded_at').eq('dealership_id', did).gte('created_at', since).not('responded_at', 'is', null).limit(500),
    ])
    // Average first-response time, in minutes, over leads that got a reply.
    let avgResponseMin = null
    const rows = respRows.data || []
    if (rows.length) {
      const mins = rows.map(r => (new Date(r.responded_at) - new Date(r.created_at)) / 60000).filter(m => m >= 0)
      if (mins.length) avgResponseMin = Math.round(mins.reduce((s, m) => s + m, 0) / mins.length)
    }
    res.json({
      window_days: 30,
      posted: active,          // vehicles live (proxy for "posted" until FB sync lands)
      views: null,             // from Facebook — not ingested yet
      messages: null,          // from Facebook — not ingested yet
      leads: leads30,
      sold: sold30,
      avg_response_min: avgResponseMin,
    })
  })
}
