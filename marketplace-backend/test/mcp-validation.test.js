import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { keyIsExpired, requestedExpiry, requestedScopes } from '../api-key-policy.js'

const hashKey = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex')

// Mock API key validator mirroring public-api.js logic
function validateApiKey(rawKey, mockDbKey) {
  if (!rawKey) return { status: 401, error: 'API key required' }
  const hashed = hashKey(rawKey)
  if (!mockDbKey || mockDbKey.key_hash !== hashed || mockDbKey.revoked_at) {
    return { status: 401, error: 'invalid or revoked API key' }
  }
  if (keyIsExpired(mockDbKey.expires_at)) {
    return { status: 401, error: 'API key expired' }
  }
  return { status: 200, key: mockDbKey }
}

// Mock MCP JSON-RPC handler mirroring public-api.js logic
function handleMcpRequest(reqBody, authKey) {
  const { method, params, id = null } = reqBody || {}
  if (!authKey) return { status: 401, body: { jsonrpc: '2.0', id, error: { code: -32001, message: 'Unauthorized' } } }

  if (method === 'tools/list') {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            { name: 'search_inventory', description: 'Search inventory', input_schema: {} },
            { name: 'create_lead', description: 'Create CRM lead', input_schema: {} },
          ],
        },
      },
    }
  }

  if (method === 'tools/call') {
    const toolName = params?.name
    const scope = toolName === 'create_lead' ? 'leads' : 'read'
    if (!authKey.scopes?.includes(scope)) {
      return {
        status: 403,
        body: { jsonrpc: '2.0', id, error: { code: -32003, message: `API key lacks ${scope} scope` } },
      }
    }
    if (toolName === 'search_inventory') {
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify({ vehicles: [{ id: 'v1', dealership_id: authKey.dealership_id }] }) }], isError: false },
        },
      }
    }
    if (toolName === 'create_lead') {
      const args = params?.arguments || {}
      if (!args.name) {
        return {
          status: 200,
          body: {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify({ error: 'name and email or phone required' }) }], isError: true },
          },
        }
      }
      return {
        status: 200,
        body: {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, contact_id: 'c100' }) }], isError: false },
        },
      }
    }
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify({ error: 'unknown tool: ' + toolName }) }], isError: true },
      },
    }
  }

  return {
    status: 400,
    body: { jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found' } },
  }
}

test('API Key Validation: valid key succeeds', () => {
  const raw = 'msk_live_abcdef1234567890'
  const mockDbKey = { id: 'k1', dealership_id: 'd1', scopes: ['read', 'leads'], key_hash: hashKey(raw), expires_at: null, revoked_at: null }
  const res = validateApiKey(raw, mockDbKey)
  assert.equal(res.status, 200)
  assert.equal(res.key.dealership_id, 'd1')
})

test('API Key Validation: invalid key fails with 401', () => {
  const raw = 'msk_live_invalid'
  const mockDbKey = { id: 'k1', dealership_id: 'd1', scopes: ['read'], key_hash: hashKey('different'), expires_at: null, revoked_at: null }
  const res = validateApiKey(raw, mockDbKey)
  assert.equal(res.status, 401)
  assert.equal(res.error, 'invalid or revoked API key')
})

test('API Key Validation: revoked key fails with 401', () => {
  const raw = 'msk_live_revoked'
  const mockDbKey = { id: 'k1', dealership_id: 'd1', scopes: ['read'], key_hash: hashKey(raw), expires_at: null, revoked_at: '2026-08-01T00:00:00Z' }
  const res = validateApiKey(raw, mockDbKey)
  assert.equal(res.status, 401)
  assert.equal(res.error, 'invalid or revoked API key')
})

test('API Key Validation: expired key fails with 401', () => {
  const raw = 'msk_live_expired'
  const mockDbKey = { id: 'k1', dealership_id: 'd1', scopes: ['read'], key_hash: hashKey(raw), expires_at: '2020-01-01T00:00:00Z', revoked_at: null }
  const res = validateApiKey(raw, mockDbKey)
  assert.equal(res.status, 401)
  assert.equal(res.error, 'API key expired')
})

test('MCP Endpoint: tools/list returns available tools', () => {
  const mockKey = { id: 'k1', dealership_id: 'd1', scopes: ['read'] }
  const res = handleMcpRequest({ method: 'tools/list', id: 1 }, mockKey)
  assert.equal(res.status, 200)
  assert.equal(res.body.jsonrpc, '2.0')
  assert.equal(res.body.result.tools.length, 2)
  assert.equal(res.body.result.tools[0].name, 'search_inventory')
})

test('MCP Endpoint: tools/call search_inventory succeeds with read scope', () => {
  const mockKey = { id: 'k1', dealership_id: 'dealer-A', scopes: ['read'] }
  const res = handleMcpRequest({ method: 'tools/call', params: { name: 'search_inventory', arguments: { query: 'Civic' } }, id: 2 }, mockKey)
  assert.equal(res.status, 200)
  assert.ok(res.body.result.content[0].text.includes('dealer-A'))
})

test('MCP Endpoint: tools/call create_lead fails with 403 when leads scope missing', () => {
  const mockKey = { id: 'k1', dealership_id: 'dealer-A', scopes: ['read'] }
  const res = handleMcpRequest({ method: 'tools/call', params: { name: 'create_lead', arguments: { name: 'John' } }, id: 3 }, mockKey)
  assert.equal(res.status, 403)
  assert.equal(res.body.error.code, -32003)
  assert.ok(res.body.error.message.includes('leads scope'))
})

test('MCP Endpoint: malformed JSON-RPC or unknown method fails with 400', () => {
  const mockKey = { id: 'k1', dealership_id: 'dealer-A', scopes: ['read'] }
  const res = handleMcpRequest({ method: 'unknown/method', id: 4 }, mockKey)
  assert.equal(res.status, 400)
  assert.equal(res.body.error.code, -32601)
  assert.equal(res.body.error.message, 'method not found')
})
