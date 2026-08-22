// Pure commission-exception detection — NO IO, unit-tested. Given a commission line and
// its deal, return the anomalies a manager should resolve before payroll. commissions.js
// runs this over the store's lines and upserts the results into commission_exceptions.
// No AI — these are deterministic rules.

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

export const EXCEPTION_TYPES = {
  no_plan: 'error',                 // line was written without a plan → amounts are unverified
  negative_total: 'error',          // a line should never pay a negative amount
  unwound_not_reversed: 'error',    // deal was unwound but the commission wasn't clawed back
  zero_commission: 'warning',       // deal has value but the line pays nothing
  missing_cost: 'warning',          // front gross couldn't use real cost (front may be understated)
  stale_pending: 'warning',         // delivered long ago but still pending (never funded)
}

// Deal statuses that mean the deal is dead/unwound and its commission should be reversed.
const UNWOUND = new Set(['working', 'dead', 'lost', 'unwound', 'cancelled', 'canceled'])

// Returns [{ type, severity, detail }] for one line + its deal. `nowMs` lets the caller
// pin "now" for the stale check (defaults to Date.now()). Clawed-back lines only surface
// structural issues, never payout ones (they're already reversed).
export function detectExceptions(line, deal, nowMs) {
  const out = []
  if (!line) return out
  const now = typeof nowMs === 'number' ? nowMs : Date.now()
  const status = line.status || 'pending'
  const total = num(line.total)
  const clawed = status === 'clawed_back'
  const push = (type, detail) => out.push({ type, severity: EXCEPTION_TYPES[type] || 'warning', detail })

  if (!line.plan_id) push('no_plan', 'Commission line has no plan attached.')
  if (total < 0) push('negative_total', `Line total is negative (${total}).`)

  // Deal was unwound but this line is still live → it must be clawed back.
  if (deal && UNWOUND.has(String(deal.deal_status || '').toLowerCase()) && !clawed) {
    push('unwound_not_reversed', `Deal is ${deal.deal_status} but the commission is still ${status}.`)
  }

  if (!clawed) {
    const price = deal ? num(deal.selling_price) : 0
    if (price > 0 && total === 0) push('zero_commission', 'Deal has a selling price but the commission is $0.')
    if (line.breakdown && line.breakdown.cost_known === false) push('missing_cost', 'Front gross was computed without a known vehicle cost.')
    // Delivered/sold > 45 days ago and still pending (never marked funded).
    const anchor = deal && (deal.delivered_at || deal.sold_at)
    if (status === 'pending' && anchor) {
      const ageDays = (now - Date.parse(anchor)) / 86400000
      if (ageDays > 45) push('stale_pending', `Pending for ${Math.round(ageDays)} days without funding.`)
    }
  }
  return out
}
