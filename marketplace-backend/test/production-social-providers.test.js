import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.SUPABASE_ANON_KEY ||= 'placeholder-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-key'

import {
  createFacebookAdapter,
  createInstagramAdapter,
  createLinkedInAdapter,
  createPinterestAdapter,
  createXAdapter,
} from '../providers/production-social-providers.js'
import {
  socialOAuthAuthorizeUrl,
  socialOAuthDiscoverAccounts,
  socialOAuthExchangeCode,
  socialOAuthRefreshToken,
  xPkceChallenge,
} from '../providers/social-providers.js'

const ACCOUNT = {
  provider: 'instagram',
  external_account_id: '17841400000000000',
  display_name: 'MarketSync',
  status: 'connected',
  credentials: { access_token: 'encrypted-token-was-decrypted-server-side' },
  token_expires_at: new Date(Date.now() + 3600000).toISOString(),
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

test('Instagram publishes a public JPEG through container then media_publish', async () => {
  const original = global.fetch
  const calls = []
  global.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    if (String(url).includes('content_publishing_limit')) return json({ data: [{ quota_usage: 2, config: { quota_total: 100 } }] })
    if (String(url).endsWith('/media')) return json({ id: 'container-1' })
    if (String(url).endsWith('/media_publish')) return json({ id: 'ig-media-1' })
    return json({ error: { message: 'unexpected request' } }, 400)
  }
  try {
    const result = await createInstagramAdapter().publish({
      account: ACCOUNT,
      body: 'A real MarketSync post',
      media: ['https://cdn.example.com/vehicle.jpg'],
    })
    assert.equal(result.external_post_id, 'ig-media-1')
    const create = calls.find(call => call.url.endsWith('/media'))
    assert.equal(create.init.body.get('image_url'), 'https://cdn.example.com/vehicle.jpg')
    assert.equal(create.init.body.get('caption'), 'A real MarketSync post')
    assert.ok(calls.some(call => call.url.endsWith('/media_publish')))
  } finally { global.fetch = original }
})

test('Instagram refuses unsupported or private media before claiming success', async () => {
  const original = global.fetch
  global.fetch = async () => json({ data: [{ quota_usage: 0, config: { quota_total: 100 } }] })
  try {
    await assert.rejects(
      createInstagramAdapter().publish({ account: ACCOUNT, body: 'x', media: ['http://localhost/photo.webp'] }),
      /publicly accessible HTTPS URL/,
    )
  } finally { global.fetch = original }
})

test('Facebook text publishing returns the provider post id', async () => {
  const original = global.fetch
  global.fetch = async (url, init) => {
    assert.match(String(url), /\/feed$/)
    assert.equal(init.body.get('message'), 'Hello Facebook')
    return json({ id: 'page_123' })
  }
  try {
    const result = await createFacebookAdapter().publish({ account: { ...ACCOUNT, provider: 'facebook' }, body: 'Hello Facebook', media: [] })
    assert.equal(result.external_post_id, 'page_123')
  } finally { global.fetch = original }
})

test('Pinterest publishes an image Pin to the selected board', async () => {
  const original = global.fetch
  global.fetch = async (url, init) => {
    assert.equal(String(url), 'https://api.pinterest.com/v5/pins')
    assert.equal(init.headers.Authorization, 'Bearer encrypted-token-was-decrypted-server-side')
    const payload = JSON.parse(init.body)
    assert.equal(payload.board_id, 'board-123')
    assert.equal(payload.title, 'Fresh arrival')
    assert.equal(payload.description, 'Fresh arrival\n2026 MarketSync test vehicle')
    assert.deepEqual(payload.media_source, {
      source_type: 'image_url',
      url: 'https://cdn.example.com/vehicle.jpg',
      is_standard: true,
    })
    return json({ id: 'pin-987' }, 201)
  }
  try {
    const result = await createPinterestAdapter().publish({
      account: { ...ACCOUNT, provider: 'pinterest', external_account_id: 'board-123' },
      body: 'Fresh arrival\n2026 MarketSync test vehicle',
      media: ['https://cdn.example.com/vehicle.jpg'],
    })
    assert.deepEqual(result, {
      external_post_id: 'pin-987',
      url: 'https://www.pinterest.com/pin/pin-987/',
    })
  } finally { global.fetch = original }
})

test('LinkedIn and X refuse unimplemented media instead of pretending it published', async () => {
  await assert.rejects(createLinkedInAdapter().publish({ account: { ...ACCOUNT, provider: 'linkedin' }, body: 'hello', media: ['https://cdn.example.com/a.jpg'] }), /not enabled yet/)
  await assert.rejects(createXAdapter().publish({ account: { ...ACCOUNT, provider: 'x' }, body: 'hello', media: ['https://cdn.example.com/a.jpg'] }), /not enabled yet/)
})

