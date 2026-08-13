/**
 * Service department — a light fixed-ops surface that reuses the CRM's unified
 * customer records. No repair orders / parts / technician time-clocks (that's a
 * separate DMS-scale build); this is: service settings, a service appointment
 * book, and a sales-vs-service tag on every customer.
 *
 * Service appointments are crm_tasks with type='appointment' + category='service',
 * so they attach to the SAME contact as that customer's sales history — one record,
 * two relationships. Booking one flips contacts.service_customer = true.
 */
import { supabaseAdmin, resend, EMAIL_FROM } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { findOrCreateContact } from './crm.js'
import { checkInAppointment } from './service-engine.js'
import { createNotification } from '../notifications.js'
import { rateLimit } from '../security.js'
import { syncAppointmentOut } from './calendar.js'
import { audit } from '../audit.js'

const isDealerLevel = (p) => ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'SERVICE'].includes(p?.role)
const DEFAULT_TYPES = ['Oil change', 'Tire change / rotation', 'Brakes', 'Diagnostic', 'Scheduled maintenance', 'Recall', 'Detailing', 'Other']

function serviceSettings(dealer) {
  const s = (dealer?.service_settings && typeof dealer.service_settings === 'object') ? dealer.service_settings : {}
  return {
    enabled: s.enabled === true,                                  // online service booking on the site
    service_types: Array.isArray(s.service_types) && s.service_types.length ? s.service_types.slice(0, 30) : DEFAULT_TYPES,
    desk_email: s.desk_email || null,
    hours: s.hours || null,
    note: s.note || null,
    duration_min: Number.isFinite(s.duration_min) ? s.duration_min : 60,
  }
}

// Appointment state. `status` is the canonical column (Phase 4); `done` predates it and
// still means "dealt with", so an older appointment with no status is derived rather
// than guessed — a done appointment with no status is simply closed out.
const APPT_STATES = ['scheduled', 'arrived', 'no_show', 'converted', 'canceled']
const apptStatus = (t) => APPT_STATES.includes(t.status) ? t.status : (t.done ? 'converted' : 'scheduled')

// Shape a service crm_task + its contact for the dashboard list.
function apptRow(t, contactName, repName, roId) {
  return {
    id: t.id, contact_id: t.contact_id, title: t.title,
    when: t.due_at, done: !!t.done, status: apptStatus(t),
    arrived_at: t.arrived_at || null,
    repair_order_id: roId || null,
    customer: contactName || 'Customer', rep: repName || null,
    service_type: t.service_type || null,
  }
}

