/**
 * Google Sheets Work Queue Sync & Migration Adapter
 * 
 * Provides idempotent migration and continuous synchronization between the
 * existing Google Sheets Work Queue and MarketSync HQ Task Ledger.
 */

import { createTask, getTask, updateTaskExecution, listTasks, recordHqAudit } from './hq-agent-hub.js'

/**
 * Standardizes a raw task row from Google Sheets into the canonical HQ Task format.
 */
export function normalizeSheetTaskRow(row) {
  if (!row) return null

  // Support both array rows [id, title, priority, owner, status, ...] and object rows
  let id = '', title = '', priority = 'P2', owner = null, status = 'Inbox',
      acceptance_criteria = '', next_action = '', qa_owner = null,
      handoff_target = null, blocked_by = null

  if (Array.isArray(row)) {
    id = String(row[0] || '').trim()
    title = String(row[1] || '').trim()
    priority = String(row[2] || 'P2').trim().toUpperCase()
    owner = String(row[3] || '').trim().toLowerCase() || null
    status = String(row[4] || 'Inbox').trim()
    acceptance_criteria = String(row[5] || '').trim()
    next_action = String(row[6] || '').trim()
    qa_owner = String(row[7] || '').trim().toLowerCase() || null
  } else if (typeof row === 'object') {
    id = String(row.id || row.taskId || row['Task ID'] || row['MS ID'] || '').trim()
    title = String(row.title || row.objective || row['Objective / Title'] || '').trim()
    priority = String(row.priority || row['Priority'] || 'P2').trim().toUpperCase()
    owner = String(row.owner || row['Owner'] || row['Agent'] || '').trim().toLowerCase() || null
    status = String(row.status || row['Status'] || 'Inbox').trim()
    acceptance_criteria = String(row.acceptance_criteria || row.criteria || row['Acceptance Criteria'] || '').trim()
    next_action = String(row.next_action || row['Next Action'] || '').trim()
    qa_owner = String(row.qa_owner || row['QA Owner'] || row['Reviewer'] || '').trim().toLowerCase() || null
    handoff_target = String(row.handoff_target || row['Handoff Target'] || '').trim().toLowerCase() || null
    blocked_by = String(row.blocked_by || row['Blocked By'] || '').trim() || null
  }

  // Ensure ID format (e.g. MS-001)
  if (!id) return null
  if (/^\d+$/.test(id)) id = `MS-${id.padStart(3, '0')}`
  id = id.toUpperCase()

  // Standardize status
  const statusMap = {
    'inbox': 'Inbox',
    'backlog': 'Inbox',
    'todo': 'Ready',
    'ready': 'Ready',
    'in progress': 'In Progress',
    'in_progress': 'In Progress',
    'doing': 'In Progress',
    'review': 'Review',
    'in review': 'Review',
    'qa': 'Review',
    'blocked': 'Blocked',
    'done': 'Done',
    'complete': 'Done',
    'completed': 'Done'
  }
  const normStatus = statusMap[status.toLowerCase()] || 'Inbox'

  // Standardize priority
  const normPriority = ['P0', 'P1', 'P2', 'P3'].includes(priority) ? priority : 'P2'

  // Standardize owner to recognized agents
  const knownAgents = ['chatgpt', 'claude', 'gemini', 'grok']
  const normOwner = knownAgents.includes(owner) ? owner : (owner ? owner : null)
  const normQaOwner = knownAgents.includes(qa_owner) ? qa_owner : (qa_owner ? qa_owner : null)

  return {
    id,
    title: title || `Task ${id}`,
    priority: normPriority,
    status: normStatus,
    owner: normOwner,
    acceptance_criteria,
    next_action,
    qa_owner: normQaOwner,
    handoff_target: handoff_target || null,
    blocked_by: blocked_by || null,
    source: 'google_sheets',
    external_sync_key: id
  }
}

/**
 * Syncs an array of Google Sheet rows into HQ Task Ledger idempotently.
 */
export async function syncGoogleSheetWorkQueue(rows = [], actor = 'google_sheets_sync') {
  if (!Array.isArray(rows)) {
    throw new Error('syncGoogleSheetWorkQueue expects an array of rows')
  }

  let importedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  const processedTasks = []

  for (const rawRow of rows) {
    const normalized = normalizeSheetTaskRow(rawRow)
    if (!normalized || !normalized.id) {
      skippedCount++
      continue
    }

    const existing = await getTask(normalized.id)
    if (!existing) {
      // 1. Create new task
      const newTask = await createTask(normalized, actor)
      importedCount++
      processedTasks.push(newTask)
    } else {
      // 2. Update existing task without clobbering existing evidence or history
      const hasChanges =
        existing.title !== normalized.title ||
        existing.status !== normalized.status ||
        existing.priority !== normalized.priority ||
        existing.owner !== normalized.owner ||
        existing.next_action !== normalized.next_action ||
        existing.acceptance_criteria !== normalized.acceptance_criteria

      if (hasChanges) {
        const updated = await updateTaskExecution(existing.id, 'founder', {
          status: normalized.status,
          nextAction: normalized.next_action,
          note: `Synced from Google Sheets Work Queue`
        })
        // Apply field sync
        existing.title = normalized.title
        existing.priority = normalized.priority
        existing.owner = normalized.owner
        existing.acceptance_criteria = normalized.acceptance_criteria
        existing.qa_owner = normalized.qa_owner
        existing.updated_at = new Date().toISOString()
        updatedCount++
        processedTasks.push(updated)
      } else {
        skippedCount++
        processedTasks.push(existing)
      }
    }
  }

  await recordHqAudit({
    action: 'work_queue.synced',
    actorType: 'system',
    actorId: actor,
    metadata: {
      totalRows: rows.length,
      importedCount,
      updatedCount,
      skippedCount
    }
  })

  return {
    success: true,
    totalProcessed: rows.length,
    importedCount,
    updatedCount,
    skippedCount,
    tasks: processedTasks
  }
}
