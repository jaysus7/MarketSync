import test from 'node:test'
import assert from 'node:assert/strict'
import {
  listAgents,
  getAgent,
  createTask,
  getTask,
  claimTask,
  updateTaskExecution,
  addEvidence,
  handoffTask,
  blockTask,
  requestApproval,
  decideApproval,
  listApprovals,
  generateAgentKey,
  registerAgentCredential,
  verifyAgentApiKey,
  executeHqMcpTool,
  updateAgentHeartbeat
} from '../services/hq-agent-hub.js'

test('E2E Hub Verification: 1. Four Agents Connected and Ready in HQ', async () => {
  const agents = await listAgents()
  assert.equal(agents.length, 4, 'Exactly 4 agents registered')

  const expectedAgents = [
    { id: 'chatgpt', name: 'ChatGPT', role: 'lead_architect' },
    { id: 'claude', name: 'Claude', role: 'senior_developer' },
    { id: 'gemini', name: 'Gemini', role: 'infrastructure_specialist' },
    { id: 'grok', name: 'Grok', role: 'qa_reviewer' }
  ]

  for (const exp of expectedAgents) {
    const ag = await getAgent(exp.id)
    assert.ok(ag, `Agent ${exp.id} must exist`)
    assert.equal(ag.role, exp.role)
    assert.equal(ag.is_enabled, true)

    // Update heartbeat
    const updated = await updateAgentHeartbeat(exp.id, { status: 'idle' })
    assert.ok(updated.last_heartbeat)
  }
})

test('E2E Hub Verification: 2. Agent Connection & Scoped MCP Credentials', async () => {
  const agentConnections = ['chatgpt', 'claude', 'gemini', 'grok']

  for (const agentId of agentConnections) {
    const { apiKey, hash, prefix } = generateAgentKey(agentId, `${agentId}-connection-key`)
    registerAgentCredential({
      agentId,
      name: `${agentId}-connection-key`,
      apiKeyHash: hash,
      keyPrefix: prefix,
      scopes: ['tasks:claim', 'tasks:write', 'evidence:write', 'approvals:request']
    })

    const verified = await verifyAgentApiKey(apiKey)
    assert.ok(verified, `API key for ${agentId} must be verified`)
    assert.equal(verified.agentId, agentId)
  }
})

