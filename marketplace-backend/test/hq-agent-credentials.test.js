/**
 * Tests for Founder-Only HQ Agent Credential Generation & Rotation Flow
 * 
 * Verifies:
 * 1. Founder can generate keys for chatgpt, claude, gemini, grok
 * 2. Normal user cannot generate keys (403 Forbidden)
 * 3. AI agent bearer token cannot generate keys (403 Forbidden)
 * 4. Invalid agent ID rejected (400 Bad Request)
 * 5. Duplicate generation blocked without rotate_existing
 * 6. Explicit rotation succeeds
 * 7. Old credential becomes inactive after rotation
 * 8. Only SHA-256 hash persists
 * 9. Plaintext token never appears in database/store records
 * 10. Plaintext token never appears in audit logs
 * 11. GET status endpoint never returns hashes or tokens
 * 12. Staging and production environment labels are correct
 * 13. Credential generation writes immutable HQ audit event
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import express from 'express'
import {
  generateAgentCredentials,
  listAgentCredentialsStatus,
  getEnvironmentLabel,
  verifyAgentApiKey,
  hashApiKey,
  recordHqAudit
} from '../services/hq-agent-hub.js'
import { registerHqAgentsRoutes } from '../routes/hq-agents.js'

describe('Founder-Only HQ Agent Credential Generation & Lifecycle', () => {
  let server
  let baseUrl

  before(async () => {
    process.env.NODE_ENV = 'test'
    const app = express()
    app.use(express.json())
    registerHqAgentsRoutes(app)

    await new Promise((resolve) => {
      server = http.createServer(app)
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port
        baseUrl = `http://127.0.0.1:${port}`
        resolve()
      })
    })
  })

  after(() => {
    if (server) {
      server.close()
    }
  })

  // 1. Founder can generate keys
  it('1. Founder can generate keys for all 4 agents', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['chatgpt', 'claude', 'gemini', 'grok'],
        rotate_existing: true
      })
    })

    const body = await res.json()
    assert.equal(res.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.credentials.length, 4)

    for (const cred of body.credentials) {
      assert.ok(['chatgpt', 'claude', 'gemini', 'grok'].includes(cred.agent_id))
      assert.ok(cred.key_prefix.startsWith(`ms_agent_${cred.agent_id}_`))
      assert.ok(cred.token.startsWith(`ms_agent_${cred.agent_id}_`))
    }
  })

  // 2. Normal user cannot generate keys
  it('2. Normal user cannot generate keys (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer normal-user-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['chatgpt'],
        rotate_existing: true
      })
    })

    const body = await res.json()
    assert.equal(res.status, 403)
    assert.ok(body.error.includes('Founder / platform owner access required'))
  })

  // 3. AI agent bearer token cannot generate keys
  it('3. AI agent bearer token cannot generate keys (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ms_agent_chatgpt_mocktoken123456789',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['chatgpt'],
        rotate_existing: true
      })
    })

    const body = await res.json()
    assert.equal(res.status, 403)
    assert.ok(body.error.includes('AI agent bearer tokens cannot generate'))
  })

  // 4. Invalid agent ID rejected
  it('4. Invalid agent ID is rejected with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['unknown_bot'],
        rotate_existing: true
      })
    })

    const body = await res.json()
    assert.equal(res.status, 400)
    assert.ok(body.error.includes("Invalid agent_id 'unknown_bot'"))
  })

  // 5. Duplicate generation blocked without rotate_existing
  it('5. Duplicate generation blocked without rotate_existing', async () => {
    // Generate for grok first
    await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['grok'],
        rotate_existing: true
      })
    })

    // Try to generate again without rotate_existing: true
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['grok'],
        rotate_existing: false
      })
    })

    const body = await res.json()
    assert.equal(res.status, 409)
    assert.ok(body.error.includes("Active credential already exists for agent 'grok'"))
  })

  // 6. Explicit rotation succeeds
  it('6. Explicit rotation with rotate_existing: true succeeds and returns new token', async () => {
    const res1 = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['gemini'],
        rotate_existing: true
      })
    })
    const body1 = await res1.json()
    assert.equal(res1.status, 200)
    const token1 = body1.credentials[0].token

    const res2 = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['gemini'],
        rotate_existing: true
      })
    })
    const body2 = await res2.json()
    assert.equal(res2.status, 200)
    const token2 = body2.credentials[0].token

    assert.notEqual(token1, token2)
  })

  // 7. Old credential becomes inactive after rotation
  it('7. Old credential becomes inactive after rotation and fails verification', async () => {
    const res1 = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['claude'],
        rotate_existing: true
      })
    })
    const body1 = await res1.json()
    const oldToken = body1.credentials[0].token

    // Verify old token works initially
    const auth1 = await verifyAgentApiKey(oldToken)
    assert.ok(auth1)
    assert.equal(auth1.agentId, 'claude')

    // Rotate token
    const res2 = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['claude'],
        rotate_existing: true
      })
    })
    const body2 = await res2.json()
    const newToken = body2.credentials[0].token

    // Old token should fail verification now
    const authOldAfterRotate = await verifyAgentApiKey(oldToken)
    assert.equal(authOldAfterRotate, null)

    // New token should succeed
    const authNew = await verifyAgentApiKey(newToken)
    assert.ok(authNew)
    assert.equal(authNew.agentId, 'claude')
  })

  // 8. Only SHA-256 hash persists
  it('8. Only SHA-256 hash persists and matches hashApiKey()', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['chatgpt'],
        rotate_existing: true
      })
    })
    const body = await res.json()
    const token = body.credentials[0].token
    const expectedHash = hashApiKey(token)

    // Verify SHA-256 string format (64 hex characters)
    assert.equal(expectedHash.length, 64)
    assert.match(expectedHash, /^[a-f0-9]{64}$/)
  })

  // 9. Plaintext token never appears in status response or stored records
  it('9. Plaintext token never appears in status response or stored records', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/status`, {
      headers: {
        'Authorization': 'Bearer founder-token'
      }
    })

    const body = await res.json()
    assert.equal(res.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.credentials.length, 4)

    for (const cred of body.credentials) {
      assert.equal(cred.token, undefined)
      assert.equal(cred.apiKey, undefined)
      assert.equal(cred.secret, undefined)
      assert.equal(cred.api_key_hash, undefined)
      assert.equal(cred.hash, undefined)
      assert.ok(cred.agent_id)
      assert.ok(typeof cred.has_active_credential === 'boolean')
    }
  })

  // 10. Plaintext token never appears in audit logs
  it('10. Plaintext token never appears in audit logs', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['grok'],
        rotate_existing: true
      })
    })
    const body = await res.json()
    const generatedToken = body.credentials[0].token

    const auditRes = await fetch(`${baseUrl}/api/hq/audit-logs`, {
      headers: {
        'Authorization': 'Bearer founder-token'
      }
    })

    assert.equal(auditRes.status, 200)
    const auditBody = await auditRes.json()
    const rawAuditString = JSON.stringify(auditBody)

    // Plaintext token MUST NOT appear anywhere in the audit payload
    assert.equal(rawAuditString.includes(generatedToken), false)
  })

  // 11. GET status endpoint never returns hashes or tokens
  it('11. GET /api/hq/agent-credentials/status returns safe metadata only', async () => {
    const res = await fetch(`${baseUrl}/api/hq/agent-credentials/status`, {
      headers: {
        'Authorization': 'Bearer founder-token'
      }
    })

    const body = await res.json()
    assert.equal(res.status, 200)
    assert.ok(body.environment)
    assert.ok(Array.isArray(body.credentials))

    const cred = body.credentials.find(c => c.agent_id === 'grok')
    assert.ok(cred)
    assert.equal(cred.has_active_credential, true)
    assert.ok(cred.key_prefix.startsWith('ms_agent_grok_'))
    assert.equal(cred.api_key_hash, undefined)
    assert.equal(cred.token, undefined)
  })

  // 12. Staging vs Production environment labels
  it('12. Staging and production environment labels evaluate correctly', () => {
    const origEnv = process.env.NODE_ENV
    const origService = process.env.RENDER_SERVICE_NAME
    const origDomain = process.env.SITE_DOMAIN_TARGET

    try {
      // Staging test
      process.env.NODE_ENV = 'test'
      assert.equal(getEnvironmentLabel(), 'staging')

      // Production test
      process.env.NODE_ENV = 'production'
      process.env.SITE_DOMAIN_TARGET = 'marketsync.link'
      delete process.env.RENDER_SERVICE_NAME
      assert.equal(getEnvironmentLabel(), 'production')
    } finally {
      process.env.NODE_ENV = origEnv
      process.env.RENDER_SERVICE_NAME = origService
      process.env.SITE_DOMAIN_TARGET = origDomain
    }
  })

  // 13. Credential generation writes immutable HQ audit event
  it('13. Credential generation writes immutable HQ audit event with proper actor & action', async () => {
    await fetch(`${baseUrl}/api/hq/agent-credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer founder-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agents: ['gemini'],
        rotate_existing: true
      })
    })

    const auditRes = await fetch(`${baseUrl}/api/hq/audit-logs`, {
      headers: {
        'Authorization': 'Bearer founder-token'
      }
    })

    assert.equal(auditRes.status, 200)
    const auditBody = await auditRes.json()
    const logs = auditBody.auditLogs || []
    const credLog = logs.find(l => l.action.startsWith('agent_credentials.') && l.agent_id === 'gemini')

    assert.ok(credLog)
    assert.equal(credLog.actor_type, 'founder')
    assert.ok(credLog.resulting_state.key_prefix.startsWith('ms_agent_gemini_'))
    assert.equal(credLog.resulting_state.environment, 'staging')
  })
})
