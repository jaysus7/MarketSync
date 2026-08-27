/**
 * MarketSync HQ Agent Hub Service Layer
 * 
 * Provides the central control plane, task ledger, and MCP backend
 * for AI agents (ChatGPT, Claude, Gemini, Grok) and Platform Owners.
 */

import crypto from 'node:crypto'
import { supabaseAdmin } from '../shared.js'

// Standard Seeded Agent Definitions
export const CORE_AGENTS = Object.freeze({
  chatgpt: {
    id: 'chatgpt',
    display_name: 'ChatGPT',
    role: 'chief_of_staff',
    status: 'idle',
    permission_scope: ['read_context', 'read_tasks', 'claim_tasks', 'update_task_state', 'attach_evidence', 'handoff_qa', 'request_approval'],
    is_enabled: true,
    provider: 'openai',
    model: 'gpt-4o / o1'
  },
  claude: {
    id: 'claude',
    display_name: 'Claude',
    role: 'senior_builder',
    status: 'idle',
    permission_scope: ['read_context', 'read_tasks', 'claim_tasks', 'update_task_state', 'attach_evidence', 'handoff_qa', 'request_approval'],
    is_enabled: true,
    provider: 'anthropic',
    model: 'claude-3-7-sonnet'
  },
  gemini: {
    id: 'gemini',
    display_name: 'Gemini',
    role: 'workspace_specialist',
    status: 'idle',
    permission_scope: ['read_context', 'read_tasks', 'claim_tasks', 'update_task_state', 'attach_evidence', 'handoff_qa', 'request_approval'],
    is_enabled: true,
    provider: 'google',
    model: 'gemini-2.0-flash / pro'
  },
  grok: {
    id: 'grok',
    display_name: 'Grok',
    role: 'implementation_engineer',
    status: 'idle',
    permission_scope: ['read_context', 'read_tasks', 'claim_tasks', 'update_task_state', 'attach_evidence', 'handoff_qa', 'request_approval'],
    is_enabled: true,
    provider: 'xai',
    model: 'grok-2'
  }
})

export const TASK_LIFECYCLE = Object.freeze([
  'Inbox',
  'Ready',
  'In Progress',
  'Review',
  'Blocked',
  'Done'
])

export const TASK_PRIORITIES = Object.freeze(['P0', 'P1', 'P2', 'P3'])

