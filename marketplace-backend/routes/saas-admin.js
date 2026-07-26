/**
 * SaaS Admin / Company Operating Engine — MarketSync's OWN internal OS, built on the
 * same kernel it sells. This is the saas_admin workspace back office. Stage 1 is the
 * revenue-first Command Center overview; Customers/Trials/CRM/Support/Marketing/
 * Employees are subsequent stages that register into the same workspace.
 *
 * Owner-gated (OWNER_EMAIL / MarketSync org). Reads across accounts — no new tables.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { resolveProducts } from './profile.js'

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'massiejay@gmail.com').toLowerCase()
const isOwner = (req) => (req.user?.email || '').toLowerCase() === OWNER_EMAIL || req.profile?.is_marketsync === true

// Monthly price per product (used for MRR estimation from entitlements).
const PRODUCT_MRR = { facebook_solo: 79, facebook_dealer: 499, ai_chatbot: 499, dealer_os: 499 }
const activeStatus = (s) => (s || '').toUpperCase() === 'ACTIVE'
const trialingStatus = (s) => (s || '').toUpperCase() === 'TRIALING'
const dunningStatus = (s) => ['INACTIVE', 'PAST_DUE'].includes((s || '').toUpperCase())

export function registerSaasAdmin(app) {
  const guard = (req, res) => { if (!isOwner(req)) { res.status(403).json({ error: 'Owner access required' }); return false } return true }

  app.get('/saas/overview', requireAuth, async (req, res) => {
    if (!guard(req, res)) return
    const [{ data: dealers }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, is_personal, billing_status, trial_ends_at, plan, products, created_at').order('created_at', { ascending: false }).limit(2000),
      supabaseAdmin.from('profiles').select('id, dealership_id, billing_status, trial_ends_at').limit(8000),
    ])
    // Personal workspaces bill on the profile — index the (single) profile per personal org.
    const profByDealer = {}
    for (const p of profiles || []) { (profByDealer[p.dealership_id] = profByDealer[p.dealership_id] || []).push(p) }

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const soon = Date.now() + 5 * 86400000
    let mrr = 0, active = 0, trials = 0, churnRisk = 0, newThisMonth = 0
    const trialList = [], topAccounts = []

    for (const d of (dealers || [])) {
      // Effective billing: personal → its profile; else the dealership row.
      let status = d.billing_status, trialEnds = d.trial_ends_at
      if (d.is_personal) { const u = (profByDealer[d.id] || [])[0]; if (u) { status = u.billing_status; trialEnds = u.trial_ends_at } }
      const products = resolveProducts(d)
      const accountMrr = Object.keys(PRODUCT_MRR).reduce((s, k) => s + (products[k] ? PRODUCT_MRR[k] : 0), 0)

      if (activeStatus(status)) { active++; mrr += accountMrr; topAccounts.push({ id: d.id, name: d.name, mrr: accountMrr, products }) }
      else if (trialingStatus(status)) {
        const expired = trialEnds && new Date(trialEnds) < new Date()
        if (!expired) {
          trials++
          const days = trialEnds ? Math.max(0, Math.round((new Date(trialEnds) - Date.now()) / 86400000)) : null
          trialList.push({ id: d.id, name: d.name, days_left: days, products })
          if (trialEnds && new Date(trialEnds).getTime() < soon) churnRisk++
        } else { churnRisk++ }   // expired trial = at-risk / recovery
      } else if (dunningStatus(status)) { churnRisk++ }

      if (d.created_at && new Date(d.created_at) >= monthStart) newThisMonth++
    }

    topAccounts.sort((a, b) => b.mrr - a.mrr)
    trialList.sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))
    res.json({
      mrr, arr: mrr * 12, active_customers: active, trial_accounts: trials,
      churn_risk: churnRisk, new_this_month: newThisMonth,
      trials: trialList.slice(0, 12),
      top_accounts: topAccounts.slice(0, 8),
      total_accounts: (dealers || []).length,
    })
  })
}
