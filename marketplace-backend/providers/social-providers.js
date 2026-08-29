/**
 * Social provider adapters & OAuth connectors (Phase 6 PR 6.6 & Security Hardening).
 *
 * This file is an authoritative boundary for social integrations and OAuth flows:
 * 1. Post publishing requires authoritative provider evidence (external_post_id).
 * 2. Social account connection requires authoritative OAuth provider verification.
 * 3. Browser clients CANNOT self-declare status='connected', POST arbitrary credentials,
 *    or invent provider capabilities.
 */
import crypto from 'crypto'
import { BACKEND_URL } from '../shared.js'

export const PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED'
export const PROVIDER_NO_CREDENTIALS = 'PROVIDER_NO_CREDENTIALS'
export const PROVIDER_NO_EVIDENCE = 'PROVIDER_NO_EVIDENCE'
export const PROVIDER_THREW = 'PROVIDER_THREW'

// Keep provider API versions in one place. Meta versions are intentionally configurable so
// a supported version can be rolled forward in Render without hunting through OAuth and
// publishing code. v23.0 supports the Facebook Login based Instagram flow used here.
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0'
export const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202604'

// The networks the product talks about.
export const KNOWN_PROVIDERS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'youtube']

export const SOCIAL_CAPABILITIES = {
  // Capabilities describe what MarketSync currently implements, not everything each vendor
  // sells. This keeps the composer from offering a button that will fail at publish time.
  facebook: { can_publish_text: true, can_publish_image: true, can_publish_video: false, can_read_comments: false, can_read_insights: false },
  instagram: { can_publish_text: false, can_publish_image: true, can_publish_video: true, can_read_comments: false, can_read_insights: false },
  tiktok: { can_publish_text: false, can_publish_image: false, can_publish_video: false, can_read_comments: false, can_read_insights: false },
  youtube: { can_publish_text: false, can_publish_image: false, can_publish_video: false, can_read_comments: false, can_read_insights: false },
  linkedin: { can_publish_text: true, can_publish_image: false, can_publish_video: false, can_read_comments: false, can_read_insights: false },
  x: { can_publish_text: true, can_publish_image: false, can_publish_video: false, can_read_comments: false, can_read_insights: false },
}

export function providerCapabilities(provider, evidence = {}) {
  const base = SOCIAL_CAPABILITIES[String(provider || '').toLowerCase()] || {}
  const out = {}
  for (const [key, value] of Object.entries(base)) out[key] = value === true && evidence[key] !== false
  out.publish = out.can_publish_text || out.can_publish_image || out.can_publish_video
  out.schedule = out.publish && String(provider || '').toLowerCase() !== 'tiktok'
  return out
}

const ADAPTERS = new Map()
const STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ms-social-oauth-state-secret'

/**
 * Register a real integration adapter for publishing.
 */
export function registerSocialProvider(provider, adapter) {
  if (!provider || typeof adapter?.publish !== 'function') {
    throw new Error('A social provider adapter must supply a publish() function.')
  }
  ADAPTERS.set(provider, adapter)
}

export function socialProviderConfigured(provider) { return ADAPTERS.has(provider) }
export function configuredSocialProviders() { return [...ADAPTERS.keys()].sort() }

export function __resetSocialProviders() { ADAPTERS.clear() }

/**
 * Check if OAuth app credentials are configured for a given social platform.
 */
export function socialOAuthConfig(provider) {
  const p = String(provider || '').toLowerCase()
  if (p === 'facebook') {
    const id = process.env.FACEBOOK_APP_ID || process.env.FACEBOOK_CLIENT_ID || process.env.META_APP_ID || ''
    const secret = process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET || process.env.META_APP_SECRET || ''
    return { id, secret, configured: !!(id && secret) }
  }
  if (p === 'instagram') {
    const id = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID || process.env.META_APP_ID || ''
    const secret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET || process.env.META_APP_SECRET || ''
    return { id, secret, configured: !!(id && secret) }
  }
  if (p === 'linkedin') {
    const id = process.env.LINKEDIN_CLIENT_ID || ''
    const secret = process.env.LINKEDIN_CLIENT_SECRET || ''
    return { id, secret, configured: !!(id && secret) }
  }
  if (p === 'youtube') {
    const id = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''
    const secret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || ''
    return { id, secret, configured: !!(id && secret) }
  }
  if (p === 'tiktok') {
    const id = process.env.TIKTOK_CLIENT_KEY || ''
    const secret = process.env.TIKTOK_CLIENT_SECRET || ''
    return { id, secret, configured: !!(id && secret) }
  }
  if (p === 'x' || p === 'twitter') {
    const id = process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || ''
    const secret = process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET || ''
    return { id, secret, configured: !!(id && secret) }
  }
  return { id: '', secret: '', configured: false }
}

