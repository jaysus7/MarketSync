/**
 * Native e-signature — MarketSync's own signing flow (no DocuSign). A manager sends
 * a document (bill of sale, credit app, anything the desk already renders as HTML)
 * for signature; the customer opens a tokened public link, reviews the exact document
 * in a sandboxed frame, signs (typed + drawn), and agrees to an e-sign consent. We
 * capture the signature image, timestamp, IP and user-agent as a tamper-evident audit
 * trail, email both parties, and log it to the customer's timeline.
 *
 *   POST /esign/create        (manager) create a request from an HTML doc → signing URL
 *   GET  /esign/:token        (public)  the document + signer info (records "viewed")
 *   POST /esign/:token/sign   (public)  capture signature + consent → signed
 *   POST /esign/:token/decline(public)  signer declines
 *   GET  /esign               (manager) list this dealership's requests
 *   GET  /esign/:id/detail    (manager) one request incl. signature (for the record)
 */
import crypto from 'node:crypto'
import { supabaseAdmin, resend, EMAIL_FROM, FRONTEND_URL } from '../shared.js'
import { requireAuth } from '../middleware.js'
import { rateLimit, getClientIp } from '../security.js'
import { audit, AuditAction } from '../audit.js'

const CONSENT ='By signing electronically, I agree that my electronic signature is the legal equivalent of my handwritten signature and that I have reviewed this document.'
const signUrl = (token) => `${FRONTEND_URL.replace(/\/$/, '')}/esign.html?t=${token}`

