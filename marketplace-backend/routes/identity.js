/**
 * Identity verification — Stripe Identity. A rep starts a real check on a customer
 * (government-ID document authentication + a matching selfie / liveness). Stripe
 * does the document + biometric work; we store only the pass/fail status and a
 * non-sensitive summary on the contact. The ID images live at Stripe, not here.
 *
 *   POST /identity/start    { contact_id } -> { url }  (hosted verification link)
 *   GET  /identity/status?contact_id       -> current status (polls Stripe)
 *
 * Uses the existing STRIPE_SECRET_KEY. Requires Stripe Identity to be enabled on
 * the Stripe account; if it isn't, Stripe returns an error we surface plainly.
 */
import { stripe, supabaseAdmin, FRONTEND_URL } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { audit, AuditAction } from '../audit.js'

// Two interchangeable identity providers, chosen by env so the customer-facing flow
// (a hosted link + a polled status) is identical either way:
//   Stripe Identity  — STRIPE_SECRET_KEY
//   Persona          — PERSONA_API_KEY (+ PERSONA_TEMPLATE_ID)   ← cheaper / more regions
// Set IDENTITY_PROVIDER to force one; otherwise we prefer Stripe, then Persona.
const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY
const personaConfigured = () => !!(process.env.PERSONA_API_KEY && process.env.PERSONA_TEMPLATE_ID)
function identityProvider() {
  const pref = String(process.env.IDENTITY_PROVIDER || '').toLowerCase()
  if (pref === 'persona' && personaConfigured()) return 'persona'
  if (pref === 'stripe' && stripeConfigured()) return 'stripe'
  if (stripeConfigured()) return 'stripe'
  if (personaConfigured()) return 'persona'
  return null
}
const configured = () => identityProvider() !== null
// Which providers this server can actually use right now (keys present).
function availableProviders() {
  const a = []
  if (stripeConfigured()) a.push('stripe')
  if (personaConfigured()) a.push('persona')
  return a
}
const PROVIDER_LABELS = { stripe: 'Stripe Identity', persona: 'Persona' }

// A dealer may pin a provider (stored on a dealer_integrations 'identity' row); we honour
// it only if that provider is configured, else fall back to the env default.
async function dealerProviderPref(dealershipId) {
  const { data } = await supabaseAdmin.from('dealer_integrations')
    .select('lender_code_map').eq('dealership_id', dealershipId).eq('provider', 'identity').maybeSingle()
  return data?.lender_code_map?.provider || null
}
async function resolveProvider(dealershipId) {
  const avail = availableProviders()
  if (!avail.length) return null
  const pref = await dealerProviderPref(dealershipId)
  if (pref && avail.includes(pref)) return pref
  return identityProvider()
}

const PERSONA_BASE = 'https://api.withpersona.com/api/v1'
const PERSONA_VERSION = '2023-01-05'
async function personaFetch(path, opts = {}) {
  const r = await fetch(`${PERSONA_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.PERSONA_API_KEY}`, 'Persona-Version': PERSONA_VERSION, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.errors?.[0]?.title || j.errors?.[0]?.detail || 'Persona request failed')
  return j
}
// Create a Persona inquiry for a contact and return a one-time hosted link.
async function personaStart(contactId, returnUrl) {
  const created = await personaFetch('/inquiries', {
    method: 'POST',
    body: JSON.stringify({ data: { attributes: { 'inquiry-template-id': process.env.PERSONA_TEMPLATE_ID, 'reference-id': `dep_${contactId}`, 'redirect-uri': returnUrl } } }),
  })
  const id = created.data?.id
  if (!id) throw new Error('Persona did not return an inquiry id.')
  let url = null
  try {
    const link = await personaFetch(`/inquiries/${id}/generate-one-time-link`, { method: 'POST' })
    url = link.meta?.['one-time-link'] || link.data?.attributes?.['one-time-link'] || null
  } catch { /* fall back to the standard hosted URL below */ }
  if (!url) url = `https://withpersona.com/verify?inquiry-id=${encodeURIComponent(id)}`
  return { id, url }
}
// A generic Persona inquiry status does NOT prove which template checks ran. Until report-level
// evidence is retrieved, an approval is a manual-review result — never a fabricated selfie pass.
export function normalizePersonaInquiry(j) {
  const a = j.data?.attributes || {}
  const raw = String(a.status || '').toLowerCase()
  const terminalFailure = ['declined', 'failed', 'expired'].includes(raw)
  const approvedWithoutEvidence = ['approved', 'completed'].includes(raw)
  return {
    decision: terminalFailure ? (raw === 'expired' ? 'expired' : 'failed') : approvedWithoutEvidence ? 'manual_review' : raw === 'pending' ? 'processing' : 'pending',
    machine_decision: terminalFailure ? 'failed' : approvedWithoutEvidence ? 'manual_review' : 'processing',
    legal_name: [a['name-first'], a['name-last']].filter(Boolean).join(' ') || null,
    date_of_birth: a.birthdate || null,
    document_type: null,
    document_result: 'unknown', live_face_result: 'unknown', liveness_result: 'unknown', face_match_score: null,
    evidence_reference: j.data?.id || null,
    last_error: terminalFailure ? `Verification ${raw}.` : approvedWithoutEvidence ? 'Provider approval received; report-level face and liveness evidence requires review.' : null,
  }
}
async function personaStatus(inquiryId) {
  return normalizePersonaInquiry(await personaFetch(`/inquiries/${inquiryId}`))
}

