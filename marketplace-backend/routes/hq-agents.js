/**
 * MarketSync HQ Agent Hub Routes & MCP Endpoint
 * 
 * REST and JSON-RPC APIs for ChatGPT, Claude, Gemini, Grok, and Platform Owners.
 */

import express from 'express'
import {
  verifyAgentApiKey,
  listAgents,
  getAgent,
  updateAgentHeartbeat,
  listTasks,
  getTask,
  createTask,
  claimTask,
  updateTaskExecution,
  addEvidence,
  handoffTask,
  blockTask,
  addTaskEvent,
  listApprovals,
  requestApproval,
  decideApproval,
  getApprovedContext,
  getIntegrationsStatus,
  HQ_MCP_TOOLS,
  executeHqMcpTool,
  CORE_AGENTS
} from '../services/hq-agent-hub.js'
import { syncGoogleSheetWorkQueue } from '../services/work-queue-sync.js'
import { supabase, supabaseAdmin, isSaasStaff } from '../shared.js'
import { SYSTEM_ROLES, hasSystemRole } from '../authorization.js'

// ── AUTHENTICATION MIDDLEWARE ──

export async function requireHqAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' })
  }

  // 1. Check if token is an Agent API key (e.g. ms_agent_*, ms_test_*)
  if (token.startsWith('ms_agent_') || token.startsWith('ms_test_') || token.startsWith('agent_')) {
    const agentAuth = await verifyAgentApiKey(token)
    if (agentAuth) {
      req.isAgent = true
      req.agent = agentAuth
      req.agentId = agentAuth.agentId
      return next()
    }
    return res.status(401).json({ error: 'Invalid or inactive Agent API key' })
  }

  // 2. Otherwise verify as MarketSync User / Platform Owner JWT
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      // If token looks like a general agent key, attempt verification as fallback
      const agentAuth = await verifyAgentApiKey(token)
      if (agentAuth) {
        req.isAgent = true
        req.agent = agentAuth
        req.agentId = agentAuth.agentId
        return next()
      }
      return res.status(401).json({ error: 'AUTH_EXPIRED — please sign in again' })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    const isPlatformStaff = isSaasStaff(profile, user.email)
    const isOwner = hasSystemRole(req, SYSTEM_ROLES.PLATFORM_OWNER) || profile?.system_role === 'platform_owner' || profile?.saas_role === 'owner'

    if (!isPlatformStaff && !isOwner) {
      return res.status(403).json({ error: 'MarketSync HQ access required' })
    }

    req.user = user
    req.profile = profile
    req.isOwner = true
    req.isAgent = false
    req.agentId = 'founder'
    req.agent = {
      agentId: 'founder',
      displayName: profile?.full_name || user.email || 'Platform Owner',
      role: 'owner',
      scopes: ['*']
    }

    return next()
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Authentication failed' })
  }
}