export function socialOAuthConfigured(provider) {
  return socialOAuthConfig(provider).configured
}

export function socialOAuthRedirectUri(provider) {
  return `${BACKEND_URL}/social/callback/${provider}`
}

function xPkceVerifier(state) {
  return crypto.createHmac('sha256', STATE_SECRET).update(`x-pkce:${String(state || '')}`).digest('base64url')
}

export function xPkceChallenge(state) {
  return crypto.createHash('sha256').update(xPkceVerifier(state)).digest('base64url')
}

/**
 * Signed OAuth state tying callback to user and dealership.
 */
export function signSocialOAuthState(payload) {
  const body = Buffer.from(JSON.stringify({ ts: Date.now(), ...payload })).toString('base64url')
  const mac = crypto.createHmac('sha256', STATE_SECRET).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function verifySocialOAuthState(state) {
  try {
    const [body, mac] = String(state || '').split('.')
    if (!body || !mac) return null
    const expect = crypto.createHmac('sha256', STATE_SECRET).update(body).digest('base64url')
    if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!data.ts || Date.now() - data.ts > 15 * 60 * 1000) return null // 15 minutes TTL
    return data
  } catch {
    return null
  }
}

export function socialOAuthStateHash(state) {
  return crypto.createHash('sha256').update(String(state || '')).digest('hex')
}

/**
 * Construct authoritative OAuth Authorization URL for a provider.
 */
