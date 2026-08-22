// ─────────────────────────────────────────────────────────────────────────────
// DealerOS Pro — Email Marketing (template library + broadcast campaigns).
//
// Brings the HQ "Automation & Email" template/campaign layer to dealers, Pro-gated.
// Lifecycle drip sequences already live in routes/automation.js; this module adds:
//   • A dealer-editable, reusable email TEMPLATE LIBRARY (seeded with starters).
//   • One-off broadcast CAMPAIGNS to a CRM contact SEGMENT (with a live count
//     preview and send), reusing the shared Resend sender.
//
// Every route is guarded requireAuth + requireMfa + requireFeature('os.email_marketing')
// (Pro / Enterprise only) and reads/writes through req.supabase so RLS enforces
// tenant isolation + the lead.assign permission.
// ─────────────────────────────────────────────────────────────────────────────
import { sendEmail } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requireFeature, requireAnyFeature } from '../access.js'
import { audit } from '../audit.js'

const nowIso = () => new Date().toISOString()
const clean = (s) => String(s == null ? '' : s).trim()

// Starter templates seeded once per dealership. {{first_name}} / {{full_name}} /
// {{dealership}} merge fields are substituted at send time.
const SEED_TEMPLATES = [
  { name: 'Welcome / thanks for reaching out', category: 'lead', subject: 'Thanks for reaching out to {{dealership}}',
    body: 'Hi {{first_name}},\n\nThanks for getting in touch with {{dealership}}. I wanted to personally reach out — is there a particular vehicle you had in mind, or can I help you find the right fit?\n\nReply any time and I’ll get right back to you.' },
  { name: 'New inventory match', category: 'lead', subject: 'A few new arrivals you might like',
    body: 'Hi {{first_name}},\n\nWe just took in some new inventory at {{dealership}} that lines up with what you were looking for. Want me to send over a couple of options and pricing?\n\nHappy to set up a quick look whenever suits you.' },
  { name: 'Service reminder', category: 'service', subject: 'Time for your next service at {{dealership}}',
    body: 'Hi {{first_name}},\n\nOur records show your vehicle is due for its next service. Keeping up with maintenance protects your warranty and your resale value.\n\nReply here or call us and we’ll find a time that works.' },
  { name: 'We miss you (win-back)', category: 'retention', subject: 'We’d love to see you back at {{dealership}}',
    body: 'Hi {{first_name}},\n\nIt’s been a while! We’ve got new arrivals and some great offers right now. If you’re even thinking about an upgrade, I’d be glad to run the numbers for you — no pressure.' },
  { name: 'Happy birthday', category: 'retention', subject: 'Happy birthday from {{dealership}}! 🎂',
    body: 'Hi {{first_name}},\n\nEveryone at {{dealership}} wanted to wish you a happy birthday! Thanks for being part of our community — we appreciate you.' },
  { name: 'Post-sale check-in', category: 'retention', subject: 'How’s everything going with your vehicle?',
    body: 'Hi {{first_name}},\n\nJust checking in now that you’ve had your vehicle for a bit — how is everything going? If you have any questions at all, I’m one reply away. Enjoy the drive!' },
  { name: 'Review request', category: 'retention', subject: 'Would you share your experience with {{dealership}}?',
    body: 'Hi {{first_name}},\n\nIt was a pleasure working with you! If you have a moment, a quick review would mean the world to our team and helps other shoppers find us. Thank you!' },
]

function renderMerge(text, contact, dealerName) {
  const first = clean(contact.first_name) || clean(contact.full_name).split(/\s+/)[0] || 'there'
  return String(text || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, first)
    .replace(/\{\{\s*full_name\s*\}\}/gi, clean(contact.full_name) || first)
    .replace(/\{\{\s*dealership\s*\}\}/gi, dealerName || 'our dealership')
}

