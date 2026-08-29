/**
 * MarketSync HQ — Staff & Affiliate Commission Engine.
 *
 * Implements versioned commission plans, calculations, approvals, and double-entry payouts.
 */
import { supabaseAdmin } from '../shared.js'
import { logHqAudit } from '../hq-audit.js'
import { postHqJournal } from './hqFinanceService.js'

export async function calculateStaffCommission({
  staffId,
  opportunityId = null,
  companyId = null,
  dealValue = 0,
  mrrValue = 0,
  product = 'dealer_os_pro',
  planId = null,
}) {
  // 1. Fetch active commission plan
  let plan = null
  if (planId) {
    const { data } = await supabaseAdmin.from('hq_commission_plans').select('*').eq('id', planId).maybeSingle()
    plan = data
  }
  if (!plan) {
    const { data } = await supabaseAdmin
      .from('hq_commission_plans')
      .select('*')
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    plan = data
  }

  const rules = plan?.rules || [
    { product: 'dealer_os_pro', type: 'percentage', rate: 10, mrrMultiple: 1.0 },
    { product: 'dealer_os_complete', type: 'percentage', rate: 15, mrrMultiple: 1.0 },
    { product: 'default', type: 'percentage', rate: 10, mrrMultiple: 0.5 },
  ]

  const matchedRule = rules.find(r => r.product === product) || rules.find(r => r.product === 'default') || { rate: 10 }
  let commissionAmount = 0

  if (matchedRule.type === 'flat') {
    commissionAmount = Number(matchedRule.amount) || 250
  } else {
    const baseValue = Number(mrrValue) > 0 ? Number(mrrValue) * (matchedRule.mrrMultiple || 1) : Number(dealValue)
    commissionAmount = Math.round(baseValue * (Number(matchedRule.rate || 10) / 100) * 100) / 100
  }

  // 2. Insert Accrued Commission Record
  const { data: commission, error } = await supabaseAdmin.from('hq_staff_commissions').insert({
    staff_id: staffId,
    opportunity_id: opportunityId || null,
    company_id: companyId || null,
    plan_id: plan?.id || null,
    plan_version: plan?.version || 1,
    deal_value: Number(dealValue) || 0,
    commission_amount: commissionAmount,
    status: 'accrued',
    accrued_date: new Date().toISOString().slice(0, 10),
  }).select('*').single()

  if (error) throw error

  // 3. Post Accrual to Ledger: Debit Staff Commission Expense (6100), Credit Staff Commission Payable (2400)
  if (commissionAmount > 0) {
    await postHqJournal({
      entryDate: new Date().toISOString().slice(0, 10),
      source: 'staff_commission_payout',
      sourceId: commission.id,
      description: `Staff Commission Accrual: Opp #${opportunityId || 'direct'}`,
      lines: [
        { accountCode: '6100', description: 'Staff Sales Commission Expense', debit: commissionAmount, credit: 0 },
        { accountCode: '2400', description: 'Staff Commission Payable', debit: 0, credit: commissionAmount },
      ],
      actorName: 'Commission Engine',
    }).catch(e => console.warn('[hq-commission] Accrual ledger posting note:', e.message))
  }

  return commission
}

export async function approveStaffCommission({ commissionId, actorId = null, actorName = 'HQ Operator' }) {
  const { data: comm, error } = await supabaseAdmin.from('hq_staff_commissions').update({
    status: 'approved',
    approved_by: actorId || null,
  }).eq('id', commissionId).select('*').single()

  if (error) throw error

  await logHqAudit({
    entityType: 'hq_staff_commission',
    entityId: commissionId,
    action: 'commission_approved',
    afterState: { id: commissionId, status: 'approved', amount: comm.commission_amount },
    actorId,
    actorName,
    reason: 'Commission approved for payout',
  })

  return comm
}

export async function processCommissionPayout({
  recipientType = 'staff', // 'staff' | 'affiliate'
  recipientId,
  recipientName,
  commissionIds = [],
  payoutMethod = 'direct_deposit',
  payoutReference = null,
  actorId = null,
  actorName = 'HQ Operator',
}) {
  if (!commissionIds.length) throw new Error('At least one commission must be selected for payout')

  // Calculate total amount
  let totalAmount = 0
  if (recipientType === 'staff') {
    const { data: comms } = await supabaseAdmin.from('hq_staff_commissions').select('id, commission_amount').in('id', commissionIds)
    totalAmount = (comms || []).reduce((sum, c) => sum + Number(c.commission_amount || 0), 0)
  } else {
    const { data: comms } = await supabaseAdmin.from('affiliate_commissions').select('id, amount').in('id', commissionIds)
    totalAmount = (comms || []).reduce((sum, c) => sum + Number(c.amount || 0), 0)
  }

  totalAmount = Math.round(totalAmount * 100) / 100
  if (totalAmount <= 0) throw new Error('Total payout amount must be greater than zero')

  const payableAccount = recipientType === 'staff' ? '2400' : '2300'

  // Post Payout to Ledger: Debit Commission Payable, Credit Cash / Bank
  const journal = await postHqJournal({
    entryDate: new Date().toISOString().slice(0, 10),
    source: recipientType === 'staff' ? 'staff_commission_payout' : 'affiliate_payout',
    description: `${recipientType.toUpperCase()} Commission Payout to ${recipientName}`,
    lines: [
      { accountCode: payableAccount, description: `Relieve ${recipientType} commission payable`, debit: totalAmount, credit: 0 },
      { accountCode: '1000', description: 'Operating Bank checking account', debit: 0, credit: totalAmount },
    ],
    actorId,
    actorName,
  })

  // Create Payout Record
  const { data: payout, error: pErr } = await supabaseAdmin.from('hq_payouts').insert({
    recipient_type: recipientType,
    recipient_id: String(recipientId),
    recipient_name: recipientName,
    amount: totalAmount,
    payout_method: payoutMethod,
    payout_reference: payoutReference,
    journal_entry_id: journal.journalEntryId,
    status: 'completed',
    paid_by: actorId || null,
  }).select('*').single()

  if (pErr) throw pErr

  // Update commissions to 'paid'
  if (recipientType === 'staff') {
    await supabaseAdmin.from('hq_staff_commissions').update({
      status: 'paid',
      payout_id: payout.id,
    }).in('id', commissionIds)
  }

  return {
    success: true,
    payout,
    journal,
  }
}
