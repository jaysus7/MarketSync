/**
 * Public API / MCP layer — external agents + integrations reach MarketSync through a
 * per-dealership API key. A curated, API-SAFE tool set (read inventory + capture a
 * lead) is exposed as REST (/api/v1/*) and as a minimal MCP-over-HTTP endpoint
 * (tools/list + tools/call). Keys are hashed (sha256); the raw key is shown once.
 *
 * These tools are kept separate from the in-app tool-registry on purpose: the shared
 * registry is keyed by tool name, and the sales-chat handlers depend on a conversation
 * context that external callers don't have. Same MCP shape, API-safe handlers.
 */
import crypto from 'node:crypto'
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'
import { emitEvent } from './events.js'
import { findOrCreateContact } from './crm.js'
import { audit, AuditAction } from '../audit.js'
import { keyIsExpired, requestedExpiry, requestedScopes } from '../api-key-policy.js'
import { consumeQuota, getClientIp } from '../security.js'

// API keys are 'msk_live_' + crypto.randomBytes(24) — 192 bits of cryptographic
// entropy, NOT a human-chosen password. SHA-256 is the correct choice here: it gives
// constant-time-lengthed, unguessable lookup by key_hash without a per-key salt/KDF.
// A slow KDF (bcrypt/argon2) would only add latency to every API request and cannot
// be looked up by hash, breaking the equality lookup below. Not a weak-hash finding.
const hashKey = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex') // codeql[js/insufficient-password-hash]

// ── Input Sanitization / Validation Helpers ────────────────────────────────────
function sanitizeString(val, maxLen = 200) {
  if (typeof val !== 'string') return ''
  return val.trim().slice(0, maxLen)
}

function sanitizeNumber(val, min = null, max = null) {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  if (isNaN(n)) return null
  if (min !== null && n < min) return null
  if (max !== null && n > max) return null
  return n
}

// ── API-safe tool set (MCP-shaped) ────────────────────────────────────────────
export const API_TOOLS = [
  {
    name: 'search_inventory',
    description: "Search the dealership's live inventory by make/model/keywords, with optional max price and min year.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for make, model, or trim (max 100 chars)' },
        max_price: { type: 'number', description: 'Maximum vehicle price' },
        min_year: { type: 'number', description: 'Minimum vehicle year (e.g. 2018)' },
        limit: { type: 'number', description: 'Maximum number of vehicles to return (1-50)' },
      },
    },
    async handler(args, ctx) {
      const qStr = sanitizeString(args.query, 100)
      const maxPrice = sanitizeNumber(args.max_price, 0)
      const minYear = sanitizeNumber(args.min_year, 1900, 2100)
      const limit = Math.min(50, Math.max(1, sanitizeNumber(args.limit, 1, 50) || 20))

      let q = supabaseAdmin.from('inventory')
        .select('id, year, make, model, trim, price, mileage, stocknumber, vin, status')
        .eq('dealership_id', ctx.dealershipId)
        .is('archived_at', null)
        .neq('status', 'sold')
        .limit(limit)

      if (maxPrice !== null) q = q.lte('price', maxPrice)
      if (minYear !== null) q = q.gte('year', minYear)
      if (qStr) q = q.or(`make.ilike.%${qStr}%,model.ilike.%${qStr}%,trim.ilike.%${qStr}%`)

      const { data, error } = await q
      if (error) return { error: error.message }
      return { vehicles: data || [] }
    },
  },
  {
    name: 'create_lead',
    description: 'Create a CRM lead. Requires a name and an email or phone. Notifies the dealership.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer full name (max 120 chars)' },
        email: { type: 'string', description: 'Customer email address (max 160 chars)' },
        phone: { type: 'string', description: 'Customer phone number (max 40 chars)' },
        source: { type: 'string', description: 'Lead source (e.g. Website, API, Chatbot)' },
        comments: { type: 'string', description: 'Notes or vehicle interest (max 2000 chars)' },
      },
      required: ['name'],
    },
    async handler(args, ctx) {
      const name = sanitizeString(args.name, 120)
      const email = sanitizeString(args.email, 160)
      const phone = sanitizeString(args.phone, 40)
      const source = sanitizeString(args.source || 'API', 80)
      const comments = sanitizeString(args.comments, 2000)

      if (!name || (!email && !phone)) {
        return { error: 'name and email or phone required' }
      }

      // Check daily lead creation quota (max 500/day per API key)
      if (ctx.apiKeyId) {
        const dailyQuota = await consumeQuota(`api_daily_leads:${ctx.apiKeyId}:${ctx.dealershipId}`, 500, 86400)
        if (!dailyQuota.allowed) {
          return { error: 'Daily lead creation quota exceeded (max 500 leads per day).' }
        }
      }

      const contactId = await findOrCreateContact({
        dealershipId: ctx.dealershipId,
        name,
        email: email || null,
        phone: phone || null,
        source,
      })
      if (!contactId) return { error: 'could not create lead' }

      emitEvent({
        dealershipId: ctx.dealershipId,
        eventName: 'lead.created',
        entityType: 'customer',
        entityId: contactId,
        summary: `API lead — ${name}`,
        department: 'Sales',
        payload: { source, comments: comments || null },
      })

      return { ok: true, contact_id: contactId }
    },
  },
]

