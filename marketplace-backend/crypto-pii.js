/**
 * App-layer encryption for sensitive PII (SIN, DOB) and vendor credentials.
 *
 * AES-256-GCM with a random 96-bit IV per value; output is "v1:" + base64(iv|tag|
 * ciphertext). The key comes from PII_ENCRYPTION_KEY — a 32-byte key as 64 hex chars
 * or base64. Generate one with:  openssl rand -hex 32
 *
 * Fails CLOSED: if the key is missing or malformed, encrypt() throws so we can never
 * silently write plaintext. Callers surface a clear "set PII_ENCRYPTION_KEY" error.
 */
import crypto from 'node:crypto'
import { supabaseAdmin } from './shared.js'

let _key = null
function key() {
  if (_key) return _key
  const raw = (process.env.PII_ENCRYPTION_KEY || '').trim()
  if (!raw) throw new Error('PII_ENCRYPTION_KEY is not set — cannot store or read encrypted fields.')
  let buf
  if (/^[0-9a-fA-F]{64}$/.test(raw)) buf = Buffer.from(raw, 'hex')
  else { try { buf = Buffer.from(raw, 'base64') } catch { buf = null } }
  if (!buf || buf.length !== 32) throw new Error('PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).')
  _key = buf
  return _key
}

export function piiConfigured() {
  try { key(); return true } catch { return false }
}

/** Encrypt a string → "v1:base64". Returns null for empty input. */
export function encryptField(plaintext) {
  if (plaintext == null || plaintext === '') return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return 'v1:' + Buffer.concat([iv, tag, ct]).toString('base64')
}

/** Decrypt a "v1:base64" payload → string. Returns null on empty/failure. */
export function decryptField(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('v1:')) return null
  try {
    const buf = Buffer.from(payload.slice(3), 'base64')
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch (e) { console.warn('[pii] decrypt failed:', e.message); return null }
}

/** JSON blob helpers for vendor credentials. */
export function encryptJson(obj) { return encryptField(JSON.stringify(obj || {})) }
export function decryptJson(payload) { const s = decryptField(payload); if (!s) return null; try { return JSON.parse(s) } catch { return null } }

/** Non-reversible display mask, e.g. maskTail('123456789', 4) => '•••••6789'. */
export function maskTail(value, keep = 4) {
  const s = String(value || '').replace(/\s/g, '')
  if (!s) return null
  const tail = s.slice(-keep)
  return '•'.repeat(Math.max(0, s.length - keep)) + tail
}

/** Write an audit row for any access to sensitive data (best-effort, never throws). */
export async function logSensitiveAccess({ dealershipId, actorId, entity, entityId, action, detail, ip }) {
  try {
    await supabaseAdmin.from('sensitive_access_log').insert({
      dealership_id: dealershipId || null, actor_id: actorId || null,
      entity: entity || null, entity_id: entityId || null,
      action: action || null, detail: detail ? String(detail).slice(0, 300) : null, ip: ip || null,
    })
  } catch (e) { console.warn('[pii] audit log failed:', e.message) }
}