export function socialOAuthAuthorizeUrl(provider, state) {
  const p = String(provider || '').toLowerCase()
  const cfg = socialOAuthConfig(p)
  if (!cfg.configured) {
    throw new Error(`Provider ${provider} is not configured on this server.`)
  }
  const redirect_uri = socialOAuthRedirectUri(p)

  if (p === 'facebook') {
    const q = new URLSearchParams({
      client_id: cfg.id,
      redirect_uri,
      state,
      response_type: 'code',
      scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,public_profile',
    })
    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${q}`
  }
  if (p === 'instagram') {
    const q = new URLSearchParams({
      client_id: cfg.id,
      redirect_uri,
      state,
      response_type: 'code',
      scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
    })
    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${q}`
  }
  if (p === 'linkedin') {
    const q = new URLSearchParams({
      client_id: cfg.id,
      redirect_uri,
      state,
      response_type: 'code',
      scope: 'openid profile w_member_social',
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${q}`
  }
  if (p === 'youtube') {
    const q = new URLSearchParams({
      client_id: cfg.id,
      redirect_uri,
      state,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
  }
  if (p === 'tiktok') {
    const q = new URLSearchParams({
      client_key: cfg.id,
      redirect_uri,
      state,
      response_type: 'code',
      scope: 'user.info.basic,video.publish',
    })
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`
  }
  if (p === 'x' || p === 'twitter') {
    const q = new URLSearchParams({
      client_id: cfg.id,
      redirect_uri,
      state,
      response_type: 'code',
      scope: 'tweet.read tweet.write users.read offline.access',
      code_challenge: xPkceChallenge(state),
      code_challenge_method: 'S256',
    })
    return `https://twitter.com/i/oauth2/authorize?${q}`
  }
  throw new Error(`Unknown provider ${provider}`)
}

/**
 * Exchange authorization code for access tokens.
 */
export async function socialOAuthExchangeCode(provider, code, { state } = {}) {
  const p = String(provider || '').toLowerCase()
  const cfg = socialOAuthConfig(p)
  if (!cfg.configured) throw new Error(`Provider ${provider} is not configured on this server.`)
  const redirect_uri = socialOAuthRedirectUri(p)

  if (p === 'facebook' || p === 'instagram') {
    const tokenUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${new URLSearchParams({
      client_id: cfg.id,
      client_secret: cfg.secret,
      redirect_uri,
      code,
    })}`
    const r = await fetch(tokenUrl)
    const data = await r.json()
    if (!r.ok || data.error) throw new Error(data.error?.message || 'Failed to exchange OAuth code with Meta')
    // The code exchange can return a short-lived user token. Exchange it immediately for a
    // long-lived token; Page tokens discovered from it inherit the durable authorization.
    const longUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: cfg.id,
      client_secret: cfg.secret,
      fb_exchange_token: data.access_token,
    })}`
    const longRes = await fetch(longUrl)
    const long = await longRes.json().catch(() => ({}))
    const selected = longRes.ok && long.access_token ? long : data
    const expiresIn = Number(selected.expires_in || data.expires_in || 5184000)
    return {
      access_token: selected.access_token,
      refresh_token: selected.access_token,
      token_type: selected.token_type || data.token_type || 'bearer',
      expires_in: expiresIn,
      expires_at: Date.now() + Math.max(60, expiresIn - 60) * 1000,
      token_source: selected === long ? 'meta_long_lived' : 'meta_code_exchange',
    }
  }

  if (p === 'linkedin') {
    const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: cfg.id,
        client_secret: cfg.secret,
      }),
    })
    const data = await r.json()
    if (!r.ok || data.error) throw new Error(data.error_description || data.error || 'Failed to exchange LinkedIn OAuth code')
    return {
      access_token: data.access_token,
      expires_in: data.expires_in || 5184000,
      refresh_token: data.refresh_token,
    }
  }

  if (p === 'youtube') {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: cfg.id,
        client_secret: cfg.secret,
      }),
    })
    const data = await r.json()
    if (!r.ok || data.error) throw new Error(data.error_description || data.error || 'Failed to exchange Google/YouTube OAuth code')
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 3600,
    }
  }

  if (p === 'tiktok') {
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: cfg.id,
        client_secret: cfg.secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri,
      }),
    })
    const data = await r.json()
    if (!r.ok || data.error) throw new Error(data.message || data.error || 'Failed to exchange TikTok OAuth code')
    return {
      access_token: data.data?.access_token,
      refresh_token: data.data?.refresh_token,
      expires_in: data.data?.expires_in || 86400,
      open_id: data.data?.open_id,
    }
  }


  if (p === 'x' || p === 'twitter') {
    if (!state) throw new Error('The X authorization state is missing; start the connection again.')
    const basic = Buffer.from(`${cfg.id}:${cfg.secret}`).toString('base64')
    const r = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        code_verifier: xPkceVerifier(state),
      }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || data.error) throw new Error(data.error_description || data.detail || data.error || 'Failed to exchange X OAuth code')
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type || 'bearer',
      expires_in: Number(data.expires_in || 7200),
    }
  }

  throw new Error(`OAuth code exchange not implemented for ${provider}`)
}

