import * as dns from 'dns'
import { isIP } from 'node:net'

function isPrivateIp(ip) {
  if (isIP(ip) !== 4) return true
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

export async function isSafeHttpUrl(rawUrl) {
  let parsed
  try { parsed = new URL(String(rawUrl || '').trim()) } catch { return false }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hostname === 'localhost') return false
  if (isIP(parsed.hostname) && isPrivateIp(parsed.hostname)) return false
  try {
    const { address } = await dns.promises.lookup(parsed.hostname)
    if (isPrivateIp(address)) return false
  } catch {
    // DNS failures are handled by the probe itself; do not misclassify a failed
    // public lookup as an internal-address request.
  }
  return true
}

export const isSafeFeedProbeUrl = isSafeHttpUrl
