// Pure pay-period logic — NO IO, unit-testable. Given a period type and any anchor
// date, compute the [start, end] date bounds; and validate lifecycle transitions of a
// pay period. commissions.js does the DB work and calls these. All math is UTC and
// date-only (YYYY-MM-DD) so it never drifts by timezone.

const pad = (nn) => String(nn).padStart(2, '0')
const toISO = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const parse = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)) }
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)

export const PERIOD_TYPES = ['weekly', 'biweekly', 'semi_monthly', 'monthly', 'custom']
export const PERIOD_STATUSES = ['open', 'locked', 'paid']

// The [start, end] (inclusive) bounds for the period CONTAINING the anchor date.
// - weekly:      Monday..Sunday of the anchor's week
// - biweekly:    a 14-day window aligned to Mondays from a fixed epoch (2024-01-01 Mon)
// - semi_monthly: 1st..15th, or 16th..end-of-month
// - monthly:     1st..last day of month
// custom has no computable bounds — the caller supplies start/end explicitly.
export function periodBounds(type, anchorISO) {
  const a = parse(anchorISO)
  if (type === 'monthly') {
    const start = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1))
    const end = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0)) // day 0 of next month = last day
    return { start: toISO(start), end: toISO(end) }
  }
  if (type === 'semi_monthly') {
    const day = a.getUTCDate()
    if (day <= 15) {
      return { start: toISO(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1))), end: toISO(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 15))) }
    }
    return { start: toISO(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 16))), end: toISO(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0))) }
  }
  if (type === 'weekly' || type === 'biweekly') {
    // Monday-anchored. getUTCDay(): 0=Sun..6=Sat → shift so Monday=0.
    const dow = (a.getUTCDay() + 6) % 7
    const monday = addDays(a, -dow)
    if (type === 'weekly') return { start: toISO(monday), end: toISO(addDays(monday, 6)) }
    // biweekly: align to a fixed epoch Monday so windows are stable across the year.
    const epoch = Date.UTC(2024, 0, 1) // 2024-01-01 is a Monday
    const weeks = Math.floor((monday.getTime() - epoch) / (7 * 86400000))
    const blockStart = addDays(monday, (weeks % 2 === 0) ? 0 : -7)
    return { start: toISO(blockStart), end: toISO(addDays(blockStart, 13)) }
  }
  throw new Error(`Cannot auto-compute bounds for period type: ${type}`)
}

// A default human label for a period, e.g. "2026-08 (monthly)" or "Aug 4–17, 2026".
export function periodLabel(type, startISO, endISO) {
  if (type === 'monthly') return startISO.slice(0, 7)
  return `${startISO} → ${endISO}`
}

// Lifecycle: open ⇄ locked → paid (paid is terminal). You can unlock (locked→open)
// only before payout. Anything else is rejected.
const ALLOWED = { open: ['locked'], locked: ['open', 'paid'], paid: [] }
export function canTransition(from, to) {
  if (!PERIOD_STATUSES.includes(to)) return false
  return (ALLOWED[from] || []).includes(to)
}

// Lines may only be assigned to / removed from a period while it is OPEN.
export function isAssignable(status) { return status === 'open' }

// ── Review / approval gates (Group 4) ────────────────────────────────────────
// A locked period must be REVIEWED, then APPROVED, before it can be paid. These are
// gates layered on top of the status graph — the raw status stays open→locked→paid.
// A period is an object with { status, reviewed_at, approved_at }.
export function canReview(p) { return !!p && p.status === 'locked' && !p.reviewed_at }
export function canApprove(p) { return !!p && p.status === 'locked' && !!p.reviewed_at && !p.approved_at }
// Paying requires the status transition to be legal AND the period to be approved.
export function payReady(p) { return !!p && canTransition(p.status, 'paid') && !!p.approved_at }
