import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hashApiKey,
  generateAgentKey,
  registerAgentCredential,
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
  listApprovals,
  requestApproval,
  decideApproval,
  getApprovedContext,
  getIntegrationsStatus,
  HQ_MCP_TOOLS,
  executeHqMcpTool
} from '../services/hq-agent-hub.js'
import {
  normalizeSheetTaskRow,
  syncGoogleSheetWorkQueue
} from '../services/work-queue-sync.js'

test('MarketSync HQ Agent Hub — 1. Four required agent identities exist', async () => {
  const agents = await listAgents()
  assert.ok(agents.length >= 4, 'Must have at least 4 agents seeded')

  const agentIds = agents.map(a => a.id)
  assert.ok(agentIds.includes('chatgpt'), 'ChatGPT agent must exist')
  assert.ok(agentIds.includes('claude'), 'Claude agent must exist')
  assert.ok(agentIds.includes('gemini'), 'Gemini agent must exist')
  assert.ok(agentIds.includes('grok'), 'Grok agent must exist')

  const gemini = await getAgent('gemini')
  assert.equal(gemini.display_name, 'Gemini')
  assert.equal(gemini.role, 'workspace_specialist')
  assert.equal(gemini.is_enabled, true)
  assert.ok(gemini.permission_scope.includes('claim_tasks'))
})

test('MarketSync HQ Agent Hub — 2. Agent authentication and scoped credential verification', async () => {
  // Generate a key for Gemini
  const { apiKey, hash, prefix } = generateAgentKey('gemini', 'Gemini Test Key')
  assert.ok(apiKey.startsWith('ms_agent_gemini_'))
  assert.equal(hashApiKey(apiKey), hash)

  // Register the credential
  registerAgentCredential({
    agentId: 'gemini',
    name: 'Gemini Test Key',
    apiKeyHash: hash,
    keyPrefix: prefix,
    scopes: ['tasks:claim', 'tasks:write', 'evidence:write', 'approvals:request']
  })

  // Verify valid key
  const verified = await verifyAgentApiKey(apiKey)
  assert.ok(verified, 'Key should be verified successfully')
  assert.equal(verified.agentId, 'gemini')
  assert.ok(verified.scopes.includes('tasks:claim'))

  // Verify invalid key returns null
  const invalid = await verifyAgentApiKey('ms_agent_gemini_fake_key_12345')
  assert.equal(invalid, null, 'Invalid key must return null')
})

test('MarketSync HQ Agent Hub — 3. Task Creation, Assignment, and Retrieval', async () => {
  const taskData = {
    id: 'MS-101',
    title: 'Build Agent Hub Infrastructure',
    description: 'Implement backend API and MCP layer for HQ Agent Hub',
    priority: 'P0',
    owner: 'gemini',
    acceptance_criteria: 'All routes operational, double-claim prevented, tests green.',
    next_action: 'Claim task and begin implementation',
    qa_owner: 'grok',
    status: 'Ready'
  }

  const created = await createTask(taskData, 'founder')
  assert.equal(created.id, 'MS-101')
  assert.equal(created.status, 'Ready')
  assert.equal(created.owner, 'gemini')
  assert.equal(created.priority, 'P0')

  const fetched = await getTask('MS-101')
  assert.ok(fetched)
  assert.equal(fetched.title, taskData.title)
  assert.ok(fetched.events.length >= 1)
  assert.equal(fetched.events[0].event_type, 'created')
})

test('MarketSync HQ Agent Hub — 4. Task Claiming and Double-Claim Prevention', async () => {
  const taskData = {
    id: 'MS-102',
    title: 'Integrate SEO Engine',
    priority: 'P1',
    status: 'Ready',
    owner: 'claude'
  }
  await createTask(taskData, 'founder')

  // Claude claims the task
  const claimed = await claimTask('MS-102', 'claude', { sessionContext: 'claude-session-1' })
  assert.equal(claimed.status, 'In Progress')
  assert.equal(claimed.owner, 'claude')
  assert.ok(claimed.claimed_at)

  // Verify agent state updated
  const claude = await getAgent('claude')
  assert.equal(claude.status, 'working')
  assert.equal(claude.current_task_id, 'MS-102')

  // Attempt double-claim by Gemini must throw/fail
  await assert.rejects(
    async () => {
      await claimTask('MS-102', 'gemini')
    },
    /Double-claim prevented/,
    'Double-claim by another agent must be rejected'
  )
})

