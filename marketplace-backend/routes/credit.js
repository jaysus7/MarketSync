/**
 * Credit applications — the spine of desking a real deal.
 *
 * Captures the full lender-grade applicant / co-applicant / employment / income /
 * residence / financing record, stores SIN & DOB ENCRYPTED (crypto-pii), records the
 * applicant's credit-pull consent, and exports the STAR-style credit-application XML
 * (and a print/PDF on the client) so an F&I manager can push it into RouteOne /
 * Dealertrack today — even before a live DSP pipe exists. Every reveal/export/submit
 * is written to sensitive_access_log.
 */
import { supabaseAdmin } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { getClientIp } from '../security.js'
import { encryptField, decryptField, maskTail, piiConfigured, logSensitiveAccess } from '../crypto-pii.js'
import { getCreditProvider } from '../providers/credit.js'

const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)
const str = (v) => { const s = (v == null ? '' : String(v)).trim(); return s || null }
const digits = (v) => String(v || '').replace(/\D/g, '')

// Strip encrypted columns; expose only masks + presence flags for normal reads.
function publicShape(row) {
  if (!row) return null
  const { applicant_sin_enc, applicant_dob_enc, co_sin_enc, co_dob_enc, ...rest } = row
  return {
    ...rest,
    has_applicant_sin: !!applicant_sin_enc,
    has_applicant_dob: !!applicant_dob_enc,
    has_co_sin: !!co_sin_enc,
    has_co_dob: !!co_dob_enc,
  }
}