export function normalizeStripeSession(vs) {
  const status = String(vs?.status || 'pending')
  const decision = status === 'verified' ? 'verified'
    : status === 'requires_input' ? 'failed'
      : status === 'canceled' ? 'cancelled'
        : status === 'processing' ? 'processing' : 'pending'
  const vo = vs?.verified_outputs || {}
  return {
    decision, machine_decision: decision,
    legal_name: [vo.first_name, vo.last_name].filter(Boolean).join(' ') || null,
    date_of_birth: vo.dob ? `${vo.dob.year}-${String(vo.dob.month).padStart(2, '0')}-${String(vo.dob.day).padStart(2, '0')}` : null,
    document_type: vo.id_number_type || null,
    // Stripe's verified decision is evidence for the checks explicitly requested at session
    // creation. It does not expose a portable 0–100 score, so that remains unknown.
    document_result: decision === 'verified' ? 'passed' : decision === 'failed' ? 'failed' : 'unknown',
    live_face_result: decision === 'verified' ? 'passed' : decision === 'failed' ? 'failed' : 'unknown',
    liveness_result: decision === 'verified' ? 'passed' : decision === 'failed' ? 'failed' : 'unknown',
    face_match_score: null,
    evidence_reference: vs?.id || null,
    last_error: vs?.last_error?.reason || null,
  }
}

const PURPOSES = new Set(['test_drive', 'credit_application', 'remote_purchase', 'esign', 'payment', 'delivery'])
const publicVerification = (v) => ({
  id: v.id, contact_id: v.contact_id, provider: v.provider, purpose: v.purpose,
  status: v.decision, decision: v.decision, requested_at: v.requested_at,
  completed_at: v.completed_at, expires_at: v.expires_at,
  document_result: v.document_result, live_face_result: v.live_face_result,
  liveness_result: v.liveness_result, face_match_score: v.face_match_score,
  legal_name: v.legal_name, dob: v.date_of_birth, document_type: v.document_type,
  verified_address: v.verified_address, masked_document_number: v.masked_document_number,
  document_expiry: v.document_expiry, issuing_jurisdiction: v.issuing_jurisdiction,
  machine_decision: v.machine_decision, provider_version: v.provider_version,
  model_version: v.model_version, evidence_reference: v.evidence_reference,
  reviewed_at: v.reviewed_at, review_reason: v.review_reason,
  customer_name: v.contacts?.full_name || null,
  last_error: v.last_error, verified_at: v.decision === 'verified' ? v.completed_at : null,
})

export async function identityAttention(dealershipId) {
  const { data, error } = await supabaseAdmin.from('identity_verifications')
    .select('id, contact_id, purpose, provider, decision, requested_at, last_error, contacts(full_name)')
    .eq('dealership_id', dealershipId).in('decision', ['manual_review', 'failed'])
    .order('requested_at', { ascending: true }).limit(100)
  if (error) throw error
  return (data || []).map(v => ({
    kind: v.decision === 'manual_review' ? 'identity_manual_review' : 'identity_failed',
    severity: v.decision === 'manual_review' ? 2 : 3,
    subject: `${v.contacts?.full_name || 'Customer'} · ${String(v.purpose).replace(/_/g, ' ')}`,
    reason: v.decision === 'manual_review' ? 'Identity evidence requires an authorized decision.' : (v.last_error || 'Identity verification failed.'),
    owner: 'Management', action: v.decision === 'manual_review' ? 'Review Identity' : 'Resolve Identity Failure',
    ref: v.id, source_type: 'identity_verification', source_id: v.id,
    department: 'Management', attention_type: v.decision === 'manual_review' ? 'approval' : 'exception',
    due_at: v.requested_at, deep_link: '#/w/sales/crm',
  }))
}

