/**
 * Reputation — asking for reviews, honestly (Phase 6 PR 6.8).
 *
 * THE DECISION: no review gating.
 *
 * The standard dealer "reputation management" feature asks the customer how they feel first,
 * then sends happy customers to Google and routes unhappy ones to a private form. That is
 * review gating. The FTC has acted on it and it breaches Google's policies — but the reason
 * not to build it is simpler than either: it manufactures a rating that is not true, and every
 * dealer who buys it is buying a liability nobody told them about.
 *
 * So there is no code path here where sentiment is consulted before asking. A request is
 * created from an EVENT — a delivery, a closed repair order — and every request carries the
 * public review link AND the private-feedback route together. The private option is an
 * addition offered to everyone, never a diversion for the unhappy.
 *
 * Suppression exists, because there are real reasons not to ask: the customer opted out, we
 * asked recently, or a manager knows something the system does not. Every one of those must
 * be stated in writing, and the database refuses a suppression with no reason.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit } from '../audit.js'
import { mayContact } from './consent.js'
import crypto from 'crypto'

const REQUEST_COLUMNS = 'id, dealership_id, contact_id, source, source_id, channel, status, consent_basis, public_url, sent_at, responded_at, suppressed_reason, created_at'
const REVIEW_COLUMNS = 'id, dealership_id, source, external_id, author_name, rating, body, posted_at, url, response_body, responded_at, responded_by, contact_id, created_at'

// Don't ask the same person again within this window, whatever the event.
const ASK_COOLDOWN_DAYS = 90

const newPrivateToken = () => crypto.randomBytes(18).toString('base64url')

/**
 * Why we would NOT ask this customer right now.
 *
 * Every reason here is about consent, timing or an explicit human decision. None of them is
 * about the rating we expect to get, and that is the entire point — this function is where a
 * gate would live if the product had one, so it is deliberately written to make its absence
 * checkable.
 */
