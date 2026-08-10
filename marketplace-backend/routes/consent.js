/**
 * The consent gate (Phase 6 PR 6.3).
 *
 * ONE place that answers "may we contact this customer on this channel, right now?".
 *
 * The rule already existed and was correct — it was just written out separately in
 * automation's dispatch verifier, its birthday sweep and its email sweep. Three copies of
 * a rule is three chances for one of them to drift, and Phase 6 is about to add several
 * more senders: campaigns, AI follow-up, sales video, social DMs. So the rule moves here
 * and every sender calls it.
 *
 * Nothing about the existing decision changes. `dnc` and `opt_out` are hard stops; a
 * channel consent flag explicitly set to false blocks that channel; an unset flag is
 * treated as implied consent exactly as it is today.
 *
 * What is ADDED is honesty about the basis. `customer_consents` holds real evidence —
 * lawful basis, policy version, a hash of the notice the customer saw, capture time and
 * expiry — and nothing read it. The gate now does, so a sender can tell express consent
 * from implied, and an expired express consent stops looking like a fresh one.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'

export const CHANNELS = ['email', 'sms', 'phone', 'mail']

// The columns the decision needs. Named explicitly so a schema change that removes one
// fails loudly here rather than silently making the gate more permissive.
const CONTACT_COLUMNS = 'id, dealership_id, email, phone, phone_mobile, dnc, opt_out, consent_email, consent_sms, automation_paused, delivery_issue'

/**
 * May we contact this customer on this channel?
 *
 * Returns { allowed, reason, basis, evidence }.
 *   basis: 'express'  — a live consent record exists
 *          'implied'  — no record, and nothing blocks it (today's default)
 *          'blocked'  — a hard stop or an explicit refusal
 *
 * `reason` is written for a person, because it ends up in an exception queue.
 */
export async function mayContact(dealershipId, contactId, channel, { ignorePause = false } = {}) {
  const ch = String(channel || '').toLowerCase()
  if (!CHANNELS.includes(ch)) {
    return { allowed: false, basis: 'blocked', reason: `${channel} is not a contact channel.` }
  }
  const { data: c } = await supabaseAdmin.from('contacts').select(CONTACT_COLUMNS).eq('id', contactId).maybeSingle()
  if (!c || c.dealership_id !== dealershipId) {
    return { allowed: false, basis: 'blocked', reason: 'That customer was not found.' }
  }

  // Hard stops, in the order automation already applies them.
  if (c.opt_out) return { allowed: false, basis: 'blocked', reason: 'This customer has opted out of contact.' }
  if (c.dnc) return { allowed: false, basis: 'blocked', reason: 'This customer is on the do-not-contact list.' }
  if (ch === 'sms' && c.consent_sms === false) return { allowed: false, basis: 'blocked', reason: 'This customer has not consented to SMS.' }
  if (ch === 'email' && c.consent_email === false) return { allowed: false, basis: 'blocked', reason: 'This customer has not consented to email.' }

  // A reply froze automation. A human reaching out deliberately may pass this; an
  // automated sender may not — talking over a live conversation is the thing it prevents.
  if (c.automation_paused && !ignorePause) {
    return { allowed: false, basis: 'blocked', reason: 'This customer replied — automated follow-up is paused so nobody talks over the conversation.' }
  }

  // You cannot email someone with no email address, however consenting they are.
  if (ch === 'email' && !c.email) return { allowed: false, basis: 'blocked', reason: 'No email address on file.' }
  if ((ch === 'sms' || ch === 'phone') && !(c.phone_mobile || c.phone)) {
    return { allowed: false, basis: 'blocked', reason: 'No phone number on file.' }
  }

  // Evidence, where it exists. An expired record is not consent.
  const { data: record } = await supabaseAdmin.from('customer_consents')
    .select('id, consent_type, status, lawful_basis, policy_version, captured_at, expires_at')
    .eq('dealership_id', dealershipId).eq('contact_id', contactId).eq('consent_type', ch)
    .order('captured_at', { ascending: false }).limit(1).maybeSingle()

  if (record) {
    const expired = record.expires_at && new Date(record.expires_at) < new Date()
    if (record.status === 'withdrawn' || record.status === 'denied') {
      return { allowed: false, basis: 'blocked', reason: 'This customer withdrew consent for this channel.', evidence: record }
    }
    if (expired) {
      // Falls back to the flag-based decision rather than blocking outright — the flags
      // are what the dealership operates on today, and silently muting a customer whose
      // paperwork lapsed would be a behaviour change nobody asked for. It is reported.
      return { allowed: true, basis: 'implied', reason: 'Express consent has expired; proceeding on implied consent.', evidence: record }
    }
    return { allowed: true, basis: 'express', reason: null, evidence: record }
  }

  return { allowed: true, basis: 'implied', reason: null, evidence: null }
}

