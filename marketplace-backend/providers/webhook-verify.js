/**
 * Outbound webhook signature helper for receivers (and our own tests).
 * MarketSync signs bodies as HMAC-SHA256 hex with header:
 *   X-MarketSync-Signature: sha256=<hex>
 */
import crypto from 'node:crypto'

export function signMarketSyncWebhook(secret, body) {
  if (!secret) return null
  const payload = typeof body === 'string' ? body : JSON.stringify(body || {})
  return 'sha256=' + crypto.createHmac('sha256', String(secret)).update(payload).digest('hex')
}

export function verifyMarketSyncWebhook({ secret, body, signature } = {}) {
  if (!secret) return { ok: false, reason: 'No signing secret configured.' }
  const expect = signMarketSyncWebhook(secret, body)
  const got = String(signature || '')
  if (!expect || !got) return { ok: false, reason: 'Missing signature.' }
  const a = Buffer.from(got)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Signature mismatch.' }
  }
  return { ok: true }
}
