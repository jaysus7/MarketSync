/**
 * Exception scanner — Stage 6 of the Workflow Engine.
 *
 * Time-based problems can't be caught by an event (nothing happens when a car SITS
 * in recon, or a sold deal is never delivered, or a task quietly goes overdue). This
 * scanner sweeps the SSOT tables on a schedule and raises exceptions that surface on
 * the Operations dashboard. raiseException is idempotent (unique partial index on
 * open exceptions), so re-scanning never duplicates an existing open problem.
 *
 * Thresholds are env-tunable; the defaults are conservative dealership norms.
 */
import { supabaseAdmin } from '../shared.js'
import { raiseException } from './workflow.js'

const HRS = (n) => new Date(Date.now() - n * 3600 * 1000).toISOString()
const RECON_STALL_HRS = Number(process.env.EXC_RECON_STALL_HOURS || 72)   // a unit stuck 3 days in one recon stage
const SOLD_UNDELIVERED_HRS = Number(process.env.EXC_SOLD_UNDELIVERED_HOURS || 168)  // sold but not delivered after 7 days

// A car sitting in the same non-frontline recon stage past the threshold.
async function scanReconStalled() {
  const { data } = await supabaseAdmin.from('recon')
    .select('dealership_id, inventory_id, stage, stage_since')
    .neq('stage', 'frontline').lt('stage_since', HRS(RECON_STALL_HRS)).limit(1000)
  for (const r of data || []) {
    const dept = r.stage === 'detail' ? 'Cleanup' : r.stage === 'photos' ? 'Marketing' : 'Service'
    await raiseException(r.dealership_id, {
      kind: 'recon_stalled', entityType: 'vehicle', entityId: r.inventory_id, department: dept,
      severity: 'medium', description: `Stuck in "${r.stage}" for over ${RECON_STALL_HRS}h`,
    })
  }
}

// A deal marked sold but never delivered, past the threshold.
async function scanSoldNotDelivered() {
  const { data } = await supabaseAdmin.from('deals')
    .select('id, dealership_id, sold_at')
    .eq('deal_status', 'sold').not('sold_at', 'is', null).lt('sold_at', HRS(SOLD_UNDELIVERED_HRS)).limit(1000)
  for (const d of data || []) {
    await raiseException(d.dealership_id, {
      kind: 'sold_not_delivered', entityType: 'deal', entityId: d.id, department: 'Sales',
      severity: 'high', description: `Sold but not delivered after ${Math.round(SOLD_UNDELIVERED_HRS / 24)} days`,
    })
  }
}

// An open task whose due date has passed.
async function scanTasksOverdue() {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabaseAdmin.from('dealer_tasks')
    .select('id, dealership_id, title, due_date, department, status')
    .neq('status', 'done').not('due_date', 'is', null).lt('due_date', today).limit(2000)
  for (const t of data || []) {
    await raiseException(t.dealership_id, {
      kind: 'task_overdue', entityType: 'task', entityId: t.id, department: t.department || null,
      severity: 'medium', description: `Overdue: ${t.title} (due ${t.due_date})`,
    })
  }
}

// Auto-resolve exceptions whose underlying problem is gone (e.g. car reached
// frontline, deal delivered, task completed) so the dashboard clears itself.
async function resolveStaleExceptions() {
  const now = new Date().toISOString()
  try {
    // recon_stalled → resolved once the vehicle is frontline
    const { data: recons } = await supabaseAdmin.from('recon').select('inventory_id').eq('stage', 'frontline').limit(2000)
    const frontline = (recons || []).map(r => r.inventory_id)
    if (frontline.length) await supabaseAdmin.from('exceptions').update({ status: 'resolved', resolved_at: now })
      .eq('kind', 'recon_stalled').eq('status', 'open').in('entity_id', frontline)
    // task_overdue → resolved once the task is done
    const { data: doneTasks } = await supabaseAdmin.from('dealer_tasks').select('id').eq('status', 'done').limit(4000)
    const done = (doneTasks || []).map(t => t.id)
    if (done.length) await supabaseAdmin.from('exceptions').update({ status: 'resolved', resolved_at: now })
      .eq('kind', 'task_overdue').eq('status', 'open').in('entity_id', done)
    // sold_not_delivered → resolved once delivered
    const { data: delivered } = await supabaseAdmin.from('deals').select('id').eq('deal_status', 'delivered').limit(2000)
    const dv = (delivered || []).map(d => d.id)
    if (dv.length) await supabaseAdmin.from('exceptions').update({ status: 'resolved', resolved_at: now })
      .eq('kind', 'sold_not_delivered').eq('status', 'open').in('entity_id', dv)
  } catch (e) { console.warn('[workflow-scan] resolveStale failed:', e.message) }
}

export async function scanExceptions(reason = 'interval') {
  try {
    await scanReconStalled()
    await scanSoldNotDelivered()
    await scanTasksOverdue()
    await resolveStaleExceptions()
    console.log(`[workflow-scan] exception sweep complete (${reason})`)
  } catch (e) { console.error('[workflow-scan] sweep failed:', e.message) }
}