export function registerIdentity(app) {
  app.get('/identity/config', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    const available = availableProviders()
    const selected = req.dealershipId ? await resolveProvider(req.dealershipId) : identityProvider()
    res.json({
      ok: true, configured: configured(), available,
      providers: available.map(p => ({ value: p, label: PROVIDER_LABELS[p] || p })),
      selected, native: { available: false, reason: 'No vetted native liveness and face-match stack is configured.' },
    })
  })

  // Managers pin which verification provider this dealership uses (only among the ones
  // the server actually has keys for). Stored on a dealer_integrations 'identity' row.
  app.put('/identity/provider', requireAuth, requireMfa, requirePermission('integrations.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const provider = String(req.body?.provider || '').toLowerCase()
    if (!availableProviders().includes(provider)) return res.status(400).json({ error: 'That verification provider isn’t available.' })
    await supabaseAdmin.from('dealer_integrations').upsert({
      dealership_id: req.dealershipId, provider: 'identity', enabled: true, status: 'configured',
      lender_code_map: { provider }, updated_at: new Date().toISOString(),
    }, { onConflict: 'dealership_id,provider' })
    audit(req, 'identity.provider_updated', { after_state: { provider } })
    res.json({ ok: true, selected: provider })
  })

  app.post('/identity/start', requireAuth, requireMfa, requirePermission('identity.request'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!configured()) return res.status(501).json({ error: 'Identity verification isn’t configured on this server yet.' })
    const contactId = String(req.body?.contact_id || '')
    const purpose = String(req.body?.purpose || 'test_drive')
    if (!contactId) return res.status(400).json({ error: 'contact_id required' })
    if (!PURPOSES.has(purpose)) return res.status(400).json({ error: 'A valid verification purpose is required.' })
    const { data: contact } = await supabaseAdmin.from('contacts')
      .select('id, full_name, email').eq('id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!contact) return res.status(404).json({ error: 'Customer not found' })
    const provider = await resolveProvider(req.dealershipId)
    const returnUrl = `${FRONTEND_URL.replace(/\/$/, '')}/dashboard.html?idv=done&contact=${encodeURIComponent(contactId)}`
    try {
      let sessionId, url
      if (provider === 'persona') {
        const inq = await personaStart(contactId, returnUrl)
        sessionId = inq.id; url = inq.url
      } else {
        const vs = await stripe.identity.verificationSessions.create({
          type: 'document',
          metadata: { dealership_id: req.dealershipId, contact_id: contactId },
          options: { document: { require_matching_selfie: true, require_live_capture: true } },
          return_url: returnUrl,
        })
        sessionId = vs.id; url = vs.url
      }
      const { data: verification, error: writeError } = await supabaseAdmin.from('identity_verifications').insert({
        dealership_id: req.dealershipId, contact_id: contactId, provider,
        provider_reference: sessionId, purpose, decision: 'pending', machine_decision: 'pending',
        requested_by: req.user?.id || null, evidence_reference: sessionId,
      }).select('*').single()
      if (writeError) throw writeError
      audit(req, 'customer.identity_verification_started', { contact_id: contactId, verification_id: verification.id, provider, purpose })
      res.json({ ok: true, url, status: 'pending', verification_id: verification.id, purpose })
    } catch (e) {
      const msg = provider === 'stripe' && /not.*enabled|activate|identity/i.test(e.message || '')
        ? 'Turn on Stripe Identity in your Stripe dashboard (Settings → Identity) to use verification.'
        : (e.message || 'Could not start verification.')
      res.status(400).json({ error: msg })
    }
  })

  app.get('/identity/status', requireAuth, requireMfa, requirePermission('identity.view'), async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const contactId = String(req.query.contact_id || '')
    if (!contactId) return res.status(400).json({ error: 'contact_id required' })
    const { data: contact } = await supabaseAdmin.from('contacts')
      .select('id')
      .eq('id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!contact) return res.status(404).json({ error: 'Customer not found' })
    let query = supabaseAdmin.from('identity_verifications').select('*')
      .eq('dealership_id', req.dealershipId).eq('contact_id', contactId)
    if (req.query.purpose) query = query.eq('purpose', String(req.query.purpose))
    const { data: verification, error: readError } = await query.order('requested_at', { ascending: false }).limit(1).maybeSingle()
    if (readError) return res.status(500).json({ error: readError.message })
    if (!verification) return res.json({ ok: true, status: 'unstarted', verification: null })
    if (!verification.provider_reference || !configured() || !['pending', 'processing'].includes(verification.decision)) {
      const result = publicVerification(verification)
      return res.json({ ok: true, ...result, verification: result })
    }
    const provider = verification.provider
    try {
      let normalized
      if (provider === 'persona') {
        normalized = await personaStatus(verification.provider_reference)
      } else {
        normalized = normalizeStripeSession(await stripe.identity.verificationSessions.retrieve(verification.provider_reference, { expand: ['verified_outputs'] }))
      }
      const terminal = ['verified', 'manual_review', 'failed', 'expired', 'cancelled'].includes(normalized.decision)
      const patch = { ...normalized, completed_at: terminal ? (verification.completed_at || new Date().toISOString()) : null }
      const { data: saved, error: saveError } = await supabaseAdmin.from('identity_verifications').update(patch)
        .eq('id', verification.id).eq('dealership_id', req.dealershipId).select('*').single()
      if (saveError) throw saveError
      audit(req, 'customer.identity_verification_status_checked', { contact_id: contactId, verification_id: saved.id, after_state: { decision: saved.decision, provider } })
      const result = publicVerification(saved)
      res.json({ ok: true, ...result, verification: result })
    } catch (e) {
      const result = publicVerification(verification)
      res.json({ ok: true, ...result, verification: result, error: e.message })
    }
  })

  app.get('/identity/reviews', requireAuth, requireMfa, requirePermission('identity.review'), async (req, res) => {
    const { data, error } = await supabaseAdmin.from('identity_verifications').select('*, contacts(full_name)')
      .eq('dealership_id', req.dealershipId).eq('decision', 'manual_review')
      .order('requested_at', { ascending: true }).limit(100)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ reviews: (data || []).map(publicVerification) })
  })

  app.post('/identity/:id/review', requireAuth, requireMfa, requirePermission('identity.review'), async (req, res) => {
    const decision = String(req.body?.decision || '')
    const reason = String(req.body?.reason || '').trim()
    if (!['verified', 'failed'].includes(decision) || !reason) return res.status(400).json({ error: 'Decision and review reason are required.' })
    const { data: current } = await supabaseAdmin.from('identity_verifications').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!current) return res.status(404).json({ error: 'Verification not found' })
    if (current.decision !== 'manual_review') return res.status(409).json({ error: 'Only a Manual Review verification can be reviewed.' })
    if (decision === 'verified' && (current.document_result === 'unknown' || current.liveness_result === 'unknown' || !current.evidence_reference)) {
      return res.status(409).json({ error: 'Provider-backed document and liveness evidence is required before this can be verified. Use an authorized override only when policy permits.' })
    }
    const { data: saved, error } = await supabaseAdmin.from('identity_verifications').update({
      decision, reviewed_by: req.user?.id || null, reviewed_at: new Date().toISOString(),
      review_reason: reason, completed_at: current.completed_at || new Date().toISOString(),
    }).eq('id', current.id).eq('dealership_id', req.dealershipId).eq('decision', 'manual_review').select('*').single()
    if (error) return res.status(409).json({ error: error.message })
    audit(req, 'customer.identity_verification_reviewed', { contact_id: current.contact_id, verification_id: current.id, before_state: { decision: current.decision }, after_state: { decision, reason } })
    res.json({ ok: true, verification: publicVerification(saved) })
  })

  // Override is deliberately separate from ordinary review. It never rewrites the provider's
  // machine result and is available only to the small identity.override permission set.
  app.post('/identity/:id/override', requireAuth, requireMfa, requirePermission('identity.override'), async (req, res) => {
    const decision = String(req.body?.decision || '')
    const reason = String(req.body?.reason || '').trim()
    if (!['verified', 'failed'].includes(decision) || reason.length < 10) {
      return res.status(400).json({ error: 'Override decision and a meaningful reason are required.' })
    }
    const { data: current } = await supabaseAdmin.from('identity_verifications').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!current) return res.status(404).json({ error: 'Verification not found' })
    if (!['manual_review', 'verified', 'failed'].includes(current.decision)) {
      return res.status(409).json({ error: 'A pending verification cannot be overridden.' })
    }
    const { data: saved, error } = await supabaseAdmin.from('identity_verifications').update({
      decision, reviewed_by: req.user?.id || null, reviewed_at: new Date().toISOString(),
      override_reason: reason, completed_at: current.completed_at || new Date().toISOString(),
    }).eq('id', current.id).eq('dealership_id', req.dealershipId).eq('updated_at', current.updated_at).select('*').maybeSingle()
    if (error) return res.status(409).json({ error: error.message })
    if (!saved) return res.status(409).json({ error: 'The verification changed while you were reviewing it.' })
    audit(req, 'customer.identity_verification_overridden', {
      contact_id: current.contact_id, verification_id: current.id,
      before_state: { decision: current.decision, machine_decision: current.machine_decision },
      after_state: { decision, override_reason: reason },
    })
    res.json({ ok: true, verification: publicVerification(saved) })
  })
}
