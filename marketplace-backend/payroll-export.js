// Provider-neutral payroll export — pure, unit-tested, no IO. Turns a pay period's
// commission lines into one summary row per rep, then serializes to CSV. The column set
// is deliberately generic (not ADP/Gusto/Paychex-specific) so any provider import can map
// from it. commissions.js does the DB read and streams the result of buildCsv().

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round((num(x)) * 100) / 100

// RFC-4180 CSV: quote a field when it contains a comma, quote, or newline; double inner quotes.
export function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(columns, rows) {
  const head = columns.map(c => csvCell(c.header)).join(',')
  const body = rows.map(r => columns.map(c => csvCell(r[c.key])).join(',')).join('\n')
  return body ? `${head}\n${body}\n` : `${head}\n`
}

// Generic payroll columns. `amount` is the payable total for the rep in this period.
export const PAYROLL_COLUMNS = [
  { key: 'pay_period', header: 'Pay Period' },
  { key: 'start_date', header: 'Start Date' },
  { key: 'end_date', header: 'End Date' },
  { key: 'employee_id', header: 'Employee ID' },
  { key: 'employee_name', header: 'Employee Name' },
  { key: 'employee_email', header: 'Employee Email' },
  { key: 'units', header: 'Units' },
  { key: 'front', header: 'Front Commission' },
  { key: 'back', header: 'F&I Commission' },
  { key: 'spiff', header: 'Spiffs' },
  { key: 'amount', header: 'Total Commission' },
]

// Aggregate the period's lines into one row per rep. Clawed-back lines are excluded from
// the payable total (they were reversed) but still reduce it if present as negatives is
// NOT assumed here — we simply skip them. `repsById` maps rep_id → { name, email }.
export function buildPayrollRows(period, lines, repsById = {}) {
  const byRep = new Map()
  for (const l of lines || []) {
    if (!l || l.status === 'clawed_back') continue
    const id = l.rep_id || 'unknown'
    const agg = byRep.get(id) || { units: 0, front: 0, back: 0, spiff: 0, amount: 0, deals: new Set() }
    agg.front = round2(agg.front + num(l.front_amount))
    agg.back = round2(agg.back + num(l.back_amount))
    agg.spiff = round2(agg.spiff + num(l.spiff_amount))
    agg.amount = round2(agg.amount + num(l.total))
    if (l.deal_id) agg.deals.add(l.deal_id)
    byRep.set(id, agg)
  }
  const rows = []
  for (const [id, a] of byRep) {
    const who = repsById[id] || {}
    rows.push({
      pay_period: period?.name || '',
      start_date: period?.start_date || '',
      end_date: period?.end_date || '',
      employee_id: id,
      employee_name: who.name || '',
      employee_email: who.email || '',
      units: a.deals.size,
      front: a.front, back: a.back, spiff: a.spiff, amount: a.amount,
    })
  }
  // Stable order: highest total first, then name.
  rows.sort((x, y) => y.amount - x.amount || String(x.employee_name).localeCompare(String(y.employee_name)))
  return rows
}

// One-shot: period + lines + reps → CSV string.
export function buildCsv(period, lines, repsById) {
  return toCsv(PAYROLL_COLUMNS, buildPayrollRows(period, lines, repsById))
}
