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
import { resolveProducts, saasCan, saasRoleOf, SAAS_ROLES, SAAS_PERMISSIONS } from './profile.js'

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
    const [{ data: dealer }, { data: team }, { data: events }, { data: subs }, { data: followups }, { data: enrollments }, { data: seqDefs }, { data: seqSteps }] = await Promise.all([
      supabaseAdmin.from('dealerships').select('*').eq('id', id).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name, role, saas_role, billing_status, trial_ends_at, phone, created_at').eq('dealership_id', id).limit(100),
      supabaseAdmin.from('events').select('event_name, created_at').eq('dealership_id', id).order('created_at', { ascending: false }).limit(60),
      supabaseAdmin.from('subscriptions').select('*').eq('dealership_id', id),
      supabaseAdmin.from('saas_account_followups').select('*').eq('dealership_id', id).order('due_at', { ascending: true }).limit(100),
      supabaseAdmin.from('saas_sequence_enrollments').select('*').eq('dealership_id', id).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('saas_sequences').select('id, key, name, trigger, enabled'),
      supabaseAdmin.from('saas_sequence_steps').select('sequence_id'),
    ])
    const seqByKey = Object.fromEntries((seqDefs || []).map(s => [s.key, s]))
    const stepCount = {}
    for (const st of seqSteps || []) stepCount[st.sequence_id] = (stepCount[st.sequence_id] || 0) + 1
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

    res.json({
      id: dealer.id, name: dealer.name, website_url: dealer.website_url || null,
      is_personal: !!dealer.is_personal, status: (status || '').toUpperCase() || null,
      created_at: dealer.created_at, trial_ends_at: trialEnds,
      products, product_keys: productKeys, plan: dealer.plan || null,
      mrr, arr: mrr * 12, ltv, ltv_source: ltvSource, tenure_months: tenureMonths,
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
      stripe_customer_id: custId || null,
    })
  })

  // Follow-ups — HQ's own task queue against customer accounts (GHL-style). Powers
  // both the Follow-ups page and the Customer 360 drawer. Open items only (completed
  // ones drop off the queue). Account + assignee names are resolved for the UI.
  app.get('/saas/followups', requireAuth, async (req, res) => {
    if (!need('view_pipeline')(req, res)) return
    const { data: rows } = await supabaseAdmin.from('saas_account_followups')
      .select('*').is('completed_at', null).order('due_at', { ascending: true, nullsFirst: false }).limit(500)
    const followups = rows || []
    const dealerIds = [...new Set(followups.map(f => f.dealership_id).filter(Boolean))]
    const userIds = [...new Set(followups.map(f => f.assigned_to).filter(Boolean))]
    const [{ data: dealers }, { data: users }] = await Promise.all([
      dealerIds.length ? supabaseAdmin.from('dealerships').select('id, name').in('id', dealerIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabaseAdmin.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
    ])
    const dName = Object.fromEntries((dealers || []).map(d => [d.id, d.name]))
    const uName = Object.fromEntries((users || []).map(u => [u.id, u.full_name]))
    res.json({ followups: followups.map(f => ({ ...f, account_name: dName[f.dealership_id] || 'Account', assigned_name: f.assigned_to ? (uName[f.assigned_to] || null) : null })) })
  })

  app.post('/saas/followups', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const { dealership_id, title, note, due_at, priority, assigned_to } = req.body || {}
    if (!dealership_id || !title || !String(title).trim()) return res.status(400).json({ error: 'dealership_id and title required' })
    const { data, error } = await supabaseAdmin.from('saas_account_followups').insert({
      dealership_id, title: String(title).trim(), note: note || null, due_at: due_at || null,
      priority: priority || 'normal', assigned_to: assigned_to || null, created_by: req.user.id,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

  app.patch('/saas/followups/:id', requireAuth, async (req, res) => {
    if (!need('manage_followups')(req, res)) return
    const b = req.body || {}
    const patch = { updated_at: new Date().toISOString() }
    if ('done' in b) { patch.completed_at = b.done ? new Date().toISOString() : null; patch.completed_by = b.done ? req.user.id : null }
    for (const k of ['title', 'note', 'due_at', 'priority', 'assigned_to']) if (k in b) patch[k] = b[k]
    const { data, error } = await supabaseAdmin.from('saas_account_followups').update(patch).eq('id', req.params.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data)
  })

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