export async function askEligibility(dealershipId, contactId, channel = 'email') {
  const consent = await mayContact(dealershipId, contactId, channel)
  if (!consent.allowed) {
    return { eligible: false, reason: consent.reason, basis: consent.basis }
  }

  const since = new Date(Date.now() - ASK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabaseAdmin.from('review_requests')
    .select('id, created_at').eq('dealership_id', dealershipId).eq('contact_id', contactId)
    .in('status', ['sent', 'responded']).gte('created_at', since).limit(1)
  if ((recent || []).length) {
    return { eligible: false, reason: `This customer was already asked in the last ${ASK_COOLDOWN_DAYS} days.`, basis: consent.basis }
  }
  return { eligible: true, basis: consent.basis }
}

/**
 * The rating, said plainly. Averages hide the shape of a reputation — a 4.2 built from
 * fifty 5s and twelve 1s is a different dealership from a 4.2 of steady 4s, and only one of
 * them has a problem to fix.
 */
export function ratingSummary(reviews) {
  const rows = (reviews || []).filter(r => r.rating != null)
  if (!rows.length) return { count: 0, average: null, unanswered: 0, detractors: 0, note: 'No reviews yet.' }
  const sum = rows.reduce((s, r) => s + Number(r.rating), 0)
  const average = Math.round((sum / rows.length) * 10) / 10
  const detractors = rows.filter(r => Number(r.rating) <= 3).length
  const unanswered = (reviews || []).filter(r => !r.responded_at).length
  return {
    count: rows.length, average, unanswered, detractors,
    note: detractors
      ? `${detractors} of ${rows.length} rated 3 or below — the average alone would hide them.`
      : 'No reviews at 3 or below.',
  }
}

export async function reputationAttention(dealershipId) {
  const { data: reviews } = await supabaseAdmin.from('reviews')
    .select('id, source, rating, author_name, posted_at, responded_at')
    .eq('dealership_id', dealershipId).is('responded_at', null)
    .order('posted_at', { ascending: false }).limit(100)

  const items = []
  for (const r of reviews || []) {
    const low = r.rating != null && Number(r.rating) <= 3
    items.push({
      // An unanswered bad review is the most expensive thing on a dealership's front page.
      kind: low ? 'review_negative_unanswered' : 'review_unanswered',
      severity: low ? 3 : 1,
      subject: `${r.rating != null ? `${r.rating}★ ` : ''}${r.author_name || 'A customer'} on ${r.source}`,
      reason: low
        ? 'A low review is sitting on your public profile with no reply'
        : 'A review is waiting for a reply',
      owner: 'Marketing', action: 'Reply', ref: r.id,
    })
  }
  return items.sort((a, b) => b.severity - a.severity)
}

export function registerReputation(app) {
  const canView = requirePermission('marketing.view')
  const canEdit = requirePermission('marketing.edit')
  const guard = (req, res) => { if (!req.dealershipId) { res.status(403).json({ error: 'no dealership' }); return false } return true }

  app.get('/reputation/reviews', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('reviews').select(REVIEW_COLUMNS)
        .eq('dealership_id', req.dealershipId).order('posted_at', { ascending: false }).limit(300)
      if (error) return res.status(500).json({ error: error.message })
      res.json({ reviews: data || [], summary: ratingSummary(data || []) })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/reputation/requests', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try {
      const { data, error } = await supabaseAdmin.from('review_requests').select(REQUEST_COLUMNS)
        .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(300)
      if (error) return res.status(500).json({ error: error.message })
      res.json({ requests: data || [] })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.get('/reputation/attention', requireAuth, requireMfa, canView, async (req, res) => {
    if (!guard(req, res)) return
    try { res.json({ items: await reputationAttention(req.dealershipId) }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Ask for a review.
   *
   * There is no `expected_rating`, no `sentiment`, and no pre-screen question — a request is
   * tied to an event that already happened. Both destinations go out together: the public
   * review link and the private-feedback route.
   */
  app.post('/reputation/requests', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const b = req.body || {}
    const channel = String(b.channel || 'email').toLowerCase()
    if (!['sms', 'email'].includes(channel)) return res.status(400).json({ error: 'Choose sms or email.' })
    if (!b.contact_id) return res.status(400).json({ error: 'A review request needs a customer.' })
    // No event, no ask. This is what stops a sweep of everyone who might say something nice.
    if (!['vehicle_delivered', 'service_closed', 'manual'].includes(String(b.source || ''))) {
      return res.status(400).json({ error: 'A review request must name the visit it follows.' })
    }

    try {
      const elig = await askEligibility(req.dealershipId, b.contact_id, channel)
      if (!elig.eligible) return res.status(409).json({ error: elig.reason })

      const { data: dealer } = await supabaseAdmin.from('dealerships')
        .select('reputation_settings').eq('id', req.dealershipId).maybeSingle()
      const publicUrl = dealer?.reputation_settings?.review_url || null
      // Asking someone for a public review with nowhere to leave one wastes the one ask this
      // customer will tolerate. Refuse it rather than send a broken message.
      if (!publicUrl) {
        return res.status(409).json({ error: 'Set your public review link in Reputation settings before asking customers for reviews.' })
      }

      const { data, error } = await supabaseAdmin.from('review_requests').insert({
        dealership_id: req.dealershipId,
        contact_id: b.contact_id,
        source: b.source,
        source_id: b.source_id || null,
        channel,
        status: 'sent',
        consent_basis: elig.basis,
        public_url: publicUrl,
        // Always issued, for every customer, alongside the public link.
        private_feedback_token: newPrivateToken(),
        sent_at: new Date().toISOString(),
        created_by: req.user?.id || null,
      }).select(REQUEST_COLUMNS).single()

      if (error) {
        // The one-ask-per-event index did its job.
        if (/duplicate key/i.test(error.message)) {
          return res.status(409).json({ error: 'This customer has already been asked about this visit.' })
        }
        return res.status(500).json({ error: error.message })
      }
      audit(req, 'reputation.review_requested', { after_state: { id: data.id, source: data.source, basis: data.consent_basis } })
      res.json({ ok: true, request: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Deliberately not asking someone. Allowed, and recorded with the reason in the staff
   * member's own words — an exclusion nobody has to justify is a gate wearing a different hat.
   */
  app.post('/reputation/requests/:id/suppress', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const reason = String(req.body?.reason || '').trim()
    if (!reason) return res.status(400).json({ error: 'Say why this customer should not be asked.' })
    try {
      const { data, error } = await supabaseAdmin.from('review_requests')
        .update({ status: 'suppressed', suppressed_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', req.params.id).eq('dealership_id', req.dealershipId).eq('status', 'pending')
        .select(REQUEST_COLUMNS).maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(409).json({ error: 'Only a request that has not been sent can be suppressed.' })
      audit(req, 'reputation.request_suppressed', { after_state: { id: data.id, reason } })
      res.json({ ok: true, request: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  /**
   * Reply to a review. The dealership owns its reply and nothing else on the row — a review
   * is somebody else's statement, and there is no route here that edits one.
   */
  app.post('/reputation/reviews/:id/respond', requireAuth, requireMfa, canEdit, async (req, res) => {
    if (!guard(req, res)) return
    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(400).json({ error: 'A reply needs something in it.' })
    try {
      const { data, error } = await supabaseAdmin.from('reviews').update({
        response_body: body, responded_at: new Date().toISOString(),
        responded_by: req.user?.id || null, updated_at: new Date().toISOString(),
      }).eq('id', req.params.id).eq('dealership_id', req.dealershipId).select(REVIEW_COLUMNS).maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      if (!data) return res.status(404).json({ error: 'Review not found' })
      audit(req, 'reputation.review_answered', { after_state: { id: data.id } })
      res.json({ ok: true, review: data })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })
}
