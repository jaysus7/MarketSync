/**
 * Payments — a DealerOS CORE primitive, not a department feature.
 *
 * One durable record of money received, and a separate record of where it was applied.
 * Service, Sales, F&I and Accounting all use these; none of them owns them. A payment
 * can be split across obligations, partially applied, or left entirely unapplied — and
 * an unapplied payment IS a customer deposit, which is why there is no deposits table.
 *
 * THE ACCOUNTING INVARIANT, stated once:
 *   the INVOICE creates revenue, tax and AR.  A PAYMENT only moves AR into cash.
 * Cash arriving never recognises revenue or tax a second time.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { emitEvent } from './events.js'
import { audit } from '../audit.js'

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((Number(x) || 0) * 100) / 100

export async function getPayment(dealershipId, id) {
  const { data } = await supabaseAdmin.from('payments').select('*').eq('id', id).eq('dealership_id', dealershipId).maybeSingle()
  if (!data) return null
  const { data: allocs } = await supabaseAdmin.from('payment_allocations').select('*').eq('payment_id', id).order('created_at')
  return { ...data, allocations: allocs || [] }
}

export async function allocatedTotal(paymentId) {
  const { data } = await supabaseAdmin.from('payment_allocations').select('amount').eq('payment_id', paymentId)
  return round2((data || []).reduce((s, a) => s + n(a.amount), 0))
}

// What has been paid against one obligation — the read Service uses for a balance.
export async function paymentsForSubject(dealershipId, subjectType, subjectId) {
  const { data: allocs } = await supabaseAdmin.from('payment_allocations').select('*')
    .eq('dealership_id', dealershipId).eq('subject_type', subjectType).eq('subject_id', subjectId).order('created_at')
  const ids = [...new Set((allocs || []).map(a => a.payment_id))]
  let pays = []
  if (ids.length) {
    const { data } = await supabaseAdmin.from('payments').select('*').in('id', ids).eq('dealership_id', dealershipId)
    pays = data || []
  }
  const byId = Object.fromEntries(pays.map(p => [p.id, p]))
  // Only money that actually arrived counts toward a balance.
  const settled = (allocs || []).filter(a => ['received', 'partially_refunded'].includes(byId[a.payment_id]?.status))
  return {
    paid: round2(settled.reduce((s, a) => s + n(a.amount), 0)),
    allocations: allocs || [],
    payments: pays.map(p => ({
      id: p.id, amount: n(p.amount), method: p.method, status: p.status,
      processor: p.processor, received_at: p.received_at, refunded_amount: n(p.refunded_amount),
    })),
  }
}

async function findExistingPayment(dealershipId, { processor, processorReference, idempotencyKey }) {
  if (processorReference) {
    const { data } = await supabaseAdmin.from('payments').select('*')
      .eq('dealership_id', dealershipId).eq('processor', processor).eq('processor_reference', processorReference).maybeSingle()
    if (data) return data
  }
  if (idempotencyKey) {
    const { data } = await supabaseAdmin.from('payments').select('*')
      .eq('dealership_id', dealershipId).eq('idempotency_key', idempotencyKey).maybeSingle()
    if (data) return data
  }
  return null
}

// Record money that arrived. Idempotent twice over: the caller's key and the provider's
// reference are both unique in the database, so a webhook retry re-reads instead of
// creating a second payment.
export async function recordPayment(dealershipId, {
  amount, method = 'card', contactId = null, processor = null, processorReference = null,
  status = 'received', idempotencyKey = null, metadata = null, receivedAt = null, userId = null,
} = {}) {
  if (n(amount) <= 0) throw new Error('a payment amount is required')
  const existing = await findExistingPayment(dealershipId, { processor, processorReference, idempotencyKey })
  if (existing) return { payment: existing, created: false }

  const { data, error } = await supabaseAdmin.from('payments').insert({
    dealership_id: dealershipId, contact_id: contactId, amount: round2(n(amount)), method,
    status, processor, processor_reference: processorReference, idempotency_key: idempotencyKey,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    received_at: status === 'received' ? (receivedAt || new Date().toISOString()) : null,
    created_by: userId,
  }).select('*').single()
  if (!error) return { payment: data, created: true }

  // Lost the uniqueness race — the other writer's payment is the canonical one.
  const raced = await findExistingPayment(dealershipId, { processor, processorReference, idempotencyKey })
  if (raced) return { payment: raced, created: false }
  throw new Error(error.message)
}

// Apply money to an obligation. The database refuses to allocate more than arrived.
export async function allocatePayment(dealershipId, paymentId, { subjectType, subjectId, amount, note = null, userId = null } = {}) {
  const { data, error } = await supabaseAdmin.from('payment_allocations').insert({
    dealership_id: dealershipId, payment_id: paymentId, subject_type: subjectType,
    subject_id: subjectId, amount: round2(n(amount)), note, created_by: userId,
  }).select('*').single()
  if (error) throw new Error(error.message)
  return data
}

// The ONE financial event for customer money. Emitted after the payment is durable, and
// carrying the applied/unapplied split so Accounting credits AR for what settles an
// invoice and customer_deposits for what does not — without ever touching revenue.
export async function publishPaymentReceived(dealershipId, paymentId, { userId = null } = {}) {
  const pay = await getPayment(dealershipId, paymentId)
  if (!pay || pay.status !== 'received') return null
  const applied = await allocatedTotal(paymentId)
  const unapplied = round2(n(pay.amount) - applied)
  emitEvent({
    dealershipId, eventName: 'payment.received', entityType: 'payment', entityId: paymentId,
    summary: `Payment received — $${n(pay.amount).toFixed(2)}`, department: 'Accounting', createdBy: userId,
    payload: {
      payment_id: paymentId, amount: n(pay.amount), applied, unapplied,
      contact_id: pay.contact_id || null, method: pay.method,
      ref: paymentId,                    // the posting reference — a replay posts once
    },
  })
  return { amount: n(pay.amount), applied, unapplied }
}

export function registerPayments(app) {
  const canView = requirePermission('accounting.view')
  const canTake = requirePermission('deal.create')      // taking money is front-of-house work

  app.get('/payments/for/:subjectType/:subjectId', requireAuth, canView, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    res.json(await paymentsForSubject(req.dealershipId, req.params.subjectType, req.params.subjectId))
  })

  app.get('/payments/:id', requireAuth, canView, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const payment = await getPayment(req.dealershipId, req.params.id)
    if (!payment) return res.status(404).json({ error: 'not found' })
    res.json({ payment })
  })

  app.post('/payments', requireAuth, canTake, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    try {
      const b = req.body || {}
      const { payment, created } = await recordPayment(req.dealershipId, {
        amount: b.amount, method: b.method, contactId: b.contact_id || null,
        processor: b.processor || null, processorReference: b.processor_reference || null,
        idempotencyKey: b.idempotency_key || null, metadata: b.metadata || null,
        userId: req.user?.id || null,
      })
      if (created && b.subject_type && b.subject_id) {
        await allocatePayment(req.dealershipId, payment.id, {
          subjectType: b.subject_type, subjectId: b.subject_id,
          amount: b.allocate_amount ?? b.amount, userId: req.user?.id || null,
        })
      }
      // A retry emits nothing: the payment already existed, so the money already posted.
      if (created) {
        await publishPaymentReceived(req.dealershipId, payment.id, { userId: req.user?.id || null })
        audit(req, 'payment.recorded', { after_state: { id: payment.id, amount: payment.amount, method: payment.method } })
      }
      res.json({ ok: true, created, payment: await getPayment(req.dealershipId, payment.id) })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })

  app.post('/payments/:id/allocate', requireAuth, canTake, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    try {
      const b = req.body || {}
      const allocation = await allocatePayment(req.dealershipId, req.params.id, {
        subjectType: b.subject_type, subjectId: b.subject_id, amount: b.amount,
        note: b.note || null, userId: req.user?.id || null,
      })
      audit(req, 'payment.allocated', { after_state: allocation })
      res.json({ ok: true, allocation })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })
}