export function registerEsign(app) {
  // Create a signing request. Body: { doc_html, doc_title, doc_type, contact_id,
  // deal_id, signer_name, signer_email }. Returns the public signing URL.
  app.post('/esign/create', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const b = req.body || {}
    const doc_html = String(b.doc_html || '')
    if (doc_html.length < 20) return res.status(400).json({ error: 'Nothing to sign — generate the document first.' })
    if (doc_html.length > 400000) return res.status(400).json({ error: 'Document is too large to send for signature.' })
    const signer_email = String(b.signer_email || '').trim().slice(0, 160)
    const token = crypto.randomBytes(24).toString('base64url')
    const row = {
      dealership_id: req.dealershipId, contact_id: b.contact_id || null, deal_id: b.deal_id || null,
      token, doc_type: String(b.doc_type || 'document').slice(0, 40), doc_title: String(b.doc_title || 'Document').slice(0, 160),
      doc_html, signer_name: String(b.signer_name || '').trim().slice(0, 120) || null, signer_email: signer_email || null,
      status: 'sent', consent_text: CONSENT, created_by: req.user?.id || null,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      audit: [{ event: 'created', by: req.user?.email || null, at: new Date().toISOString() }],
    }
    const { data, error } = await supabaseAdmin.from('esign_requests').insert(row).select('id, token').single()
    if (error) { console.error('[esign] create failed:', error.message); return res.status(500).json({ error: 'Could not create the signing request.' }) }
    const url = signUrl(token)
    // Email the signer the link (best-effort).
    if (resend && signer_email) {
      const { data: d } = await supabaseAdmin.from('dealerships').select('name').eq('id', req.dealershipId).maybeSingle()
      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto"><div style="background:#1e3a8a;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><div style="font-size:19px;font-weight:800">${d?.name || 'Your dealership'} — document to sign</div></div><div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:20px"><p style="font-size:15px;color:#0f172a">Hi ${row.signer_name || 'there'}, please review and sign your ${row.doc_title}.</p><div style="margin-top:16px"><a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px">Review &amp; sign →</a></div><p style="font-size:12px;color:#94a3b8;margin-top:16px">This secure link is unique to you. It expires in 30 days.</p></div></div>`
      resend.emails.send({ from: EMAIL_FROM, to: signer_email, subject: `Please sign: ${row.doc_title}`, html }).catch(() => {})
    }
    // Timeline note on the customer's record.
    if (b.contact_id) {
      await supabaseAdmin.from('communications').insert({
        dealership_id: req.dealershipId, contact_id: b.contact_id, channel: 'note', direction: 'internal',
        subject: `Sent for e-signature: ${row.doc_title}`, body: `Signing link sent${signer_email ? ' to ' + signer_email : ''}.`,
        occurred_at: new Date().toISOString(), rep_id: req.user?.id || null, meta: { kind: 'esign_sent', esign_id: data.id },
      }).catch(() => {})
    }
    audit(req, AuditAction.ESIGN_SENT, { esign_id: data.id, doc_title: row.doc_title, doc_type: row.doc_type, signer_email: signer_email || null, contact_id: b.contact_id || null })
    res.json({ ok: true, id: data.id, token, url })
  })

  // PUBLIC: fetch the document to sign. Records a "viewed" event (once).
  app.get('/esign/:token', rateLimit('esignget', 60, 60000), async (req, res) => {
    const { data: r } = await supabaseAdmin.from('esign_requests')
      .select('id, dealership_id, doc_title, doc_type, doc_html, signer_name, status, consent_text, expires_at')
      .eq('token', req.params.token).maybeSingle()
    if (!r) return res.status(404).json({ error: 'This signing link is invalid.' })
    if (r.expires_at && new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'This signing link has expired.' })
    const { data: d } = await supabaseAdmin.from('dealerships').select('name, branding').eq('id', r.dealership_id).maybeSingle()
    if (r.status === 'sent') {
      await supabaseAdmin.from('esign_requests').update({ status: 'viewed', audit: await appendAudit(r.id, { event: 'viewed', at: new Date().toISOString(), ip: getClientIp(req) }) }).eq('id', r.id).catch(() => {})
    }
    res.json({
      ok: true, doc_title: r.doc_title, doc_type: r.doc_type, doc_html: r.doc_html,
      signer_name: r.signer_name, status: r.status, consent_text: r.consent_text || CONSENT,
      dealership: d?.name || 'Dealership', logo: d?.branding?.logo_url || null,
      already_signed: r.status === 'signed', declined: r.status === 'declined' || r.status === 'void',
    })
  })

  // PUBLIC: submit a signature. Body: { signature_name, signature_image (dataURL), agree }.
  app.post('/esign/:token/sign', rateLimit('esignsign', 20, 60000), async (req, res) => {
    const { data: r } = await supabaseAdmin.from('esign_requests').select('*').eq('token', req.params.token).maybeSingle()
    if (!r) return res.status(404).json({ error: 'This signing link is invalid.' })
    if (r.status === 'signed') return res.status(409).json({ error: 'This document was already signed.' })
    if (r.expires_at && new Date(r.expires_at) < new Date()) return res.status(410).json({ error: 'This signing link has expired.' })
    const b = req.body || {}
    const name = String(b.signature_name || '').trim().slice(0, 120)
    const img = String(b.signature_image || '')
    if (!name) return res.status(400).json({ error: 'Type your full legal name.' })
    if (!b.agree) return res.status(400).json({ error: 'You must agree to sign electronically.' })
    if (!/^data:image\/(png|jpeg);base64,/.test(img) || img.length > 400000) return res.status(400).json({ error: 'Please draw your signature.' })
    const now = new Date().toISOString()
    const ip = getClientIp(req), ua = String(req.headers['user-agent'] || '').slice(0, 300)
    const audit = Array.isArray(r.audit) ? r.audit : []
    audit.push({ event: 'signed', at: now, ip, ua, name })
    const { error } = await supabaseAdmin.from('esign_requests').update({
      status: 'signed', signature_name: name, signature_image: img, signed_at: now, signed_ip: ip, signed_ua: ua, audit,
    }).eq('id', r.id).eq('status', r.status)   // guard against a double-sign race
    if (error) return res.status(500).json({ error: 'Could not record your signature — please try again.' })

    // Notify the dealership + log to the customer timeline.
    const { data: d } = await supabaseAdmin.from('dealerships').select('name, branding, automation_settings').eq('id', r.dealership_id).maybeSingle()
    if (r.contact_id) {
      await supabaseAdmin.from('communications').insert({
        dealership_id: r.dealership_id, contact_id: r.contact_id, channel: 'note', direction: 'internal',
        subject: `Signed: ${r.doc_title}`, body: `${name} e-signed on ${new Date(now).toLocaleString('en-US')} (IP ${ip}).`,
        occurred_at: now, rep_id: r.created_by || null, meta: { kind: 'esign_signed', esign_id: r.id },
      }).catch(() => {})
    }
    if (resend) {
      const inbox = new Set()
      const house = d?.branding?.email || d?.automation_settings?.house_email
      if (house) inbox.add(String(house).toLowerCase())
      if (r.created_by) { const { data: rp } = await supabaseAdmin.from('profiles').select('email').eq('id', r.created_by).maybeSingle(); if (rp?.email) inbox.add(rp.email.toLowerCase()) }
      for (const to of inbox) resend.emails.send({ from: EMAIL_FROM, to, subject: `✅ Signed: ${r.doc_title} — ${name}`, html: `<p style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">${name} e-signed <b>${r.doc_title}</b> on ${new Date(now).toLocaleString('en-US')}.<br>IP ${ip}. Open MarketSync → the customer's record for the signed copy.</p>` }).catch(() => {})
      if (r.signer_email) resend.emails.send({ from: EMAIL_FROM, to: r.signer_email, subject: `Your signed copy — ${r.doc_title}`, html: `<p style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">Thanks ${name.split(' ')[0] || ''} — we've recorded your signature on <b>${r.doc_title}</b>. Your dealership will follow up with next steps.</p>` }).catch(() => {})
    }
    res.json({ ok: true, signed_at: now })
  })

  app.post('/esign/:token/decline', rateLimit('esignsign', 20, 60000), async (req, res) => {
    const { data: r } = await supabaseAdmin.from('esign_requests').select('id, status, audit').eq('token', req.params.token).maybeSingle()
    if (!r) return res.status(404).json({ error: 'Invalid link.' })
    if (r.status === 'signed') return res.status(409).json({ error: 'Already signed.' })
    const audit = Array.isArray(r.audit) ? r.audit : []
    audit.push({ event: 'declined', at: new Date().toISOString(), ip: getClientIp(req) })
    await supabaseAdmin.from('esign_requests').update({ status: 'declined', audit }).eq('id', r.id)
    res.json({ ok: true })
  })

  // Manager: list this dealership's signing requests (no doc_html/signature blobs).
  app.get('/esign', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data } = await supabaseAdmin.from('esign_requests')
      .select('id, token, doc_title, doc_type, signer_name, signer_email, status, signed_at, created_at, contact_id')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(200)
    res.json({ ok: true, requests: (data || []).map(r => ({ ...r, url: signUrl(r.token) })) })
  })

  // Manager: full record incl. the signed document + signature (the file of record).
  app.get('/esign/:id/detail', requireAuth, async (req, res) => {
    if (!req.dealershipId) return res.status(400).json({ error: 'No dealership' })
    const { data: r } = await supabaseAdmin.from('esign_requests').select('*')
      .eq('id', req.params.id).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!r) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true, request: { ...r, url: signUrl(r.token) } })
  })
}

// Append an audit event, returning the new array (read-modify; low concurrency).
async function appendAudit(id, event) {
  const { data } = await supabaseAdmin.from('esign_requests').select('audit').eq('id', id).maybeSingle()
  const a = Array.isArray(data?.audit) ? data.audit : []
  a.push(event)
  return a
}
