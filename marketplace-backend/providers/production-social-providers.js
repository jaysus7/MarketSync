/**
 * Production social publishing adapters.
 *
 * Every adapter returns an authoritative provider post id. Unsupported media is refused
 * before a provider call so MarketSync never reports a post as live when it was not sent.
 */
import {
  LINKEDIN_API_VERSION,
  META_GRAPH_VERSION,
  registerSocialProvider,
  socialOAuthConfigured,
} from './social-providers.js'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

class ProviderRequestError extends Error {
  constructor(message, { retryable = true, providerCode = null, accountStatus = null } = {}) {
    super(message)
    this.name = 'ProviderRequestError'
    this.retryable = retryable
    this.providerCode = providerCode
    this.accountStatus = accountStatus
  }
}

function mediaUrl(entry) {
  if (typeof entry === 'string') return entry.trim()
  return String(entry?.url || entry?.public_url || entry?.src || '').trim()
}

function publicHttpsUrl(entry) {
  const value = mediaUrl(entry)
  let parsed
  try { parsed = new URL(value) } catch { throw new ProviderRequestError('Social media must use a valid public HTTPS URL.', { retryable: false }) }
  if (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new ProviderRequestError('Social media must use a publicly accessible HTTPS URL.', { retryable: false })
  }
  return parsed
}

function mediaKind(entry) {
  const parsed = publicHttpsUrl(entry)
  const path = parsed.pathname.toLowerCase()
  if (/\.(mp4|mov)$/.test(path)) return 'video'
  if (/\.(jpe?g)$/.test(path)) return 'image'
  return 'unknown'
}

function providerError(data, fallback, status) {
  const raw = data?.error || data || {}
  const code = raw.code || raw.status || status || null
  const message = raw.message || raw.error_description || raw.detail || fallback
  const invalidToken = Number(code) === 190 || String(raw.type || '').toLowerCase().includes('oauth')
  const rateLimited = status === 429 || [4, 17, 32, 613].includes(Number(code))
  const retryable = rateLimited || status >= 500 || (!invalidToken && status !== 400 && status !== 401 && status !== 403)
  return new ProviderRequestError(message, {
    retryable,
    providerCode: code,
    accountStatus: invalidToken || status === 401 ? 'expired' : null,
  })
}

async function requestJson(url, init = {}, fallback = 'The social network refused the request.') {
  let response
  try { response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(30000) }) }
  catch (error) { throw new ProviderRequestError(`Network request failed: ${error.message}`, { retryable: true }) }
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.error || data?.errors) throw providerError(data, fallback, response.status)
  return { data, response }
}

function requireCredentials(account) {
  const token = account?.credentials?.access_token
  if (!token || !account?.external_account_id) {
    throw new ProviderRequestError('The connected account has no usable encrypted authorization. Reconnect it.', {
      retryable: false,
      accountStatus: 'expired',
    })
  }
  if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
    throw new ProviderRequestError('The connected account authorization has expired. Reconnect it.', {
      retryable: false,
      accountStatus: 'expired',
    })
  }
  return token
}

async function metaPost(path, token, params) {
  const body = new URLSearchParams({ ...params, access_token: token })
  return requestJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, 'Meta refused the publishing request.')
}

async function instagramContainerStatus(containerId, token) {
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(containerId)}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    const { data } = await requestJson(url, {}, 'Instagram could not report media processing status.')
    const status = String(data.status_code || '').toUpperCase()
    if (status === 'FINISHED' || status === 'PUBLISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new ProviderRequestError(data.status || `Instagram media processing ${status.toLowerCase()}.`, { retryable: false })
    }
    if (attempt < 10) await sleep(5000)
  }
  throw new ProviderRequestError('Instagram is still processing this media. MarketSync will retry shortly.', { retryable: true })
}

async function instagramLimitCheck(accountId, token) {
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(accountId)}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token)}`
  try {
    const { data } = await requestJson(url, {}, 'Instagram could not report its publishing limit.')
    const row = data?.data?.[0] || data
    const used = Number(row?.quota_usage)
    const total = Number(row?.config?.quota_total || 100)
    if (Number.isFinite(used) && used >= total) {
      throw new ProviderRequestError(`Instagram's ${total}-post rolling limit has been reached. MarketSync will retry later.`, { retryable: true })
    }
  } catch (error) {
    // A limit-check permission/version error must not suppress a legitimate publication.
    if (error instanceof ProviderRequestError && /rolling limit/.test(error.message)) throw error
  }
}

async function createInstagramChild(accountId, token, entry, caption, carouselItem = false) {
  const parsed = publicHttpsUrl(entry)
  const kind = mediaKind(entry)
  if (kind === 'unknown') {
    throw new ProviderRequestError('Instagram accepts JPEG images and MP4/MOV videos. Convert this asset and try again.', { retryable: false })
  }
  const params = carouselItem ? { is_carousel_item: 'true' } : { caption: String(caption || '') }
  if (kind === 'image') params.image_url = parsed.href
  else {
    params.video_url = parsed.href
    params.media_type = carouselItem ? 'VIDEO' : 'REELS'
    if (!carouselItem) params.share_to_feed = 'true'
  }
  const { data } = await metaPost(`${encodeURIComponent(accountId)}/media`, token, params)
  if (!data.id) throw new ProviderRequestError('Instagram created no media container id.', { retryable: true })
  if (kind === 'video') await instagramContainerStatus(data.id, token)
  return data.id
}