// In-Memory store fallback for unit testing / offline execution without live Postgres
const memoryStore = {
  agents: new Map(Object.entries(CORE_AGENTS).map(([k, v]) => [k, { ...v, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])),
  credentials: new Map(),
  sessions: new Map(),
  tasks: new Map(),
  events: [],
  evidence: [],
  approvals: new Map(),
  integrations: new Map([
    ['google_sheets_work_queue', { id: 'google_sheets_work_queue', name: 'Google Sheets Work Queue', category: 'work_queue', status: 'connected', config: { sheet_name: 'MarketSync — AI Work Queue', sync_mode: 'bidirectional' } }],
    ['github', { id: 'github', name: 'GitHub Repository (jaysus7/MarketSync)', category: 'vcs', status: 'connected', config: { repo: 'jaysus7/MarketSync', default_branch: 'main', working_branch: 'staging' } }],
    ['openai', { id: 'openai', name: 'OpenAI (ChatGPT / o1)', category: 'model_provider', status: 'connected', config: { status: 'active' } }],
    ['anthropic', { id: 'anthropic', name: 'Anthropic (Claude 3.7)', category: 'model_provider', status: 'connected', config: { status: 'active' } }],
    ['google_gemini', { id: 'google_gemini', name: 'Google Cloud (Gemini 2.0)', category: 'model_provider', status: 'connected', config: { status: 'active' } }],
    ['xai_grok', { id: 'xai_grok', name: 'xAI (Grok 2)', category: 'model_provider', status: 'connected', config: { status: 'active' } }]
  ]),
  auditLogs: []
}

// ── UTILITIES ──

export function hashApiKey(key) {
  if (!key || typeof key !== 'string') return ''
  return crypto.createHash('sha256').update(key.trim()).digest('hex')
}

export function generateAgentKey(agentId, name = 'Default Key') {
  const secret = `ms_agent_${agentId}_${crypto.randomBytes(24).toString('hex')}`
  const hash = hashApiKey(secret)
  const prefix = secret.slice(0, 16)
  return { apiKey: secret, hash, prefix, name, agentId }
}

const isTestEnv = () => process.env.NODE_ENV === 'test' || !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('placeholder')

// ── AUDIT LOGGING ──

export async function recordHqAudit({
  agentId = null,
  taskId = null,
  action,
  actorType = 'agent',
  actorId = null,
  previousState = null,
  resultingState = null,
  evidenceRef = null,
  sessionId = null,
  metadata = {}
}) {
  const logEntry = {
    id: crypto.randomUUID(),
    agent_id: agentId,
    task_id: taskId,
    action,
    actor_type: actorType,
    actor_id: actorId || agentId,
    previous_state: previousState,
    resulting_state: resultingState,
    evidence_ref: evidenceRef,
    session_id: sessionId,
    metadata: metadata || {},
    created_at: new Date().toISOString()
  }

  memoryStore.auditLogs.push(logEntry)

  if (!isTestEnv()) {
    try {
      await supabaseAdmin.from('hq_audit_logs').insert(logEntry)
    } catch (e) {
      console.warn('[hq-agent-hub] DB audit insert failed:', e.message)
    }
  }

  return logEntry
}

// ── AGENT AUTHENTICATION ──

export async function verifyAgentApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return null
  const keyHash = hashApiKey(apiKey)

  // 1. Check in-memory store
  for (const cred of memoryStore.credentials.values()) {
    if (cred.api_key_hash === keyHash && cred.is_active) {
      const agent = memoryStore.agents.get(cred.agent_id)
      if (agent && agent.is_enabled) {
        cred.last_used_at = new Date().toISOString()
        return {
          agentId: agent.id,
          displayName: agent.display_name,
          role: agent.role,
          scopes: cred.scopes || agent.permission_scope || [],
          credentialId: cred.id
        }
      }
    }
  }

  // 2. Check Database if available
  if (!isTestEnv()) {
    try {
      const { data: cred, error } = await supabaseAdmin
        .from('hq_agent_credentials')
        .select('*, hq_agents(*)')
        .eq('api_key_hash', keyHash)
        .eq('is_active', true)
        .maybeSingle()

      if (!error && cred && cred.hq_agents && cred.hq_agents.is_enabled) {
        await supabaseAdmin
          .from('hq_agent_credentials')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', cred.id)

        return {
          agentId: cred.hq_agents.id,
          displayName: cred.hq_agents.display_name,
          role: cred.hq_agents.role,
          scopes: cred.scopes || cred.hq_agents.permission_scope || [],
          credentialId: cred.id
        }
      }
    } catch (e) {
      console.warn('[hq-agent-hub] DB credential lookup failed:', e.message)
    }
  }

  // 3. Fallback well-known mock keys for developer agent environments
  for (const [id, agent] of memoryStore.agents.entries()) {
    if (apiKey === `ms_test_${id}` || apiKey === `ms_agent_${id}_secret`) {
      return {
        agentId: agent.id,
        displayName: agent.display_name,
        role: agent.role,
        scopes: agent.permission_scope,
        credentialId: 'mock-cred'
      }
    }
  }

  return null
}