export async function socialOAuthRefreshToken(provider, refreshToken) {
  const p = String(provider || '').toLowerCase()
  const cfg = socialOAuthConfig(p)
  if (!cfg.configured || !refreshToken) throw new Error('A refresh token is not available; reconnect this account.')
  let url = 'https://oauth2.googleapis.com/token'
  let body = { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: cfg.id, client_secret: cfg.secret }
  if (p === 'tiktok') {
    url = 'https://open.tiktokapis.com/v2/oauth/token/'
    body = { client_key: cfg.id, client_secret: cfg.secret, grant_type: 'refresh_token', refresh_token: refreshToken }
  } else if (p === 'facebook' || p === 'instagram') {
    url = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: cfg.id, client_secret: cfg.secret, fb_exchange_token: refreshToken })}`
    body = null
  } else if (p === 'linkedin') {
    url = 'https://www.linkedin.com/oauth/v2/accessToken'
  } else if (p === 'x' || p === 'twitter') {
    url = 'https://api.x.com/2/oauth2/token'
    body = { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: cfg.id }
  }
  const headers = body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}
  if ((p === 'x' || p === 'twitter') && cfg.secret) headers.Authorization = `Basic ${Buffer.from(`${cfg.id}:${cfg.secret}`).toString('base64')}`
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? new URLSearchParams(body) : undefined })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || data.error) throw new Error(data.error_description || data.error?.message || data.message || 'Token refresh failed.')
  const d = data.data || data
  return { ...d, access_token: d.access_token, refresh_token: d.refresh_token || refreshToken, expires_in: Number(d.expires_in || 3600) }
}

/** Refresh credentials for one already-selected account, including re-deriving Meta Page tokens. */
export async function socialOAuthRenewAccountCredentials(provider, externalAccountId, credentials) {
  const p = String(provider || '').toLowerCase()
  if (!credentials) throw new Error('The encrypted authorization is unavailable; reconnect this account.')
  if (p === 'facebook' || p === 'instagram') {
    const userToken = credentials.refresh_token || credentials.user_access_token || credentials.access_token
    const refreshed = await socialOAuthRefreshToken(p, userToken)
    const candidates = await socialOAuthDiscoverAccounts(p, refreshed)
    const selected = candidates.find(row => String(row.external_account_id) === String(externalAccountId))
    if (!selected?._credentials?.access_token) throw new Error('That Meta Page or Instagram account is no longer available. Reconnect it.')
    return selected._credentials
  }
  const next = await socialOAuthRefreshToken(p, credentials.refresh_token)
  return { ...credentials, ...next }
}

export async function socialOAuthRevokeToken(provider, accessToken) {
  const p = String(provider || '').toLowerCase()
  if (!accessToken) return { ok: true, supported: false }
  let r
  if (p === 'facebook' || p === 'instagram') r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/permissions?access_token=${encodeURIComponent(accessToken)}`, { method: 'DELETE' })
  else if (p === 'youtube') r = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, { method: 'POST' })
  else if (p === 'tiktok') r = await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: socialOAuthConfig(p).id, token: accessToken }) })
  else return { ok: true, supported: false }
  return { ok: r.ok, supported: true }
}

/**
 * Fetch authoritative account profile and capabilities from provider API.
 */
