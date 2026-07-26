/**
 * Delivery department — the Sold Vehicle Queue. Deals that are sold but not yet
 * delivered, each with a prep checklist (PDI, detail, plates, documents, customer
 * notified). Marking delivered emits the kernel deal.status_changed:delivered event,
 * so the Accounting Engine posts the journal, the Commission Engine calculates, and
 * the Integration Engine syncs — the same spine every other delivery path uses.
 * This is the workflow engine made visible.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { emitEvent } from './events.js'

const CHECKLIST = [
  { key: 'pdi', label: 'PDI complete' },
  { key: 'detail', label: 'Detailed / cleaned' },
  { key: 'plates', label: 'Plates & registration' },
  { key: 'documents', label: 'Documents signed' },
  { key: 'customer_notified', label: 'Customer notified' },
]
const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'].includes(req.profile?.role)

export function registerDelivery(app) {
  // The queue: sold-but-not-delivered deals + their checklist + who/what.
  app.get('/delivery/queue', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data: deals } = await supabaseAdmin.from('deals')
      .select('id, deal_number, contact_id, inventory_id, deal_status, delivery_checklist, delivery_date, updated_at')
      .eq('dealership_id', req.dealershipId).eq('deal_status', 'sold')
      .order('updated_at', { ascending: true }).limit(200)
    const rows = deals || []
    const contactIds = [...new Set(rows.map(d => d.contact_id).filter(Boolean))]
    const invIds = [...new Set(rows.map(d => d.inventory_id).filter(Boolean))]
    const [{ data: contacts }, { data: inv }] = await Promise.all([
      contactIds.length ? supabaseAdmin.from('contacts').select('id, full_name, first_name, last_name, phone, phone_mobile').in('id', contactIds) : Promise.resolve({ data: [] }),
      invIds.length ? supabaseAdmin.from('inventory').select('id, year, make, model, trim, stocknumber, vin').in('id', invIds) : Promise.resolve({ data: [] }),
    ])
    const cById = Object.fromEntries((contacts || []).map(c => [c.id, c]))
    const vById = Object.fromEntries((inv || []).map(v => [v.id, v]))
    const queue = rows.map(d => {
      const c = cById[d.contact_id] || {}
      const v = vById[d.inventory_id] || {}
      const cl = (d.delivery_checklist && typeof d.delivery_checklist === 'object') ? d.delivery_checklist : {}
      const checklist = CHECKLIST.map(item => ({ ...item, done: !!cl[item.key] }))
      return {
        id: d.id, deal_number: d.deal_number || null,
        customer: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer',
        phone: c.phone || c.phone_mobile || null,
        vehicle: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || (v.vin ? 'VIN ' + v.vin : '—'),
        stock: v.stocknumber || null,
        delivery_date: d.delivery_date || null,
        checklist, ready: checklist.every(i => i.done),
      }
    })
    res.json({ items: CHECKLIST, queue })
  })

  // Toggle one checklist item.
  app.post('/delivery/:id/checklist', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const key = String(req.body?.key || '')
    if (!CHECKLIST.some(i => i.key === key)) return res.status(400).json({ error: 'unknown checklist item' })
    const { data: deal } = await supabaseAdmin.from('deals').select('delivery_checklist').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!deal) return res.status(404).json({ error: 'not found' })
    const cl = (deal.delivery_checklist && typeof deal.delivery_checklist === 'object') ? { ...deal.delivery_checklist } : {}
    cl[key] = !!req.body?.done
    const { error } = await supabaseAdmin.from('deals').update({ delivery_checklist: cl, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true, checklist: cl })
  })

  // Complete delivery → the kernel event drives accounting + commission + sync.
  app.post('/delivery/:id/deliver', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { data: deal } = await supabaseAdmin.from('deals').select('id, deal_status, contact_id, inventory_id').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!deal) return res.status(404).json({ error: 'not found' })
    if (deal.deal_status === 'delivered') return res.json({ ok: true, already: true })
    const now = new Date().toISOString()
    await supabaseAdmin.from('deals').update({ deal_status: 'delivered', delivered_at: now, updated_at: now }).eq('id', deal.id).eq('dealership_id', req.dealershipId)
    if (deal.inventory_id) await supabaseAdmin.from('inventory').update({ status: 'sold', sold_at: now }).eq('id', deal.inventory_id).eq('dealership_id', req.dealershipId)
    if (deal.contact_id) await supabaseAdmin.from('contacts').update({ status: 'delivered', updated_at: now }).eq('id', deal.contact_id).eq('dealership_id', req.dealershipId)
    emitEvent({
      dealershipId: req.dealershipId, eventName: 'deal.status_changed', entityType: 'deal', entityId: deal.id,
      summary: 'Deal delivered', toState: 'delivered', department: 'Delivery', createdBy: req.user?.id || null,
      payload: { contact_id: deal.contact_id || null, inventory_id: deal.inventory_id || null, action: 'delivery_queue' },
    })
    res.json({ ok: true })
  })
}
