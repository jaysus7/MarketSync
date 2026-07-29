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

const hashKey = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex')
const isMgr = (req) => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(req.profile?.role)
const API_SCOPES = new Set(['read', 'leads'])
const DEFAULT_API_SCOPES = ['read', 'leads']

function requestedScopes(value) {
  if (value == null) return DEFAULT_API_SCOPES
  if (!Array.isArray(value)) return null
  const normalized = value.map(s => String(s || '').trim().toLowerCase())
  if (normalized.some(s => !API_SCOPES.has(s))) return null
  const scopes = [...new Set(normalized)]
  return scopes.length ? scopes : null
}

function requestedExpiry(value) {
  if (value == null || value === '') return { value: null }
  const expiresAt = new Date(value)
  const max = Date.now() + 366 * 24 * 60 * 60 * 1000
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() || expiresAt.getTime() > max) {
    return { error: 'expires_at must be a future date within one year' }
  }
  return { value: expiresAt.toISOString() }
}

// ── API-safe tool set (MCP-shaped) ────────────────────────────────────────────
const API_TOOLS = [
  {
    name: 'search_inventory',
    description: "Search the dealership's live inventory by make/model/keywords, with optional max price and min year.",
    input_schema: { type: 'object', properties: { query: { type: 'string' }, max_price: { type: 'number' }, min_year: { type: 'number' }, limit: { type: 'number' } } },
    async handler(a, ctx) {
      let q = supabaseAdmin.from('inventory').select('id, year, make, model, trim, price, mileage, stocknumber, vin, status')
        .eq('dealership_id', ctx.dealershipId).is('archived_at', null).neq('status', 'sold').limit(Math.min(50, Number(a.limit) || 20))
      if (a.max_price) q = q.lte('price', a.max_price)
      if (a.min_year) q = q.gte('year', a.min_year)
      if (a.query) q = q.or(`make.ilike.%${a.query}%,model.ilike.%${a.query}%,trim.ilike.%${a.query}%`)
      const { data } = await q
      return { vehicles: data || [] }
    },
  },
  {
    name: 'create_lead',
    description: 'Create a CRM lead. Requires a name and an email or phone. Notifies the dealership.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, source: { type: 'string' }, comments: { type: 'string' } }, required: ['name'] },
    async handler(a, ctx) {
      if (!a.name || (!a.email && !a.phone)) return { error: 'name and email or phone required' }
      const contactId = await findOrCreateContact({ dealershipId: ctx.dealershipId, name: a.name, email: a.email, phone: a.phone, source: a.source || 'API' })
      if (!contactId) return { error: 'could not create lead' }
      emitEvent({
        dealershipId: ctx.dealershipId, eventName: 'lead.created', entityType: 'customer', entityId: contactId,
        summary: `API lead — ${a.name}`, department: 'Sales',
        payload: { source: a.source || 'API', comments: a.comments || null },
      })
      return { ok: true, contact_id: contactId }
    },
  },
]
const API_TOOL_BY_NAME = Object.fromEntries(API_TOOLS.map(t => [t.name, t]))
const apiToolDefs = () => API_TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }))
async function callApiTool(name, args, ctx) {
  const t = API_TOOL_BY_NAME[name]
  if (!t) return { error: 'unknown tool: ' + name }
  try { return await t.handler(args || {}, ctx) } catch (e) { return { error: String(e?.message || e).slice(0, 300) } }
}

// ── Bearer key auth → resolves the dealership ─────────────────────────────────
async function apiAuth(req, res, next) {
  const h = req.headers.authorization || ''
  const raw = h.startsWith('Bearer ') ? h.slice(7).trim() : String(req.headers['x-api-key'] || '').trim()
  if (!raw) return res.status(401).json({ error: 'API key required' })
  try {
    const { data: key } = await supabaseAdmin.from('api_keys').select('id, dealership_id, scopes, expires_at').eq('key_hash', hashKey(raw)).is('revoked_at', null).maybeSingle()
    if (!key) return res.status(401).json({ error: 'invalid or revoked API key' })
    if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) return res.status(401).json({ error: 'API key expired' })
    req.dealershipId = key.dealership_id
    req.apiScopes = key.scopes || []
    supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id).then(() => {}, () => {})
    next()
  } catch { res.status(500).json({ error: 'auth error' }) }
}