// Filter an audience down to who may actually be contacted, keeping the refusals so a
// campaign can tell an operator "412 recipients, 38 excluded, and why".
export async function filterContactable(dealershipId, contactIds, channel, opts = {}) {
  const allowed = [], excluded = []
  for (const id of contactIds || []) {
    const v = await mayContact(dealershipId, id, channel, opts)
    if (v.allowed) allowed.push({ contact_id: id, basis: v.basis })
    else excluded.push({ contact_id: id, reason: v.reason })
  }
  return { allowed, excluded, total: (contactIds || []).length }
}

/**
 * Record an opt-out from any channel, and propagate it.
 *
 * Opt-out must reach BOTH models or it half-works: the flags are what every sender reads,
 * and the consent record is the evidence that it happened. An inbound STOP that only wrote
 * one of them would leave the customer contactable by whichever sender read the other.
 */
export async function recordOptOut(dealershipId, contactId, { channel = null, source = 'customer', actorId = null, evidence = null } = {}) {
  const patch = { automation_paused: true }
  if (!channel || channel === 'all') { patch.opt_out = true; patch.consent_sms = false; patch.consent_email = false }
  else if (channel === 'sms') patch.consent_sms = false
  else if (channel === 'email') patch.consent_email = false

  await supabaseAdmin.from('contacts').update(patch).eq('id', contactId).eq('dealership_id', dealershipId)

  for (const ch of (!channel || channel === 'all') ? ['email', 'sms'] : [channel]) {
    await supabaseAdmin.from('customer_consents').insert({
      dealership_id: dealershipId, contact_id: contactId, consent_type: ch,
      status: 'withdrawn', lawful_basis: 'withdrawn', source,
      captured_by: actorId, captured_at: new Date().toISOString(),
      evidence: evidence || null,
    }).select('id').maybeSingle().catch(() => null)
  }
  return { ok: true, channels: (!channel || channel === 'all') ? ['email', 'sms'] : [channel] }
}

export function registerConsent(app) {
  // The canonical customer permissions — consent is a fact about a customer, so it is
  // gated exactly as the customer record is. (`crm.*` does not exist; the vocabulary is
  // customer.view / customer.edit.)
  const canView = requirePermission('customer.view')
  const canEdit = requirePermission('customer.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  // What may we do with this customer, and on what basis.
  app.get('/consent/:contactId', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const out = {}
      for (const ch of CHANNELS) out[ch] = await mayContact(req.dealershipId, req.params.contactId, ch)
      res.json({ contact_id: req.params.contactId, channels: out })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // Check an audience before sending, so a campaign can show its real reach.
  app.post('/consent/check', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    const ids = Array.isArray(req.body?.contact_ids) ? req.body.contact_ids.slice(0, 5000) : []
    const channel = String(req.body?.channel || '')
    if (!CHANNELS.includes(channel)) return res.status(400).json({ error: `channel must be one of ${CHANNELS.join(', ')}` })
    try { res.json(await filterContactable(req.dealershipId, ids, channel)) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/consent/:contactId/opt-out', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const r = await recordOptOut(req.dealershipId, req.params.contactId, {
        channel: req.body?.channel || 'all', source: req.body?.source || 'staff', actorId: req.user?.id || null,
      })
      audit(req, 'consent.opted_out', { after_state: { contact_id: req.params.contactId, ...r } })
      res.json({ ok: true, ...r })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