// Build a filtered contacts query for a segment (excludes the dealership .eq, added by caller).
// Consent is filtered in JS after fetch (booleans may be null) to mirror single-send opt-out rules.
function segmentFilters(q, seg = {}) {
  q = q.is('deleted_at', null).not('email', 'is', null).neq('email', '')
  const arr = (v) => Array.isArray(v) ? v.filter(Boolean) : []
  if (arr(seg.status).length) q = q.in('status', arr(seg.status))
  if (arr(seg.source).length) q = q.in('source', arr(seg.source))
  if (arr(seg.tags).length) q = q.overlaps('tags', arr(seg.tags))
  if (seg.service_customer === true) q = q.eq('service_customer', true)
  if (seg.sold === true) q = q.not('sold_at', 'is', null)
  if (seg.assigned_rep) q = q.eq('assigned_rep', seg.assigned_rep)
  return q
}

// Emailable = has an address and hasn't opted out (mirrors /crm/contacts/:id/email).
const emailable = (c) => !!clean(c.email) && c.dnc !== true && c.opt_out !== true && c.consent_email !== false

export function registerDealerEmailMarketing(app) {
  const guards = [requireAuth, requireMfa, requireAnyFeature('email.campaigns', 'email.templates', 'email.audiences', 'email.automations', 'os.email_marketing')]

  async function dealerName(req) {
    const { data } = await req.supabase.from('dealerships').select('name').eq('id', req.dealershipId).maybeSingle()
    return data?.name || 'our dealership'
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  app.get('/dealer/email/templates', ...guards, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    let { data, error } = await req.supabase.from('dealer_email_templates')
      .select('*').eq('dealership_id', req.dealershipId).order('updated_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    // Lazily seed starters the first time.
    if (!data || data.length === 0) {
      const rows = SEED_TEMPLATES.map(t => ({ ...t, dealership_id: req.dealershipId, is_seed: true, created_by: req.user.id }))
      const seeded = await req.supabase.from('dealer_email_templates').insert(rows).select()
      if (!seeded.error) data = seeded.data
    }
    res.json({ templates: data || [] })
  })

  app.post('/dealer/email/templates', ...guards, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const name = clean(req.body?.name)
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const { data, error } = await req.supabase.from('dealer_email_templates').insert({
      dealership_id: req.dealershipId, name,
      subject: clean(req.body?.subject), body: clean(req.body?.body),
      category: clean(req.body?.category) || 'general', created_by: req.user.id,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ template: data })
  })

  app.patch('/dealer/email/templates/:id', ...guards, async (req, res) => {
    const patch = { updated_at: nowIso() }
    const bools = new Set(['active', 'sms_enabled'])
    for (const k of ['name', 'subject', 'body', 'category', 'active', 'sms_enabled']) {
      if (req.body?.[k] !== undefined) patch[k] = bools.has(k) ? !!req.body[k] : clean(req.body[k])
    }
    const { data, error } = await req.supabase.from('dealer_email_templates')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ template: data })
  })

  app.delete('/dealer/email/templates/:id', ...guards, async (req, res) => {
    const { error } = await req.supabase.from('dealer_email_templates')
      .delete().eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // ── Segment count (live preview) ─────────────────────────────────────────────
  app.post('/dealer/email/segment-count', ...guards, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const seg = req.body?.segment || {}
    let q = req.supabase.from('contacts')
      .select('id, email, consent_email, opt_out, dnc').eq('dealership_id', req.dealershipId).limit(10000)
    q = segmentFilters(q, seg)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    const matched = (data || []).length
    const reachable = (data || []).filter(emailable).length
    res.json({ matched, reachable })
  })

  // ── Campaigns ────────────────────────────────────────────────────────────────
  app.get('/dealer/email/campaigns', ...guards, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data, error } = await req.supabase.from('dealer_campaigns')
      .select('*').eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(200)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ campaigns: data || [] })
  })

  app.post('/dealer/email/campaigns', ...guards, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const name = clean(req.body?.name)
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const { data, error } = await req.supabase.from('dealer_campaigns').insert({
      dealership_id: req.dealershipId, name,
      segment: req.body?.segment || {},
      template_id: req.body?.template_id || null,
      subject: clean(req.body?.subject), body: clean(req.body?.body),
      status: 'draft', created_by: req.user.id,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ campaign: data })
  })

  app.patch('/dealer/email/campaigns/:id', ...guards, async (req, res) => {
    const patch = { updated_at: nowIso() }
    for (const k of ['name', 'subject', 'body']) if (req.body?.[k] !== undefined) patch[k] = clean(req.body[k])
    if (req.body?.segment !== undefined) patch.segment = req.body.segment || {}
    if (req.body?.template_id !== undefined) patch.template_id = req.body.template_id || null
    const { data, error } = await req.supabase.from('dealer_campaigns')
      .update(patch).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ campaign: data })
  })

  app.delete('/dealer/email/campaigns/:id', ...guards, async (req, res) => {
    const { error } = await req.supabase.from('dealer_campaigns')
      .delete().eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ ok: true })
  })

  // Send now: resolve the segment, merge + send to each reachable contact, record counts.
  app.post('/dealer/email/campaigns/:id/send', ...guards, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: c } = await req.supabase.from('dealer_campaigns')
      .select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!c) return res.status(404).json({ error: 'Campaign not found' })
    if (c.status === 'sending') return res.status(409).json({ error: 'Campaign is already sending' })

    // Subject/body come from the campaign, falling back to its linked template.
    let subject = clean(c.subject), body = clean(c.body)
    if ((!subject || !body) && c.template_id) {
      const { data: t } = await req.supabase.from('dealer_email_templates')
        .select('subject, body').eq('id', c.template_id).eq('dealership_id', req.dealershipId).maybeSingle()
      if (t) { subject = subject || clean(t.subject); body = body || clean(t.body) }
    }
    if (!subject || !body) return res.status(400).json({ error: 'Campaign needs a subject and message (or a template)' })

    let q = req.supabase.from('contacts')
      .select('id, first_name, full_name, email, consent_email, opt_out, dnc')
      .eq('dealership_id', req.dealershipId).limit(2000)
    q = segmentFilters(q, c.segment || {})
    const { data: contacts, error: cErr } = await q
    if (cErr) return res.status(500).json({ error: cErr.message })
    const recipients = (contacts || []).filter(emailable)

    await req.supabase.from('dealer_campaigns').update({
      status: 'sending', recipient_count: recipients.length, updated_at: nowIso(),
    }).eq('id', c.id).eq('dealership_id', req.dealershipId)

    const dn = await dealerName(req)
    let sent = 0, failed = 0, lastError = null
    for (const contact of recipients) {
      try {
        const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.55">`
          + renderMerge(body, contact, dn).replace(/\n/g, '<br>')
          + `<br><br><span style="color:#94a3b8;font-size:12px">You’re receiving this because you’re a contact of ${dn}. Reply STOP to opt out.</span></div>`
        const r = await sendEmail({ to: contact.email, subject: renderMerge(subject, contact, dn), html })
        if (r?.ok === false) { failed++; lastError = r.error || 'send failed' } else sent++
      } catch (e) { failed++; lastError = e.message }
    }

    const { data: updated } = await req.supabase.from('dealer_campaigns').update({
      status: failed && !sent ? 'failed' : 'sent', sent_count: sent,
      last_error: lastError, sent_at: nowIso(), updated_at: nowIso(),
    }).eq('id', c.id).eq('dealership_id', req.dealershipId).select().single()

    try { await audit(req, 'dealer_campaign.send', { entity: 'dealer_campaign', entity_id: c.id, sent, failed, recipients: recipients.length }) } catch {}
    res.json({ ok: true, sent, failed, recipients: recipients.length, campaign: updated })
  })
}