export const API_TOOL_BY_NAME = Object.fromEntries(API_TOOLS.map(t => [t.name, t]))
export const apiToolDefs = () => API_TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }))

export async function callApiTool(name, args, ctx) {
  const t = API_TOOL_BY_NAME[name]
  if (!t) return { error: 'unknown tool: ' + name }
  try {
    return await t.handler(args || {}, ctx)
  } catch (e) {
    return { error: String(e?.message || e).slice(0, 300) }
  }
}

// ── Bearer key auth → resolves the dealership ─────────────────────────────────
async function apiAuth(req, res, next) {
  const h = req.headers.authorization || ''
  const raw = h.startsWith('Bearer ') ? h.slice(7).trim() : String(req.headers['x-api-key'] || '').trim()
  if (!raw) return res.status(401).json({ error: 'API key required' })
  try {
    const { data: key } = await supabaseAdmin.from('api_keys')
      .select('id, dealership_id, scopes, expires_at')
      .eq('key_hash', hashKey(raw))
      .is('revoked_at', null)
      .maybeSingle()

    if (!key) return res.status(401).json({ error: 'invalid or revoked API key' })
    if (keyIsExpired(key.expires_at)) return res.status(401).json({ error: 'API key expired' })

    req.apiKeyId = key.id
    req.dealershipId = key.dealership_id
    req.apiScopes = key.scopes || []

    supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {}, () => {})
    next()
  } catch {
    res.status(500).json({ error: 'auth error' })
  }
}

function requireApiScope(scope) {
  return (req, res, next) => {
    if (!req.apiScopes?.includes(scope)) return res.status(403).json({ error: `API key lacks ${scope} scope` })
    next()
  }
}

