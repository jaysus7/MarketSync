/**
 * Marketing ROI attribution — "which campaign made money?"
 *
 * Dealers key in their monthly ad spend per channel (marketing_spend table); this
 * route joins that spend against data MarketSync already captures — leads by source
 * and attributed sales (contacts.sold_source) with real deal revenue — to compute,
 * per channel: leads, sales, cost-per-lead, cost-per-sale, revenue, estimated gross
 * and ROI. Manager-gated (it exposes financials). Also feeds the AI brain's
 * `marketing_roi` topic so "which campaign paid off" is answerable in chat.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'

const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)
const WON = ['sold', 'fni', 'delivered']
const DEFAULT_AVG_GROSS = 3500   // front + F&I gross per unit, dealer-editable assumption

// Fold the many raw source strings a lead can carry into one canonical marketing
// channel, so spend keyed against "Facebook" lines up with leads tagged
// "Facebook Marketplace", "FB", etc. Unknown sources pass through cleaned up.
export function channelOf(src) {
  const s = String(src || '').trim().toLowerCase()
  if (!s) return 'Unattributed'
  if (/(facebook|fb\b|marketplace|meta)/.test(s)) return 'Facebook Marketplace'
  if (/(autotrader|trader\.ca|trader)/.test(s)) return 'AutoTrader'
  if (/(cargurus|gurus)/.test(s)) return 'CarGurus'
  if (/kijiji/.test(s)) return 'Kijiji'
  if (/(google|gmb|business profile|adwords|ppc|sem)/.test(s)) return 'Google'
  if (/(instagram|\big\b|tiktok|youtube|social)/.test(s)) return 'Social'
  if (/(website|web|site|marketsync|chatbot|chat|form|vdp|reserve|build|trade-?in|credit|payment quote)/.test(s)) return 'Website'
  if (/referr/.test(s)) return 'Referral'
  if (/(walk.?in|showroom|drive.?by)/.test(s)) return 'Walk-in'
  if (/(repeat|previous|existing|owner)/.test(s)) return 'Repeat customer'
  if (/(phone|call|inbound)/.test(s)) return 'Phone'
  // Otherwise title-case the raw source so it still shows as its own line.
  return s.replace(/\b\w/g, c => c.toUpperCase()).slice(0, 40)
}

// Months (YYYY-MM) spanned by a lookback window, so spend rows in that window sum up.
function monthsInRange(days) {
  const out = new Set()
  const now = new Date()
  for (let d = 0; d <= days; d += 1) {
    const t = new Date(now.getTime() - d * 86400000)
    out.add(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function registerMarketing(app) {
  // List the store's spend rows (optionally for one period). Managers only.
  app.get('/marketing/spend', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    let q = supabaseAdmin.from('marketing_spend').select('id, channel, period, amount, notes, updated_at')
      .eq('dealership_id', req.dealershipId)
    if (req.query.period) q = q.eq('period', String(req.query.period).slice(0, 7))
    const { data, error } = await q.order('period', { ascending: false }).order('channel')
    if (error) return res.status(500).json({ error: 'Could not load spend' })
    res.json({ spend: data || [] })
  })

  // Upsert one channel/period spend amount. Managers only.
  app.put('/marketing/spend', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const channel = String(req.body?.channel || '').trim().slice(0, 60)
    const period = String(req.body?.period || '').trim().slice(0, 7)
    const amount = Number(req.body?.amount)
    if (!channel) return res.status(400).json({ error: 'Pick a channel.' })
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'Period must be YYYY-MM.' })
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Enter a valid amount.' })
    const { error } = await supabaseAdmin.from('marketing_spend').upsert({
      dealership_id: req.dealershipId, channel, period, amount,
      notes: (req.body?.notes || '').toString().slice(0, 300) || null,
      created_by: req.user?.id || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'dealership_id,channel,period' })
    if (error) { console.error('[marketing] spend save failed:', error.message); return res.status(500).json({ error: 'Save failed' }) }
    res.json({ ok: true })
  })

  app.delete('/marketing/spend/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    await supabaseAdmin.from('marketing_spend').delete()
      .eq('dealership_id', req.dealershipId).eq('id', req.params.id)
    res.json({ ok: true })
  })

  // The ROI report: per-channel leads / sales / spend / cost-per / revenue / est
  // gross / ROI over the window. Managers only.
  app.get('/marketing/roi', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const did = req.dealershipId
    const days = ({ '30': 30, '90': 90, '180': 180, '365': 365 }[String(req.query.range || '90')]) || 90
    const avgGross = Number(req.query.avg_gross) > 0 ? Number(req.query.avg_gross) : DEFAULT_AVG_GROSS
    try {
      const data = await buildMarketingRoi(did, { days, avgGross })
      res.json({ ok: true, ...data })
    } catch (e) {
      console.error('[marketing] roi failed:', e.message)
      res.status(500).json({ error: 'Could not build the marketing report.' })
    }
  })
}

// Shared builder so both the route and the AI brain can call it.
export async function buildMarketingRoi(did, { days = 90, avgGross = DEFAULT_AVG_GROSS } = {}) {
  const startIso = new Date(Date.now() - days * 86400000).toISOString()
  const months = monthsInRange(days)

  const [{ data: leadRows }, { data: contactRows }, { data: spendRows }] = await Promise.all([
    supabaseAdmin.from('leads').select('source, created_at, contact_id').eq('dealership_id', did).gte('created_at', startIso).limit(50000),
    supabaseAdmin.from('contacts').select('id, status, source, sold_source, sold_at').eq('dealership_id', did).limit(50000),
    supabaseAdmin.from('marketing_spend').select('channel, period, amount').eq('dealership_id', did),
  ])

  // Revenue: sold/delivered deals inside the window, mapped to the contact's source.
  const { data: dealRows } = await supabaseAdmin.from('deals')
    .select('selling_price, contact_id, sold_at, created_at, deal_status')
    .eq('dealership_id', did).in('deal_status', WON).limit(20000)
  const contactById = {}
  for (const c of (contactRows || [])) contactById[c.id] = c

  const ch = {}   // channel → aggregates
  const bump = (name) => (ch[name] = ch[name] || { channel: name, leads: 0, sales: 0, revenue: 0, spend: 0 })

  for (const l of (leadRows || [])) bump(channelOf(l.source)).leads++

  // Sales attributed to the source that won them (sold_source), sold inside window.
  for (const c of (contactRows || [])) {
    if (!WON.includes(c.status)) continue
    if (!c.sold_at || c.sold_at < startIso) continue
    bump(channelOf(c.sold_source || c.source)).sales++
  }
  // Revenue from the deals themselves (more accurate than a flat assumption).
  for (const d of (dealRows || [])) {
    const when = d.sold_at || d.created_at
    if (!when || when < startIso) continue
    const c = contactById[d.contact_id]
    const name = channelOf(c?.sold_source || c?.source)
    bump(name).revenue += Number(d.selling_price) || 0
  }
  // Spend for periods inside the window.
  let totalSpend = 0
  for (const s of (spendRows || [])) {
    if (!months.has(s.period)) continue
    bump(s.channel).spend += Number(s.amount) || 0
    totalSpend += Number(s.amount) || 0
  }

  const rows = Object.values(ch).map(r => {
    const estGross = r.sales * avgGross
    return {
      ...r,
      revenue: Math.round(r.revenue),
      cost_per_lead: r.leads && r.spend ? Math.round((r.spend / r.leads) * 100) / 100 : null,
      cost_per_sale: r.sales && r.spend ? Math.round((r.spend / r.sales) * 100) / 100 : null,
      est_gross: estGross,
      roi_pct: r.spend > 0 ? Math.round(((estGross - r.spend) / r.spend) * 100) : null,
    }
  }).sort((a, b) => (b.sales - a.sales) || (b.leads - a.leads))

  const totals = rows.reduce((t, r) => {
    t.leads += r.leads; t.sales += r.sales; t.revenue += r.revenue; t.spend += r.spend; t.est_gross += r.est_gross
    return t
  }, { leads: 0, sales: 0, revenue: 0, spend: 0, est_gross: 0 })
  totals.roi_pct = totals.spend > 0 ? Math.round(((totals.est_gross - totals.spend) / totals.spend) * 100) : null
  totals.cost_per_lead = totals.leads && totals.spend ? Math.round((totals.spend / totals.leads) * 100) / 100 : null
  totals.cost_per_sale = totals.sales && totals.spend ? Math.round((totals.spend / totals.sales) * 100) / 100 : null

  return { range_days: days, avg_gross: avgGross, has_spend: totalSpend > 0, rows, totals }
}
