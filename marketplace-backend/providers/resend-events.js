/**
 * Resend delivery events. Sending is already wired through the Resend SDK.
 * This module verifies the Svix-signed webhook and maps provider events onto
 * a canonical message status. Delivered/bounced is only true when Resend said so.
 */
import crypto from 'node:crypto'

export function resendSendingConfigured() {
  return !!process.env.RESEND_API_KEY
}

export function resendEventsConfigured() {
  return !!process.env.RESEND_WEBHOOK_SECRET
}

function parseSecret(raw) {
  const s = String(raw || '')
  if (s.startsWith('whsec_')) return Buffer.from(s.slice(6), 'base64')
  return Buffer.from(s)
}

export function verifyResendSignature({ payload, headers = {}, secret } = {}) {
  const key = secret || process.env.RESEND_WEBHOOK_SECRET
  if (!key) return { ok: false, reason: 'RESEND_WEBHOOK_SECRET is not set.' }
  const id = headers['svix-id'] || headers['Svix-Id']
  const ts = headers['svix-timestamp'] || headers['Svix-Timestamp']
  const sig = headers['svix-signature'] || headers['Svix-Signature']
  if (!id || !ts || !sig) return { ok: false, reason: 'Missing Svix signature headers.' }
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(Number(ts)) || age > 5 * 60) return { ok: false, reason: 'Stale or invalid Svix timestamp.' }
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {})
  const expected = crypto.createHmac('sha256', parseSecret(key)).update(`${id}.${ts}.${body}`).digest('base64')
  const candidates = String(sig).split(' ').map(part => part.replace(/^v1,/, '').replace(/^v1=/, ''))
  const match = candidates.some(c => {
    try {
      const a = Buffer.from(c)
      const b = Buffer.from(expected)
      return a.length === b.length && crypto.timingSafeEqual(a, b)
    } catch { return false }
  })
  if (!match) return { ok: false, reason: 'Invalid Resend webhook signature.' }
  return { ok: true }
}

const STATUS_OF = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
}

export function mapResendEvent(body = {}) {
  const type = String(body.type || body.event || '')
  const data = body.data || {}
  const status = STATUS_OF[type]
  if (!status) return { accepted: false, reason: `Unsupported Resend event ${type || '(none)'}` }
  const emailId = data.email_id || data.id || null
  if (!emailId) return { accepted: false, reason: 'Resend event had no email id.' }
  return {
    accepted: true,
    status,
    email_id: String(emailId),
    to: data.to || null,
    evidence: { provider: 'resend', type, email_id: String(emailId) },
  }
}
