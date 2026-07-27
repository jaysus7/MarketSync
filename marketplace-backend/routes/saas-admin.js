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
import { resolveProducts, saasCan, saasRoleOf, SAAS_ROLES, SAAS_PERMISSIONS } from './profile.js'

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'massiejay@gmail.com').toLowerCase()
const isOwner = (req) => (req.user?.email || '').toLowerCase() === OWNER_EMAIL || req.profile?.is_marketsync === true

// Monthly price per product (used for MRR estimation from entitlements).
const PRODUCT_MRR = { facebook_solo: 79, facebook_dealer: 499, ai_chatbot: 499, dealer_os: 499 }
const activeStatus = (s) => (s || '').toUpperCase() === 'ACTIVE'
const trialingStatus = (s) => (s || '').toUpperCase() === 'TRIALING'
const dunningStatus = (s) => ['INACTIVE', 'PAST_DUE'].includes((s || '').toUpperCase())

export function registerSaasAdmin(app) {
  // Permission gate: owner (or staff whose role grants `perm`). Reads use
  // 'view_customers'; staff management requires being the owner.
  const need = (perm) => (req, res) => {
    if (saasCan(req, perm)) return true
    res.status(403).json({ error: 'Insufficient permission' }); return false
  }

  app.get('/saas/overview', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
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

      // Anyone inside a live trial window counts as a trial customer, even if the
      // billing_status hasn't been set to TRIALING yet (fresh sign-ups).
      const futureTrial = trialEnds && new Date(trialEnds) > new Date()
      if (activeStatus(status)) { active++; mrr += accountMrr; topAccounts.push({ id: d.id, name: d.name, mrr: accountMrr, products }) }
      else if (dunningStatus(status)) { churnRisk++ }
      else if (trialingStatus(status) || futureTrial) {
        if (futureTrial) {
          trials++
          const days = Math.max(0, Math.round((new Date(trialEnds) - Date.now()) / 86400000))
          trialList.push({ id: d.id, name: d.name, days_left: days, products })
          if (new Date(trialEnds).getTime() < soon) churnRisk++
        } else { churnRisk++ }   // trialing status but the trial window has lapsed = at-risk / recovery
      }

      if (d.created_at && new Date(d.created_at) >= monthStart) newThisMonth++
    }

    topAccounts.sort((a, b) => b.mrr - a.mrr)
    trialList.sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))
    res.json({
      mrr, arr: mrr * 12, active_customers: active, trial_accounts: trials,
      // "Customers" includes everyone on the books — paying + in-trial.
      customers: active + trials,
      churn_risk: churnRisk, new_this_month: newThisMonth,
      trials: trialList.slice(0, 12),
      top_accounts: topAccounts.slice(0, 8),
      total_accounts: (dealers || []).length,
    })
  })

  // Customer Pipeline — a SaaS sales/retention board. Each account gets a stage,
  // a health score, and a next action, derived from real usage (the event spine)
  // + billing. No CRM tables needed; this reads what accounts actually did.
  app.get('/saas/customers', requireAuth, async (req, res) => {
    if (!need('view_pipeline')(req, res)) return
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [{ data: dealers }, { data: profiles }, { data: events }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, is_personal, billing_status, trial_ends_at, products, created_at').limit(2000),
      supabaseAdmin.from('profiles').select('dealership_id, billing_status, trial_ends_at').limit(8000),
      supabaseAdmin.from('events').select('dealership_id, event_name, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(20000),
    ])
    const profByDealer = {}
    for (const p of profiles || []) { (profByDealer[p.dealership_id] = profByDealer[p.dealership_id] || []).push(p) }
    // Aggregate 30-day engagement per account: activity count, engines touched, last-seen.
    const agg = {}
    for (const e of events || []) {
      const a = agg[e.dealership_id] || (agg[e.dealership_id] = { count: 0, engines: new Set(), lastAt: null })
      a.count++
      const ns = String(e.event_name || '').split('.')[0]
      if (ns) a.engines.add(ns)
      if (!a.lastAt) a.lastAt = e.created_at   // events are desc, first seen = most recent
    }

    const now = Date.now()
    const rows = (dealers || []).map(d => {
      let status = d.billing_status, trialEnds = d.trial_ends_at
      if (d.is_personal) { const u = (profByDealer[d.id] || [])[0]; if (u) { status = u.billing_status; trialEnds = u.trial_ends_at } }
      const S = (status || '').toUpperCase()
      const products = resolveProducts(d)
      const productCount = Object.keys(products).filter(k => products[k]).length
      const a = agg[d.id] || { count: 0, engines: new Set(), lastAt: null }
      const adoption = a.engines.size
      const lastDays = a.lastAt ? Math.floor((now - new Date(a.lastAt)) / 86400000) : null
      // A live trial window makes the account a trial customer even if billing_status
      // isn't TRIALING yet (fresh sign-ups). An expired trial (status TRIALING but
      // the window has passed) is a lapsed trial.
      const futureTrial = trialEnds && new Date(trialEnds) > new Date()
      const onTrial = trialingStatus(status) || futureTrial
      const trialExpired = trialingStatus(status) && !futureTrial && trialEnds && new Date(trialEnds) < new Date()
      const trialDaysLeft = onTrial && trialEnds ? Math.round((new Date(trialEnds) - now) / 86400000) : null

      // Health 0–100: adoption breadth + recency + billing standing.
      let health = 0
      health += Math.min(adoption, 5) / 5 * 45
      health += lastDays == null ? 0 : lastDays <= 3 ? 35 : lastDays <= 7 ? 28 : lastDays <= 14 ? 18 : lastDays <= 30 ? 8 : 0
      health += activeStatus(status) ? 20 : onTrial ? 12 : 0
      health = Math.round(Math.min(100, health))

      // Stage on the SaaS board.
      let stage
      if (S === 'INACTIVE') stage = 'cancelled'
      else if (S === 'PAST_DUE') stage = 'churn_risk'
      else if (activeStatus(status)) {
        if (lastDays == null || lastDays > 30) stage = 'churn_risk'
        else if (productCount >= 2) stage = 'expanded'
        else stage = 'paid'
      } else if (onTrial) {
        if (trialExpired) stage = 'churn_risk'
        else if (adoption >= 2 && a.count >= 3) stage = 'activated'
        else stage = 'trial_started'
      } else stage = 'lead'

      // Next action.
      let next
      if (S === 'PAST_DUE') next = 'Recover payment'
      else if (stage === 'cancelled') next = 'Win-back outreach'
      else if (trialExpired) next = 'Re-engage — trial lapsed'
      else if (onTrial && trialDaysLeft != null && trialDaysLeft <= 5) next = 'Convert — book demo'
      else if (stage === 'trial_started') next = 'Activation outreach'
      else if (stage === 'activated') next = 'Convert to paid'
      else if (stage === 'churn_risk') next = 'Check in — usage dropped'
      else if (stage === 'expanded') next = 'Upsell / advocate'
      else next = 'Upsell / expand'

      return {
        id: d.id, name: d.name, stage, health, status: S || null,
        products, product_count: productCount, engines_used: adoption,
        activity_30d: a.count, last_activity_days: lastDays, trial_days_left: trialDaysLeft,
        next_action: next,
      }
    })

    const STAGES = ['lead', 'trial_started', 'activated', 'paid', 'expanded', 'churn_risk', 'cancelled']
    const byStage = {}; for (const s of STAGES) byStage[s] = []
    for (const r of rows) (byStage[r.stage] = byStage[r.stage] || []).push(r)
    for (const s of STAGES) byStage[s].sort((x, y) => x.health - y.health)   // most at-risk first
    res.json({ stages: STAGES, by_stage: byStage, counts: Object.fromEntries(STAGES.map(s => [s, byStage[s].length])) })
  })

  // ── SaaS Accounting — MarketSync's OWN books (recurring revenue + program cost) ──
  // Recurring revenue is recognised from live product entitlements (the same basis
  // as HQ's MRR); the affiliate program is the recurring cost of goods. This is the
  // company P&L, not a dealership ledger.
  app.get('/saas/accounting', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const [{ data: dealers }, { data: profiles }, { data: comms }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, is_personal, billing_status, trial_ends_at, products, created_at').limit(2000),
      supabaseAdmin.from('profiles').select('dealership_id, billing_status, trial_ends_at').limit(8000),
      supabaseAdmin.from('affiliate_commissions').select('amount, status, created_at').limit(20000),
    ])
    const profByDealer = {}
    for (const p of profiles || []) { (profByDealer[p.dealership_id] = profByDealer[p.dealership_id] || []).push(p) }

    // Recurring revenue by product + counts.
    const byProduct = {}; for (const k of Object.keys(PRODUCT_MRR)) byProduct[k] = { mrr: 0, accounts: 0 }
    let mrr = 0, paying = 0, trials = 0, newMrrThisMonth = 0, churnRisk = 0
    for (const d of (dealers || [])) {
      let status = d.billing_status, trialEnds = d.trial_ends_at
      if (d.is_personal) { const u = (profByDealer[d.id] || [])[0]; if (u) { status = u.billing_status; trialEnds = u.trial_ends_at } }
      const products = resolveProducts(d)
      const acctMrr = Object.keys(PRODUCT_MRR).reduce((s, k) => s + (products[k] ? PRODUCT_MRR[k] : 0), 0)
      const futureTrial = trialEnds && new Date(trialEnds) > new Date()
      if (activeStatus(status)) {
        paying++; mrr += acctMrr
        for (const k of Object.keys(PRODUCT_MRR)) if (products[k]) { byProduct[k].mrr += PRODUCT_MRR[k]; byProduct[k].accounts++ }
        if (d.created_at && new Date(d.created_at) >= monthStart) newMrrThisMonth += acctMrr
      } else if (dunningStatus(status)) { churnRisk++ }
      else if (trialingStatus(status) || futureTrial) { if (futureTrial) trials++; else churnRisk++ }
    }

    // Affiliate program = recurring cost of goods.
    const num = (v) => Number(v) || 0
    let affPending = 0, affPaid = 0, affPaidThisMonth = 0, affAccruedThisMonth = 0
    for (const c of (comms || [])) {
      const amt = num(c.amount), thisMonth = c.created_at && new Date(c.created_at) >= monthStart
      if (c.status === 'paid') { affPaid += amt; if (thisMonth) affPaidThisMonth += amt }
      else { affPending += amt; if (thisMonth) affAccruedThisMonth += amt }   // pending/approved = owed
    }
    // This month's affiliate cost against revenue (paid out + newly accrued).
    const monthlyExpense = Math.round((affPaidThisMonth + affAccruedThisMonth) * 100) / 100
    const netMrr = Math.round((mrr - monthlyExpense) * 100) / 100

    const PRODUCT_LABELS = { facebook_solo: 'Facebook Solo', facebook_dealer: 'Facebook Dealer', ai_chatbot: 'AI Chatbot', dealer_os: 'DealerOS' }
    res.json({
      currency: 'USD',
      mrr, arr: mrr * 12, gross_mrr: mrr,
      revenue_by_product: Object.keys(PRODUCT_MRR).map(k => ({ key: k, label: PRODUCT_LABELS[k] || k, mrr: byProduct[k].mrr, accounts: byProduct[k].accounts })),
      paying, trials, new_mrr_this_month: newMrrThisMonth, churn_risk: churnRisk,
      affiliate: { pending: Math.round(affPending * 100) / 100, paid: Math.round(affPaid * 100) / 100, paid_this_month: Math.round(affPaidThisMonth * 100) / 100, accrued_this_month: Math.round(affAccruedThisMonth * 100) / 100 },
      monthly_expense: monthlyExpense,
      net_mrr: netMrr,
      net_margin: mrr ? Math.round(netMrr / mrr * 100) : 0,
    })
  })

  // ── Employees + permissions (owner-only) ────────────────────────────────────
  const ownerOnly = (req, res) => { if (saasRoleOf(req) === 'owner') return true; res.status(403).json({ error: 'Owner access required' }); return false }

  // List MarketSync staff (anyone with a saas_role) + the role→permission matrix.
  app.get('/saas/employees', requireAuth, async (req, res) => {
    if (!ownerOnly(req, res)) return
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, saas_role').not('saas_role', 'is', null).limit(200)
    const staff = (data || []).map(p => ({ id: p.id, name: p.full_name || '—', saas_role: p.saas_role, permissions: SAAS_PERMISSIONS[p.saas_role] || [] }))
    res.json({ roles: SAAS_ROLES, permissions_matrix: SAAS_PERMISSIONS, staff })
  })

  // Set (or clear) a user's staff role. Assign by user id, or promote by email.
  app.post('/saas/employees/role', requireAuth, async (req, res) => {
    if (!ownerOnly(req, res)) return
    const role = req.body?.saas_role
    if (role != null && role !== '' && !SAAS_ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' })
    // Never let the owner strip their own owner status via this tool.
    let targetId = req.body?.user_id || null
    if (!targetId && req.body?.email) {
      // Resolve a profile by the auth user's email (profiles has no email col; go via auth).
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      const u = (list?.users || []).find(x => (x.email || '').toLowerCase() === String(req.body.email).toLowerCase())
      if (!u) return res.status(404).json({ error: 'no user with that email' })
      targetId = u.id
    }
    if (!targetId) return res.status(400).json({ error: 'user_id or email required' })
    const { error } = await supabaseAdmin.from('profiles').update({ saas_role: role || null }).eq('id', targetId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, user_id: targetId, saas_role: role || null })
  })
}