test('E2E Hub Verification: 3. Run Real Tasks Per Agent & Complete Lifecycle', async () => {
  // Task 1: Grok -> MS-001 (Phase 1 Kernel & Architecture)
  const t1 = await createTask({
    id: 'MS-001',
    title: 'Phase 1 Core Architecture Verification',
    priority: 'P0',
    owner: 'grok',
    acceptance_criteria: 'All baseline tests green and kernel contracts frozen.',
    status: 'Ready'
  })
  assert.equal(t1.id, 'MS-001')
  assert.equal(t1.status, 'Ready')

  // Grok claims MS-001
  await claimTask('MS-001', 'grok')
  let grokTask = await getTask('MS-001')
  assert.equal(grokTask.status, 'In Progress')
  assert.equal(grokTask.owner, 'grok')

  // Grok attaches evidence
  await addEvidence('MS-001', 'grok', {
    evidenceType: 'test_run',
    title: 'Kernel Architecture Audit Pass',
    content: { passed: 98, failed: 0 },
    url: 'https://github.com/jaysus7/MarketSync/actions'
  })

  // Grok marks Done
  await updateTaskExecution('MS-001', 'grok', {
    status: 'Done',
    resultSummary: 'Phase 1 architecture validated and frozen.'
  })
  grokTask = await getTask('MS-001')
  assert.equal(grokTask.status, 'Done')

  // Task 2: Claude -> MS-002 (Phase 2 Sales Workspace)
  await createTask({
    id: 'MS-002',
    title: 'Phase 2 Sales Workspace Inspection',
    priority: 'P1',
    owner: 'claude',
    status: 'Ready'
  })
  await claimTask('MS-002', 'claude')
  await addEvidence('MS-002', 'claude', {
    evidenceType: 'pr_link',
    title: 'Sales Workspace PR',
    url: 'https://github.com/jaysus7/MarketSync/pull/12'
  })
  await handoffTask('MS-002', 'claude', {
    targetAgentId: 'grok',
    note: 'Sales workspace complete, ready for Grok QA review.'
  })
  let claudeTask = await getTask('MS-002')
  assert.equal(claudeTask.status, 'Review')
  assert.equal(claudeTask.handoff_target, 'grok')

  // Grok approves QA for MS-002
  await updateTaskExecution('MS-002', 'grok', {
    status: 'Done',
    resultSummary: 'QA verified: Sales workspace routes and views render properly.'
  })
  claudeTask = await getTask('MS-002')
  assert.equal(claudeTask.status, 'Done')

  // Task 3: Gemini -> MS-005 (MarketSync SEO Engine)
  await createTask({
    id: 'MS-005',
    title: 'MarketSync SEO Engine Hub',
    priority: 'P1',
    owner: 'gemini',
    status: 'Ready',
    qa_owner: 'chatgpt'
  })
  await claimTask('MS-005', 'gemini')
  await addEvidence('MS-005', 'gemini', {
    evidenceType: 'audit_report',
    title: 'SEO Audit & Sitemap Generator Report',
    content: { sitemapRoutes: 14, schemaStructuredData: 'pass' }
  })
  await handoffTask('MS-005', 'gemini', {
    targetAgentId: 'chatgpt',
    note: 'SEO engine infrastructure ready for Architect review.'
  })
  let geminiTask = await getTask('MS-005')
  assert.equal(geminiTask.status, 'Review')
  assert.equal(geminiTask.handoff_target, 'chatgpt')

  // Task 4: ChatGPT -> QA/review task on MS-005
  await updateTaskExecution('MS-005', 'chatgpt', {
    status: 'Done',
    resultSummary: 'Architect QA Review passed. Clean integration with SEO routes.'
  })
  geminiTask = await getTask('MS-005')
  assert.equal(geminiTask.status, 'Done')
})

test('E2E Hub Verification: 4. Security Enforcement & Boundary Gates', async () => {
  // Setup task owned and in progress by Claude
  await createTask({
    id: 'MS-099',
    title: 'Secure Isolated Task',
    priority: 'P1',
    owner: 'claude',
    status: 'Ready'
  })
  await claimTask('MS-099', 'claude')

  // 1. Grok cannot claim Claude's in-progress task (Double-claim prevented)
  await assert.rejects(
    async () => {
      await claimTask('MS-099', 'grok')
    },
    /Double-claim prevented/
  )

  // 2. Claude cannot modify Gemini's task
  await createTask({
    id: 'MS-098',
    title: 'Gemini Infrastructure Task',
    priority: 'P1',
    owner: 'gemini',
    status: 'Ready'
  })
  await claimTask('MS-098', 'gemini')

  await assert.rejects(
    async () => {
      await updateTaskExecution('MS-098', 'claude', { status: 'Done' })
    },
    /Unauthorized/
  )

  // 3. Founder-gated action: Request approval and ensure agent cannot decide it
  const approval = await requestApproval({
    taskId: 'MS-098',
    agentId: 'gemini',
    actionType: 'schema_migration',
    title: 'Add table hq_test',
    description: 'Privileged migration request'
  })
  assert.equal(approval.status, 'pending')

  // Non-founder cannot decide approval
  await assert.rejects(
    async () => {
      await decideApproval(approval.id, 'approved', {
        decidedBy: 'claude',
        isFounder: false
      })
    },
    /Only platform founders/
  )

  // Founder decision succeeds
  const decided = await decideApproval(approval.id, 'approved', {
    decidedBy: 'founder@marketsync.link',
    isFounder: true
  })
  assert.equal(decided.status, 'approved')
})