export function registerHqAgentsRoutes(app) {
  // ── 1. AGENTS / IDENTITY ──

  // GET /api/hq/agents/me — Returns current agent / caller identity
  app.get('/api/hq/agents/me', requireHqAuth, async (req, res) => {
    try {
      const agent = req.isAgent ? await getAgent(req.agentId) : req.agent
      res.json({
        authenticated: true,
        isAgent: req.isAgent,
        agentId: req.agentId,
        agent: agent || req.agent,
        scopes: req.agent?.scopes || []
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/hq/agents — Lists all 4 AI agents & their real-time statuses
  app.get('/api/hq/agents', requireHqAuth, async (req, res) => {
    try {
      const agents = await listAgents()
      res.json({ agents })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/hq/agents/heartbeat — Update agent heartbeat
  app.post('/api/hq/agents/heartbeat', requireHqAuth, async (req, res) => {
    try {
      const agentId = req.isAgent ? req.agentId : (req.body?.agentId || req.agentId)
      const updated = await updateAgentHeartbeat(agentId, req.body || {})
      res.json({ success: true, agent: updated })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // ── 2. TASKS & LIFECYCLE ──

  // GET /api/hq/tasks — List tasks with status, owner, priority filters
  app.get('/api/hq/tasks', requireHqAuth, async (req, res) => {
    try {
      const { status, owner, priority, limit } = req.query
      const tasks = await listTasks({
        status: status ? (status.includes(',') ? status.split(',') : status) : null,
        owner: owner || null,
        priority: priority || null,
        limit: limit ? Number(limit) : 100
      })
      res.json({ tasks })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/hq/tasks/:id — Get task detail with events, evidence, approvals
  app.get('/api/hq/tasks/:id', requireHqAuth, async (req, res) => {
    try {
      const task = await getTask(req.params.id)
      if (!task) return res.status(404).json({ error: `Task '${req.params.id}' not found` })
      res.json({ task })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/hq/tasks — Create a new task (founder or sync)
  app.post('/api/hq/tasks', requireHqAuth, async (req, res) => {
    try {
      const task = await createTask(req.body, req.agentId)
      res.status(201).json({ success: true, task })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // POST /api/hq/tasks/:id/claim — Claim task (atomic double-claim prevention)
  app.post('/api/hq/tasks/:id/claim', requireHqAuth, async (req, res) => {
    try {
      const targetAgentId = req.isAgent ? req.agentId : (req.body?.agentId || req.agentId)
      const task = await claimTask(req.params.id, targetAgentId, {
        sessionContext: req.body?.sessionContext || null
      })
      res.json({ success: true, task })
    } catch (e) {
      res.status(409).json({ error: e.message })
    }
  })

  // POST /api/hq/tasks/:id/event — Record an event or progress note
  app.post('/api/hq/tasks/:id/event', requireHqAuth, async (req, res) => {
    try {
      const { eventType = 'status_changed', note = '', payload = {} } = req.body || {}
      const event = await addTaskEvent(req.params.id, req.agentId, eventType, null, null, note, payload)
      res.status(201).json({ success: true, event })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // POST /api/hq/tasks/:id/evidence — Attach evidence / proof of work
  app.post('/api/hq/tasks/:id/evidence', requireHqAuth, async (req, res) => {
    try {
      const evidence = await addEvidence(req.params.id, req.agentId, req.body || {})
      res.status(201).json({ success: true, evidence })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // POST /api/hq/tasks/:id/handoff — Hand task off to QA / target agent
  app.post('/api/hq/tasks/:id/handoff', requireHqAuth, async (req, res) => {
    try {
      const task = await handoffTask(req.params.id, req.agentId, req.body || {})
      res.json({ success: true, task })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // POST /api/hq/tasks/:id/block — Mark task blocked
  app.post('/api/hq/tasks/:id/block', requireHqAuth, async (req, res) => {
    try {
      const task = await blockTask(req.params.id, req.agentId, req.body || {})
      res.json({ success: true, task })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // POST /api/hq/tasks/:id/review — Submit review or update execution status
  app.post('/api/hq/tasks/:id/review', requireHqAuth, async (req, res) => {
    try {
      const { status = 'Done', note = 'Review completed', resultSummary = '', verificationNotes = '' } = req.body || {}
      const task = await updateTaskExecution(req.params.id, req.agentId, {
        status,
        note,
        resultSummary,
        verificationNotes
      })
      res.json({ success: true, task })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // ── 3. FOUNDER APPROVALS ──

  // GET /api/hq/approvals — List approvals
  app.get('/api/hq/approvals', requireHqAuth, async (req, res) => {
    try {
      const { status, limit } = req.query
      const approvals = await listApprovals({
        status: status || null,
        limit: limit ? Number(limit) : 50
      })
      res.json({ approvals })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/hq/approvals/:id/request — Request founder approval
  app.post('/api/hq/approvals/:id/request', requireHqAuth, async (req, res) => {
    try {
      const approval = await requestApproval({
        taskId: req.params.id !== 'new' ? req.params.id : (req.body?.taskId || null),
        agentId: req.agentId,
        actionType: req.body?.actionType,
        title: req.body?.title,
        description: req.body?.description || '',
        requestedChanges: req.body?.requestedChanges || {}
      })
      res.status(201).json({ success: true, approval })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // POST /api/hq/approvals/:id/decide — Founder approve or reject
  app.post('/api/hq/approvals/:id/decide', requireHqAuth, async (req, res) => {
    try {
      if (req.isAgent && req.agentId !== 'founder') {
        return res.status(403).json({ error: 'Only founders / platform owners can decide approvals' })
      }
      const { decision, reason } = req.body || {}
      const approval = await decideApproval(req.params.id, decision, {
        reason: reason || '',
        decidedBy: req.user?.email || req.agentId
      })
      res.json({ success: true, approval })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // ── 4. CONTEXT & INTEGRATIONS ──

  // GET /api/hq/context — Retrieve approved shared context
  app.get('/api/hq/context', requireHqAuth, (req, res) => {
    try {
      const context = getApprovedContext(req.query?.category || 'all')
      res.json({ context })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/hq/integrations/status — Integrations health status
  app.get('/api/hq/integrations/status', requireHqAuth, (req, res) => {
    try {
      const integrations = getIntegrationsStatus()
      res.json({ integrations })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/hq/sync/work-queue — Idempotent sync from Google Sheets
  app.post('/api/hq/sync/work-queue', requireHqAuth, async (req, res) => {
    try {
      const rows = req.body?.rows || []
      const result = await syncGoogleSheetWorkQueue(rows, req.agentId)
      res.json(result)
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // ── 5. MCP JSON-RPC 2.0 PROTOCOL ──

  // GET /api/hq/mcp/tools — Discovery list of MCP tools
  app.get('/api/hq/mcp/tools', requireHqAuth, (req, res) => {
    res.json({ tools: HQ_MCP_TOOLS })
  })

  // POST /api/hq/mcp — JSON-RPC 2.0 Endpoint (tools/list + tools/call)
  app.post('/api/hq/mcp', requireHqAuth, async (req, res) => {
    const { method, params, id = null, jsonrpc = '2.0' } = req.body || {}

    if (method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: { tools: HQ_MCP_TOOLS } })
    }

    if (method === 'tools/call') {
      const toolName = String(params?.name || '').trim()
      const toolDef = HQ_MCP_TOOLS.find(t => t.name === toolName)
      if (!toolDef) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Tool '${toolName}' not found` }
        })
      }

      const args = params?.arguments || {}
      const output = await executeHqMcpTool(toolName, args, req.agentId)

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          isError: !!output?.error
        }
      })
    }

    return res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method '${method}' not supported` }
    })
  })
}