export async function socialOAuthFetchProfile(provider, tokens) {
  const p = String(provider || '').toLowerCase()
  if (!tokens?.access_token) throw new Error('Missing access token')

  if (p === 'facebook') {
    try {
      const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?access_token=${encodeURIComponent(tokens.access_token)}`)
      const data = await r.json()
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        const page = data.data[0]
        return {
          external_account_id: page.id,
          display_name: page.name,
          handle: page.name ? `@${page.name.replace(/\s+/g, '').toLowerCase()}` : null,
        capabilities: providerCapabilities('facebook'),
          token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        }
      }
    } catch {}
    // Fallback to user profile
    const userRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(tokens.access_token)}`)
    const user = await userRes.json()
    if (user?.id) {
      return {
        external_account_id: user.id,
        display_name: user.name || 'Facebook User',
        handle: user.name ? `@${user.name.replace(/\s+/g, '').toLowerCase()}` : null,
        capabilities: providerCapabilities('facebook'),
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      }
    }
    throw new Error('Could not fetch Facebook account details.')
  }

  if (p === 'instagram') {
    const rows = await socialOAuthDiscoverAccounts('instagram', tokens)
    const ig = rows[0]
    if (ig?.external_account_id) {
      return {
        ...ig,
        capabilities: providerCapabilities('instagram'),
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      }
    }
    throw new Error('No linked Instagram Business account found.')
  }

  if (p === 'linkedin') {
    const r = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const user = await r.json()
    if (user?.sub) {
      return {
        external_account_id: user.sub,
        display_name: user.name || `${user.given_name || ''} ${user.family_name || ''}`.trim() || 'LinkedIn User',
        handle: user.email || null,
        capabilities: providerCapabilities('linkedin'),
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      }
    }
    throw new Error('Could not fetch LinkedIn profile.')
  }

  if (p === 'youtube') {
    const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const data = await r.json()
    const ch = data?.items?.[0]
    if (ch?.id) {
      return {
        external_account_id: ch.id,
        display_name: ch.snippet?.title || 'YouTube Channel',
        handle: ch.snippet?.customUrl || null,
        avatar_url: ch.snippet?.thumbnails?.default?.url || null,
        capabilities: providerCapabilities('youtube'),
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      }
    }
    throw new Error('No YouTube channel found for this account.')
  }

  if (p === 'tiktok') {
    const r = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const data = await r.json()
    const user = data?.data?.user
    if (user?.open_id || tokens.open_id) {
      return {
        external_account_id: user?.open_id || tokens.open_id,
        display_name: user?.display_name || 'TikTok User',
        avatar_url: user?.avatar_url || null,
        capabilities: providerCapabilities('tiktok'),
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      }
    }
    throw new Error('Could not fetch TikTok user info.')
  }


  if (p === 'x' || p === 'twitter') {
    const r = await fetch('https://api.x.com/2/users/me?user.fields=name,username,profile_image_url', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const data = await r.json().catch(() => ({}))
    const user = data?.data
    if (user?.id) {
      return {
        external_account_id: user.id,
        display_name: user.name || user.username || 'X User',
        handle: user.username ? `@${user.username}` : null,
        avatar_url: user.profile_image_url || null,
        capabilities: providerCapabilities('x'),
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      }
    }
    throw new Error(data?.detail || 'Could not fetch X profile.')
  }

  throw new Error(`Profile fetch not implemented for ${provider}`)
}

// Discovery is separate from connection persistence so the caller can present every
// Page/channel/profile the provider authorized and let the dealer choose one.
export async function socialOAuthDiscoverAccounts(provider, tokens) {
  const p = String(provider || '').toLowerCase()
  if (p === 'facebook' || p === 'instagram') {
    let next = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&limit=100&access_token=${encodeURIComponent(tokens.access_token)}`
    const pages = []
    for (let pageNumber = 0; next && pageNumber < 10; pageNumber += 1) {
      const r = await fetch(next)
      const data = await r.json().catch(() => ({}))
      if (!r.ok || data.error) throw new Error(data.error?.message || 'Could not discover Meta Pages.')
      pages.push(...(data.data || []))
      next = data.paging?.next || null
    }
    return pages.flatMap(page => {
      const pageToken = {
        ...tokens,
        access_token: page.access_token || tokens.access_token,
        refresh_token: tokens.refresh_token || tokens.access_token,
        user_access_token: tokens.access_token,
        page_id: page.id,
      }
      if (p === 'facebook') {
        return [{ external_account_id: page.id, display_name: page.name || 'Facebook Page', handle: null, account_kind: 'page', capabilities: providerCapabilities('facebook'), _credentials: pageToken }]
      }
      const ig = page.instagram_business_account
      return ig?.id ? [{ external_account_id: ig.id, display_name: ig.name || ig.username || 'Instagram Professional Account', handle: ig.username ? `@${ig.username}` : null, account_kind: 'instagram', capabilities: providerCapabilities('instagram'), _credentials: pageToken }] : []
    })
  }
  const profile = await socialOAuthFetchProfile(p, tokens)
  return [{ ...profile, account_kind: p, _credentials: tokens }]
}

/**
 * Attempt one publication. Never throws — returns structured outcome.
 */
export async function publishToProvider({ account, body, media = [] }) {
  const provider = account?.provider || 'unknown'
  const adapter = ADAPTERS.get(provider)

  if (!adapter) {
    return {
      ok: false, code: PROVIDER_NOT_CONFIGURED, retryable: false,
      error: `MarketSync cannot publish to ${provider} yet — no integration is connected. Nothing was sent.`,
    }
  }
  if (account.status !== 'connected') {
    return {
      ok: false, code: PROVIDER_NO_CREDENTIALS, retryable: false,
      error: `The ${provider} account "${account.display_name}" is ${account.status}. Reconnect it, then publish again.`,
    }
  }

  try {
    const out = await adapter.publish({ account, body, media })
    const id = out?.external_post_id
    if (!id) {
      return {
        ok: false, code: PROVIDER_NO_EVIDENCE, retryable: true,
        error: `${provider} accepted the request but returned no post id, so we cannot confirm it went live.`,
      }
    }
    return { ok: true, external_post_id: String(id), url: out.url || null }
  } catch (e) {
    return {
      ok: false, code: PROVIDER_THREW, retryable: e?.retryable !== false,
      provider_code: e?.providerCode || null,
      account_status: e?.accountStatus || null,
      error: `${provider} refused the post: ${e?.message || 'unknown error'}`,
    }
  }
}