test('Instagram OAuth requests publishing and Page-read permissions', () => {
  const previousId = process.env.META_APP_ID
  const previousSecret = process.env.META_APP_SECRET
  process.env.META_APP_ID = 'meta-app-id'
  process.env.META_APP_SECRET = 'meta-app-secret'
  try {
    const url = new URL(socialOAuthAuthorizeUrl('instagram', 'signed-state'))
    const scopes = new Set(String(url.searchParams.get('scope')).split(','))
    for (const permission of ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement']) {
      assert.ok(scopes.has(permission), `missing ${permission}`)
    }
  } finally {
    if (previousId === undefined) delete process.env.META_APP_ID; else process.env.META_APP_ID = previousId
    if (previousSecret === undefined) delete process.env.META_APP_SECRET; else process.env.META_APP_SECRET = previousSecret
  }
})

test('Pinterest OAuth requests board and Pin permissions with continuous refresh', async () => {
  const previousId = process.env.PINTEREST_APP_ID
  const previousSecret = process.env.PINTEREST_APP_SECRET
  const original = global.fetch
  process.env.PINTEREST_APP_ID = 'pinterest-app-id'
  process.env.PINTEREST_APP_SECRET = 'pinterest-app-secret'
  try {
    const url = new URL(socialOAuthAuthorizeUrl('pinterest', 'signed-state'))
    assert.equal(url.origin + url.pathname, 'https://www.pinterest.com/oauth/')
    const scopes = new Set(String(url.searchParams.get('scope')).split(','))
    for (const permission of ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read']) {
      assert.ok(scopes.has(permission), `missing ${permission}`)
    }

    global.fetch = async (requestUrl, init) => {
      assert.equal(String(requestUrl), 'https://api.pinterest.com/v5/oauth/token')
      assert.equal(init.headers.Authorization, `Basic ${Buffer.from('pinterest-app-id:pinterest-app-secret').toString('base64')}`)
      assert.equal(init.body.get('continuous_refresh'), 'true')
      return json({ access_token: 'pina-token', refresh_token: 'pinr-token', expires_in: 2592000 })
    }
    const tokens = await socialOAuthExchangeCode('pinterest', 'oauth-code')
    assert.equal(tokens.access_token, 'pina-token')
    assert.equal(tokens.refresh_token, 'pinr-token')

    global.fetch = async (requestUrl, init) => {
      assert.equal(String(requestUrl), 'https://api.pinterest.com/v5/oauth/token')
      assert.equal(init.body.get('grant_type'), 'refresh_token')
      assert.equal(init.body.get('refresh_token'), 'pinr-token')
      return json({ access_token: 'pina-refreshed', refresh_token: 'pinr-refreshed', expires_in: 2592000 })
    }
    const refreshed = await socialOAuthRefreshToken('pinterest', 'pinr-token')
    assert.equal(refreshed.access_token, 'pina-refreshed')
    assert.equal(refreshed.refresh_token, 'pinr-refreshed')
  } finally {
    global.fetch = original
    if (previousId === undefined) delete process.env.PINTEREST_APP_ID; else process.env.PINTEREST_APP_ID = previousId
    if (previousSecret === undefined) delete process.env.PINTEREST_APP_SECRET; else process.env.PINTEREST_APP_SECRET = previousSecret
  }
})

test('Pinterest discovery returns each authorized board as a selectable account', async () => {
  const original = global.fetch
  const calls = []
  global.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('/user_account')) {
      return json({ username: 'marketsyncdealer', business_name: 'MarketSync Dealer', profile_image: 'https://cdn.example.com/avatar.jpg' })
    }
    if (String(url).includes('/boards?')) {
      return json({ items: [
        { id: 'board-1', name: 'New Inventory', media: { image_cover_url: 'https://cdn.example.com/cover.jpg' } },
        { id: 'board-2', name: 'Service Tips' },
      ], bookmark: null })
    }
    return json({ message: 'unexpected request' }, 400)
  }
  try {
    const choices = await socialOAuthDiscoverAccounts('pinterest', { access_token: 'pina-token', refresh_token: 'pinr-token', expires_in: 2592000 })
    assert.deepEqual(choices.map(choice => [choice.external_account_id, choice.display_name, choice.handle, choice.account_kind]), [
      ['board-1', 'New Inventory', '@marketsyncdealer', 'board'],
      ['board-2', 'Service Tips', '@marketsyncdealer', 'board'],
    ])
    assert.equal(choices[0]._credentials.pinterest_board_id, 'board-1')
    assert.ok(calls.some(url => url.includes('/boards?page_size=250')))
  } finally { global.fetch = original }
})
test('X OAuth uses a state-bound S256 PKCE challenge', () => {
  const previousId = process.env.X_CLIENT_ID
  const previousSecret = process.env.X_CLIENT_SECRET
  process.env.X_CLIENT_ID = 'x-client-id'
  process.env.X_CLIENT_SECRET = 'x-client-secret'
  try {
    const first = new URL(socialOAuthAuthorizeUrl('x', 'state-one'))
    const second = new URL(socialOAuthAuthorizeUrl('x', 'state-two'))
    assert.equal(first.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(first.searchParams.get('code_challenge'), xPkceChallenge('state-one'))
    assert.notEqual(first.searchParams.get('code_challenge'), second.searchParams.get('code_challenge'))
  } finally {
    if (previousId === undefined) delete process.env.X_CLIENT_ID; else process.env.X_CLIENT_ID = previousId
    if (previousSecret === undefined) delete process.env.X_CLIENT_SECRET; else process.env.X_CLIENT_SECRET = previousSecret
  }
})
