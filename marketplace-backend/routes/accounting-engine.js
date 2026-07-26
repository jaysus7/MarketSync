/**
 * Accounting Engine — event-driven, double-entry (Accounting Engine A2).
 *
 *   financial event → Event Listener → Rule Engine → Journal Engine → Ledger
 *
 * The Journal Engine (postJournal) is the ONLY thing allowed to create financial
 * postings. Every entry is balanced (Σdebit = Σcredit) or it is refused. Postings
 * are immutable and cannot enter a locked period — corrections are reversing entries.
 *
 * This runs IN PARALLEL with the legacy single-sided gl_entries posting during
 * rollout: it writes to the new journal_entries/journal_lines substrate only, so
 * there is no double-count and no behavior regression. Reports can cut over to
 * journals once proven.
 *
 * The commission calculation logic is NOT reimplemented here — the existing
 * commissions.js engine (splits, F&I, volume, spiff, clawback, draw) computes the
 * numbers; this engine only turns its result (deal_commissions.total) into journals.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { onEvent } from './events.js'
import { getCommissionResult } from './commissions.js'
import { getDeal } from './dashboard.js'
import { getConfig } from './config-engine.js'

// Dealer accounting settings, read through the Configuration Engine (contract §6:
// dealer-specific behavior comes from config, not hardcoded/raw-table reads). Falls
// back to the legacy dealerships.accounting_settings / cost_tracking_enabled columns
// so dealers who never set the config key keep their current behavior.
async function getAccountingSettings(dealershipId) {
  const cfg = await getConfig(dealershipId, 'accounting', null)
  if (cfg && typeof cfg === 'object') {
    return { autoPost: cfg.auto_post !== false, costTracking: !!cfg.cost_tracking }
  }
  const { data: dlr } = await supabaseAdmin.from('dealerships')
    .select('accounting_settings, cost_tracking_enabled').eq('id', dealershipId).maybeSingle()
  return { autoPost: dlr?.accounting_settings?.auto_post !== false, costTracking: !!dlr?.cost_tracking_enabled }
}

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100

// Full automotive chart of accounts. account_key → account spec, created on first
// use when a posting rule references it (so a dealer only grows the accounts they
// actually post to). Categories: asset|liability|equity|income|cogs|expense.
const ACCOUNT_DEFS = {
  // Assets
  cash:                { code: '1000', name: 'Cash / Bank',            category: 'asset' },
  accounts_receivable: { code: '1100', name: 'Accounts Receivable',   category: 'asset' },
  contracts_in_transit:{ code: '1150', name: 'Contracts in Transit',  category: 'asset' },
  inventory:           { code: '1200', name: 'Vehicle Inventory',     category: 'asset' },
  parts_inventory:     { code: '1300', name: 'Parts Inventory',       category: 'asset' },
  recon_wip:           { code: '1400', name: 'Recon Work in Progress',category: 'asset' },
  prepaids:            { code: '1450', name: 'Prepaids',              category: 'asset' },
  fixed_assets:        { code: '1500', name: 'Fixed Assets',          category: 'asset' },
  tax_paid:            { code: '1600', name: 'Sales Tax Paid / ITCs', category: 'asset' },
  // Liabilities
  accounts_payable:    { code: '2000', name: 'Accounts Payable',      category: 'liability' },
  floorplan_payable:   { code: '2100', name: 'Floorplan Payable',     category: 'liability' },
  tax_collected:       { code: '2200', name: 'Sales Tax Payable',     category: 'liability' },
  commission_payable:  { code: '2300', name: 'Commission Payable',    category: 'liability' },
  payroll_payable:     { code: '2400', name: 'Payroll Payable',       category: 'liability' },
  customer_deposits:   { code: '2500', name: 'Customer Deposits',     category: 'liability' },
  trade_allowance:     { code: '2600', name: 'Trade Allowance',        category: 'liability' },
  // Equity
  retained_earnings:   { code: '3000', name: 'Retained Earnings',     category: 'equity' },
  // Revenue
  vehicle_sales:       { code: '4000', name: 'Vehicle Sales',         category: 'income' },
  fni_income:          { code: '4100', name: 'F&I Revenue',           category: 'income' },
  service_revenue:     { code: '4200', name: 'Service Revenue',       category: 'income' },
  parts_revenue:       { code: '4300', name: 'Parts Revenue',         category: 'income' },
  warranty_revenue:    { code: '4400', name: 'Warranty Revenue',      category: 'income' },
  accessories_income:  { code: '4500', name: 'Accessories Revenue',   category: 'income' },
  // Cost of sales
  cogs:                { code: '5000', name: 'Vehicle COGS',          category: 'cogs' },
  recon_cost:          { code: '5100', name: 'Recon Cost',           category: 'cogs' },
  parts_cost:          { code: '5200', name: 'Parts Cost',           category: 'cogs' },
  warranty_cost:       { code: '5300', name: 'Warranty Cost',        category: 'cogs' },
  // Expenses
  commission_expense:  { code: '6000', name: 'Sales Commissions',     category: 'expense' },
  advertising:         { code: '6100', name: 'Advertising',          category: 'expense' },
  payroll_expense:     { code: '6200', name: 'Payroll',              category: 'expense' },
  rent:                { code: '6300', name: 'Rent',                 category: 'expense' },
  software:            { code: '6400', name: 'Software',             category: 'expense' },
  utilities:           { code: '6500', name: 'Utilities',           category: 'expense' },
  interest:            { code: '6600', name: 'Floorplan Interest',   category: 'expense' },
}
async function resolveAccount(dealershipId, key) {
  const { data } = await supabaseAdmin.from('gl_accounts').select('id').eq('dealership_id', dealershipId).eq('system_key', key).maybeSingle()
  if (data?.id) return data.id
  const def = ACCOUNT_DEFS[key] || { code: null, name: key, category: 'expense' }
  const { data: created } = await supabaseAdmin.from('gl_accounts').insert({ dealership_id: dealershipId, system_key: key, ...def }).select('id').single()
  return created?.id || null
}

async function periodLocked(dealershipId, dateStr) {
  const period = String(dateStr).slice(0, 7)
  const { data } = await supabaseAdmin.from('accounting_periods').select('status').eq('dealership_id', dealershipId).eq('period', period).maybeSingle()
  return data?.status === 'locked'
}

// ── Journal Engine — the ONLY writer of financial postings ───────────────────
export async function postJournal(dealershipId, { source, eventName, reference, entryDate, workflowInstanceId = null, memo = null, refs = {}, lines }) {
  if (!dealershipId || !Array.isArray(lines) || !lines.length) return null
  const date = (entryDate || new Date().toISOString()).slice(0, 10)
  const totDr = round2(lines.reduce((s, l) => s + n(l.debit), 0))
  const totCr = round2(lines.reduce((s, l) => s + n(l.credit), 0))
  if (totDr !== totCr) { console.error(`[accounting-engine] REFUSED unbalanced ${eventName}: DR ${totDr} != CR ${totCr}`); return null }
  if (totDr === 0) return null
  if (await periodLocked(dealershipId, date)) { console.warn(`[accounting-engine] period locked — skip ${eventName} ${reference}`); return null }
  // Idempotent: one entry per (source, reference, event).
  if (reference) {
    const { data: dup } = await supabaseAdmin.from('journal_entries').select('id')
      .eq('dealership_id', dealershipId).eq('source', source).eq('reference', String(reference)).eq('event_name', eventName).limit(1)
    if (dup && dup.length) return dup[0].id
  }
  const { data: entry, error } = await supabaseAdmin.from('journal_entries').insert({
    dealership_id: dealershipId, entry_date: date, reference: reference ? String(reference) : null,
    source, event_name: eventName, workflow_instance_id: workflowInstanceId, memo,
  }).select('id').single()
  if (error) { console.error('[accounting-engine] entry insert failed:', error.message); return null }
  const lineRows = []
  for (const l of lines) {
    if (!n(l.debit) && !n(l.credit)) continue
    const acct = await resolveAccount(dealershipId, l.account_key)
    if (!acct) continue
    lineRows.push({ journal_entry_id: entry.id, dealership_id: dealershipId, account_id: acct, debit: round2(l.debit), credit: round2(l.credit), department: l.department || null, memo: l.desc || null, ...refs })
  }
  if (lineRows.length) await supabaseAdmin.from('journal_lines').insert(lineRows)
  return entry.id
}

// ── Rule Engine — post an event by the dealership's (or default) posting rule ─
export async function postByRule(dealershipId, eventName, ctx = {}) {
  const { data: rules } = await supabaseAdmin.from('accounting_rules').select('*')
    .eq('event_name', eventName).eq('active', true).or(`dealership_id.eq.${dealershipId},dealership_id.is.null`)
  if (!rules?.length) return null
  const rule = rules.find(r => r.dealership_id === dealershipId) || rules.find(r => !r.dealership_id)
  if (!rule) return null
  const amt = (token) => n(ctx[token])
  const lines = (rule.lines || []).map(l => ({
    account_key: l.account_key, desc: l.desc, department: l.department || null,
    debit: l.side === 'debit' ? amt(l.source) : 0, credit: l.side === 'credit' ? amt(l.source) : 0,
  })).filter(l => n(l.debit) || n(l.credit))
  if (!lines.length) return null
  return postJournal(dealershipId, {
    source: ctx.__source || eventName, eventName, reference: ctx.__reference, entryDate: ctx.__date,
    workflowInstanceId: ctx.__wf || null, refs: ctx.__refs || {}, lines,
  })
}

// ── Context builders (compute amount tokens from real records) ───────────────
async function postDealDelivered(dealershipId, dealId) {
  const deal = await getDeal(dealershipId, dealId)   // Deal Engine read API, not a raw table read
  if (!deal) return
  const settings = await getAccountingSettings(dealershipId)   // Config Engine, not a raw dealerships read
  if (!settings.autoPost) return
  const price = n(deal.selling_price)
  const fniGross = (Array.isArray(deal.fni_items) ? deal.fni_items : []).reduce((s, x) => s + n(x?.price), 0)
  const tax = n(deal.tax_amount)
  const cost = (settings.costTracking && deal.cost != null) ? n(deal.cost) : 0
  const arTotal = round2(price + fniGross + tax)
  const refs = { ref_deal_id: deal.id, ref_vehicle_id: deal.inventory_id || null, ref_contact_id: deal.contact_id || null }
  return postByRule(dealershipId, 'vehicle_delivered', {
    ar_total: arTotal, selling_price: price, fni_gross: fniGross, tax, cost,
    __source: 'deal', __reference: deal.id, __date: (deal.delivered_at || new Date().toISOString()).slice(0, 10), __refs: refs,
  })
}

async function postCommissionCalculated(dealershipId, dealId) {
  // Read the commission via the Commission Engine's published API, not deal_commissions
  // directly (kernel contract §4 — no reaching into another engine's tables).
  const { total, period } = await getCommissionResult(dealershipId, dealId)
  if (total <= 0) return null
  const date = period || new Date().toISOString().slice(0, 10)
  return postByRule(dealershipId, 'commission_calculated', {
    commission_total: total, __source: 'commission', __reference: dealId, __date: date, __refs: { ref_deal_id: dealId },
  })
}

// Map one bus event to its posting handler → returns { handler, journalId } or null
// when the event isn't a financial one. Amounts for A5 events come from the payload.
async function routeFinancialEvent(event) {
  const did = event.dealership_id
  const p = event.payload || {}
  const e = event.entity_id
  switch (event.event_name) {
    case 'deal.status_changed':
      if (event.to_state !== 'delivered') return null
      return { handler: 'vehicle_delivered', journalId: await postDealDelivered(did, e) }
    case 'commission.calculated':
      return { handler: 'commission_calculated', journalId: await postCommissionCalculated(did, p.deal_id || e) }
    case 'commission.paid':
      return { handler: 'commission_paid', journalId: await postByRule(did, 'commission_paid', { commission_total: n(p.amount), __source: 'commission_pay', __reference: p.ref || e, __date: event.created_at, __refs: { ref_deal_id: p.deal_id || null } }) }
    case 'deposit.paid': {
      const cents = n(p.amount_cents); if (cents <= 0) return null
      return { handler: 'deposit_received', journalId: await postByRule(did, 'deposit_received', { deposit_amount: round2(cents / 100), __source: 'deposit', __reference: p.payment_ref || e, __date: event.created_at, __refs: { ref_contact_id: e } }) }
    }
    case 'vehicle.acquired':
      return { handler: 'vehicle_acquired', journalId: await postByRule(did, 'vehicle_acquired', { amount: n(p.amount), __source: 'acquisition', __reference: e, __date: event.created_at, __refs: { ref_vehicle_id: e } }) }
    case 'recon.cost':
      return { handler: 'recon_cost', journalId: await postByRule(did, 'recon_cost', { amount: n(p.amount), __source: 'recon', __reference: p.ref || `${e}:${event.id}`, __date: event.created_at, __refs: { ref_vehicle_id: e, ref_vendor_id: p.vendor_id || null } }) }
    case 'trade.received':
      return { handler: 'trade_received', journalId: await postByRule(did, 'trade_received', { amount: n(p.amount), __source: 'trade', __reference: p.ref || e, __date: event.created_at, __refs: { ref_vehicle_id: p.inventory_id || null, ref_deal_id: p.deal_id || null } }) }
    case 'funding.received':
      return { handler: 'funding_received', journalId: await postByRule(did, 'funding_received', { amount: n(p.amount), __source: 'funding', __reference: p.ref || p.deal_id || e, __date: event.created_at, __refs: { ref_deal_id: p.deal_id || e } }) }
    case 'service.closed':
      return { handler: 'service_closed', journalId: await postByRule(did, 'service_closed', { revenue: n(p.revenue), cost: n(p.cost), __source: 'service', __reference: p.ro_id || e, __date: event.created_at, __refs: { ref_vehicle_id: p.inventory_id || null, ref_contact_id: p.contact_id || null } }) }
    default:
      return null
  }
}

// ── Event Listener — subscribes to the bus; routes + logs for replay ─────────
async function onFinancialEvent(event) {
  if (!event?.dealership_id || event.payload?.engine) return
  try {
    const result = await routeFinancialEvent(event)
    if (!result) return   // not a financial event
    // Record the event→journal mapping so a bug can be fixed and the event replayed.
    await supabaseAdmin.from('accounting_event_log').insert({
      dealership_id: event.dealership_id, event_id: event.id || null, event_name: event.event_name,
      processed_by: result.handler, journal_entry_id: result.journalId || null,
      status: result.journalId ? 'processed' : 'skipped',
    })
  } catch (e) {
    console.warn('[accounting-engine] listener failed:', e.message)
    try { await supabaseAdmin.from('accounting_event_log').insert({ dealership_id: event.dealership_id, event_id: event.id || null, event_name: event.event_name, status: 'error', error: String(e.message).slice(0, 500) }) } catch {}
  }
}

// ── HTTP surface — journals + trial balance (reports read from the ledger) ───
export function registerAccountingEngine(app) {
  onEvent(onFinancialEvent)   // subscribe the accounting engine to the events bus

  app.get('/accounting/journal', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: entries } = await supabaseAdmin.from('journal_entries').select('*')
      .eq('dealership_id', req.dealershipId).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
    const ids = (entries || []).map(e => e.id)
    let lines = []
    if (ids.length) { const { data } = await supabaseAdmin.from('journal_lines').select('*').in('journal_entry_id', ids); lines = data || [] }
    const byEntry = {}
    for (const l of lines) (byEntry[l.journal_entry_id] ||= []).push(l)
    res.json({ entries: (entries || []).map(e => ({ ...e, lines: byEntry[e.id] || [] })) })
  })

  // Event → journal audit log (which event produced which journal; replay history).
  app.get('/accounting/event-log', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data } = await supabaseAdmin.from('accounting_event_log').select('*')
      .eq('dealership_id', req.dealershipId).order('processed_at', { ascending: false }).limit(200)
    res.json({ log: data || [] })
  })

  // Replay a stored event → regenerate its accounting safely (postings are idempotent
  // per source+reference+event, so replaying returns the existing journal, not a dup).
  app.post('/accounting/replay/:eventId', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: event } = await supabaseAdmin.from('events').select('*')
      .eq('id', req.params.eventId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!event) return res.status(404).json({ error: 'event not found' })
    const result = await routeFinancialEvent(event)
    await supabaseAdmin.from('accounting_event_log').insert({
      dealership_id: req.dealershipId, event_id: event.id, event_name: event.event_name,
      processed_by: (result?.handler || 'replay') + ' (replay)', journal_entry_id: result?.journalId || null,
      status: result?.journalId ? 'processed' : 'skipped',
    })
    res.json({ ok: true, handler: result?.handler || null, journal_entry_id: result?.journalId || null })
  })

  // Trial balance — computed purely from journal_lines (never edited balances).
  app.get('/accounting/trial-balance', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const acc = await accountBalances(req.dealershipId, req.query)
    const rows = acc.filter(a => a.debit || a.credit)
    const totDr = round2(rows.reduce((s, r) => s + r.debit, 0))
    const totCr = round2(rows.reduce((s, r) => s + r.credit, 0))
    res.json({ rows, total_debit: totDr, total_credit: totCr, balanced: totDr === totCr })
  })

  // Dashboard cards — MTD P&L + cumulative balance-sheet positions (from journals).
  app.get('/accounting/summary', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const now = new Date()
    const from = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
    const [mtd, all] = await Promise.all([accountBalances(req.dealershipId, { from }), accountBalances(req.dealershipId, {})])
    const catCr = (rows, cat) => round2(rows.filter(a => a.category === cat).reduce((s, a) => s + (a.credit - a.debit), 0))
    const catDr = (rows, cat) => round2(rows.filter(a => a.category === cat).reduce((s, a) => s + (a.debit - a.credit), 0))
    const keyDr = (rows, key) => { const a = rows.find(x => x.system_key === key); return a ? round2(a.debit - a.credit) : 0 }
    const keyCr = (rows, key) => { const a = rows.find(x => x.system_key === key); return a ? round2(a.credit - a.debit) : 0 }
    const revenue = catCr(mtd, 'income'), cogs = catDr(mtd, 'cogs'), expense = catDr(mtd, 'expense')
    const grossProfit = round2(revenue - cogs), netIncome = round2(grossProfit - expense)
    res.json({
      month: from.slice(0, 7),
      revenue_mtd: revenue, gross_profit_mtd: grossProfit, expenses_mtd: expense, net_income_mtd: netIncome,
      cash: keyDr(all, 'cash'), accounts_receivable: keyDr(all, 'accounts_receivable'),
      accounts_payable: keyCr(all, 'accounts_payable'), inventory_value: keyDr(all, 'inventory'),
    })
  })

  // Income statement — revenue − COGS − expense (from journals, optional date range).
  app.get('/accounting/income-statement', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const acc = await accountBalances(req.dealershipId, req.query)
    const bucket = (cat) => acc.filter(a => a.category === cat)
    const creditBal = (rows) => round2(rows.reduce((s, a) => s + (a.credit - a.debit), 0))
    const debitBal = (rows) => round2(rows.reduce((s, a) => s + (a.debit - a.credit), 0))
    const revenue = creditBal(bucket('income'))
    const cogs = debitBal(bucket('cogs'))
    const expense = debitBal(bucket('expense'))
    const grossProfit = round2(revenue - cogs)
    const netIncome = round2(grossProfit - expense)
    res.json({
      revenue, cogs, gross_profit: grossProfit, expense, net_income: netIncome,
      revenue_lines: bucket('income').map(a => ({ ...a, amount: round2(a.credit - a.debit) })).filter(a => a.amount),
      cogs_lines: bucket('cogs').map(a => ({ ...a, amount: round2(a.debit - a.credit) })).filter(a => a.amount),
      expense_lines: bucket('expense').map(a => ({ ...a, amount: round2(a.debit - a.credit) })).filter(a => a.amount),
    })
  })

  // Balance sheet — assets = liabilities + equity + net income (from journals).
  app.get('/accounting/balance-sheet', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const acc = await accountBalances(req.dealershipId, {})   // balance sheet is cumulative
    const bucket = (cat) => acc.filter(a => a.category === cat)
    const debitBal = (rows) => round2(rows.reduce((s, a) => s + (a.debit - a.credit), 0))
    const creditBal = (rows) => round2(rows.reduce((s, a) => s + (a.credit - a.debit), 0))
    const assets = debitBal(bucket('asset'))
    const liabilities = creditBal(bucket('liability'))
    const equityBase = creditBal(bucket('equity'))
    const netIncome = round2(creditBal(bucket('income')) - debitBal(bucket('cogs')) - debitBal(bucket('expense')))
    const equity = round2(equityBase + netIncome)
    res.json({
      assets, liabilities, equity, net_income: netIncome,
      balanced: assets === round2(liabilities + equity),
      asset_lines: bucket('asset').map(a => ({ ...a, amount: round2(a.debit - a.credit) })).filter(a => a.amount),
      liability_lines: bucket('liability').map(a => ({ ...a, amount: round2(a.credit - a.debit) })).filter(a => a.amount),
      equity_lines: bucket('equity').map(a => ({ ...a, amount: round2(a.credit - a.debit) })).filter(a => a.amount),
    })
  })

  // ── A6 Period Close: open → manager_approved → controller_approved → closed → locked
  app.get('/accounting/periods', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const now = new Date(); const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    // Ensure the current month exists so there's always something to act on.
    await supabaseAdmin.from('accounting_periods').upsert({ dealership_id: req.dealershipId, period: cur }, { onConflict: 'dealership_id,period', ignoreDuplicates: true })
    const { data } = await supabaseAdmin.from('accounting_periods').select('*').eq('dealership_id', req.dealershipId).order('period', { ascending: false }).limit(36)
    res.json({ periods: data || [], flow: PERIOD_FLOW, current: cur })
  })

  // Advance a period one step (or lock it). Managers/admins only.
  app.post('/accounting/periods/advance', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTING'].includes(req.profile?.role)) return res.status(403).json({ error: 'Manager access required' })
    const period = String(req.body?.period || '')
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'period must be YYYY-MM' })
    const { data: row } = await supabaseAdmin.from('accounting_periods').select('*').eq('dealership_id', req.dealershipId).eq('period', period).maybeSingle()
    const cur = row?.status || 'open'
    const idx = PERIOD_FLOW.indexOf(cur)
    if (idx < 0 || idx >= PERIOD_FLOW.length - 1) return res.status(400).json({ error: `Period is already ${cur}` })
    const next = PERIOD_FLOW[idx + 1]
    const approvals = { ...(row?.approvals || {}), [next]: { by: req.user?.id || null, at: new Date().toISOString() } }
    const patch = { dealership_id: req.dealershipId, period, status: next, approvals, updated_at: new Date().toISOString() }
    if (next === 'locked') { patch.locked_at = new Date().toISOString(); patch.locked_by = req.user?.id || null }
    await supabaseAdmin.from('accounting_periods').upsert(patch, { onConflict: 'dealership_id,period' })
    res.json({ ok: true, status: next })
  })

  // ── A8 Forecast: project month-end from open deals + posted journals + pipeline.
  app.get('/accounting/forecast', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const did = req.dealershipId
    const now = new Date(); const from = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
    // Posted MTD actuals from journals
    const acc = await accountBalances(did, { from })
    const catCr = (cat) => round2(acc.filter(a => a.category === cat).reduce((s, a) => s + (a.credit - a.debit), 0))
    const catDr = (cat) => round2(acc.filter(a => a.category === cat).reduce((s, a) => s + (a.debit - a.credit), 0))
    const actualRevenue = catCr('income'), actualCogs = catDr('cogs'), actualExpense = catDr('expense')
    // Sold-but-not-delivered pipeline (expected to close this month)
    const [{ data: soldDeals }, { data: pendingComm }, { data: openDeals }] = await Promise.all([
      supabaseAdmin.from('deals').select('selling_price, cost, fni_items').eq('dealership_id', did).eq('deal_status', 'sold').limit(2000),
      supabaseAdmin.from('deal_commissions').select('total, status').eq('dealership_id', did).in('status', ['pending', 'earned']).limit(5000),
      supabaseAdmin.from('deals').select('id').eq('dealership_id', did).in('deal_status', ['working', 'pending_credit']).limit(2000),
    ])
    const expectedGross = round2((soldDeals || []).reduce((s, d) => {
      const price = n(d.selling_price), cost = n(d.cost)
      const fni = (Array.isArray(d.fni_items) ? d.fni_items : []).reduce((a, x) => a + n(x?.price), 0)
      return s + Math.max(0, price - cost) + fni
    }, 0))
    const expectedCommission = round2((pendingComm || []).reduce((s, c) => s + n(c.total), 0))
    const projectedRevenue = round2(actualRevenue + (soldDeals || []).reduce((s, d) => s + n(d.selling_price), 0))
    const projectedGross = round2((actualRevenue - actualCogs) + expectedGross)
    const projectedExpense = round2(actualExpense + expectedCommission)
    const projectedNet = round2(projectedGross - projectedExpense)
    res.json({
      month: from.slice(0, 7),
      actual: { revenue: actualRevenue, gross_profit: round2(actualRevenue - actualCogs), expense: actualExpense },
      pipeline: { sold_undelivered: (soldDeals || []).length, open_deals: (openDeals || []).length, expected_gross: expectedGross, expected_commission: expectedCommission },
      forecast: { revenue: projectedRevenue, gross_profit: projectedGross, expense: projectedExpense, payroll: expectedCommission, net_income: projectedNet },
      note: 'Projection = posted MTD actuals + sold-but-undelivered pipeline. Grows more accurate as A5 event coverage (acquisition, recon, service) fills in.',
    })
  })
}

const PERIOD_FLOW = ['open', 'manager_approved', 'controller_approved', 'closed', 'locked']

// Per-account debit/credit totals from journal_lines (optional ?from & ?to on entry_date).
async function accountBalances(dealershipId, query = {}) {
  const { data: accts } = await supabaseAdmin.from('gl_accounts').select('id, name, code, category, system_key').eq('dealership_id', dealershipId)
  // Date filter joins through journal_entries.entry_date when a range is given.
  let entryIds = null
  if (query.from || query.to) {
    let eq = supabaseAdmin.from('journal_entries').select('id').eq('dealership_id', dealershipId)
    if (query.from) eq = eq.gte('entry_date', String(query.from))
    if (query.to) eq = eq.lt('entry_date', String(query.to))
    const { data: entries } = await eq.limit(100000)
    entryIds = (entries || []).map(e => e.id)
    if (!entryIds.length) return (accts || []).map(a => ({ ...a, debit: 0, credit: 0 }))
  }
  let lq = supabaseAdmin.from('journal_lines').select('account_id, debit, credit').eq('dealership_id', dealershipId)
  if (entryIds) lq = lq.in('journal_entry_id', entryIds)
  const { data: lines } = await lq.limit(100000)
  const acc = Object.fromEntries((accts || []).map(a => [a.id, { ...a, debit: 0, credit: 0 }]))
  for (const l of lines || []) { const a = acc[l.account_id]; if (!a) continue; a.debit += n(l.debit); a.credit += n(l.credit) }
  return Object.values(acc).map(a => ({ ...a, debit: round2(a.debit), credit: round2(a.credit) }))
}