test('MarketSync HQ Agent Hub — 5. Task State Transitions, Evidence Attachment, and QA Handoff', async () => {
  const taskData = {
    id: 'MS-103',
    title: 'Customer Intelligence Multi-modal Router',
    priority: 'P1',
    status: 'Ready',
    owner: 'gemini',
    qa_owner: 'grok'
  }
  await createTask(taskData, 'founder')
  await claimTask('MS-103', 'gemini')

  // 1. Attach Evidence
  const evidence = await addEvidence('MS-103', 'gemini', {
    evidenceType: 'test_run',
    title: 'HQ Agent Hub Test Suite Results',
    content: { passed: 12, failed: 0, duration_ms: 120 },
    url: 'https://github.com/jaysus7/MarketSync/actions/runs/123'
  })
  assert.equal(evidence.task_id, 'MS-103')
  assert.equal(evidence.agent_id, 'gemini')
  assert.equal(evidence.evidence_type, 'test_run')

  // 2. Hand off to QA (Grok)
  const handedOff = await handoffTask('MS-103', 'gemini', {
    targetAgentId: 'grok',
    note: 'Implementation complete with green test baseline. Ready for QA review.'
  })
  assert.equal(handedOff.status, 'Review')
  assert.equal(handedOff.handoff_target, 'grok')

  // 3. QA Reviewer (Grok) completes review
  const completed = await updateTaskExecution('MS-103', 'grok', {
    status: 'Done',
    resultSummary: 'QA verified: API contract holds, double-claim protection confirmed.',
    verificationNotes: 'Automated test suite passed.'
  })
  assert.equal(completed.status, 'Done')
  assert.ok(completed.completed_at)

  // Verify task full detail
  const fullTask = await getTask('MS-103')
  assert.equal(fullTask.status, 'Done')
  assert.equal(fullTask.evidence.length, 1)
  assert.ok(fullTask.events.some(e => e.event_type === 'evidence_added'))
  assert.ok(fullTask.events.some(e => e.event_type === 'handoff'))
})

test('MarketSync HQ Agent Hub — 6. Task Blocking with reason', async () => {
  const taskData = {
    id: 'MS-104',
    title: 'Production Migration Probe',
    priority: 'P2',
    status: 'Ready',
    owner: 'chatgpt'
  }
  await createTask(taskData, 'founder')
  await claimTask('MS-104', 'chatgpt')

  const blocked = await blockTask('MS-104', 'chatgpt', {
    reason: 'Waiting for production Supabase credentials approval',
    blockedBy: 'founder'
  })
  assert.equal(blocked.status, 'Blocked')
  assert.equal(blocked.blocked_by, 'founder')

  const agent = await getAgent('chatgpt')
  assert.equal(agent.status, 'blocked')
})

test('MarketSync HQ Agent Hub — 7. Founder Approval Gate Workflow', async () => {
  // Agent requests founder approval for schema migration
  const approval = await requestApproval({
    taskId: 'MS-104',
    agentId: 'chatgpt',
    actionType: 'schema_migration',
    title: 'Apply 2026-08-27-hq-agent-hub-phase1.sql',
    description: 'Creates new tables for HQ Agent Hub control plane',
    requestedChanges: { migration: '2026-08-27-hq-agent-hub-phase1.sql' }
  })
  assert.ok(approval.id)
  assert.equal(approval.status, 'pending')
  assert.equal(approval.action_type, 'schema_migration')

  const list = await listApprovals({ status: 'pending' })
  assert.ok(list.some(a => a.id === approval.id))

  // Founder approves
  const decided = await decideApproval(approval.id, 'approved', {
    reason: 'Verified safe and idempotent migration',
    decidedBy: 'founder@marketsync.link'
  })
  assert.equal(decided.status, 'approved')
  assert.equal(decided.decided_by, 'founder@marketsync.link')
})