function rateLimitApiKey(bucket, max, windowSecs) {
  return async (req, res, next) => {
    const ip = getClientIp(req)
    const key = `api_rl:${bucket}:${req.apiKeyId || 'no_key'}:${req.dealershipId || 'no_dealer'}:${ip}`
    const { allowed, retryAfter = 60 } = await consumeQuota(key, max, windowSecs)
    if (!allowed) {
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({
        error: `Too many requests. Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retry_after_seconds: retryAfter,
      })
    }
    next()
  }
}

export function registerPublicApi(app) {
  // ── Key management (dashboard, managers) ──
  app.post('/api-keys', requireAuth, requireMfa, requirePermission('api_keys.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const scopes = requestedScopes(req.body?.scopes)
    if (!scopes) return res.status(400).json({ error: 'scopes must include read and/or leads' })
    const expiry = requestedExpiry(req.body?.expires_at)
    if (expiry.error) return res.status(400).json({ error: expiry.error })
    const raw = 'msk_live_' + crypto.randomBytes(24).toString('hex')
    const prefix = raw.slice(0, 16) + '…'
    const { data, error } = await supabaseAdmin.from('api_keys').insert({
      dealership_id: req.dealershipId, name: String(req.body?.name || 'API key').slice(0, 80),
      key_prefix: prefix, key_hash: hashKey(raw), scopes, expires_at: expiry.value, created_by: req.user?.id || null,
    }).select('id, name, key_prefix, scopes, expires_at, created_at').single()
    if (error) return res.status(500).json({ error: error.message })
    audit(req, AuditAction.API_KEY_CREATED, { api_key_id: data.id, name: data.name })
    res.json({ ok: true, key: raw, meta: data })   // raw key returned ONCE
  })

  app.get('/api-keys', requireAuth, requireMfa, requirePermission('api_keys.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    const { data } = await supabaseAdmin.from('api_keys').select('id, name, key_prefix, scopes, expires_at, created_at, last_used_at, revoked_at')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(50)
    res.json({ keys: data || [] })
  })

  app.post('/api-keys/:id/revoke', requireAuth, requireMfa, requirePermission('api_keys.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    await supabaseAdmin.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    audit(req, AuditAction.API_KEY_REVOKED, { api_key_id: req.params.id })
    res.json({ ok: true })
  })

  // ── Public REST API v1 (key auth + rate limit) ──
  app.get('/api/v1/inventory', apiAuth, requireApiScope('read'), rateLimitApiKey('read', 120, 60), async (req, res) => {
    const limit = Math.min(200, Math.max(1, sanitizeNumber(req.query.limit, 1, 200) || 50))
    let q = supabaseAdmin.from('inventory')
      .select('id, year, make, model, trim, price, mileage, stocknumber, vin, status, image_urls')
      .eq('dealership_id', req.dealershipId)
      .is('archived_at', null)
      .limit(limit)

    if (req.query.status) {
      q = q.eq('status', sanitizeString(req.query.status, 30))
    } else {
      q = q.neq('status', 'sold')
    }

    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ data: data || [] })
  })

  app.get('/api/v1/leads', apiAuth, requireApiScope('read'), rateLimitApiKey('read', 120, 60), async (req, res) => {
    const limit = Math.min(200, Math.max(1, sanitizeNumber(req.query.limit, 1, 200) || 50))
    const { data, error } = await supabaseAdmin.from('leads')
      .select('id, name, email, phone, source, status, created_at')
      .eq('dealership_id', req.dealershipId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ data: data || [] })
  })

  app.post('/api/v1/leads', apiAuth, requireApiScope('leads'), rateLimitApiKey('write', 30, 60), async (req, res) => {
    const b = req.body || {}
    const out = await callApiTool('create_lead', {
      name: b.name,
      email: b.email,
      phone: b.phone,
      source: b.source || 'API',
      comments: b.comments,
    }, {
      dealershipId: req.dealershipId,
      apiKeyId: req.apiKeyId,
    })
    res.status(out?.error ? 400 : 200).json(out)
  })

  // ── Tools + MCP ──
  app.get('/api/v1/tools', apiAuth, requireApiScope('read'), rateLimitApiKey('read', 120, 60), (req, res) => {
    res.json({ tools: apiToolDefs() })
  })

  // Minimal MCP-over-HTTP (JSON-RPC): tools/list + tools/call.
  app.post('/api/v1/mcp', apiAuth, rateLimitApiKey('mcp', 60, 60), async (req, res) => {
    const { method, params, id = null } = req.body || {}
    if (method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: { tools: apiToolDefs() } })
    }

    if (method === 'tools/call') {
      const toolName = sanitizeString(params?.name, 80)
      if (!API_TOOL_BY_NAME[toolName]) {
        return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool '${toolName}' not found` } })
      }

      const scope = toolName === 'create_lead' ? 'leads' : 'read'
      if (!req.apiScopes?.includes(scope)) {
        return res.status(403).json({ jsonrpc: '2.0', id, error: { code: -32003, message: `API key lacks ${scope} scope` } })
      }

      if (params?.arguments && typeof params.arguments !== 'object') {
        return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid tool arguments' } })
      }

      const out = await callApiTool(toolName, params?.arguments || {}, {
        dealershipId: req.dealershipId,
        apiKeyId: req.apiKeyId,
      })

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(out) }],
          isError: !!out?.error,
        },
      })
    }

    res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found' } })
  })
}
