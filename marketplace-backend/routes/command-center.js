/**
 * Command Center / Dealer Management Workspace — the executive DealerOS home.
 *
 * Composes canonical operational state across all engines into:
 * - /command-center & /management/summary: Executive throughput & performance tiles
 * - /management/exceptions: Multi-department exception queue
 * - /management/approvals: Centralized approval registry for GM/Controller sign-off
 *
 * Pure composition API (kernel contract §4) that respects tenant isolation and RBAC.
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
  const canView = requirePermission('accounting.view')

  // ── 1. Legacy & Unified Command Summary ────────────────────────────────────
  const handleSummary = async (req, res) => {
    const did = req.dealershipId
    if (!did) return res.status(403).json({ error: 'no dealership' })
    const today = startOfToday()
    const [leadsWaiting, dealsInProgress, deliveriesToday, reconDelays, serviceBottlenecks, exRes, citRes] = await Promise.all([
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
      // Active exceptions
      supabaseAdmin.from('exceptions').select('*').eq('dealership_id', did).neq('status', 'resolved').order('created_at', { ascending: false }).limit(200),
      // Contracts in Transit total balance
      supabaseAdmin.from('journal_lines').select('debit, credit, accounts!inner(code, dealership_id)').eq('accounts.dealership_id', did).eq('accounts.code', '1150').limit(500),
    ])

    const exceptions = exRes.data || []
    const byDept = {}
    for (const x of exceptions) { const d = x.department || 'Other'; byDept[d] = (byDept[d] || 0) + 1 }

    let citBalance = 0
    if (citRes.data) {
      for (const l of citRes.data) {
        citBalance += (Number(l.debit) || 0) - (Number(l.credit) || 0)
      }
    }

    res.json({
      tiles: {
        leads_waiting: leadsWaiting,
        deals_in_progress: dealsInProgress,
        deliveries_today: deliveriesToday,
        recon_delays: reconDelays,
        service_bottlenecks: serviceBottlenecks,
        contracts_in_transit_balance: Math.round(citBalance * 100) / 100,
      },
      exceptions,
      exceptions_by_department: byDept,
      exception_count: exceptions.length,
    })
  }

  app.get('/command-center', requireAuth, requireMfa, canView, handleSummary)
  app.get('/command-center/summary', requireAuth, requireMfa, canView, handleSummary)
  app.get('/management/summary', requireAuth, requireMfa, canView, handleSummary)

  // ── 2. Multi-Department Exceptions Queue ───────────────────────────────────
  const handleExceptions = async (req, res) => {
    const did = req.dealershipId
    if (!did) return res.status(403).json({ error: 'no dealership' })

    const { data: exceptions, error } = await supabaseAdmin
      .from('exceptions')
      .select('*')
      .eq('dealership_id', did)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) return res.status(500).json({ error: error.message })

    const list = exceptions || []
    const byDept = {}
    let highCount = 0

    for (const ex of list) {
      const d = ex.department || 'General'
      if (!byDept[d]) byDept[d] = []
      byDept[d].push(ex)
      if (Number(ex.severity) >= 3 || ex.priority === 'critical') highCount++
    }

    res.json({
      exceptions: list,
      by_department: byDept,
      total: list.length,
      high_severity_count: highCount,
    })
  }

  app.get('/command-center/exceptions', requireAuth, requireMfa, canView, handleExceptions)
  app.get('/management/exceptions', requireAuth, requireMfa, canView, handleExceptions)

  // ── 3. Centralized Executive Approvals Queue ────────────────────────────────
  const handleApprovals = async (req, res) => {
    const did = req.dealershipId
    if (!did) return res.status(403).json({ error: 'no dealership' })

    const [identities, deals, campaigns, expenses] = await Promise.all([
      // Identity verifications requiring manual review
      supabaseAdmin.from('identity_verifications')
        .select('id, contact_id, decision, machine_decision, provider, created_at, last_error, contacts(full_name, email, phone)')
        .eq('dealership_id', did).eq('decision', 'manual_review').limit(50),
      // Deals requiring manager approval (e.g. discount exceptions or pending approval flag)
      supabaseAdmin.from('deals')
        .select('id, deal_number, selling_price, deal_status, created_at, contacts(full_name)')
        .eq('dealership_id', did).eq('deal_status', 'pending_approval').limit(50),
      // Campaigns awaiting approval
      supabaseAdmin.from('campaigns')
        .select('id, name, budget, channel, status, created_at')
        .eq('dealership_id', did).eq('status', 'approval_required').limit(50),
      // AP expenses pending approval
      supabaseAdmin.from('expenses')
        .select('id, description, amount, vendor_name, category, created_at')
        .eq('dealership_id', did).eq('status', 'pending').limit(50),
    ])

    const approvals = [
      ...(identities.data || []).map(i => ({
        type: 'identity_verification',
        id: i.id,
        title: `Identity Manual Review — ${i.contacts?.full_name || 'Customer'}`,
        subject: i.contacts?.full_name || 'Customer',
        reason: i.last_error || 'Provider flagged for manual review',
        department: 'Management',
        action_route: `/identity/review`,
        created_at: i.created_at,
      })),
      ...(deals.data || []).map(d => ({
        type: 'deal_approval',
        id: d.id,
        title: `Deal Approval — #${d.deal_number || d.id}`,
        subject: d.contacts?.full_name || `Deal #${d.deal_number}`,
        amount: d.selling_price,
        department: 'Sales',
        action_route: `/fni/deals/${d.id}`,
        created_at: d.created_at,
      })),
      ...(campaigns.data || []).map(c => ({
        type: 'campaign_approval',
        id: c.id,
        title: `Campaign Budget Sign-off — ${c.name}`,
        subject: c.name,
        amount: c.budget,
        department: 'Marketing',
        action_route: `/campaigns/${c.id}`,
        created_at: c.created_at,
      })),
      ...(expenses.data || []).map(e => ({
        type: 'expense_approval',
        id: e.id,
        title: `AP Invoice Approval — ${e.vendor_name || e.description}`,
        subject: e.vendor_name || e.description,
        amount: e.amount,
        department: 'Accounting',
        action_route: `/expenses/${e.id}`,
        created_at: e.created_at,
      })),
    ]

    res.json({
      approvals,
      total: approvals.length,
      by_type: {
        identity: (identities.data || []).length,
        deals: (deals.data || []).length,
        campaigns: (campaigns.data || []).length,
        expenses: (expenses.data || []).length,
      },
    })
  }

  app.get('/command-center/approvals', requireAuth, requireMfa, canView, handleApprovals)
  app.get('/management/approvals', requireAuth, requireMfa, canView, handleApprovals)
}