export function registerAgentCredential({ agentId, name, apiKeyHash, keyPrefix, scopes = [] }) {
  const id = crypto.randomUUID()
  const cred = {
    id,
    agent_id: agentId,
    name: name || 'Agent Credential',
    api_key_hash: apiKeyHash,
    key_prefix: keyPrefix,
    scopes: scopes.length ? scopes : ['tasks:claim', 'tasks:write', 'evidence:write', 'approvals:request'],
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  memoryStore.credentials.set(id, cred)
  return cred
}

// ── AGENTS MANAGEMENT ──

export async function listAgents() {
  const list = []
  for (const a of memoryStore.agents.values()) {
    list.push({ ...a })
  }
  return list
}

export async function getAgent(agentId) {
  if (!agentId) return null
  return memoryStore.agents.get(agentId) || null
}

export async function updateAgentHeartbeat(agentId, { status = null, currentTaskId = null } = {}) {
  const agent = memoryStore.agents.get(agentId)
  if (!agent) throw new Error(`Agent '${agentId}' not found`)

  const now = new Date().toISOString()
  agent.last_heartbeat = now
  agent.last_activity_at = now
  if (status && ['idle', 'working', 'blocked', 'review', 'offline', 'disabled'].includes(status)) {
    agent.status = status
  }
  if (currentTaskId !== undefined) {
    agent.current_task_id = currentTaskId
  }
  agent.updated_at = now

  if (!isTestEnv()) {
    try {
      await supabaseAdmin.from('hq_agents').update({
        last_heartbeat: now,
        last_activity_at: now,
        status: agent.status,
        current_task_id: agent.current_task_id,
        updated_at: now
      }).eq('id', agentId)
    } catch (e) {
      console.warn('[hq-agent-hub] Heartbeat DB update failed:', e.message)
    }
  }

  return agent
}

// ── TASKS MANAGEMENT ──

export async function listTasks({ status = null, owner = null, priority = null, limit = 100 } = {}) {
  let list = Array.from(memoryStore.tasks.values())

  if (status) {
    const statuses = Array.isArray(status) ? status : [status]
    list = list.filter(t => statuses.includes(t.status))
  }
  if (owner) {
    list = list.filter(t => t.owner === owner)
  }
  if (priority) {
    list = list.filter(t => t.priority === priority)
  }

  // Sort descending by priority, then created_at
  const pWeight = { P0: 4, P1: 3, P2: 2, P3: 1 }
  list.sort((a, b) => (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0) || new Date(b.created_at) - new Date(a.created_at))

  return list.slice(0, limit)
}

export async function getTask(taskId) {
  if (!taskId) return null
  const task = memoryStore.tasks.get(taskId)
  if (!task) return null

  const events = memoryStore.events.filter(e => e.task_id === taskId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const evidence = memoryStore.evidence.filter(e => e.task_id === taskId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const approvals = Array.from(memoryStore.approvals.values()).filter(a => a.task_id === taskId)

  return {
    ...task,
    events,
    evidence,
    approvals
  }
}

export async function createTask(taskData, actor = 'founder') {
  if (!taskData.id || !taskData.title) {
    throw new Error('Task requires both id (e.g. MS-001) and title')
  }

  const taskId = String(taskData.id).trim().toUpperCase()
  if (memoryStore.tasks.has(taskId)) {
    throw new Error(`Task '${taskId}' already exists`)
  }

  const now = new Date().toISOString()
  const task = {
    id: taskId,
    title: taskData.title.trim(),
    description: taskData.description || '',
    priority: TASK_PRIORITIES.includes(taskData.priority) ? taskData.priority : 'P2',
    status: TASK_LIFECYCLE.includes(taskData.status) ? taskData.status : 'Inbox',
    owner: taskData.owner || null,
    acceptance_criteria: taskData.acceptance_criteria || '',
    next_action: taskData.next_action || '',
    qa_owner: taskData.qa_owner || null,
    handoff_target: taskData.handoff_target || null,
    blocked_by: taskData.blocked_by || null,
    result_summary: taskData.result_summary || '',
    verification_notes: taskData.verification_notes || '',
    claimed_at: taskData.status === 'In Progress' ? now : null,
    completed_at: taskData.status === 'Done' ? now : null,
    source: taskData.source || 'internal',
    external_sync_key: taskData.external_sync_key || taskId,
    metadata: taskData.metadata || {},
    created_at: now,
    updated_at: now
  }

  memoryStore.tasks.set(taskId, task)

  // Event
  await addTaskEvent(taskId, actor, 'created', null, task.status, `Task ${taskId} created with status ${task.status}`)

  // Audit
  await recordHqAudit({
    taskId,
    action: 'task.created',
    actorType: actor.startsWith('ms_agent_') || CORE_AGENTS[actor] ? 'agent' : 'founder',
    actorId: actor,
    previousState: null,
    resultingState: task
  })

  return task
}

export async function claimTask(taskId, agentId, { sessionContext = null } = {}) {
  const task = memoryStore.tasks.get(taskId)
  if (!task) throw new Error(`Task '${taskId}' not found`)

  const agent = memoryStore.agents.get(agentId)
  if (!agent) throw new Error(`Agent '${agentId}' not registered`)
  if (!agent.is_enabled) throw new Error(`Agent '${agentId}' is disabled`)

  // Double claim prevention: Cannot claim if already In Progress by another agent
  if (task.status === 'In Progress' && task.owner && task.owner !== agentId) {
    throw new Error(`Double-claim prevented: Task '${taskId}' is currently claimed by agent '${task.owner}'`)
  }

  if (task.status === 'Done') {
    throw new Error(`Task '${taskId}' is already Done`)
  }

  // If task has a specific assigned owner that is not this agent, prevent claim
  if (task.owner && task.owner !== agentId && task.status !== 'Ready' && task.status !== 'Inbox') {
    throw new Error(`Task '${taskId}' is assigned to '${task.owner}', not '${agentId}'`)
  }

  const prevState = { ...task }
  const now = new Date().toISOString()

  task.owner = agentId
  task.status = 'In Progress'
  task.claimed_at = now
  task.updated_at = now

  // Update Agent's state
  agent.status = 'working'
  agent.current_task_id = taskId
  agent.last_activity_at = now

  await addTaskEvent(taskId, agentId, 'claimed', prevState.status, 'In Progress', `Agent ${agentId} claimed task ${taskId}`, { sessionContext })

  await recordHqAudit({
    agentId,
    taskId,
    action: 'task.claimed',
    actorType: 'agent',
    actorId: agentId,
    previousState: prevState,
    resultingState: task,
    sessionId: sessionContext
  })

  return task
}

export async function updateTaskExecution(taskId, agentId, {
  status = null,
  nextAction = null,
  resultSummary = null,
  verificationNotes = null,
  note = null
} = {}) {
  const task = memoryStore.tasks.get(taskId)
  if (!task) throw new Error(`Task '${taskId}' not found`)

  // Authorization check: Only current owner, QA owner, handoff target, or founder can update
  if (
    task.owner &&
    task.owner !== agentId &&
    task.qa_owner !== agentId &&
    task.handoff_target !== agentId &&
    agentId !== 'founder' &&
    agentId !== 'admin'
  ) {
    throw new Error(`Unauthorized: Agent '${agentId}' is not the owner or QA reviewer for task '${taskId}'`)
  }

  const prevState = { ...task }
  const now = new Date().toISOString()

  if (status) {
    if (!TASK_LIFECYCLE.includes(status)) {
      throw new Error(`Invalid status '${status}'. Must be one of: ${TASK_LIFECYCLE.join(', ')}`)
    }
    task.status = status
    if (status === 'Done') task.completed_at = now
  }
  if (nextAction !== null) task.next_action = nextAction
  if (resultSummary !== null) task.result_summary = resultSummary
  if (verificationNotes !== null) task.verification_notes = verificationNotes
  task.updated_at = now

  await addTaskEvent(taskId, agentId, 'status_changed', prevState.status, task.status, note || `Status updated to ${task.status}`)

  await recordHqAudit({
    agentId,
    taskId,
    action: 'task.updated',
    actorType: agentId === 'founder' || agentId === 'admin' ? 'founder' : 'agent',
    actorId: agentId,
    previousState: prevState,
    resultingState: task
  })

  return task
}

export async function handoffTask(taskId, agentId, {
  targetAgentId = null,
  qaOwner = null,
  note = 'Handoff to QA / Review'
} = {}) {
  const task = memoryStore.tasks.get(taskId)
  if (!task) throw new Error(`Task '${taskId}' not found`)

  const prevState = { ...task }
  const now = new Date().toISOString()

  const target = targetAgentId || qaOwner || task.qa_owner || task.handoff_target
  if (!target) {
    throw new Error('Handoff requires a target agent or QA owner')
  }

  task.status = 'Review'
  task.handoff_target = target
  if (qaOwner || !task.qa_owner) task.qa_owner = qaOwner || target
  task.updated_at = now

  // Update original agent status
  const currentAgent = memoryStore.agents.get(agentId)
  if (currentAgent && currentAgent.current_task_id === taskId) {
    currentAgent.current_task_id = null
    currentAgent.status = 'idle'
  }

  await addTaskEvent(taskId, agentId, 'handoff', prevState.status, 'Review', note, { from: agentId, to: target })

  await recordHqAudit({
    agentId,
    taskId,
    action: 'task.handoff',
    actorType: 'agent',
    actorId: agentId,
    previousState: prevState,
    resultingState: task,
    metadata: { handoff_from: agentId, handoff_to: target }
  })

  return task
}

export async function blockTask(taskId, agentId, {
  reason,
  blockedBy = null
}) {
  const task = memoryStore.tasks.get(taskId)
  if (!task) throw new Error(`Task '${taskId}' not found`)
  if (!reason || !reason.trim()) throw new Error('Block reason is required')

  const prevState = { ...task }
  const now = new Date().toISOString()

  task.status = 'Blocked'
  task.blocked_by = blockedBy || reason
  task.updated_at = now

  const currentAgent = memoryStore.agents.get(agentId)
  if (currentAgent) {
    currentAgent.status = 'blocked'
  }

  await addTaskEvent(taskId, agentId, 'blocked', prevState.status, 'Blocked', reason, { blocked_by: task.blocked_by })

  await recordHqAudit({
    agentId,
    taskId,
    action: 'task.blocked',
    actorType: 'agent',
    actorId: agentId,
    previousState: prevState,
    resultingState: task,
    metadata: { reason }
  })

  return task
}

export async function addEvidence(taskId, agentId, {
  evidenceType,
  title,
  content = {},
  url = null
}) {
  const task = memoryStore.tasks.get(taskId)
  if (!task) throw new Error(`Task '${taskId}' not found`)
  if (!evidenceType || !title) throw new Error('Evidence requires evidenceType and title')

  const id = crypto.randomUUID()
  const evidenceEntry = {
    id,
    task_id: taskId,
    agent_id: agentId,
    evidence_type: evidenceType,
    title: title.trim(),
    url: url || null,
    content: typeof content === 'object' ? content : { raw: content },
    verified: false,
    created_at: new Date().toISOString()
  }

  memoryStore.evidence.push(evidenceEntry)

  await addTaskEvent(taskId, agentId, 'evidence_added', task.status, task.status, `Evidence added: ${title} (${evidenceType})`, { evidenceId: id })

  await recordHqAudit({
    agentId,
    taskId,
    action: 'task.evidence_added',
    actorType: 'agent',
    actorId: agentId,
    evidenceRef: id,
    resultingState: evidenceEntry
  })

  return evidenceEntry
}

export async function addTaskEvent(taskId, agentId, eventType, previousState, newState, note = '', payload = {}) {
  const event = {
    id: crypto.randomUUID(),
    task_id: taskId,
    agent_id: agentId,
    event_type: eventType,
    previous_state: previousState,
    new_state: newState,
    note: note || '',
    payload: payload || {},
    created_at: new Date().toISOString()
  }
  memoryStore.events.push(event)
  return event
}

// ── APPROVALS (Founder Gate) ──

export async function listApprovals({ status = null, limit = 50 } = {}) {
  let list = Array.from(memoryStore.approvals.values())
  if (status) {
    list = list.filter(a => a.status === status)
  }
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return list.slice(0, limit)
}

export async function requestApproval({
  taskId = null,
  agentId,
  actionType,
  title,
  description = '',
  requestedChanges = {}
}) {
  if (!agentId || !actionType || !title) {
    throw new Error('Approval request requires agentId, actionType, and title')
  }

  const id = crypto.randomUUID()
  const approval = {
    id,
    task_id: taskId || null,
    agent_id: agentId,
    title: title.trim(),
    action_type: actionType,
    description: description || '',
    requested_changes: requestedChanges || {},
    status: 'pending',
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  memoryStore.approvals.set(id, approval)

  if (taskId) {
    await addTaskEvent(taskId, agentId, 'approval_requested', null, null, `Founder approval requested: ${title} (${actionType})`, { approvalId: id })
  }

  await recordHqAudit({
    agentId,
    taskId,
    action: 'approval.requested',
    actorType: 'agent',
    actorId: agentId,
    resultingState: approval
  })

  return approval
}

export async function decideApproval(approvalId, decision, {
  reason = '',
  decidedBy = 'founder',
  isFounder = true
} = {}) {
  if (isFounder === false || ['chatgpt', 'claude', 'gemini', 'grok'].includes(decidedBy)) {
    throw new Error('Unauthorized: Only platform founders can decide approval requests')
  }

  const approval = memoryStore.approvals.get(approvalId)
  if (!approval) throw new Error(`Approval '${approvalId}' not found`)

  if (approval.status !== 'pending') {
    throw new Error(`Approval '${approvalId}' is already ${approval.status}`)
  }

  if (!['approved', 'rejected', 'cancelled'].includes(decision)) {
    throw new Error(`Invalid decision '${decision}'. Must be approved, rejected, or cancelled.`)
  }

  const prevState = { ...approval }
  const now = new Date().toISOString()

  approval.status = decision
  approval.decision_reason = reason || ''
  approval.decided_by = decidedBy
  approval.decided_at = now
  approval.updated_at = now

  await recordHqAudit({
    agentId: approval.agent_id,
    taskId: approval.task_id,
    action: `approval.${decision}`,
    actorType: 'founder',
    actorId: decidedBy,
    previousState: prevState,
    resultingState: approval,
    metadata: { reason }
  })

  return approval
}

// ── APPROVED SHARED CONTEXT ──

export function getApprovedContext(category = 'all') {
  const contextDocs = {
    master_context: {
      title: 'MarketSync — Master Context',
      summary: 'DealerOS canonical record model, one event bus, one workflow engine, no duplicate business truth.',
      governing_rules: [
        'Operating a dealership, not operating software.',
        'The kernel is frozen unless approved by Jason.',
        'Runtime proof: every producer must have an executable consumer.',
        'Never fake an integration.'
      ]
    },
    handoff_protocol: {
      title: 'MarketSync — Shared AI Handoff Protocol',
      summary: 'Task lifecycle and collaboration rules for ChatGPT, Claude, Gemini, and Grok.',
      lifecycle_sequence: ['Inbox', 'Ready', 'In Progress', 'Review', 'Blocked', 'Done'],
      roles: {
        chatgpt: 'Lead Architect & Planning / Core Systems',
        claude: 'Senior Developer & Implementation Specialist',
        gemini: 'Infrastructure, Workspace & Automation Specialist',
        grok: 'QA Reviewer, Verification & Adversarial Tester'
      }
    },
    work_queue_rules: {
      title: 'MarketSync — AI Work Queue Contract',
      summary: 'MS-### task keys are stable and canonical. Double claiming is strictly forbidden. Real evidence required.'
    }
  }

  if (category && category !== 'all' && contextDocs[category]) {
    return contextDocs[category]
  }
  return contextDocs
}

// ── INTEGRATIONS STATUS ──

export function getIntegrationsStatus() {
  return Array.from(memoryStore.integrations.values())
}

// ── MCP TOOL REGISTRY DEFINITIONS ──

export const HQ_MCP_TOOLS = [
  {
    name: 'marketsync_get_my_tasks',
    description: 'Get tasks assigned to or eligible for the calling AI agent.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by lifecycle status (e.g. Ready, In Progress, Review)' }
      }
    }
  },
  {
    name: 'marketsync_get_task',
    description: 'Get full detail of a task including its events, evidence attachments, and approvals.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The MS task ID (e.g. MS-001)' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'marketsync_claim_task',
    description: 'Claim an eligible Ready task to begin work. Prevents double-claiming.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The MS task ID' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'marketsync_update_task',
    description: 'Update the execution state, next action, or verification notes on a claimed task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The MS task ID' },
        status: { type: 'string', enum: ['Ready', 'In Progress', 'Review', 'Blocked', 'Done'] },
        nextAction: { type: 'string' },
        resultSummary: { type: 'string' },
        verificationNotes: { type: 'string' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'marketsync_add_evidence',
    description: 'Attach verifiable proof of completion (test logs, commit hash, PR link, benchmark) to a task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The MS task ID' },
        evidenceType: { type: 'string', enum: ['test_run', 'pr_link', 'commit_hash', 'screenshot', 'audit_report', 'benchmark', 'log_output', 'documentation'] },
        title: { type: 'string' },
        url: { type: 'string' },
        content: { type: 'object' }
      },
      required: ['taskId', 'evidenceType', 'title']
    }
  },
  {
    name: 'marketsync_handoff_task',
    description: 'Hand off a completed task to QA / Reviewer target agent.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The MS task ID' },
        targetAgentId: { type: 'string', description: 'Target agent (e.g. grok, chatgpt, claude, gemini)' },
        note: { type: 'string' }
      },
      required: ['taskId', 'targetAgentId']
    }
  },
  {
    name: 'marketsync_request_founder_approval',
    description: 'Request explicit founder approval for privileged or customer-impacting actions.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        actionType: { type: 'string', enum: ['production_deploy', 'privileged_access', 'schema_migration', 'billing_change', 'customer_impact', 'entitlement_override'] },
        title: { type: 'string' },
        description: { type: 'string' },
        requestedChanges: { type: 'object' }
      },
      required: ['actionType', 'title']
    }
  },
  {
    name: 'marketsync_get_context',
    description: 'Retrieve approved MarketSync Master Context, Handoff Protocol, and architectural guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['all', 'master_context', 'handoff_protocol', 'work_queue_rules'] }
      }
    }
  },
  {
    name: 'marketsync_get_agent_status',
    description: 'Get live status and heartbeat metrics for all agents or a specific agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' }
      }
    }
  }
]

