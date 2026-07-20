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
import { requireAuth } from '../middleware.js'
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
const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)

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
// Map a Persona inquiry to our status vocabulary + a non-sensitive summary.
async function personaStatus(inquiryId) {
  const j = await personaFetch(`/inquiries/${inquiryId}`)
  const a = j.data?.attributes || {}
  const raw = String(a.status || '').toLowerCase()
  let status = 'pending'
  if (raw === 'approved' || raw === 'completed') status = 'verified'
  else if (raw === 'declined' || raw === 'failed' || raw === 'expired') status = 'requires_input'
  else if (raw === 'pending') status = 'processing'
  const name = [a['name-first'], a['name-last']].filter(Boolean).join(' ') || null
  const dob = a.birthdate || null
  const report = status === 'verified'
    ? { name, dob, document_type: 'document', selfie_matched: true, provider: 'persona' }
    : (status === 'requires_input' ? { last_error: `Verification ${raw}. Ask the customer to try again.`, provider: 'persona' } : null)
  return { status, report }
}

export function registerIdentity(app) {
  app.get('/identity/config', requireAuth, async (req, res) => {
    const available = availableProviders()
    const selected = req.dealershipId ? await resolveProvider(req.dealershipId) : identityProvider()
    res.json({
      ok: true, configured: configured(), available,
      providers: available.map(p => ({ value: p, label: PROVIDER_LABELS[p] || p })),
      selected,
    })
  })

  // Managers pin which verification provider this dealership uses (only among the ones
  // the server actually has keys for). Stored on a dealer_integrations 'identity' row.
  app.put('/identity/provider', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const provider = String(req.body?.provider || '').toLowerCase()
    if (!availableProviders().includes(provider)) return res.status(400).json({ error: 'That verification provider isn’t available.' })
    await supabaseAdmin.from('dealer_integrations').upsert({
      dealership_id: req.dealershipId, provider: 'identity', enabled: true, status: 'configured',
      lender_code_map: { provider }, updated_at: new Date().toISOString(),
    }, { onConflict: 'dealership_id,provider' })
    res.json({ ok: true, selected: provider })
  })

  app.post('/identity/start', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!configured()) return res.status(501).json({ error: 'Identity verification isn’t configured on this server yet.' })
    const contactId = String(req.body?.contact_id || '')
    if (!contactId) return res.status(400).json({ error: 'contact_id required' })
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
      await supabaseAdmin.from('contacts').update({
        id_verification_session: sessionId, id_verification_status: 'pending', id_verified_at: null,
        id_verification_report: { provider },
      }).eq('id', contactId)
      audit(req, AuditAction.CONFIG_UPDATED, { id_verification_started: contactId, provider })
      res.json({ ok: true, url, status: 'pending' })
    } catch (e) {
      const msg = provider === 'stripe' && /not.*enabled|activate|identity/i.test(e.message || '')
        ? 'Turn on Stripe Identity in your Stripe dashboard (Settings → Identity) to use verification.'
        : (e.message || 'Could not start verification.')
      res.status(400).json({ error: msg })
    }
  })

  app.get('/identity/status', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const contactId = String(req.query.contact_id || '')
    if (!contactId) return res.status(400).json({ error: 'contact_id required' })
    const { data: contact } = await supabaseAdmin.from('contacts')
      .select('id, id_verification_status, id_verification_session, id_verified_at, id_verification_report')
      .eq('id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!contact) return res.status(404).json({ error: 'Customer not found' })
    // No session yet, or Stripe not configured — just return what we have.
    if (!contact.id_verification_session || !configured()) {
      return res.json({ ok: true, status: contact.id_verification_status || 'unstarted', verified_at: contact.id_verified_at, report: contact.id_verification_report })
    }
    const provider = contact.id_verification_report?.provider || await resolveProvider(req.dealershipId)
    try {
      let status, report = contact.id_verification_report
      const patch = {}
      if (provider === 'persona') {
        const r = await personaStatus(contact.id_verification_session)
        status = r.status
        if (r.report) report = { ...(report || {}), ...r.report }
      } else {
        const vs = await stripe.identity.verificationSessions.retrieve(contact.id_verification_session)
        status = vs.status  // requires_input | processing | verified | canceled
        if (status === 'verified') {
          try {
            const full = await stripe.identity.verificationSessions.retrieve(contact.id_verification_session, { expand: ['verified_outputs'] })
            const vo = full.verified_outputs || {}
            report = { name: [vo.first_name, vo.last_name].filter(Boolean).join(' ') || null, dob: vo.dob ? `${vo.dob.year}-${String(vo.dob.month).padStart(2, '0')}-${String(vo.dob.day).padStart(2, '0')}` : null, document_type: vo.id_number_type || 'document', selfie_matched: true, provider: 'stripe' }
          } catch {}
        } else if (status === 'requires_input' && vs.last_error) {
          report = { ...(report || {}), last_error: vs.last_error.reason || 'Verification needs another attempt.' }
        }
      }
      patch.id_verification_status = status
      patch.id_verification_report = report
      if (status === 'verified') patch.id_verified_at = contact.id_verified_at || new Date().toISOString()
      await supabaseAdmin.from('contacts').update(patch).eq('id', contactId)
      res.json({ ok: true, status, verified_at: patch.id_verified_at || contact.id_verified_at, report })
    } catch (e) {
      res.json({ ok: true, status: contact.id_verification_status || 'unstarted', verified_at: contact.id_verified_at, report: contact.id_verification_report, error: e.message })
    }
  })
}
