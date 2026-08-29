import crypto from 'node:crypto'

const recent = new Map()
const keyFor = (dealershipId, url, reason) => `${dealershipId}:${url}:${reason}`

export function queueIndexNowSubmission({ dealershipId, url, reason, published = false, now = Date.now(), debounceMs = 300000 }) {
  if (!published) return { status: 'blocked_draft', submitted: false, url, reason }
  try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) return { status: 'invalid_url', submitted: false, url, reason } } catch { return { status: 'invalid_url', submitted: false, url, reason } }
  const key = keyFor(dealershipId, url, reason); const previous = recent.get(key); if (previous && now - previous < debounceMs) return { status: 'debounced', submitted: false, url, reason, provider: 'indexnow' }
  recent.set(key, now); return { id: `indexnow_${crypto.randomBytes(5).toString('hex')}`, status: 'queued', submitted: false, url, reason, provider: 'indexnow', submittedAt: null, result: null, indexed: null }
}

export function recordIndexNowResult(submission, result) { return { ...submission, status: result?.success ? 'submitted' : 'failed', submitted: !!result?.success, submittedAt: new Date().toISOString(), result: result || null, indexed: null } }
