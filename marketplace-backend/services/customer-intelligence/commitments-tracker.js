/**
 * MarketSync Customer Intelligence — Commitments Tracker & Dealership Promise SLA Engine.
 *
 * Tracks customer commitments (sending trade photos, visiting on weekend) and dealership commitments
 * (walkaround video, manager callback, appraisal review) with deadline alerts and interaction trust scoring.
 */

export function createDealershipPromise(type, details = {}, deadlineMinutes = 60) {
  const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000).toISOString()
  return {
    id: `prm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type, // 'send_video' | 'manager_callback' | 'confirm_availability' | 'appraisal_review'
    description: details.description || type,
    responsible_role: details.responsible_role || 'sales_consultant',
    status: 'pending', // 'pending' | 'fulfilled' | 'overdue' | 'cancelled'
    created_at: new Date().toISOString(),
    deadline_at: deadline,
  }
}

/**
 * Checks for overdue dealership promises to alert managers.
 */
export function evaluatePromiseOverdueStatus(promises = []) {
  const now = Date.now()
  const overdue = []
  const pending = []

  for (const p of promises) {
    if (p.status === 'fulfilled' || p.status === 'cancelled') continue
    const isPast = new Date(p.deadline_at).getTime() < now
    if (isPast) {
      overdue.push({ ...p, status: 'overdue' })
    } else {
      pending.push(p)
    }
  }

  return {
    has_overdue: overdue.length > 0,
    overdue_promises: overdue,
    pending_promises: pending,
  }
}
