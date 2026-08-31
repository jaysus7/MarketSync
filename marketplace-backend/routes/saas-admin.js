/**
 * SaaS Admin / Company Operating Engine — MarketSync's OWN internal OS, built on the
 * same kernel it sells. This is the saas_admin workspace back office. Stage 1 is the
 * revenue-first Command Center overview; Customers/Trials/CRM/Support/Marketing/
 * Employees are subsequent stages that register into the same workspace.
 *
 * Access is derived from server-managed MarketSync staff roles. Reads across
 * accounts — no new tables.
 */
import { supabaseAdmin, stripe } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requestHasCronSecret } from '../cron-auth.js'
import { resolveProducts, saasCan, saasRoleOf, SAAS_ROLES, SAAS_PERMISSIONS } from './profile.js'
import Anthropic from '@anthropic-ai/sdk'
import { SMART_MODEL } from '../aiModels.js'

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
    // Affiliate commissions is optional — the table may not be present in every
    // environment. Any failure resolves to null so the overview stays honest
    // (rendered as "Not connected") rather than fabricating a zero.
    const affiliatePromise = supabaseAdmin.from('affiliate_commissions')
      .select('amount, status, created_at').limit(20000)
      .then(r => r, () => ({ data: null, error: true }))
    const [{ data: dealers }, { data: profiles }, affRes] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, is_personal, billing_status, trial_ends_at, plan, products, created_at').order('created_at', { ascending: false }).limit(2000),
      supabaseAdmin.from('profiles').select('id, dealership_id, billing_status, trial_ends_at').limit(8000),
      affiliatePromise,
    ])
    // Personal workspaces bill on the profile — index the (single) profile per personal org.
    const profByDealer = {}
    for (const p of profiles || []) { (profByDealer[p.dealership_id] = profByDealer[p.dealership_id] || []).push(p) }

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const soon = Date.now() + 5 * 86400000
    let mrr = 0, active = 0, trials = 0, churnRisk = 0, newThisMonth = 0
    let pastDue = 0, newMrrThisMonth = 0, trialsExpiring = 0
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
      if (activeStatus(status)) {
        active++; mrr += accountMrr
        topAccounts.push({ id: d.id, name: d.name, mrr: accountMrr, products })
        if (d.created_at && new Date(d.created_at) >= monthStart) newMrrThisMonth += accountMrr
      }
      else if (dunningStatus(status)) { churnRisk++; pastDue++ }
      else if (trialingStatus(status) || futureTrial) {
        if (futureTrial) {
          trials++
          const days = Math.max(0, Math.round((new Date(trialEnds) - Date.now()) / 86400000))
          trialList.push({ id: d.id, name: d.name, days_left: days, products })
          if (new Date(trialEnds).getTime() < soon) { churnRisk++; trialsExpiring++ }
        } else { churnRisk++ }   // trialing status but the trial window has lapsed = at-risk / recovery
      }

      if (d.created_at && new Date(d.created_at) >= monthStart) newThisMonth++
    }

    // Affiliate program is the recurring cost-of-goods. `pending` = owed but not yet
    // paid. If the table is absent (or unreadable), affiliate stays null so the UI
    // renders "Not connected" instead of a fake $0.
    let affiliate = null
    if (affRes && affRes.data && !affRes.error) {
      const num = (v) => Number(v) || 0
      let affPending = 0, affPaidThisMonth = 0
      for (const c of affRes.data) {
        const amt = num(c.amount)
        if (c.status === 'paid') { if (c.created_at && new Date(c.created_at) >= monthStart) affPaidThisMonth += amt }
        else { affPending += amt }
      }
      affiliate = {
        payouts_due: Math.round(affPending * 100) / 100,
        paid_this_month: Math.round(affPaidThisMonth * 100) / 100,
      }
    }

    // Platform health: derived here from what we can actually observe from HQ.
    // `ok` = nothing dunning + no expired trials in the churn bucket. Anything
    // richer (queue depth, integration failures) comes from /owner/health.
    const health = { status: pastDue > 0 ? 'degraded' : 'ok', past_due: pastDue }

    topAccounts.sort((a, b) => b.mrr - a.mrr)
    trialList.sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))
    res.json({
      mrr, arr: mrr * 12, active_customers: active, trial_accounts: trials,
      // "Customers" includes everyone on the books — paying + in-trial.
      customers: active + trials,
      churn_risk: churnRisk, new_this_month: newThisMonth,
      past_due: pastDue,
      revenue_this_month: newMrrThisMonth,   // new MRR added in the current month
      trials_expiring_5d: trialsExpiring,
      affiliate,                              // null → "Not connected"
      health,
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

  // ── Account follow-ups — internal customer-success / sales work queue ───────
  // Kept separate from crm_tasks because MarketSync staff work accounts, not a
  // dealer's individual shoppers. Every mutation is permission-gated and uses the
  // service role only after that gate.
  app.get('/saas/followups', requireAuth, async (req, res) => {
    if (!need('view_pipeline')(req, res)) return
    const includeCompleted = String(req.query?.completed || '') === 'true'
    let query = supabaseAdmin.from('saas_account_followups').select('*').order('due_at', { ascending: true, nullsFirst: false }).limit(1000)
    query = includeCompleted ? query.not('completed_at', 'is', null) : query.is('completed_at', null)
    const { data: tasks, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    const dealerIds = [...new Set((tasks || []).map(t => t.dealership_id).filter(Boolean))]
    const userIds = [...new Set((tasks || []).flatMap(t => [t.assigned_to, t.created_by, t.completed_by]).filter(Boolean))]
    const [{ data: dealers }, { data: people }] = await Promise.all([
      dealerIds.length ? supabaseAdmin.from('dealerships').select('id, name').in('id', dealerIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabaseAdmin.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
    ])
    const dealerById = Object.fromEntries((dealers || []).map(d => [d.id, d.name]))
    const personById = Object.fromEntries((people || []).map(p => [p.id, p.full_name || '—']))
    res.json({ followups: (tasks || []).map(t => ({ ...t, account_name: dealerById[t.dealership_id] || 'Unknown account', assigned_name: personById[t.assigned_to] || null })) })
  })

  app.post('/saas/followups', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const body = req.body || {}
    const title = String(body.title || '').trim().slice(0, 240)
    const dealershipId = String(body.dealership_id || '').trim()
    if (!title || !dealershipId) return res.status(400).json({ error: 'Account and follow-up title are required' })
    const priority = ['low', 'normal', 'high'].includes(body.priority) ? body.priority : 'normal'
    const dueAt = body.due_at ? new Date(body.due_at) : null
    if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Invalid due date' })
    const { data: account } = await supabaseAdmin.from('dealerships').select('id').eq('id', dealershipId).maybeSingle()
    if (!account) return res.status(404).json({ error: 'Account not found' })
    const { data, error } = await supabaseAdmin.from('saas_account_followups').insert({
      dealership_id: dealershipId, title, priority,
      note: String(body.note || '').trim().slice(0, 4000) || null,
      due_at: dueAt ? dueAt.toISOString() : null,
      assigned_to: body.assigned_to || req.user.id,
      created_by: req.user.id,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json({ followup: data })
  })

  app.patch('/saas/followups/:id', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const body = req.body || {}, patch = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) { const title = String(body.title || '').trim().slice(0, 240); if (!title) return res.status(400).json({ error: 'Title cannot be empty' }); patch.title = title }
    if (body.note !== undefined) patch.note = String(body.note || '').trim().slice(0, 4000) || null
    if (body.priority !== undefined) { if (!['low', 'normal', 'high'].includes(body.priority)) return res.status(400).json({ error: 'Invalid priority' }); patch.priority = body.priority }
    if (body.due_at !== undefined) { const dueAt = body.due_at ? new Date(body.due_at) : null; if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Invalid due date' }); patch.due_at = dueAt ? dueAt.toISOString() : null }
    if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to || null
    if (body.done !== undefined) { patch.completed_at = body.done ? new Date().toISOString() : null; patch.completed_by = body.done ? req.user.id : null }
    const { data, error } = await supabaseAdmin.from('saas_account_followups').update(patch).eq('id', req.params.id).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Follow-up not found' })
    res.json({ followup: data })
  })

  // ── Customer 360 — one account: products, MRR/ARR, LTV, tenure, usage timeline,
  // team, billing history, and follow-ups. LTV is real (paid Stripe invoices) when we
  // have a Stripe customer, otherwise an MRR×tenure estimate (flagged as such). ──
  app.get('/saas/customers/:id', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const id = req.params.id
    const since = new Date(Date.now() - 90 * 86400000).toISOString()
    const [{ data: dealer }, { data: team }, { data: events }, { data: subs }, { data: followups }, { data: enrollments }, { data: seqDefs }, { data: seqSteps }, { data: allProfiles }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name, role, saas_role, billing_status, trial_ends_at, phone, created_at').eq('dealership_id', id).limit(100),
      supabaseAdmin.from('events').select('event_name, created_at').eq('dealership_id', id).order('created_at', { ascending: false }).limit(60),
      supabaseAdmin.from('subscriptions').select('*').eq('dealership_id', id),
      supabaseAdmin.from('saas_account_followups').select('*').eq('dealership_id', id).order('due_at', { ascending: true }).limit(100),
      supabaseAdmin.from('saas_sequence_enrollments').select('*').eq('dealership_id', id).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('saas_sequences').select('id, key, name, trigger, enabled'),
      supabaseAdmin.from('saas_sequence_steps').select('sequence_id'),
      supabaseAdmin.from('profiles').select('id, full_name, saas_role, system_role'),
    ])
    const seqByKey = Object.fromEntries((seqDefs || []).map(s => [s.key, s]))
    const stepCount = {}
    for (const st of seqSteps || []) stepCount[st.sequence_id] = (stepCount[st.sequence_id] || 0) + 1
    // HQ staff = anyone with a saas_role or a platform system_role — the reassignable owners.
    const hqStaff = (allProfiles || []).filter(p => p.saas_role || ['platform_owner', 'platform_admin'].includes(p.system_role))
    const ownerName = dealer.hq_owner_id ? (hqStaff.find(p => p.id === dealer.hq_owner_id)?.full_name || null) : null
    if (!dealer) return res.status(404).json({ error: 'Customer not found' })

    // Effective billing (personal orgs bill on the single profile).
    let status = dealer.billing_status, trialEnds = dealer.trial_ends_at
    if (dealer.is_personal) { const u = (team || [])[0]; if (u) { status = u.billing_status; trialEnds = u.trial_ends_at } }

    const products = resolveProducts(dealer)
    const productKeys = Object.keys(products).filter(k => products[k])
    const mrr = productKeys.reduce((s, k) => s + (PRODUCT_MRR[k] || 0), 0)
    const createdAt = dealer.created_at ? new Date(dealer.created_at) : null
    const tenureMonths = createdAt ? Math.max(1, Math.round((Date.now() - createdAt) / (30 * 86400000))) : null

    // Usage: 90-day timeline + engines touched + last-seen.
    const now = Date.now()
    const engines = new Set()
    for (const e of events || []) { const ns = String(e.event_name || '').split('.')[0]; if (ns) engines.add(ns) }
    const recent = (events || []).filter(e => e.created_at >= since)
    const lastAt = (events || [])[0]?.created_at || null
    const lastDays = lastAt ? Math.floor((now - new Date(lastAt)) / 86400000) : null

    // LTV — real paid invoices from Stripe when we can, else MRR×tenure estimate.
    let ltv = null, ltvSource = 'estimate', billingHistory = []
    const custId = dealer.stripe_customer_id || (subs || []).map(s => s.stripe_customer_id).find(Boolean)
    if (custId && stripe) {
      try {
        const inv = await stripe.invoices.list({ customer: custId, limit: 100 })
        const paid = (inv.data || []).filter(i => i.status === 'paid')
        ltv = paid.reduce((s, i) => s + (i.amount_paid || 0), 0) / 100
        ltvSource = 'stripe'
        billingHistory = (inv.data || []).slice(0, 12).map(i => ({
          date: new Date(i.created * 1000).toISOString(), amount: (i.amount_paid || i.amount_due || 0) / 100,
          currency: (i.currency || 'usd').toUpperCase(), number: i.number, status: i.status, url: i.hosted_invoice_url,
        }))
      } catch (e) { /* keep estimate */ }
    }
    if (ltv == null) ltv = tenureMonths != null ? mrr * tenureMonths : mrr

    // Customer health — same formula the pipeline endpoint uses so the score
    // matches everywhere. `factors` explains the score so an HQ user can act
    // on it instead of trusting a number they can't reason about.
    const adoptionPoints = Math.round(Math.min(engines.size, 5) / 5 * 45)
    const recencyPoints = lastDays == null ? 0 : lastDays <= 3 ? 35 : lastDays <= 7 ? 28 : lastDays <= 14 ? 18 : lastDays <= 30 ? 8 : 0
    const billingPoints = activeStatus(status) ? 20 : (trialingStatus(status) || (trialEnds && new Date(trialEnds) > new Date())) ? 12 : 0
    const healthScore = Math.min(100, adoptionPoints + recencyPoints + billingPoints)
    const health = {
      score: healthScore,
      band: healthScore >= 70 ? 'good' : healthScore >= 40 ? 'watch' : 'at_risk',
      factors: [
        { key: 'adoption', label: 'Product adoption', points: adoptionPoints, max: 45,
          detail: `${engines.size} engine${engines.size === 1 ? '' : 's'} touched in 90d` },
        { key: 'recency', label: 'Recent activity', points: recencyPoints, max: 35,
          detail: lastDays == null ? 'No activity captured yet' : lastDays === 0 ? 'Active today' : `Last active ${lastDays}d ago` },
        { key: 'billing', label: 'Billing standing', points: billingPoints, max: 20,
          detail: activeStatus(status) ? 'Paying, in good standing'
            : dunningStatus(status) ? 'Past due — recover payment'
            : (trialingStatus(status) || (trialEnds && new Date(trialEnds) > new Date())) ? 'On trial' : 'Not billing' },
      ],
    }

    res.json({
      id: dealer.id, name: dealer.name, website_url: dealer.website_url || null,
      is_personal: !!dealer.is_personal, status: (status || '').toUpperCase() || null,
      created_at: dealer.created_at, trial_ends_at: trialEnds,
      products, product_keys: productKeys, plan: dealer.plan || null,
      mrr, arr: mrr * 12, ltv, ltv_source: ltvSource, tenure_months: tenureMonths,
      health,
      engines_used: [...engines], activity_90d: recent.length, last_activity_days: lastDays,
      team: (team || []).map(t => ({ id: t.id, name: t.full_name, role: t.role, saas_role: t.saas_role })),
      timeline: (events || []).map(e => ({ name: e.event_name, at: e.created_at })),
      subscriptions: subs || [], billing_history: billingHistory,
      followups: followups || [],
      sequences: (enrollments || []).map(e => {
        const seq = seqByKey[e.sequence_key]
        return { id: e.id, key: e.sequence_key, name: seq?.name || e.sequence_key, status: e.status,
          current_step: e.current_step, total_steps: seq ? (stepCount[seq.id] || 0) : 0, started_at: e.started_at }
      }),
      sequence_catalog: (seqDefs || []).filter(s => s.enabled !== false).map(s => ({ key: s.key, name: s.name, trigger: s.trigger })),
      owner_id: dealer.hq_owner_id || null,
      owner_name: ownerName,
      owner_options: hqStaff.map(p => ({ id: p.id, name: p.full_name || '—' })),
      stripe_customer_id: custId || null,
    })
  })

  // Reassign an account to an HQ owner / CSM (or clear it).
  app.patch('/saas/customers/:id/owner', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const { data, error } = await supabaseAdmin.from('dealerships')
      .update({ hq_owner_id: req.body?.owner_id || null }).eq('id', req.params.id).select('id, hq_owner_id').single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // (Follow-up GET/POST/PATCH routes are defined once above — a duplicate block was
  // removed here; Express would only ever serve the first registration anyway.)

  // ── Checkout funnel (Phase 2) — signup → checkout → paid, and abandoned carts.
  // A cart is a Stripe Checkout Session we started; the webhook flips it to
  // 'completed'. Anything still 'started' past a 1-hour grace window is abandoned. ──
  app.get('/saas/carts', requireAuth, async (req, res) => {
    if (!need('view_pipeline')(req, res)) return
    const GRACE_MS = 60 * 60 * 1000
    const { data: rows } = await supabaseAdmin.from('saas_checkout_sessions')
      .select('*').order('created_at', { ascending: false }).limit(2000)
    const all = rows || []
    const now = Date.now()
    const completed = all.filter(r => r.status === 'completed').length
    const started = all.length
    const abandonedRows = all.filter(r => r.status !== 'completed' && (now - new Date(r.created_at).getTime()) > GRACE_MS)
    const ids = [...new Set(abandonedRows.map(r => r.dealership_id).filter(Boolean))]
    const { data: dealers } = ids.length ? await supabaseAdmin.from('dealerships').select('id, name').in('id', ids) : { data: [] }
    const dName = Object.fromEntries((dealers || []).map(d => [d.id, d.name]))
    res.json({
      started, completed, abandoned: abandonedRows.length,
      conversion: started ? Math.round(completed / started * 100) : 0,
      abandoned_list: abandonedRows.slice(0, 60).map(r => ({
        id: r.id, dealership_id: r.dealership_id, account: dName[r.dealership_id] || 'Account',
        kind: r.kind, plan: r.plan_key, currency: r.currency,
        age_hours: Math.round((now - new Date(r.created_at).getTime()) / 3600000), created_at: r.created_at,
      })),
    })
  })

  // Recover an abandoned cart → drop a high-priority follow-up on the account.
  app.post('/saas/carts/:id/recover', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const { data: cart } = await supabaseAdmin.from('saas_checkout_sessions').select('*').eq('id', req.params.id).maybeSingle()
    if (!cart) return res.status(404).json({ error: 'Cart not found' })
    if (!cart.dealership_id) return res.status(400).json({ error: 'No account linked to this cart' })
    const { data, error } = await supabaseAdmin.from('saas_account_followups').insert({
      dealership_id: cart.dealership_id,
      title: `Recover abandoned checkout (${cart.plan_key || cart.kind || 'plan'})`,
      note: `Checkout started ${new Date(cart.created_at).toLocaleString()} and was never completed — reach out to finish signup.`,
      priority: 'high', due_at: new Date().toISOString(), created_by: req.user.id,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // ── HQ copilot — MarketSync's OWN internal AI assistant (the 4th bot). Answers
  // about the SaaS business from a live snapshot; platform-staff only. Distinct from
  // the dealer /ai/assistant (a single store) and the customer/marketing bots. ──
  app.post('/saas/assistant', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured.' })
    const raw = Array.isArray(req.body?.messages) ? req.body.messages : []
    const messages = raw
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-10).map(m => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
    if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'Send a question.' })

    const now = Date.now()
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const since30 = new Date(now - 30 * 86400000).toISOString()
    const [{ data: dealers }, { data: profiles }, { data: events }, { data: followups }, { data: carts }, { data: seqs }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, is_personal, billing_status, trial_ends_at, products, created_at').limit(3000),
      supabaseAdmin.from('profiles').select('dealership_id, billing_status, trial_ends_at').limit(8000),
      supabaseAdmin.from('events').select('dealership_id').gte('created_at', since30).limit(20000),
      supabaseAdmin.from('saas_account_followups').select('due_at').is('completed_at', null).limit(2000),
      supabaseAdmin.from('saas_checkout_sessions').select('status, created_at').limit(2000),
      supabaseAdmin.from('saas_sequences').select('name, enabled').limit(100),
    ])
    const profByDealer = {}
    for (const p of profiles || []) (profByDealer[p.dealership_id] = profByDealer[p.dealership_id] || []).push(p)
    let mrr = 0, active = 0, trials = 0, churn = 0, newThis = 0
    const top = []
    for (const d of dealers || []) {
      let status = d.billing_status, trialEnds = d.trial_ends_at
      if (d.is_personal) { const u = (profByDealer[d.id] || [])[0]; if (u) { status = u.billing_status; trialEnds = u.trial_ends_at } }
      const products = resolveProducts(d)
      const acctMrr = Object.keys(PRODUCT_MRR).reduce((s, k) => s + (products[k] ? PRODUCT_MRR[k] : 0), 0)
      const futureTrial = trialEnds && new Date(trialEnds) > new Date()
      if (activeStatus(status)) { active++; mrr += acctMrr; top.push({ name: d.name, mrr: acctMrr }) }
      else if (dunningStatus(status)) churn++
      else if (trialingStatus(status) || futureTrial) { if (futureTrial) { trials++; if (new Date(trialEnds).getTime() < now + 5 * 86400000) churn++ } else churn++ }
      if (d.created_at && new Date(d.created_at) >= monthStart) newThis++
    }
    top.sort((a, b) => b.mrr - a.mrr)
    const openF = (followups || []).length
    const overdueF = (followups || []).filter(f => f.due_at && new Date(f.due_at) < new Date()).length
    const startedC = (carts || []).length
    const completedC = (carts || []).filter(c => c.status === 'completed').length
    const abandonedC = (carts || []).filter(c => c.status !== 'completed' && (now - new Date(c.created_at).getTime()) > 3600000).length
    const conv = startedC ? Math.round(completedC / startedC * 100) : 0
    const seqOn = (seqs || []).filter(s => s.enabled).map(s => s.name)

    const facts = [
      `MRR: $${Math.round(mrr).toLocaleString()} (ARR $${Math.round(mrr * 12).toLocaleString()}).`,
      `Customers: ${active} active, ${trials} on trial, ${churn} at churn risk. New accounts this month: ${newThis}. Total accounts: ${(dealers || []).length}.`,
      `Top accounts by MRR: ${top.slice(0, 6).map(t => `${t.name} $${t.mrr}`).join(', ') || 'n/a'}.`,
      `Checkout funnel: ${startedC} started, ${completedC} completed (${conv}% conversion), ${abandonedC} abandoned carts to recover.`,
      `Customer-success: ${openF} open follow-ups (${overdueF} overdue).`,
      `Automation sequences ON: ${seqOn.join(', ') || 'none'}.`,
    ].join('\n')

    const system = `You are the MarketSync HQ copilot — the analyst for MarketSync's OWN SaaS business. MarketSync sells three products to car dealerships: DealerOS (a full dealership operating system), Facebook AutoPoster, and an AI ChatBot. You help the MarketSync operator run the company: answer questions about revenue (MRR/ARR), active vs trial customers, churn risk, new signups, top accounts, the checkout funnel and abandoned carts, open customer-success follow-ups, and which automation sequences are running — all from the LIVE HQ SNAPSHOT below. Be direct: lead with the number, then one crisp takeaway or recommended next step. Keep it tight — a couple of sentences or a short list, no headings, no fluff. Never invent numbers beyond the snapshot. Today: ${new Date().toISOString().slice(0, 10)}.\n\nLIVE HQ SNAPSHOT (MarketSync, right now):\n${facts}`

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const r = await Promise.race([
        anthropic.messages.create({ model: SMART_MODEL, max_tokens: 700, system, messages }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 25000)),
      ])
      const reply = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim() || 'No reply.'
      res.json({ reply })
    } catch (e) { res.status(500).json({ error: e.message || 'AI request failed' }) }
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

  async function authUsersById() {
    const byId = new Map()
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      const users = data?.users || []
      for (const user of users) byId.set(user.id, user)
      if (users.length < 1000) break
    }
    return byId
  }

  // List MarketSync staff (anyone with a saas_role) + the role→permission matrix.
  app.get('/saas/employees', requireAuth, async (req, res) => {
    if (!ownerOnly(req, res)) return
    try {
      const [{ data, error }, users] = await Promise.all([
        supabaseAdmin.from('profiles').select('id, full_name, display_name, phone, business_email, department, active, saas_role, system_role, created_at').not('saas_role', 'is', null).order('full_name').limit(500),
        authUsersById(),
      ])
      if (error) throw error
      const staff = (data || []).map(p => {
        const user = users.get(p.id)
        return {
          id: p.id, name: p.full_name || p.display_name || '—', display_name: p.display_name || null,
          email: user?.email || p.business_email || null, phone: p.phone || null,
          business_email: p.business_email || null, department: p.department || null,
          active: p.active !== false && !user?.banned_until, last_sign_in_at: user?.last_sign_in_at || null,
          created_at: p.created_at, saas_role: p.saas_role, system_role: p.system_role,
          permissions: SAAS_PERMISSIONS[p.saas_role] || [],
        }
      })
      res.json({ roles: SAAS_ROLES, permissions_matrix: SAAS_PERMISSIONS, staff })
    } catch (error) { res.status(500).json({ error: error.message }) }
  })

  // Edit the internal directory record without exposing auth credentials or allowing
  // a browser request to grant platform-owner status. Login-email/password changes
  // remain in the dedicated MFA-protected identity controls.
  app.patch('/saas/employees/:id', requireAuth, async (req, res) => {
    if (!ownerOnly(req, res)) return
    const body = req.body || {}
    const patch = {}
    for (const key of ['full_name', 'display_name', 'phone', 'business_email', 'department']) {
      if (key in body) patch[key] = body[key] == null || body[key] === '' ? null : String(body[key]).trim().slice(0, 240)
    }
    if ('active' in body) patch.active = body.active === true
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No editable fields supplied' })
    const { data, error } = await supabaseAdmin.from('profiles').update(patch).eq('id', req.params.id)
      .select('id, full_name, display_name, phone, business_email, department, active, saas_role, system_role').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Person not found' })
    res.json(data)
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
      const users = await authUsersById()
      const u = [...users.values()].find(x => (x.email || '').toLowerCase() === String(req.body.email).toLowerCase())
      if (!u) return res.status(404).json({ error: 'no user with that email' })
      targetId = u.id
    }
    if (!targetId) return res.status(400).json({ error: 'user_id or email required' })
    const currentIsOwner = targetId === req.user.id && saasRoleOf(req) === 'owner'
    if (currentIsOwner && role !== 'owner') return res.status(409).json({ error: 'The platform owner role cannot be removed from the current owner' })
    const { error } = await supabaseAdmin.from('profiles').update({
      saas_role: role || null,
      system_role: role ? (role === 'owner' ? 'platform_owner' : 'platform_admin') : 'dealer_user',
    }).eq('id', targetId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, user_id: targetId, saas_role: role || null })
  })

  // ══ HQ Affiliates ═════════════════════════════════════════════════════════
  // Company-wide view of the affiliate program. Reads three canonical tables
  // (affiliates, affiliate_referrals, affiliate_commissions). Any one missing
  // becomes null in the response so the UI can render "Not connected" rather
  // than fabricating zeroes. Gated behind view_customers (same as HQ Pulse).
  app.get('/saas/affiliates', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const safe = (p) => p.then(r => r, () => ({ data: null, error: true }))
    const [affRes, refRes, comRes] = await Promise.all([
      safe(supabaseAdmin.from('affiliates').select('id, code, email, status, created_at').limit(5000)),
      safe(supabaseAdmin.from('affiliate_referrals').select('affiliate_id, dealership_id, status, created_at').limit(20000)),
      safe(supabaseAdmin.from('affiliate_commissions').select('affiliate_id, amount, status, created_at').limit(50000)),
    ])
    if (!affRes.data) return res.json({ connected: false, affiliates: null, program: null })

    const referralsByAff = new Map()
    for (const r of refRes.data || []) {
      const arr = referralsByAff.get(r.affiliate_id) || []
      arr.push(r); referralsByAff.set(r.affiliate_id, arr)
    }
    const commissionsByAff = new Map()
    let totalPending = 0, totalPaid = 0
    for (const c of comRes.data || []) {
      const arr = commissionsByAff.get(c.affiliate_id) || []
      arr.push(c); commissionsByAff.set(c.affiliate_id, arr)
      const amt = Number(c.amount) || 0
      if (c.status === 'paid') totalPaid += amt
      else totalPending += amt
    }
    const rows = affRes.data.map(a => {
      const refs = referralsByAff.get(a.id) || []
      const coms = commissionsByAff.get(a.id) || []
      const active = refs.filter(r => r.status === 'active').length
      const earned = coms.reduce((s, c) => s + (Number(c.amount) || 0), 0)
      const pending = coms.filter(c => c.status !== 'paid').reduce((s, c) => s + (Number(c.amount) || 0), 0)
      return {
        id: a.id, code: a.code, email: a.email, status: a.status,
        referrals: refs.length, active_referrals: active,
        earned: Math.round(earned * 100) / 100,
        pending_payout: Math.round(pending * 100) / 100,
        conversion_rate: refs.length ? Math.round(active / refs.length * 100) : 0,
      }
    })
    rows.sort((a, b) => b.earned - a.earned)
    res.json({
      connected: true,
      program: {
        affiliate_count: affRes.data.length,
        active_affiliates: affRes.data.filter(a => (a.status || '').toLowerCase() === 'active').length,
        referral_count: (refRes.data || []).length,
        active_referrals: (refRes.data || []).filter(r => r.status === 'active').length,
        pending_payouts: Math.round(totalPending * 100) / 100,
        paid_out: Math.round(totalPaid * 100) / 100,
      },
      affiliates: rows.slice(0, 200),
    })
  })

  // ══ HQ Product Usage ══════════════════════════════════════════════════════
  // Adoption per product namespace, derived from the `events` spine only.
  // Events use `<namespace>.<action>` naming — same convention the customer
  // pipeline endpoint already reads. No new tables required.
  app.get('/saas/product-usage', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 30))
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const evtRes = await supabaseAdmin.from('events')
      .select('dealership_id, event_name, created_at')
      .gte('created_at', since).limit(100000)
      .then(r => r, () => ({ data: null, error: true }))
    if (!evtRes.data) return res.json({ connected: false, window_days: days, products: null })

    const byProduct = new Map()
    for (const e of evtRes.data) {
      const ns = String(e.event_name || '').split('.')[0]
      if (!ns) continue
      const p = byProduct.get(ns) || { events: 0, accounts: new Set(), last_at: null }
      p.events++
      if (e.dealership_id) p.accounts.add(e.dealership_id)
      if (!p.last_at || e.created_at > p.last_at) p.last_at = e.created_at
      byProduct.set(ns, p)
    }
    const products = Array.from(byProduct.entries()).map(([key, p]) => ({
      key, events: p.events, accounts: p.accounts.size, last_at: p.last_at,
    })).sort((a, b) => b.accounts - a.accounts)
    res.json({
      connected: true, window_days: days,
      total_events: evtRes.data.length,
      products,
    })
  })

  // ══ HQ Trend Charts (time-series from daily snapshots) ═══════════════════
  // Reads N days of the hq_daily_snapshots table. When the table is empty (no
  // cron run yet) we return connected:false + an empty series — the chart then
  // renders "Not measured" instead of a fake flat line at zero.
  app.get('/saas/trends', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const days = Math.max(7, Math.min(365, Number(req.query.days) || 30))
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabaseAdmin.from('hq_daily_snapshots')
      .select('*').gte('snapshot_date', since).order('snapshot_date', { ascending: true })
    if (error) return res.json({ connected: false, window_days: days, series: null, reason: error.message })
    if (!data || data.length === 0) return res.json({ connected: false, window_days: days, series: null })
    res.json({
      connected: true, window_days: days,
      series: data.map(r => ({
        date: r.snapshot_date,
        mrr: Number(r.mrr) || 0, arr: Number(r.arr) || 0,
        active_customers: r.active_customers, trial_accounts: r.trial_accounts,
        new_this_month: r.new_this_month, churn_risk: r.churn_risk,
        past_due: r.past_due,
        affiliate_payouts_due: r.affiliate_payouts_due == null ? null : Number(r.affiliate_payouts_due),
      })),
    })
  })

  // ── Nightly snapshot job (cron-secret gated). Idempotent per calendar day. ─
  // POST /cron/hq-snapshot — same secret contract every /cron/* uses. Called
  // once a day (Render cron), pulls the same numbers /saas/overview computes,
  // and upserts a row keyed by today's UTC date.
  app.post('/cron/hq-snapshot', async (req, res) => {
    if (!requestHasCronSecret(req)) return res.status(403).json({ error: 'forbidden' })
    const t0 = Date.now()
    const runInsert = async (status, error, meta) => {
      await supabaseAdmin.from('hq_job_runs').insert({
        job_key: 'hq_snapshot', status, error, metadata: meta || {},
        duration_ms: Date.now() - t0, finished_at: new Date().toISOString(),
      })
    }
    try {
      const [{ data: dealers }, { data: profiles }, affRes] = await Promise.all([
        supabaseAdmin.from('dealerships').select('id, is_personal, billing_status, trial_ends_at, products, created_at').limit(5000),
        supabaseAdmin.from('profiles').select('dealership_id, billing_status, trial_ends_at').limit(20000),
        supabaseAdmin.from('affiliate_commissions').select('amount, status').limit(50000).then(r => r, () => ({ data: null })),
      ])
      const profByDealer = {}
      for (const p of profiles || []) { (profByDealer[p.dealership_id] = profByDealer[p.dealership_id] || []).push(p) }
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
      let mrr = 0, active = 0, trials = 0, churnRisk = 0, newThisMonth = 0, pastDue = 0
      for (const d of (dealers || [])) {
        let status = d.billing_status, trialEnds = d.trial_ends_at
        if (d.is_personal) { const u = (profByDealer[d.id] || [])[0]; if (u) { status = u.billing_status; trialEnds = u.trial_ends_at } }
        const products = resolveProducts(d)
        const acctMrr = Object.keys(PRODUCT_MRR).reduce((s, k) => s + (products[k] ? PRODUCT_MRR[k] : 0), 0)
        const futureTrial = trialEnds && new Date(trialEnds) > new Date()
        if (activeStatus(status)) { active++; mrr += acctMrr }
        else if (dunningStatus(status)) { churnRisk++; pastDue++ }
        else if (trialingStatus(status) || futureTrial) { if (futureTrial) trials++; else churnRisk++ }
        if (d.created_at && new Date(d.created_at) >= monthStart) newThisMonth++
      }
      let affPayoutsDue = null
      if (affRes.data) {
        affPayoutsDue = 0
        for (const c of affRes.data) if (c.status !== 'paid') affPayoutsDue += Number(c.amount) || 0
        affPayoutsDue = Math.round(affPayoutsDue * 100) / 100
      }
      const today = new Date().toISOString().slice(0, 10)
      const { error: upErr } = await supabaseAdmin.from('hq_daily_snapshots').upsert({
        snapshot_date: today, mrr, arr: mrr * 12,
        active_customers: active, trial_accounts: trials, new_this_month: newThisMonth,
        churn_risk: churnRisk, past_due: pastDue, affiliate_payouts_due: affPayoutsDue,
        captured_at: new Date().toISOString(),
      }, { onConflict: 'snapshot_date' })
      if (upErr) throw upErr
      await runInsert('success', null, { mrr, active, trials })
      res.json({ ok: true, snapshot_date: today, mrr, active_customers: active })
    } catch (e) {
      await runInsert('error', e.message)
      res.status(500).json({ error: e.message })
    }
  })

  // ══ HQ Accounting — company expense ledger + budgets ═════════════════════
  // These are MarketSync's OWN operating expenses, not a dealership ledger.
  // Reads gated on view_customers (Pulse level); writes on manage_followups
  // (same gate as other HQ mutations). Cross-day totals stay honest — if the
  // table is empty the UI shows the empty state, never a placeholder number.
  app.get('/saas/accounting/expenses', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 90))
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const [{ data: cats }, { data: rows }] = await Promise.all([
      supabaseAdmin.from('hq_expense_categories').select('*').order('label'),
      supabaseAdmin.from('hq_vendor_expenses').select('*').gte('incurred_on', since).order('incurred_on', { ascending: false }).limit(2000),
    ])
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    const totals = { window: 0, this_month: 0, by_category: {} }
    for (const c of (cats || [])) totals.by_category[c.key] = { label: c.label, monthly_budget: c.monthly_budget == null ? null : Number(c.monthly_budget), spent_this_month: 0, spent_window: 0 }
    for (const r of (rows || [])) {
      const amt = Number(r.amount) || 0
      totals.window += amt
      const thisMonth = new Date(r.incurred_on) >= monthStart
      if (thisMonth) totals.this_month += amt
      const bucket = totals.by_category[r.category_key] || (totals.by_category[r.category_key || 'uncategorized'] = { label: r.category_key || 'Uncategorized', monthly_budget: null, spent_this_month: 0, spent_window: 0 })
      bucket.spent_window += amt
      if (thisMonth) bucket.spent_this_month += amt
    }
    for (const k of Object.keys(totals.by_category)) {
      const b = totals.by_category[k]
      b.spent_this_month = Math.round(b.spent_this_month * 100) / 100
      b.spent_window = Math.round(b.spent_window * 100) / 100
      b.budget_utilization = b.monthly_budget ? Math.round(b.spent_this_month / b.monthly_budget * 100) : null
    }
    res.json({
      window_days: days,
      totals: {
        window: Math.round(totals.window * 100) / 100,
        this_month: Math.round(totals.this_month * 100) / 100,
        by_category: totals.by_category,
      },
      categories: cats || [],
      expenses: rows || [],
    })
  })

  app.post('/saas/accounting/expenses', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const b = req.body || {}
    const vendor = String(b.vendor || '').trim().slice(0, 240)
    const amount = Number(b.amount)
    const incurredOn = b.incurred_on ? new Date(b.incurred_on) : new Date()
    if (!vendor) return res.status(400).json({ error: 'Vendor required' })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Amount must be a positive number' })
    if (Number.isNaN(incurredOn.getTime())) return res.status(400).json({ error: 'Invalid incurred_on date' })
    const row = {
      vendor,
      category_key: b.category_key ? String(b.category_key).trim().slice(0, 60) : null,
      amount, currency: (b.currency || 'USD').slice(0, 3).toUpperCase(),
      incurred_on: incurredOn.toISOString().slice(0, 10),
      memo: b.memo ? String(b.memo).slice(0, 1000) : null,
      recurring: !!b.recurring,
      created_by: req.user?.id || null,
    }
    const { data, error } = await supabaseAdmin.from('hq_vendor_expenses').insert(row).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  app.patch('/saas/accounting/expenses/:id', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const patch = {}
    const b = req.body || {}
    for (const k of ['vendor', 'category_key', 'memo']) if (k in b) patch[k] = b[k] == null || b[k] === '' ? null : String(b[k]).slice(0, 1000)
    if ('amount' in b) { const n = Number(b.amount); if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'Bad amount' }); patch.amount = n }
    if ('incurred_on' in b) patch.incurred_on = new Date(b.incurred_on).toISOString().slice(0, 10)
    if ('recurring' in b) patch.recurring = !!b.recurring
    if ('status' in b) {
      if (!['recorded', 'pending', 'paid', 'cancelled'].includes(b.status)) return res.status(400).json({ error: 'Bad status' })
      patch.status = b.status
    }
    const { data, error } = await supabaseAdmin.from('hq_vendor_expenses').update(patch).eq('id', req.params.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  app.delete('/saas/accounting/expenses/:id', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const { error } = await supabaseAdmin.from('hq_vendor_expenses').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── Receipt OCR for HQ operating expenses. Uses the same Anthropic vision
  // path the dealership endpoint uses, but gated on HQ manage_followups
  // (not MFA + dealership + ai_boost) so an HQ user can capture their
  // MarketSync-side vendor spend. Returns the decoded fields; the client
  // then confirms and POSTs to /saas/accounting/expenses. Never inserts on
  // its own — the user always confirms the numbers first.
  app.post('/saas/accounting/expenses/scan', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })
    const img = String(req.body?.image || '')
    const m = img.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/)
    if (!m) return res.status(400).json({ error: 'Send the receipt photo as a base64 data URL.' })
    const media_type = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]
    const data = m[3]
    if (data.length > 8_000_000) return res.status(400).json({ error: 'Image too large — retake at normal quality.' })
    // Category keys the HQ ledger actually uses so the AI can pick one that
    // matches an existing bucket instead of coining a new label.
    const { data: cats } = await supabaseAdmin.from('hq_expense_categories').select('key, label')
    const catList = (cats || []).map(c => `${c.key} (${c.label})`).slice(0, 20).join(', ')
    const prompt = `You are reading a photo of a purchase RECEIPT for MarketSync's own operating expenses. Extract ONLY what is clearly legible. Return STRICT JSON with these keys (use null when not visible): vendor (the store/merchant name), date (YYYY-MM-DD), subtotal, tax, total. Also return category_key — pick the single best match from THIS list of MarketSync HQ categories (copy the key exactly), or null if none clearly fit: ${catList || 'infrastructure, software, marketing, contractors, operations'}. Numbers must be plain (no currency symbols or commas). Do not guess or invent. Return ONLY the JSON object, no prose.`
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: SMART_MODEL, max_tokens: 400, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data } },
          { type: 'text', text: prompt },
        ] }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 30000)),
      ])
      let txt = (msg?.content?.[0]?.text || '').trim().replace(/^```json\s*|\s*```$/g, '')
      let f
      try { f = JSON.parse(txt) } catch { return res.status(422).json({ error: 'Could not read the receipt clearly — try a flatter, well-lit photo.' }) }
      const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }
      res.json({ ok: true, fields: {
        vendor: f.vendor ? String(f.vendor).slice(0, 120) : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : null,
        subtotal: num(f.subtotal), tax: num(f.tax), total: num(f.total),
        category_key: f.category_key ? String(f.category_key).slice(0, 60) : null,
      } })
    } catch (e) {
      res.status(500).json({ error: e.message === 'ai timeout' ? 'Reading the receipt took too long — try again.' : 'Could not read the receipt.' })
    }
  })

  // ── HQ income entries (one-off invoices, side revenue). Kept separate from
  // subscription MRR so /saas/accounting can reconcile without double-count.
  app.get('/saas/accounting/income', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 90))
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const { data, error } = await supabaseAdmin.from('hq_income_entries')
      .select('*').gte('received_on', since).order('received_on', { ascending: false }).limit(2000)
    if (error) return res.status(500).json({ error: error.message })
    const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    let windowTotal = 0, monthTotal = 0
    for (const r of data || []) {
      const amt = Number(r.amount) || 0
      windowTotal += amt
      if (new Date(r.received_on) >= monthStart) monthTotal += amt
    }
    res.json({
      window_days: days,
      totals: { window: Math.round(windowTotal * 100) / 100, this_month: Math.round(monthTotal * 100) / 100 },
      income: data || [],
    })
  })
  app.post('/saas/accounting/income', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const b = req.body || {}
    const source = String(b.source || '').trim().slice(0, 240)
    const amount = Number(b.amount)
    const receivedOn = b.received_on ? new Date(b.received_on) : new Date()
    if (!source) return res.status(400).json({ error: 'Source (payer / invoice title) required' })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Amount must be a positive number' })
    if (Number.isNaN(receivedOn.getTime())) return res.status(400).json({ error: 'Invalid received_on date' })
    const row = {
      source,
      category_key: b.category_key ? String(b.category_key).trim().slice(0, 60) : null,
      amount, currency: (b.currency || 'USD').slice(0, 3).toUpperCase(),
      received_on: receivedOn.toISOString().slice(0, 10),
      memo: b.memo ? String(b.memo).slice(0, 1000) : null,
      // invoice_url is optional — client passes a URL if it hosted the file
      // itself. We do NOT persist raw base64 blobs in Postgres.
      invoice_url: b.invoice_url ? String(b.invoice_url).slice(0, 2000) : null,
      created_by: req.user?.id || null,
    }
    const { data, error } = await supabaseAdmin.from('hq_income_entries').insert(row).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })
  app.delete('/saas/accounting/income/:id', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const { error } = await supabaseAdmin.from('hq_income_entries').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── Same OCR path but for income invoices. Fields returned map to the
  // shape POST /saas/accounting/income expects.
  app.post('/saas/accounting/income/scan', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI features not configured' })
    const img = String(req.body?.image || '')
    const m = img.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/)
    if (!m) return res.status(400).json({ error: 'Send the invoice photo as a base64 data URL.' })
    const media_type = m[1] === 'image/jpg' ? 'image/jpeg' : m[1]
    const data = m[3]
    if (data.length > 8_000_000) return res.status(400).json({ error: 'Image too large — retake at normal quality.' })
    const prompt = `You are reading a photo of an INVOICE that MarketSync issued (or received payment for). Extract ONLY what is clearly legible. Return STRICT JSON with these keys (use null when not visible): source (the payer / client name), date (YYYY-MM-DD, the invoice or received date), amount (grand total, plain number, no currency symbols or commas). Do not guess or invent. Return ONLY the JSON object, no prose.`
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const msg = await Promise.race([
        anthropic.messages.create({ model: SMART_MODEL, max_tokens: 300, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type, data } },
          { type: 'text', text: prompt },
        ] }] }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ai timeout')), 30000)),
      ])
      let txt = (msg?.content?.[0]?.text || '').trim().replace(/^```json\s*|\s*```$/g, '')
      let f
      try { f = JSON.parse(txt) } catch { return res.status(422).json({ error: 'Could not read the invoice clearly — try a flatter, well-lit photo.' }) }
      const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null }
      res.json({ ok: true, fields: {
        source: f.source ? String(f.source).slice(0, 240) : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(f.date || '') ? f.date : null,
        amount: num(f.amount),
      } })
    } catch (e) {
      res.status(500).json({ error: e.message === 'ai timeout' ? 'Reading the invoice took too long — try again.' : 'Could not read the invoice.' })
    }
  })

  app.patch('/saas/accounting/categories/:key', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const b = req.body || {}
    const patch = {}
    if ('label' in b) patch.label = String(b.label || '').trim().slice(0, 240)
    if ('monthly_budget' in b) {
      if (b.monthly_budget == null || b.monthly_budget === '') patch.monthly_budget = null
      else { const n = Number(b.monthly_budget); if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'Bad budget' }); patch.monthly_budget = n }
    }
    const { data, error } = await supabaseAdmin.from('hq_expense_categories').update(patch).eq('key', req.params.key).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  // ══ HQ Billing Summary ════════════════════════════════════════════════════
  // Rolls up subscription state across every dealership: active / trialing /
  // past-due / cancel-at-period-end counts, plus a receivables approximation
  // from dunning accounts × their inferred MRR. Reads only tables that are
  // already the billing truth (dealerships + subscriptions); Stripe drill-down
  // stays in the existing /owner/billing/:id endpoint.
  app.get('/saas/billing-summary', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const [{ data: dealers }, subsRes] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, billing_status, products, plan').limit(2000),
      supabaseAdmin.from('subscriptions').select('dealership_id, status, cancel_at_period_end, current_period_end').limit(8000)
        .then(r => r, () => ({ data: null, error: true })),
    ])
    const subs = subsRes.data
    // Subscription-driven counts (Stripe-backed) if we can read the table.
    let activeSubs = null, trialingSubs = null, pastDueSubs = null, cancelling = null
    if (subs) {
      activeSubs = 0; trialingSubs = 0; pastDueSubs = 0; cancelling = 0
      for (const s of subs) {
        const st = String(s.status || '').toLowerCase()
        if (st === 'active') activeSubs++
        else if (st === 'trialing') trialingSubs++
        else if (st === 'past_due' || st === 'unpaid') pastDueSubs++
        if (s.cancel_at_period_end) cancelling++
      }
    }
    // Receivables: sum inferred MRR of dunning dealers (best-effort until an
    // invoice-history table exists). Emit null if the concept can't be computed.
    let receivables = 0, pastDueAccounts = 0
    for (const d of (dealers || [])) {
      if (!dunningStatus(d.billing_status)) continue
      pastDueAccounts++
      const products = resolveProducts(d)
      receivables += Object.keys(PRODUCT_MRR).reduce((s, k) => s + (products[k] ? PRODUCT_MRR[k] : 0), 0)
    }
    res.json({
      stripe_connected: subs !== null,
      subscriptions: subs === null ? null : {
        active: activeSubs, trialing: trialingSubs, past_due: pastDueSubs,
        cancel_at_period_end: cancelling,
      },
      receivables: {
        past_due_accounts: pastDueAccounts,
        estimated_owed_mrr: receivables,     // conservative MRR-based approximation
        note: 'Approximated from active entitlements — real invoice totals require the invoice-history table.',
      },
    })
  })

  // ══ HQ Platform Health ════════════════════════════════════════════════════
  // Aggregates the observable health signals: dunning + trials-expiring +
  // integration failure rate. No secrets emitted. Same permission as Pulse.
  app.get('/saas/platform-health', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const safe = (p) => p.then(r => r, () => ({ data: null, error: true }))
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const [dRes, iRes, jRes, wRes] = await Promise.all([
      safe(supabaseAdmin.from('dealerships').select('billing_status, trial_ends_at, is_personal').limit(2000)),
      safe(supabaseAdmin.from('dealer_integrations').select('status, provider, updated_at').limit(5000)),
      safe(supabaseAdmin.from('hq_job_runs').select('job_key, status, error, started_at, duration_ms')
        .gte('started_at', since24h).order('started_at', { ascending: false }).limit(1000)),
      safe(supabaseAdmin.from('hq_webhook_events').select('provider, status, error, received_at')
        .gte('received_at', since24h).order('received_at', { ascending: false }).limit(1000)),
    ])
    let pastDue = 0, expiringTrials = 0
    for (const d of (dRes.data || [])) {
      if (dunningStatus(d.billing_status)) pastDue++
      if (d.trial_ends_at && new Date(d.trial_ends_at) > new Date() &&
          new Date(d.trial_ends_at).getTime() - Date.now() < 5 * 86400000) expiringTrials++
    }
    const integrationsConnected = iRes.data !== null
    const failedIntegrations = integrationsConnected
      ? (iRes.data || []).filter(i => ['error', 'failed', 'disconnected'].includes(String(i.status || '').toLowerCase())).length
      : null
    // Job + webhook health. Both null-when-empty so brand new environments
    // render "Not measured" instead of a fake "0 failures".
    let failedJobs = null, runningJobs = null, recentFailedJobs = null
    if (jRes.data !== null) {
      failedJobs = jRes.data.filter(r => r.status === 'error').length
      runningJobs = jRes.data.filter(r => r.status === 'running').length
      recentFailedJobs = jRes.data.filter(r => r.status === 'error').slice(0, 10).map(r => ({
        job_key: r.job_key, error: r.error, started_at: r.started_at, duration_ms: r.duration_ms,
      }))
    }
    let failedWebhooks = null, recentFailedWebhooks = null
    if (wRes.data !== null) {
      failedWebhooks = wRes.data.filter(r => r.status === 'failed').length
      recentFailedWebhooks = wRes.data.filter(r => r.status === 'failed').slice(0, 10).map(r => ({
        provider: r.provider, error: r.error, received_at: r.received_at,
      }))
    }
    const anySignalBad = (pastDue > 0) || (failedIntegrations && failedIntegrations > 0)
      || (failedJobs != null && failedJobs > 0) || (failedWebhooks != null && failedWebhooks > 0)
    res.json({
      status: anySignalBad ? 'degraded' : 'ok',
      signals: {
        past_due: pastDue,
        trials_expiring_5d: expiringTrials,
        failed_integrations: failedIntegrations,
        failed_jobs_24h: failedJobs,          // null → "Not measured"
        running_jobs: runningJobs,
        failed_webhooks_24h: failedWebhooks,   // null → "Not measured"
      },
      recent_failures: {
        jobs: recentFailedJobs || [],
        webhooks: recentFailedWebhooks || [],
      },
      env: process.env.NODE_ENV || 'unknown',
    })
  })

  // ══ HQ Trials pipeline ═══════════════════════════════════════════════════
  // Classifies every trial into an explicit stage (new / onboarding / active /
  // engaged / low_engagement / expiring / converted / expired), with the last
  // activity and days-remaining that decide the stage. Basis for the Trials
  // engine page. Only reads tables that already exist.
  app.get('/saas/trials', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [{ data: dealers }, { data: profiles }, evtRes] = await Promise.all([
      supabaseAdmin.from('dealerships').select('id, name, is_personal, billing_status, trial_ends_at, products, created_at').limit(3000),
      supabaseAdmin.from('profiles').select('dealership_id, billing_status, trial_ends_at').limit(20000),
      supabaseAdmin.from('events').select('dealership_id, event_name, created_at').gte('created_at', since)
        .order('created_at', { ascending: false }).limit(50000)
        .then(r => r, () => ({ data: null })),
    ])
    const profByDealer = {}
    for (const p of profiles || []) { (profByDealer[p.dealership_id] = profByDealer[p.dealership_id] || []).push(p) }
    const activityByAcct = new Map()
    for (const e of (evtRes?.data || [])) {
      const a = activityByAcct.get(e.dealership_id) || { count: 0, last: null, engines: new Set() }
      a.count++
      if (!a.last) a.last = e.created_at
      const ns = String(e.event_name || '').split('.')[0]
      if (ns) a.engines.add(ns)
      activityByAcct.set(e.dealership_id, a)
    }
    const now = Date.now()
    const trials = []
    for (const d of (dealers || [])) {
      let status = d.billing_status, trialEnds = d.trial_ends_at
      if (d.is_personal) { const u = (profByDealer[d.id] || [])[0]; if (u) { status = u.billing_status; trialEnds = u.trial_ends_at } }
      const inTrialWindow = trialEnds && new Date(trialEnds).getTime() > now
      const trialingByStatus = String(status || '').toUpperCase() === 'TRIALING'
      if (!inTrialWindow && !trialingByStatus) continue
      if (activeStatus(status)) continue   // already converted → not in pipeline
      const days = trialEnds ? Math.round((new Date(trialEnds).getTime() - now) / 86400000) : null
      const a = activityByAcct.get(d.id) || { count: 0, last: null, engines: new Set() }
      const daysSinceStart = d.created_at ? Math.round((now - new Date(d.created_at).getTime()) / 86400000) : null
      let stage
      if (!inTrialWindow) stage = 'expired'
      else if (days != null && days <= 5) stage = 'expiring'
      else if (a.engines.size >= 3 && a.count >= 10) stage = 'engaged'
      else if (a.engines.size >= 1 && a.count >= 3) stage = 'active'
      else if (daysSinceStart != null && daysSinceStart <= 2) stage = 'new'
      else if (a.count > 0) stage = 'onboarding'
      else stage = 'low_engagement'
      const nextAction =
        stage === 'expiring' ? 'Convert — book demo now' :
        stage === 'expired' ? 'Re-engage — trial lapsed' :
        stage === 'engaged' ? 'Convert to paid' :
        stage === 'active' ? 'Nudge to next feature' :
        stage === 'onboarding' ? 'Coach through first outcome' :
        stage === 'new' ? 'Welcome outreach' :
        'Activation outreach'
      trials.push({
        id: d.id, name: d.name || 'Account',
        stage, days_left: days, days_since_start: daysSinceStart,
        activity_30d: a.count, engines_used: a.engines.size,
        last_activity: a.last, next_action: nextAction,
        products: resolveProducts(d),
      })
    }
    const STAGES = ['new', 'onboarding', 'active', 'engaged', 'low_engagement', 'expiring', 'expired']
    const counts = Object.fromEntries(STAGES.map(s => [s, 0]))
    for (const t of trials) counts[t.stage] = (counts[t.stage] || 0) + 1
    // Trial conversion rate over 30 days: paid_new / (paid_new + trialing).
    // "paid_new" = dealers created in the last 30 days that are now ACTIVE.
    let paidNew30d = 0, allNew30d = 0
    const cutoff = now - 30 * 86400000
    for (const d of (dealers || [])) {
      if (!d.created_at) continue
      if (new Date(d.created_at).getTime() < cutoff) continue
      allNew30d++
      let effStatus = d.billing_status
      if (d.is_personal) { const u = (profByDealer[d.id] || [])[0]; if (u) effStatus = u.billing_status }
      if (activeStatus(effStatus)) paidNew30d++
    }
    const conversionRate = allNew30d > 0 ? Math.round(paidNew30d / allNew30d * 100) : null
    trials.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999))
    res.json({
      stages: STAGES, counts,
      conversion_rate_30d: conversionRate,   // null when we can't compute
      trials,
    })
  })

  // ══ Automation diagnostics ═══════════════════════════════════════════════
  // Roll-up of sequence health for the HQ Automations page. Surfaces stalled
  // enrollments (paused > 7 days), failed step sends, and the top offending
  // sequences. Reads only existing tables.
  app.get('/saas/automation/diagnostics', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [{ data: seqs }, { data: enrollments }, sendRes] = await Promise.all([
      supabaseAdmin.from('saas_sequences').select('id, key, name, enabled'),
      supabaseAdmin.from('saas_sequence_enrollments').select('id, sequence_key, dealership_id, status, current_step, updated_at, started_at')
        .gte('started_at', since).limit(20000)
        .then(r => r, () => ({ data: null })),
      supabaseAdmin.from('saas_sequence_step_runs').select('sequence_key, dealership_id, status, error, ran_at')
        .gte('ran_at', since).limit(50000)
        .then(r => r, () => ({ data: null })),
    ])
    const enr = enrollments?.data ?? enrollments
    const runs = sendRes?.data ?? sendRes
    // Support both callable safe() shape and direct data.
    const enrRows = Array.isArray(enr) ? enr : (enr?.data || [])
    const runRows = Array.isArray(runs) ? runs : (runs?.data || [])
    const stalledCutoff = Date.now() - 7 * 86400000
    let active = 0, paused = 0, stopped = 0, stalled = 0
    const byKey = {}
    for (const e of enrRows) {
      const b = byKey[e.sequence_key] || (byKey[e.sequence_key] = { active: 0, paused: 0, stopped: 0, failed: 0 })
      if (e.status === 'active') { active++; b.active++ }
      else if (e.status === 'paused') {
        paused++; b.paused++
        if (e.updated_at && new Date(e.updated_at).getTime() < stalledCutoff) stalled++
      }
      else if (e.status === 'stopped') { stopped++; b.stopped++ }
    }
    const failedRuns = runRows.filter(r => r.status === 'error' || r.status === 'failed')
    for (const r of failedRuns) {
      const b = byKey[r.sequence_key] || (byKey[r.sequence_key] = { active: 0, paused: 0, stopped: 0, failed: 0 })
      b.failed++
    }
    const sequences = (seqs || []).map(s => ({
      key: s.key, name: s.name, enabled: s.enabled !== false, ...(byKey[s.key] || { active: 0, paused: 0, stopped: 0, failed: 0 }),
    })).sort((a, b) => (b.failed - a.failed) || (b.active - a.active))
    res.json({
      // Runs table is optional (older environments) — surface that honestly.
      runs_connected: runRows !== null,
      totals: { active, paused, stopped, stalled_over_7d: stalled, failed_runs_30d: failedRuns.length },
      sequences,
      recent_failures: failedRuns.slice(0, 15).map(r => ({
        sequence_key: r.sequence_key, dealership_id: r.dealership_id, error: r.error, ran_at: r.ran_at,
      })),
    })
  })

  // ══ Staff onboarding checklist ═══════════════════════════════════════════
  // A per-staff checklist (JSON on profiles.hq_onboarding). Owner-only.
  const STAFF_ONBOARDING = [
    { key: 'profile',       label: 'Profile complete (name, business email, department)' },
    { key: 'mfa',           label: 'MFA enrolled' },
    { key: 'training',      label: 'Product training complete' },
    { key: 'first_account', label: 'First customer account assigned' },
    { key: 'first_action',  label: 'First follow-up logged' },
  ]
  app.get('/saas/staff/onboarding', requireAuth, async (req, res) => {
    if (saasRoleOf(req) !== 'owner') { res.status(403).json({ error: 'Owner access required' }); return }
    const { data: staff } = await supabaseAdmin.from('profiles')
      .select('id, full_name, department, saas_role, hq_onboarding, business_email')
      .not('saas_role', 'is', null).order('full_name').limit(500)
    res.json({
      checklist: STAFF_ONBOARDING,
      staff: (staff || []).map(p => {
        const state = (p.hq_onboarding && typeof p.hq_onboarding === 'object') ? p.hq_onboarding : {}
        const done = STAFF_ONBOARDING.filter(item => !!state[item.key]).length
        return {
          id: p.id, name: p.full_name || p.business_email || '—',
          department: p.department || null, saas_role: p.saas_role,
          checklist_state: STAFF_ONBOARDING.reduce((acc, item) => (acc[item.key] = !!state[item.key], acc), {}),
          progress_pct: Math.round(done / STAFF_ONBOARDING.length * 100),
        }
      }),
    })
  })
  app.patch('/saas/staff/:id/onboarding', requireAuth, async (req, res) => {
    if (saasRoleOf(req) !== 'owner') { res.status(403).json({ error: 'Owner access required' }); return }
    const key = String(req.body?.key || '')
    if (!STAFF_ONBOARDING.find(i => i.key === key)) return res.status(400).json({ error: 'Unknown checklist key' })
    const done = !!req.body?.done
    const { data: current } = await supabaseAdmin.from('profiles').select('hq_onboarding').eq('id', req.params.id).maybeSingle()
    const next = { ...((current && current.hq_onboarding && typeof current.hq_onboarding === 'object') ? current.hq_onboarding : {}), [key]: done }
    const { error } = await supabaseAdmin.from('profiles').update({ hq_onboarding: next }).eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, key, done })
  })

  // ══ HQ announcements (customer + staff) ══════════════════════════════════
  // Composer-style broadcasts. Server-side sending stays out of scope for this
  // slice — this is the durable inbox record HQ authors decide on.
  app.get('/saas/announcements', requireAuth, async (req, res) => {
    if (!need('view_customers')(req, res)) return
    const audience = req.query.audience === 'staff' ? 'staff' : req.query.audience === 'customer' ? 'customer' : null
    let q = supabaseAdmin.from('hq_announcements').select('*').order('created_at', { ascending: false }).limit(100)
    if (audience) q = q.eq('audience', audience)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ announcements: data || [] })
  })
  app.post('/saas/announcements', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const b = req.body || {}
    const audience = b.audience === 'staff' ? 'staff' : 'customer'
    const title = String(b.title || '').trim().slice(0, 240)
    const body = String(b.body || '').trim().slice(0, 8000)
    if (!title || !body) return res.status(400).json({ error: 'Title and body required' })
    const publishAt = b.publish_at ? new Date(b.publish_at) : new Date()
    if (Number.isNaN(publishAt.getTime())) return res.status(400).json({ error: 'Invalid publish_at' })
    const row = {
      audience, title, body, publish_at: publishAt.toISOString(),
      severity: ['info', 'warning', 'success'].includes(b.severity) ? b.severity : 'info',
      created_by: req.user?.id || null,
    }
    const { data, error } = await supabaseAdmin.from('hq_announcements').insert(row).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })
  app.delete('/saas/announcements/:id', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const { error } = await supabaseAdmin.from('hq_announcements').delete().eq('id', req.params.id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })
}