test('MarketSync HQ Agent Hub — 8. Google Sheets Work Queue Idempotent Sync', async () => {
  const sheetRows = [
    {
      'Task ID': 'MS-001',
      'Objective / Title': 'Phase 1 Core Architecture',
      'Priority': 'P0',
      'Owner': 'chatgpt',
      'Status': 'Done',
      'Acceptance Criteria': 'Kernel contract frozen',
      'Next Action': 'Phase 2'
    },
    {
      'Task ID': 'MS-002',
      'Objective / Title': 'Phase 2 Sales Workspace',
      'Priority': 'P1',
      'Owner': 'claude',
      'Status': 'Done',
      'Acceptance Criteria': 'Sales my day live',
      'Next Action': 'Phase 3'
    },
    {
      'Task ID': 'MS-005',
      'Objective / Title': 'MarketSync SEO Engine',
      'Priority': 'P1',
      'Owner': 'gemini',
      'Status': 'Ready',
      'Acceptance Criteria': 'SEO pulse live and entitled',
      'Next Action': 'Deploy SEO suite'
    }
  ]

  // First sync
  const firstSync = await syncGoogleSheetWorkQueue(sheetRows, 'test-sync')
  assert.equal(firstSync.success, true)
  assert.equal(firstSync.importedCount, 3)

  // Verify tasks exist
  const ms005 = await getTask('MS-005')
  assert.ok(ms005)
  assert.equal(ms005.status, 'Ready')
  assert.equal(ms005.owner, 'gemini')

  // Second sync with identical data: Must be idempotent (0 new imports, 3 skipped/updated)
  const secondSync = await syncGoogleSheetWorkQueue(sheetRows, 'test-sync')
  assert.equal(secondSync.success, true)
  assert.equal(secondSync.importedCount, 0, 'No duplicate tasks should be created on repeated sync')
})

test('MarketSync HQ Agent Hub — 9. MCP Tool Registry & Execution Protocol', async () => {
  assert.ok(HQ_MCP_TOOLS.length >= 8, 'Must expose all required MCP tools')
  const toolNames = HQ_MCP_TOOLS.map(t => t.name)
  assert.ok(toolNames.includes('marketsync_get_my_tasks'))
  assert.ok(toolNames.includes('marketsync_get_task'))
  assert.ok(toolNames.includes('marketsync_claim_task'))
  assert.ok(toolNames.includes('marketsync_update_task'))
  assert.ok(toolNames.includes('marketsync_add_evidence'))
  assert.ok(toolNames.includes('marketsync_handoff_task'))
  assert.ok(toolNames.includes('marketsync_request_founder_approval'))
  assert.ok(toolNames.includes('marketsync_get_context'))
  assert.ok(toolNames.includes('marketsync_get_agent_status'))

  // Test Tool Call: marketsync_get_context
  const contextResult = await executeHqMcpTool('marketsync_get_context', { category: 'all' }, 'gemini')
  assert.ok(contextResult.context)
  assert.ok(contextResult.context.master_context)

  // Test Tool Call: marketsync_get_agent_status
  const statusResult = await executeHqMcpTool('marketsync_get_agent_status', {}, 'gemini')
  assert.ok(statusResult.agents)
  assert.ok(statusResult.agents.length >= 4)

  // Test Tool Call: marketsync_claim_task via MCP
  const mcpTask = await createTask({
    id: 'MS-105',
    title: 'MCP Autonomous Test Task',
    priority: 'P2',
    status: 'Ready',
    owner: 'gemini'
  })
  const claimResult = await executeHqMcpTool('marketsync_claim_task', { taskId: 'MS-105' }, 'gemini')
  assert.equal(claimResult.success, true)
  assert.equal(claimResult.task.status, 'In Progress')
})
