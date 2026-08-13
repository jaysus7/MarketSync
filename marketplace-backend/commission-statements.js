// Pure statement aggregation — NO IO, unit-tested. A statement is a rep's commission
// lines for a period; this rolls them into headline totals for display / CSV / print.
// commissions.js does the DB reads and calls this. No AI.

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const round2 = (x) => Math.round(num(x) * 100) / 100

// Totals for a set of commission lines. Payable = everything not clawed back.
export function statementTotals(lines) {
  const t = { units: 0, front: 0, back: 0, spiff: 0, payable: 0, clawed_back: 0, by_status: {} }
  const deals = new Set()
  for (const l of lines || []) {
    const status = l.status || 'pending'
    t.by_status[status] = round2((t.by_status[status] || 0) + num(l.total))
    if (status === 'clawed_back') { t.clawed_back = round2(t.clawed_back + num(l.total)); continue }
    if (l.deal_id) deals.add(l.deal_id)
    t.front = round2(t.front + num(l.front_amount))
    t.back = round2(t.back + num(l.back_amount))
    t.spiff = round2(t.spiff + num(l.spiff_amount))
    t.payable = round2(t.payable + num(l.total))
  }
  t.units = deals.size
  return t
}