export function registerCredit(app) {
  // ── Read the application for a deal (or contact). Masked; never returns PII. ──
  app.get('/credit/application', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const dealId = str(req.query.deal_id), contactId = str(req.query.contact_id)
    if (!dealId && !contactId) return res.status(400).json({ error: 'deal_id or contact_id required' })
    let q = supabaseAdmin.from('credit_applications').select('*').eq('dealership_id', req.dealershipId)
    q = dealId ? q.eq('deal_id', dealId) : q.eq('contact_id', contactId)
    const { data } = await q.order('updated_at', { ascending: false }).limit(1).maybeSingle()
    res.json({ ok: true, application: publicShape(data), pii_ready: piiConfigured() })
  })

  // ── Create / update (draft or ready). Encrypts SIN/DOB, captures consent. ──
  app.post('/credit/application', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const b = req.body || {}
    const dealId = str(b.deal_id), contactId = str(b.contact_id)

    // Confirm the deal (if given) belongs to this dealership.
    if (dealId) {
      const { data: dl } = await supabaseAdmin.from('deals').select('id, contact_id').eq('id', dealId).eq('dealership_id', req.dealershipId).maybeSingle()
      if (!dl) return res.status(404).json({ error: 'Deal not found' })
    }

    // Sensitive values arrive as plaintext over TLS; encrypt before storing.
    const sinFields = { applicant_sin: b.applicant_sin, applicant_dob: b.applicant_dob, co_sin: b.co_sin, co_dob: b.co_dob }
    const anySensitive = Object.values(sinFields).some(v => v != null && v !== '')
    if (anySensitive && !piiConfigured()) {
      return res.status(400).json({ error: 'Set the PII_ENCRYPTION_KEY environment variable before saving SIN / date of birth.' })
    }

    const now = new Date().toISOString()
    const row = {
      dealership_id: req.dealershipId,
      deal_id: dealId || null,
      contact_id: contactId || null,
      created_by: req.user?.id || null,
      status: ['draft', 'ready', 'submitted', 'approved', 'conditioned', 'declined'].includes(b.status) ? b.status : 'draft',
      applicant: (b.applicant && typeof b.applicant === 'object') ? b.applicant : {},
      co_applicant: (b.co_applicant && typeof b.co_applicant === 'object') ? b.co_applicant : null,
      financing: (b.financing && typeof b.financing === 'object') ? b.financing : {},
      vehicle: (b.vehicle && typeof b.vehicle === 'object') ? b.vehicle : {},
      updated_at: now,
    }
    // Only overwrite an encrypted field when a new value was supplied (empty clears it).
    const applyEnc = (plainKey, encKey, maskKey) => {
      if (b[plainKey] === undefined) return
      const v = str(b[plainKey])
      row[encKey] = v ? encryptField(v) : null
      if (maskKey) row[maskKey] = v ? maskTail(digits(v), 4) : null
    }
    applyEnc('applicant_sin', 'applicant_sin_enc', 'applicant_sin_mask')
    applyEnc('applicant_dob', 'applicant_dob_enc', null)
    applyEnc('co_sin', 'co_sin_enc', 'co_sin_mask')
    applyEnc('co_dob', 'co_dob_enc', null)

    // Consent: stamp once when the applicant authorizes the credit pull.
    const { data: existing } = dealId
      ? await supabaseAdmin.from('credit_applications').select('id, consent, created_by, created_at').eq('deal_id', dealId).eq('dealership_id', req.dealershipId).maybeSingle()
      : { data: null }
    if (b.consent === true && !existing?.consent) {
      row.consent = true
      row.consent_at = now
      row.consent_ip = getClientIp(req)
      row.consent_method = ['e-sign', 'verbal', 'paper'].includes(b.consent_method) ? b.consent_method : 'e-sign'
    } else if (b.consent === false) {
      row.consent = false
    }
    if (existing) { row.created_by = existing.created_by || row.created_by; row.created_at = existing.created_at }

    // Upsert keyed on the deal (one credit app per deal). Without a deal, insert new.
    let saved
    if (dealId) {
      const { data, error } = await supabaseAdmin.from('credit_applications').upsert(row, { onConflict: 'deal_id' }).select().maybeSingle()
      if (error) { console.error('[credit] save failed:', error.message); return res.status(500).json({ error: 'Save failed' }) }
      saved = data
    } else {
      const { data, error } = await supabaseAdmin.from('credit_applications').insert(row).select().maybeSingle()
      if (error) { console.error('[credit] save failed:', error.message); return res.status(500).json({ error: 'Save failed' }) }
      saved = data
    }
    res.json({ ok: true, application: publicShape(saved) })
  })

  // ── Reveal decrypted SIN/DOB (audited) — for the F&I manager on-screen. ──
  app.get('/credit/application/:id/reveal', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { data: row } = await supabaseAdmin.from('credit_applications').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!row) return res.status(404).json({ error: 'Not found' })
    await logSensitiveAccess({ dealershipId: req.dealershipId, actorId: req.user?.id, entity: 'credit_application', entityId: row.id, action: 'reveal', ip: getClientIp(req) })
    res.json({
      ok: true,
      applicant_sin: decryptField(row.applicant_sin_enc),
      applicant_dob: decryptField(row.applicant_dob_enc),
      co_sin: decryptField(row.co_sin_enc),
      co_dob: decryptField(row.co_dob_enc),
    })
  })

  // ── Export the STAR-style credit-application XML (audited). ──
  app.post('/credit/application/:id/export', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { data: row } = await supabaseAdmin.from('credit_applications').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!row) return res.status(404).json({ error: 'Not found' })
    const { data: dealer } = await supabaseAdmin.from('dealerships').select('name, city, province, postal_code, website_url').eq('id', req.dealershipId).maybeSingle()
    const secrets = {
      applicant_sin: decryptField(row.applicant_sin_enc), applicant_dob: decryptField(row.applicant_dob_enc),
      co_sin: decryptField(row.co_sin_enc), co_dob: decryptField(row.co_dob_enc),
    }
    await logSensitiveAccess({ dealershipId: req.dealershipId, actorId: req.user?.id, entity: 'credit_application', entityId: row.id, action: 'export', detail: 'xml', ip: getClientIp(req) })
    const xml = buildCreditXml(row, dealer || {}, secrets)
    res.json({ ok: true, xml, filename: `credit-app-${(row.id || '').slice(0, 8)}.xml` })
  })

  // ── Submit to the lender rail (manual export today; live when DSP-certified). ──
  app.post('/credit/application/:id/submit', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const providerName = str(req.body?.provider) || 'routeone'
    const { data: row } = await supabaseAdmin.from('credit_applications').select('*').eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!row) return res.status(404).json({ error: 'Not found' })
    const { data: integration } = await supabaseAdmin.from('dealer_integrations')
      .select('*').eq('dealership_id', req.dealershipId).eq('provider', providerName).maybeSingle()

    const provider = getCreditProvider(providerName, integration)
    const result = await provider.submit(row, { integration })
    await logSensitiveAccess({ dealershipId: req.dealershipId, actorId: req.user?.id, entity: 'credit_application', entityId: row.id, action: 'submit', detail: `${providerName}:${result.mode}`, ip: getClientIp(req) })

    // Reflect submission on the record (manual submits still mark it submitted).
    await supabaseAdmin.from('credit_applications').update({
      status: result.mode === 'manual' ? row.status : 'submitted',
      provider: providerName, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    res.json({ ok: true, ...result })
  })
}

