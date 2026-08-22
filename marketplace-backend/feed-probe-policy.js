import { validateOutboundUrl } from './outbound-http-policy.js'

export async function isSafeHttpUrl(rawUrl) {
  const res = await validateOutboundUrl(rawUrl)
  return res.ok
}

export const isSafeFeedProbeUrl = isSafeHttpUrl

