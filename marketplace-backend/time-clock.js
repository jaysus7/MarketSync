// Pure time-clock math — NO IO, unit-tested. Turns clock-in/out sessions into worked
// minutes/hours and rolls entries up into timesheets. time.js does the DB work and calls
// these. All arithmetic is on millisecond timestamps; break minutes are subtracted.

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const ms = (t) => { const d = Date.parse(t); return Number.isFinite(d) ? d : null }
export const round2 = (x) => Math.round(n(x) * 100) / 100

export const TIME_STATUSES = ['active', 'completed', 'approved']

// Worked minutes for one session: (clock_out || now) − clock_in − breaks, floored at 0.
// An active session (no clock_out) accrues against `nowMs`.
export function sessionMinutes(entry, nowMs) {
  if (!entry || !entry.clock_in) return 0
  const start = ms(entry.clock_in); if (start == null) return 0
  const end = entry.clock_out ? ms(entry.clock_out) : (typeof nowMs === 'number' ? nowMs : Date.now())
  if (end == null || end <= start) return 0
  const gross = (end - start) / 60000
  const net = gross - n(entry.break_minutes)
  return net > 0 ? Math.round(net) : 0
}
export function sessionHours(entry, nowMs) { return round2(sessionMinutes(entry, nowMs) / 60) }

// Round minutes to the nearest increment (e.g. 15). incr ≤ 0 → unchanged. Payroll shops
// often round to the quarter-hour; the caller decides whether to apply it.
export function roundMinutes(minutes, incr) {
  const i = n(incr); if (i <= 0) return Math.round(n(minutes))
  return Math.round(n(minutes) / i) * i
}

// Do two sessions overlap in time? Used to reject a correction that would double-count.
export function overlaps(a, b, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now()
  const aS = ms(a.clock_in), aE = a.clock_out ? ms(a.clock_out) : now
  const bS = ms(b.clock_in), bE = b.clock_out ? ms(b.clock_out) : now
  if (aS == null || bS == null) return false
  return aS < bE && bS < aE
}

// The (single) currently-open session in a list, if any.
export function findOpenSession(entries) {
  return (entries || []).find(e => e.status === 'active' || !e.clock_out) || null
}

// Roll a set of entries into totals, plus per-employee and per-day (YYYY-MM-DD, UTC)
// breakdowns. `roundIncr` optionally rounds each session before summing.
export function summarize(entries, { nowMs, roundIncr = 0 } = {}) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now()
  let totalMin = 0
  const byEmployee = {}, byDay = {}
  for (const e of entries || []) {
    const mins = roundMinutes(sessionMinutes(e, now), roundIncr)
    totalMin += mins
    const emp = e.employee_id || 'unknown'
    byEmployee[emp] = (byEmployee[emp] || 0) + mins
    const day = String(e.clock_in || '').slice(0, 10)
    if (day) byDay[day] = (byDay[day] || 0) + mins
  }
  const toH = (m) => round2(m / 60)
  return {
    total_minutes: totalMin,
    total_hours: toH(totalMin),
    by_employee: Object.fromEntries(Object.entries(byEmployee).map(([k, v]) => [k, { minutes: v, hours: toH(v) }])),
    by_day: Object.fromEntries(Object.entries(byDay).map(([k, v]) => [k, { minutes: v, hours: toH(v) }])),
  }
}