// ── STAR-style credit application XML ────────────────────────────────────────
// A clean, mappable representation of the industry credit-application payload
// (applicant / co-applicant / employment / residence / financing / vehicle). Not a
// certified schema, but 1:1 with what RouteOne / Dealertrack ingest so mapping to a
// live rail later is straightforward.
function xe(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function tag(name, v) { return v == null || v === '' ? '' : `<${name}>${xe(v)}</${name}>` }

function personXml(label, p, sin, dob) {
  p = p || {}
  const addr = p.address || {}, emp = p.employment || {}
  return `  <${label}>
    ${tag('FirstName', p.first)}${tag('MiddleName', p.middle)}${tag('LastName', p.last)}
    ${tag('SIN', sin)}${tag('DateOfBirth', dob)}${tag('MaritalStatus', p.marital)}${tag('Dependents', p.dependents)}
    ${tag('Email', p.email)}${tag('HomePhone', p.phone_home)}${tag('CellPhone', p.phone)}
    <Residence>
      ${tag('Street', addr.street)}${tag('City', addr.city)}${tag('Province', addr.province)}${tag('PostalCode', addr.postal)}
      ${tag('Status', addr.status)}${tag('MonthlyPayment', addr.payment)}${tag('YearsAt', addr.years)}${tag('MonthsAt', addr.months)}
    </Residence>
    <Employment>
      ${tag('Employer', emp.employer)}${tag('Occupation', emp.occupation)}${tag('Status', emp.status)}
      ${tag('Phone', emp.phone)}${tag('YearsAt', emp.years)}${tag('MonthsAt', emp.months)}
      ${tag('GrossMonthlyIncome', emp.income_monthly)}${tag('IncomeType', emp.income_type)}
    </Employment>
    ${p.other_income ? `<OtherIncome>${tag('Amount', p.other_income.amount)}${tag('Source', p.other_income.source)}</OtherIncome>` : ''}
  </${label}>`
}

export function buildCreditXml(row, dealer, secrets) {
  const f = row.financing || {}, v = row.vehicle || {}
  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditApplication xmlns="http://www.starstandard.org/STAR/5" version="1.0" source="MarketSync">
  <Dealer>
    ${tag('Name', dealer.name)}${tag('City', dealer.city)}${tag('Province', dealer.province)}${tag('PostalCode', dealer.postal_code)}${tag('Website', dealer.website_url)}
  </Dealer>
  ${personXml('Applicant', row.applicant, secrets.applicant_sin, secrets.applicant_dob)}
  ${row.co_applicant ? personXml('CoApplicant', row.co_applicant, secrets.co_sin, secrets.co_dob) : ''}
  <Vehicle>
    ${tag('Year', v.year)}${tag('Make', v.make)}${tag('Model', v.model)}${tag('Trim', v.trim)}${tag('VIN', v.vin)}${tag('Mileage', v.mileage)}${tag('StockNumber', v.stock)}${tag('Condition', v.condition || 'Used')}
  </Vehicle>
  <Financing>
    ${tag('Lender', f.lender)}${tag('Program', f.program)}
    ${tag('CashPrice', f.selling_price)}${tag('Tax', f.tax_amount)}${tag('Fees', f.fees_total)}
    ${tag('TradeAllowance', f.trade_value)}${tag('TradePayoff', f.trade_payoff)}
    ${tag('CashDown', f.down_payment)}${tag('Rebate', f.rebate)}${tag('AmountFinanced', f.amount_financed)}
    ${tag('APR', f.apr)}${tag('TermMonths', f.term)}${tag('PaymentFrequency', f.payment_freq)}${tag('Payment', f.payment)}${tag('FirstPaymentDate', f.first_payment_date)}
  </Financing>
  <Consent>
    ${tag('CreditPullAuthorized', row.consent ? 'true' : 'false')}${tag('AuthorizedAt', row.consent_at)}${tag('Method', row.consent_method)}
  </Consent>
</CreditApplication>`
}