export function registerService(app) {
  // ── Settings ────────────────────────────────────────────────────────────────
  app.get('/service/config', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: d } = await supabaseAdmin.from('dealerships').select('service_settings, site_slug, site_published').eq('id', req.dealershipId).maybeSingle()
    res.json({ ok: true, settings: serviceSettings(d), site_slug: d?.site_slug || null, site_published: !!d?.site_published, default_types: DEFAULT_TYPES })
  })

  app.put('/service/config', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: cur } = await supabaseAdmin.from('dealerships').select('service_settings').eq('id', req.dealershipId).maybeSingle()
    const s = { ...(cur?.service_settings || {}) }
    const b = req.body || {}
    if (b.enabled !== undefined) s.enabled = !!b.enabled
    if (Array.isArray(b.service_types)) s.service_types = b.service_types.map(x => String(x || '').trim().slice(0, 60)).filter(Boolean).slice(0, 30)
    if (b.desk_email !== undefined) s.desk_email = (b.desk_email || '').toString().trim().slice(0, 160) || null
    if (b.hours !== undefined) s.hours = (b.hours || '').toString().trim().slice(0, 400) || null
    if (b.note !== undefined) s.note = (b.note || '').toString().trim().slice(0, 600) || null
    if (b.duration_min !== undefined) { const n = parseInt(b.duration_min); if (Number.isFinite(n) && n > 0 && n <= 480) s.duration_min = n }
    const { error } = await supabaseAdmin.from('dealerships').update({ service_settings: s }).eq('id', req.dealershipId)
    if (error) return res.status(500).json({ error: 'Save failed' })
    audit(req, 'service.configuration_updated', {
      after_state: {
        enabled: s.enabled === true,
        service_type_count: Array.isArray(s.service_types) ? s.service_types.length : 0,
        desk_email_configured: !!s.desk_email,
        duration_min: s.duration_min || null,
      },
    })
    res.json({ ok: true, settings: serviceSettings({ service_settings: s }) })
  })

  // ── Service appointments (attached to the same contacts as sales) ────────────
  app.get('/service/appointments', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.json({ appointments: [] })
    let q = supabaseAdmin.from('crm_tasks')
      .select('id, contact_id, assigned_to, title, due_at, done, status, arrived_at, service_type')
      .eq('dealership_id', req.dealershipId).eq('category', 'service')
      .order('due_at', { ascending: true }).limit(2000)
    if (!isDealerLevel(req.profile)) q = q.eq('assigned_to', req.user.id)
    const { data: rows, error } = await q
    // This query silently returned nothing for every dealership because it selected a
    // column that did not exist and the error was discarded (Stage 4A finding B1). The
    // column now exists — and a failure here is reported instead of looking like an
    // empty appointment book.
    if (error) return res.status(500).json({ error: error.message })
    const list = rows || []
    const cIds = [...new Set(list.map(t => t.contact_id).filter(Boolean))]
    const rIds = [...new Set(list.map(t => t.assigned_to).filter(Boolean))]
    let cNames = {}, rNames = {}, roByTask = {}
    if (cIds.length) { const { data: cs } = await supabaseAdmin.from('contacts').select('id, full_name, first_name, last_name').in('id', cIds); cNames = Object.fromEntries((cs || []).map(c => [c.id, c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'])) }
    if (rIds.length) { const { data: rs } = await supabaseAdmin.from('profiles').select('id, full_name, display_name').in('id', rIds); rNames = Object.fromEntries((rs || []).map(r => [r.id, r.full_name || r.display_name || '—'])) }
    // Which appointments already produced a repair order — the check-in is idempotent,
    // so this is what the UI reads to know an arrival is already converted.
    if (list.length) {
      const { data: ros } = await supabaseAdmin.from('repair_orders').select('id, appointment_task_id')
        .eq('dealership_id', req.dealershipId).in('appointment_task_id', list.map(t => t.id))
      roByTask = Object.fromEntries((ros || []).map(r => [r.appointment_task_id, r.id]))
    }
    res.json({ ok: true, appointments: list.map(t => apptRow(t, cNames[t.contact_id], rNames[t.assigned_to], roByTask[t.id])), can_manage_all: isDealerLevel(req.profile) })
  })

  // ── Check-in: the canonical arrival transition ──────────────────────────────
  // Appointment → customer arrives → canonical customer + vehicle resolved → concern
  // carried forward → exactly ONE repair order. Idempotent in the database (unique
  // index on repair_orders.appointment_task_id), not in the interface: a double-click,
  // a retry, or two advisors checking the same customer in all land on the same RO.
  app.post('/service/appointments/:id/check-in', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    try {
      const result = await checkInAppointment(req.dealershipId, req.params.id, {
        vin: b.vin || null, odometer: b.odometer ?? null, customerVehicleId: b.customer_vehicle_id || null,
        complaint: b.complaint || null, year: b.year ?? null, make: b.make || null, model: b.model || null,
        trim: b.trim || null, plate: b.plate || null, advisorId: b.advisor_id || req.user?.id || null,
        userId: req.user?.id || null,
      })
      if (result.created) audit(req, 'service.checked_in', { after_state: { ro_id: result.ro.id, ro_number: result.ro.ro_number, appointment_task_id: req.params.id } })
      res.json({ ok: true, created: result.created, ro: result.ro, vehicle: result.vehicle || null })
    } catch (e) { res.status(400).json({ error: e.message }) }
  })

  // Mark an appointment arrived or no-show without opening an RO yet.
  app.post('/service/appointments/:id/status', requireAuth, requirePermission('service.write_repair_order'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const to = String(req.body?.status || '')
    if (!['scheduled', 'arrived', 'no_show', 'canceled'].includes(to)) return res.status(400).json({ error: 'invalid appointment status' })
    const patch = { status: to }
    if (to === 'arrived') patch.arrived_at = new Date().toISOString()
    if (to === 'no_show' || to === 'canceled') { patch.done = true; patch.done_at = new Date().toISOString() }
    const { data, error } = await supabaseAdmin.from('crm_tasks').update(patch)
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).eq('category', 'service').select('*').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true, appointment: apptRow(data, null, null, null) })
  })

  // Book a service appointment internally (attaches to an existing contact, or
  // creates one), and flags the customer as a service customer.
  app.post('/service/appointments', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const when = b.when ? new Date(b.when) : null
    if (!when || isNaN(when.getTime())) return res.status(400).json({ error: 'Pick a valid date and time.' })
    const serviceType = String(b.service_type || 'Service').slice(0, 60)
    const notes = String(b.notes || '').trim().slice(0, 1000)
    let contactId = b.contact_id || null
    if (!contactId) {
      const name = String(b.name || '').trim().slice(0, 120)
      if (!name) return res.status(400).json({ error: 'Pick a customer or enter a name.' })
      contactId = await findOrCreateContact({ dealershipId: req.dealershipId, name, email: b.email || null, phone: b.phone || null, repId: req.user.id, source: 'Service' })
    }
    if (!contactId) return res.status(500).json({ error: 'Could not attach the customer.' })
    const { data: task, error } = await supabaseAdmin.from('crm_tasks').insert({
      dealership_id: req.dealershipId, contact_id: contactId, assigned_to: b.assigned_to || req.user.id, created_by: req.user.id,
      title: `${serviceType}${notes ? ' — ' + notes.slice(0, 60) : ''}`, type: 'appointment', category: 'service',
      service_type: serviceType, due_at: when.toISOString(),
    }).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    // The appointment is booked — the follow-on updates are best-effort and must not
    // fail the request (a hiccup here was surfacing as a generic "internal error").
    await supabaseAdmin.from('contacts').update({ service_customer: true, updated_at: new Date().toISOString() }).eq('id', contactId).then(() => {}, () => {})
    await supabaseAdmin.from('communications').insert({
      dealership_id: req.dealershipId, contact_id: contactId, channel: 'note', direction: 'internal',
      subject: 'Service appointment booked', body: `${serviceType} · ${when.toLocaleString('en-US')}${notes ? '\nNotes: ' + notes : ''}`,
      meta: { kind: 'service_appointment', when: when.toISOString(), service_type: serviceType },
    }).catch(() => {})
    if (task?.id) syncAppointmentOut(task.id, 'upsert')
    res.json({ ok: true, appointment: task })
  })

  app.put('/service/appointments/:id', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const patch = {}
    if (b.done !== undefined) { patch.done = !!b.done; patch.done_at = b.done ? new Date().toISOString() : null }
    if (b.when !== undefined) { const w = new Date(b.when); if (!isNaN(w.getTime())) patch.due_at = w.toISOString() }
    if (b.status !== undefined) patch.status = String(b.status).slice(0, 30)
    const { data, error } = await supabaseAdmin.from('crm_tasks').update(patch)
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).eq('category', 'service').select('*').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Not found' })
    syncAppointmentOut(data.id, data.done ? 'delete' : 'upsert')
    res.json({ ok: true, appointment: data })
  })

  // ── PUBLIC: online service booking from the dealer's website ─────────────────
  app.post('/site/:slug/service-book', rateLimit('servicebook', 12, 60000), async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase().trim()
    const { data: d } = await supabaseAdmin.from('dealerships').select('id, name, branding, site_published, service_settings, automation_settings').ilike('site_slug', slug).maybeSingle()
    if (!d || !d.site_published) return res.status(404).json({ error: 'Site not found' })
    const cfg = serviceSettings(d)
    if (!cfg.enabled) return res.status(403).json({ error: 'Online service booking is not enabled for this dealer.' })
    const b = req.body || {}
    const name = String(b.name || '').trim().slice(0, 120)
    const email = String(b.email || '').trim().slice(0, 160)
    const phone = String(b.phone || '').trim().slice(0, 40)
    const serviceType = String(b.service_type || 'Service').slice(0, 60)
    const notes = String(b.notes || b.message || '').trim().slice(0, 1000)
    if (!name || (!email && !phone)) return res.status(400).json({ error: 'Add your name and an email or phone.' })
    const when = new Date(b.when)
    if (isNaN(when.getTime())) return res.status(400).json({ error: 'Pick a valid date and time.' })
    if (when.getTime() < Date.now() + 15 * 60 * 1000) return res.status(400).json({ error: 'Please choose a time at least 15 minutes out.' })
    if (when.getTime() > Date.now() + 120 * 86400000) return res.status(400).json({ error: 'Please choose a time within the next few months.' })
    const whenLabel = (() => { try { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: b.tz || 'America/Toronto' }).format(when) } catch { return when.toISOString() } })()

    try {
      const contactId = await findOrCreateContact({ dealershipId: d.id, name, email, phone, source: 'Service' })
      if (contactId) {
        await supabaseAdmin.from('contacts').update({ service_customer: true, updated_at: new Date().toISOString() }).eq('id', contactId)
        await supabaseAdmin.from('crm_tasks').insert({
          dealership_id: d.id, contact_id: contactId, created_by: null, assigned_to: null,
          title: `${serviceType} — ${name}`, type: 'appointment', category: 'service', service_type: serviceType, due_at: when.toISOString(),
        })
        await supabaseAdmin.from('communications').insert({
          dealership_id: d.id, contact_id: contactId, channel: 'note', direction: 'internal',
          subject: 'Service appointment booked (online)', body: `${serviceType} · ${whenLabel}${notes ? '\nNotes: ' + notes : ''}`,
          meta: { kind: 'service_appointment', when: when.toISOString(), service_type: serviceType, online: true },
        }).catch(() => {})
        await createNotification({ dealershipId: d.id, type: 'new_lead', title: `🔧 Service booked — ${name}`, body: `${serviceType} · ${whenLabel}.`, linkPage: 'service-appointments' }).catch(() => {})
      }
      if (resend) {
        const deskEmail = cfg.desk_email || d.branding?.email || d.automation_settings?.house_email
        const shell = (heading, intro) => `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto"><div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><div style="font-size:19px;font-weight:800">${heading}</div></div><div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:20px"><p style="font-size:15px;color:#0f172a;margin:0 0 12px">${intro}</p><table style="width:100%;font-size:14px;color:#334155"><tr><td style="padding:6px 0;color:#64748b;width:90px">Service</td><td style="padding:6px 0;font-weight:700">${serviceType}</td></tr><tr><td style="padding:6px 0;color:#64748b">When</td><td style="padding:6px 0;font-weight:700">${whenLabel}</td></tr>${notes ? `<tr><td style="padding:6px 0;color:#64748b">Notes</td><td style="padding:6px 0">${notes}</td></tr>` : ''}</table></div></div>`
        if (email) resend.emails.send({ from: EMAIL_FROM, to: email, subject: `Your service appointment at ${d.name} — ${whenLabel}`, html: shell('Service appointment confirmed', `Thanks ${name.split(' ')[0] || ''}! We've booked your ${serviceType.toLowerCase()}.`) }).catch(() => {})
        if (deskEmail) resend.emails.send({ from: EMAIL_FROM, to: deskEmail, subject: `New service booking — ${name} — ${whenLabel}`, html: shell('New service booking', `${name} booked a ${serviceType.toLowerCase()}. It's on the service calendar.`) }).catch(() => {})
      }
      res.json({ ok: true, when: when.toISOString() })
    } catch (e) {
      console.warn('[service] booking failed:', e.message)
      res.status(500).json({ error: 'Could not book that time — please try again.' })
    }
  })
}
