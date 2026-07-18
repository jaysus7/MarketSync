// FNI Deals worklist. Pushed/pending deals live here until delivery. The F&I
// manager works each deal (credit app + products), hits Approve to capture the
// get-ready details — which creates the Cleanup card and emails the teams — then
// marks Delivered, which closes the deal out and drops it off the list.
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { sendEmail } from '../securityAlerts.js'

const MGR = ['DEALER_ADMIN', 'OWNER', 'MANAGER']
const isMgr = (req) => MGR.includes(req.profile?.role)
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function registerFni(app) {
  // Worklist: every deal that isn't delivered yet, newest first.
  app.get('/fni/deals', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { data: deals, error } = await supabaseAdmin.from('deals')
      .select('id, deal_number, contact_id, inventory_id, deal_status, delivery_date, delivery_time, fni_products, notes, approved_at, created_by, created_at, selling_price')
      .eq('dealership_id', req.dealershipId)
      .neq('deal_status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return res.status(500).json({ error: error.message })

    const contactIds = [...new Set((deals || []).map(d => d.contact_id).filter(Boolean))]
    const invIds = [...new Set((deals || []).map(d => d.inventory_id).filter(Boolean))]
    const repIds = [...new Set((deals || []).map(d => d.created_by).filter(Boolean))]
    const [contacts, inv, reps, dealer] = await Promise.all([
      contactIds.length ? supabaseAdmin.from('contacts').select('id, full_name, first_name, last_name').in('id', contactIds) : Promise.resolve({ data: [] }),
      invIds.length ? supabaseAdmin.from('inventory').select('id, year, make, model, trim, stocknumber').in('id', invIds) : Promise.resolve({ data: [] }),
      repIds.length ? supabaseAdmin.from('profiles').select('id, full_name, display_name').in('id', repIds) : Promise.resolve({ data: [] }),
      supabaseAdmin.from('dealerships').select('cleanup_notify_emails').eq('id', req.dealershipId).maybeSingle(),
    ])
    const cById = Object.fromEntries((contacts.data || []).map(c => [c.id, c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—']))
    const iById = Object.fromEntries((inv.data || []).map(v => [v.id, { label: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle', stock: v.stocknumber }]))
    const rById = Object.fromEntries((reps.data || []).map(r => [r.id, r.display_name || r.full_name || '—']))

    const rows = (deals || []).map(d => ({
      id: d.id, deal_number: d.deal_number || null, deal_status: d.deal_status || null,
      customer: d.contact_id ? (cById[d.contact_id] || '—') : '—',
      vehicle: d.inventory_id ? (iById[d.inventory_id]?.label || 'Vehicle') : 'Vehicle',
      stocknumber: d.inventory_id ? (iById[d.inventory_id]?.stock || null) : null,
      salesperson: d.created_by ? (rById[d.created_by] || null) : null,
      delivery_date: d.delivery_date || null, delivery_time: d.delivery_time || null,
      fni_products: d.fni_products || null, notes: d.notes || null,
      approved_at: d.approved_at || null, selling_price: d.selling_price || null,
      contact_id: d.contact_id || null, inventory_id: d.inventory_id || null,
    }))
    res.json({ deals: rows, cleanup_notify_emails: dealer.data?.cleanup_notify_emails || '' })
  })

  // Approve → save get-ready details, create/refresh the Cleanup card, email teams.
  app.post('/fni/deals/:id/approve', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const b = req.body || {}
    const { data: deal } = await supabaseAdmin.from('deals')
      .select('id, inventory_id, contact_id, created_by, deal_number')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!deal) return res.status(404).json({ error: 'Deal not found' })

    const now = new Date().toISOString()
    const delivery_date = b.delivery_date || null
    const delivery_time = b.delivery_time || null
    const fni_products = typeof b.fni_products === 'string' ? b.fni_products.slice(0, 2000) : null
    const notes = typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null

    await supabaseAdmin.from('deals')
      .update({ delivery_date, delivery_time, fni_products, notes, approved_at: now, updated_at: now })
      .eq('id', deal.id).eq('dealership_id', req.dealershipId)

    // Combine date + time into the Cleanup card's delivery timestamp.
    let delivery_at = null
    if (delivery_date) { const d = new Date(`${delivery_date}T${delivery_time || '09:00'}`); if (!isNaN(d)) delivery_at = d.toISOString() }

    // Create or refresh the Cleanup (recon) card for the vehicle.
    if (deal.inventory_id) {
      const patch = {
        delivery_at, salesperson_id: deal.created_by || null, fni_products, notes, deal_id: deal.id, updated_at: now,
      }
      const { data: existing } = await supabaseAdmin.from('recon')
        .select('id').eq('inventory_id', deal.inventory_id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (existing) {
        await supabaseAdmin.from('recon').update(patch).eq('id', existing.id)
      } else {
        await supabaseAdmin.from('recon').insert({
          dealership_id: req.dealershipId, inventory_id: deal.inventory_id,
          stage: 'arrived', started_at: now, stage_since: now, checklist: [], ...patch,
        })
      }
    }

    // Best-effort notification email to managers + salesperson + cleanup/service.
    sendGetReadyEmails(req.dealershipId, deal, { delivery_date, delivery_time, fni_products, notes })
      .catch(e => console.warn('[fni] get-ready email failed:', e.message))

    res.json({ ok: true, approved_at: now })
  })

  // Delivered → deal delivered, vehicle sold, customer marked delivered; off the list.
  app.post('/fni/deals/:id/delivered', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { data: deal } = await supabaseAdmin.from('deals')
      .select('id, inventory_id, contact_id').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!deal) return res.status(404).json({ error: 'Deal not found' })
    const now = new Date().toISOString()
    await supabaseAdmin.from('deals').update({ deal_status: 'delivered', delivered_at: now, updated_at: now })
      .eq('id', deal.id).eq('dealership_id', req.dealershipId)
    if (deal.inventory_id) await supabaseAdmin.from('inventory').update({ status: 'sold', sold_at: now })
      .eq('id', deal.inventory_id).eq('dealership_id', req.dealershipId)
    if (deal.contact_id) await supabaseAdmin.from('contacts').update({ status: 'delivered', updated_at: now })
      .eq('id', deal.contact_id).eq('dealership_id', req.dealershipId)
    res.json({ ok: true })
  })

  // Cleanup/service notification recipients (external addresses, comma/newline sep).
  app.put('/fni/settings', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership associated' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const emails = typeof req.body?.cleanup_notify_emails === 'string' ? req.body.cleanup_notify_emails.slice(0, 1000) : ''
    const { error } = await supabaseAdmin.from('dealerships').update({ cleanup_notify_emails: emails }).eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })
}

// Email the get-ready request to managers + the salesperson + the configured
// cleanup/service addresses. Staff emails come from profiles.business_email.
async function sendGetReadyEmails(dealershipId, deal, info) {
  const { data: dealer } = await supabaseAdmin.from('dealerships')
    .select('name, cleanup_notify_emails').eq('id', dealershipId).maybeSingle()
  const { data: mgrs } = await supabaseAdmin.from('profiles')
    .select('business_email').eq('dealership_id', dealershipId).in('role', MGR)
  const recips = new Set()
  for (const m of (mgrs || [])) if (m.business_email) recips.add(m.business_email.trim())
  if (deal.created_by) {
    const { data: sp } = await supabaseAdmin.from('profiles').select('business_email').eq('id', deal.created_by).maybeSingle()
    if (sp?.business_email) recips.add(sp.business_email.trim())
  }
  for (const e of String(dealer?.cleanup_notify_emails || '').split(/[,\n;]+/).map(s => s.trim()).filter(Boolean)) recips.add(e)
  if (!recips.size) return

  let vehLabel = 'Vehicle', custLabel = ''
  if (deal.inventory_id) {
    const { data: v } = await supabaseAdmin.from('inventory').select('year, make, model, trim, stocknumber').eq('id', deal.inventory_id).maybeSingle()
    if (v) vehLabel = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') + (v.stocknumber ? ` (#${v.stocknumber})` : '')
  }
  if (deal.contact_id) {
    const { data: c } = await supabaseAdmin.from('contacts').select('full_name').eq('id', deal.contact_id).maybeSingle()
    custLabel = c?.full_name || ''
  }
  const when = info.delivery_date ? `${info.delivery_date}${info.delivery_time ? ' at ' + info.delivery_time : ''}` : 'TBD'
  const subject = `Get ready: ${vehLabel} — delivery ${when}`
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
    <h2 style="margin:0 0 10px">Get-ready request</h2>
    <p style="margin:0 0 10px"><b>Vehicle:</b> ${esc(vehLabel)}<br>
    ${custLabel ? `<b>Customer:</b> ${esc(custLabel)}<br>` : ''}
    <b>Delivery:</b> ${esc(when)}<br>
    ${deal.deal_number ? `<b>Deal #:</b> ${esc(String(deal.deal_number))}<br>` : ''}</p>
    ${info.fni_products ? `<p style="margin:0 0 10px"><b>F&amp;I products to install:</b><br>${esc(info.fni_products).replace(/\n/g, '<br>')}</p>` : ''}
    ${info.notes ? `<p style="margin:0 0 10px"><b>Special notes:</b><br>${esc(info.notes).replace(/\n/g, '<br>')}</p>` : ''}
    <p style="color:#666;font-size:12px;margin-top:16px">${esc(dealer?.name || 'Dealership')} · sent by MarketSync</p>
  </div>`
  const text = `Get-ready request\nVehicle: ${vehLabel}\n${custLabel ? 'Customer: ' + custLabel + '\n' : ''}Delivery: ${when}\n${deal.deal_number ? 'Deal #: ' + deal.deal_number + '\n' : ''}${info.fni_products ? 'F&I products: ' + info.fni_products + '\n' : ''}${info.notes ? 'Notes: ' + info.notes + '\n' : ''}`
  await sendEmail({ to: [...recips].join(','), subject, html, text })
}