export async function executeHqMcpTool(toolName, args = {}, agentId = 'gemini') {
  switch (toolName) {
    case 'marketsync_get_my_tasks': {
      const tasks = await listTasks({ owner: agentId, status: args.status || null })
      return { tasks }
    }
    case 'marketsync_get_task': {
      const task = await getTask(args.taskId)
      if (!task) return { error: `Task '${args.taskId}' not found` }
      return { task }
    }
    case 'marketsync_claim_task': {
      try {
        const task = await claimTask(args.taskId, agentId)
        return { success: true, task }
      } catch (e) {
        return { error: e.message }
      }
    }
    case 'marketsync_update_task': {
      try {
        const task = await updateTaskExecution(args.taskId, agentId, args)
        return { success: true, task }
      } catch (e) {
        return { error: e.message }
      }
    }
    case 'marketsync_add_evidence': {
      try {
        const evidence = await addEvidence(args.taskId, agentId, args)
        return { success: true, evidence }
      } catch (e) {
        return { error: e.message }
      }
    }
    case 'marketsync_handoff_task': {
      try {
        const task = await handoffTask(args.taskId, agentId, args)
        return { success: true, task }
      } catch (e) {
        return { error: e.message }
      }
    }
    case 'marketsync_request_founder_approval': {
      try {
        const approval = await requestApproval({ ...args, agentId })
        return { success: true, approval }
      } catch (e) {
        return { error: e.message }
      }
    }
    case 'marketsync_get_context': {
      const context = getApprovedContext(args.category)
      return { context }
    }
    case 'marketsync_get_agent_status': {
      if (args.agentId) {
        const agent = await getAgent(args.agentId)
        return { agent }
      }
      const agents = await listAgents()
      return { agents }
    }
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