function requireApiScope(scope) {
  return (req, res, next) => {
    if (!req.apiScopes?.includes(scope)) return res.status(403).json({ error: `API key lacks ${scope} scope` })
    next()
  }
}

export function registerPublicApi(app) {
  // ── Key management (dashboard, managers) ──
  app.post('/api-keys', requireAuth, requireMfa, requirePermission('api_keys.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
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
  app.get('/api-keys', requireAuth, requirePermission('api_keys.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    const { data } = await supabaseAdmin.from('api_keys').select('id, name, key_prefix, scopes, expires_at, created_at, last_used_at, revoked_at')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(50)
    res.json({ keys: data || [] })
  })
  app.post('/api-keys/:id/revoke', requireAuth, requireMfa, requirePermission('api_keys.manage'), async (req, res) => {
    if (!req.dealershipId) return res.status(403).json({ error: 'no dealership' })
    if (!isMgr(req)) return res.status(403).json({ error: 'Manager access required' })
    await supabaseAdmin.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', req.params.id).eq('dealership_id', req.dealershipId)
    audit(req, AuditAction.API_KEY_REVOKED, { api_key_id: req.params.id })
    res.json({ ok: true })
  })

  // ── Public REST API v1 (key auth) ──
  app.get('/api/v1/inventory', apiAuth, requireApiScope('read'), async (req, res) => {
    let q = supabaseAdmin.from('inventory').select('id, year, make, model, trim, price, mileage, stocknumber, vin, status, image_urls')
      .eq('dealership_id', req.dealershipId).is('archived_at', null).limit(Math.min(200, Number(req.query.limit) || 50))
    if (req.query.status) q = q.eq('status', String(req.query.status)); else q = q.neq('status', 'sold')
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ data: data || [] })
  })
  app.get('/api/v1/leads', apiAuth, requireApiScope('read'), async (req, res) => {
    const { data } = await supabaseAdmin.from('leads').select('id, name, email, phone, source, status, created_at')
      .eq('dealership_id', req.dealershipId).order('created_at', { ascending: false }).limit(Math.min(200, Number(req.query.limit) || 50))
    res.json({ data: data || [] })
  })
  app.post('/api/v1/leads', apiAuth, requireApiScope('leads'), async (req, res) => {
    const b = req.body || {}
    const out = await callApiTool('create_lead', { name: b.name, email: b.email, phone: b.phone, source: b.source || 'API', comments: b.comments }, { dealershipId: req.dealershipId })
    res.status(out?.error ? 400 : 200).json(out)
  })

  // ── Tools + MCP ──
  app.get('/api/v1/tools', apiAuth, requireApiScope('read'), (req, res) => res.json({ tools: apiToolDefs() }))
  // Minimal MCP-over-HTTP (JSON-RPC): tools/list + tools/call.
  app.post('/api/v1/mcp', apiAuth, async (req, res) => {
    const { method, params, id = null } = req.body || {}
    if (method === 'tools/list') return res.json({ jsonrpc: '2.0', id, result: { tools: apiToolDefs() } })
    if (method === 'tools/call') {
      const scope = params?.name === 'create_lead' ? 'leads' : 'read'
      if (!req.apiScopes?.includes(scope)) return res.status(403).json({ jsonrpc: '2.0', id, error: { code: -32003, message: `API key lacks ${scope} scope` } })
      const out = await callApiTool(params?.name, params?.arguments || {}, { dealershipId: req.dealershipId })
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out) }], isError: !!out?.error } })
    }
    res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found' } })
  })
}