export function createInstagramAdapter() {
  return {
    async publish({ account, body, media }) {
      const token = requireCredentials(account)
      const caption = String(body || '')
      if (caption.length > 2200) throw new ProviderRequestError('Instagram captions must be 2,200 characters or fewer.', { retryable: false })
      const items = (Array.isArray(media) ? media : []).filter(mediaUrl)
      if (!items.length) throw new ProviderRequestError('Instagram requires at least one image or video.', { retryable: false })
      if (items.length > 10) throw new ProviderRequestError('Instagram carousels support at most 10 media items.', { retryable: false })
      await instagramLimitCheck(account.external_account_id, token)

      let creationId
      if (items.length === 1) {
        creationId = await createInstagramChild(account.external_account_id, token, items[0], caption, false)
      } else {
        const children = []
        for (const item of items) children.push(await createInstagramChild(account.external_account_id, token, item, '', true))
        const { data } = await metaPost(`${encodeURIComponent(account.external_account_id)}/media`, token, {
          media_type: 'CAROUSEL',
          children: children.join(','),
          caption,
        })
        if (!data.id) throw new ProviderRequestError('Instagram created no carousel container id.', { retryable: true })
        creationId = data.id
      }

      const { data } = await metaPost(`${encodeURIComponent(account.external_account_id)}/media_publish`, token, { creation_id: creationId })
      if (!data.id) throw new ProviderRequestError('Instagram returned no published media id.', { retryable: true })
      return { external_post_id: data.id }
    },
  }
}

export function createFacebookAdapter() {
  return {
    async publish({ account, body, media }) {
      const token = requireCredentials(account)
      const items = (Array.isArray(media) ? media : []).filter(mediaUrl)
      if (items.length > 1) throw new ProviderRequestError('Facebook multi-image publishing is not enabled yet. Choose one image.', { retryable: false })
      if (!items.length) {
        if (!String(body || '').trim()) throw new ProviderRequestError('Facebook requires post text or an image.', { retryable: false })
        const { data } = await metaPost(`${encodeURIComponent(account.external_account_id)}/feed`, token, { message: String(body || '') })
        return { external_post_id: data.id }
      }
      if (mediaKind(items[0]) === 'video') throw new ProviderRequestError('Facebook video publishing is not enabled yet.', { retryable: false })
      const { data } = await metaPost(`${encodeURIComponent(account.external_account_id)}/photos`, token, {
        url: publicHttpsUrl(items[0]).href,
        caption: String(body || ''),
        published: 'true',
      })
      return { external_post_id: data.post_id || data.id }
    },
  }
}

export function createPinterestAdapter() {
  return {
    async publish({ account, body, media }) {
      const token = requireCredentials(account)
      const items = (Array.isArray(media) ? media : []).filter(mediaUrl)
      if (!items.length) throw new ProviderRequestError('Pinterest requires one image.', { retryable: false })
      if (items.length > 1) throw new ProviderRequestError('Pinterest multi-image Pins are not enabled yet. Choose one image.', { retryable: false })

      const image = publicHttpsUrl(items[0]).href
      if (mediaKind(items[0]) === 'video') {
        throw new ProviderRequestError('Pinterest video publishing is not enabled yet. Choose an image.', { retryable: false })
      }
      const description = String(body || '').trim().slice(0, 800)
      const title = (description.split(/\r?\n/).find(Boolean) || 'MarketSync').slice(0, 100)
      const { data } = await requestJson('https://api.pinterest.com/v5/pins', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          board_id: String(account.external_account_id),
          title,
          description,
          alt_text: title,
          media_source: {
            source_type: 'image_url',
            url: image,
            is_standard: true,
          },
        }),
      }, 'Pinterest refused the Pin.')
      if (!data?.id) throw new ProviderRequestError('Pinterest returned no published Pin id.', { retryable: true })
      return { external_post_id: data.id, url: `https://www.pinterest.com/pin/${data.id}/` }
    },
  }
}

export function createLinkedInAdapter() {
  return {
    async publish({ account, body, media }) {
      const token = requireCredentials(account)
      if ((media || []).length) throw new ProviderRequestError('LinkedIn media upload is not enabled yet. Publish a text post for now.', { retryable: false })
      if (!String(body || '').trim()) throw new ProviderRequestError('LinkedIn requires post text.', { retryable: false })
      const { data, response } = await requestJson('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': LINKEDIN_API_VERSION,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: `urn:li:person:${account.external_account_id}`,
          commentary: String(body),
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      }, 'LinkedIn refused the post.')
      return { external_post_id: response.headers.get('x-restli-id') || data.id }
    },
  }
}

export function createXAdapter() {
  return {
    async publish({ account, body, media }) {
      const token = requireCredentials(account)
      if ((media || []).length) throw new ProviderRequestError('X media upload is not enabled yet. Publish a text post for now.', { retryable: false })
      const text = String(body || '').trim()
      if (!text) throw new ProviderRequestError('X requires post text.', { retryable: false })
      const { data } = await requestJson('https://api.x.com/2/tweets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }, 'X refused the post.')
      return { external_post_id: data?.data?.id }
    },
  }
}

/** Register only integrations whose server-side OAuth credentials are present. */
export function registerProductionSocialProviders() {
  const registered = []
  const providers = [
    ['facebook', createFacebookAdapter],
    ['instagram', createInstagramAdapter],
    ['pinterest', createPinterestAdapter],
    ['linkedin', createLinkedInAdapter],
    ['x', createXAdapter],
  ]
  for (const [provider, factory] of providers) {
    if (!socialOAuthConfigured(provider)) continue
    registerSocialProvider(provider, factory())
    registered.push(provider)
  }
  return registered
}
