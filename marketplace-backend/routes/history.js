/**
 * Vehicle history — Carfax deep-link + stored reports (VHR / lien / valuation).
 * Reports stay on the VIN and follow every customer who owned or owns the vehicle.
 */
import multer from 'multer'
import { supabaseAdmin } from '../shared.js'
import { randomBytes } from 'crypto'
import { requireAuth } from '../middleware.js'
import { carfaxDeepLink } from '../providers/history.js'
import { audit } from '../audit.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } })
const str = (v) => { const s = (v == null ? '' : String(v)).trim(); return s || null }
const REPORT_TYPES = ['vhr', 'lien', 'valuation', 'other']

async function ownersForVehicle(dealershipId, { inventory_id, vin }) {
  const owners = []
  const seen = new Set()
  const add = (row) => {
    if (!row || !row.contact_id || seen.has(row.contact_id)) return
    seen.add(row.contact_id)
    owners.push(row)
  }
  if (inventory_id) {
    const { data: deals } = await supabaseAdmin.from('deals')
      .select('id, contact_id, status, created_at, delivered_at')
      .eq('dealership_id', dealershipId).eq('inventory_id', inventory_id).limit(50)
    ;(deals || []).forEach((deal) => add({
      contact_id: deal.contact_id,
      deal_id: deal.id,
      status: deal.status,
      current: !['delivered', 'unwound', 'lost'].includes(String(deal.status || '').toLowerCase()),
    }))
    const { data: contacts } = await supabaseAdmin.from('contacts')
      .select('id, first_name, last_name, interest_inventory_id, stage')
      .eq('dealership_id', dealershipId).eq('interest_inventory_id', inventory_id).limit(50)
    ;(contacts || []).forEach((c) => add({
      contact_id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(' '),
      status: c.stage,
      current: String(c.stage || '').toLowerCase() !== 'delivered',
    }))
  }
  if (vin) {
    const { data: byVin } = await supabaseAdmin.from('vehicle_history_reports')
      .select('contact_id, deal_id').eq('dealership_id', dealershipId).ilike('vin', vin).not('contact_id', 'is', null).limit(50)
    ;(byVin || []).forEach((row) => add({ contact_id: row.contact_id, deal_id: row.deal_id, status: 'history', current: false }))
  }
  if (owners.length) {
    const ids = owners.map((o) => o.contact_id)
    const { data: people } = await supabaseAdmin.from('contacts')
      .select('id, first_name, last_name, phone, email, stage')
      .eq('dealership_id', dealershipId).in('id', ids)
    const map = Object.fromEntries((people || []).map((p) => [p.id, p]))
    owners.forEach((o) => {
      const p = map[o.contact_id]
      if (p) o.name = [p.first_name, p.last_name].filter(Boolean).join(' ') || o.name
      if (p) o.stage = p.stage
    })
  }
  return owners
}

export function registerHistory(app) {
  app.get('/history/link', requireAuth, async (req, res) => {
    const vin = str(req.query.vin)
    const country = String(req.query.country || 'CA').toUpperCase() === 'US' ? 'US' : 'CA'
    res.json({ ok: true, url: carfaxDeepLink(vin, country) })
  })

  app.get('/history', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ reports: [], owners: [] })
    const inv = str(req.query.inventory_id), vin = str(req.query.vin), contact = str(req.query.contact_id), deal = str(req.query.deal_id)
    if (!inv && !vin && !contact && !deal) return res.json({ reports: [], owners: [] })

    let q = supabaseAdmin.from('vehicle_history_reports')
      .select('id, vin, provider, report_type, external_url, file_url, summary, pulled_by, created_at, inventory_id, contact_id, deal_id')
      .eq('dealership_id', req.dealershipId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(80)

    const filters = []
    if (inv) filters.push(`inventory_id.eq.${inv}`)
    if (vin) filters.push(`vin.ilike.${vin}`)
    if (contact) filters.push(`contact_id.eq.${contact}`)
    if (deal) filters.push(`deal_id.eq.${deal}`)
    if (filters.length) q = q.or(filters.join(','))

    const { data } = await q
    const owners = await ownersForVehicle(req.dealershipId, { inventory_id: inv, vin })
    res.json({ ok: true, reports: data || [], owners })
  })

  app.post('/history', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const vin = str(b.vin)
    const external_url = str(b.external_url)
    const f = req.file
    if (!f && !external_url) return res.status(400).json({ error: 'Attach a file or provide a report link.' })

    let file_url = null, file_path = null
    if (f) {
      const safe = (f.originalname || 'report.pdf').replace(/[^\w.\-]+/g, '_').slice(-80)
      file_path = `history/${req.dealershipId}/${Date.now()}-${randomBytes(6).toString("hex")}-${safe}`
      const { error: upErr } = await supabaseAdmin.storage.from('vehicle-pdfs')
        .upload(file_path, f.buffer, { contentType: f.mimetype || 'application/pdf', upsert: false })
      if (upErr) { console.warn('[history] upload failed:', upErr.message); return res.status(500).json({ error: 'Upload failed' }) }
      file_url = supabaseAdmin.storage.from('vehicle-pdfs').getPublicUrl(file_path).data.publicUrl
    }

    let contact_id = str(b.contact_id)
    let deal_id = str(b.deal_id)
    const inventory_id = str(b.inventory_id)
    if (inventory_id && !contact_id) {
      const owners = await ownersForVehicle(req.dealershipId, { inventory_id, vin })
      const current = owners.find((o) => o.current) || owners[0]
      if (current) {
        contact_id = contact_id || current.contact_id
        deal_id = deal_id || current.deal_id || null
      }
    }

    const row = {
      dealership_id: req.dealershipId,
      inventory_id, contact_id, deal_id,
      vin, provider: str(b.provider) || 'carfax',
      report_type: REPORT_TYPES.includes(b.report_type) ? b.report_type : 'vhr',
      external_url, file_url, file_path,
      summary: (() => { try { return b.summary ? JSON.parse(b.summary) : null } catch { return null } })(),
      pulled_by: req.user?.id || null,
    }
    const { data, error } = await supabaseAdmin.from('vehicle_history_reports').insert(row)
      .select('id, vin, provider, report_type, external_url, file_url, summary, pulled_by, created_at, contact_id, inventory_id').single()
    if (error) { console.error('[history] save failed:', error.message); return res.status(500).json({ error: 'Save failed' }) }
    res.json({ ok: true, report: data })
  })

  app.delete('/history/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: r } = await supabaseAdmin.from('vehicle_history_reports')
      .select('id, file_path').eq('id', req.params.id).eq('dealership_id', req.dealershipId).is('deleted_at', null).maybeSingle()
    if (!r) return res.status(404).json({ error: 'Not found' })
    const { error } = await supabaseAdmin.from('vehicle_history_reports').update({
      deleted_at: new Date().toISOString(), deleted_by: req.user?.id || null,
    }).eq('id', r.id).eq('dealership_id', req.dealershipId).is('deleted_at', null)
    if (error) return res.status(500).json({ error: 'Archive failed' })
    audit(req, 'vehicle_history_report.archived', { vehicle_history_report_id: r.id })
    res.json({ ok: true })
  })
}
