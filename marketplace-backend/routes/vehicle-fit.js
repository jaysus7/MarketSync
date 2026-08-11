/** Phase 8.4 — read-only composition: existing credit/prequal → affordability → live inventory. */
import { supabaseAdmin } from '../shared.js'
import { requireAuth, requireMfa } from '../middleware.js'
import { requirePermission } from '../authorization.js'

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : null
const monthlyPayment = (principal, annualRate, months) => {
  if (!(principal >= 0) || !(months > 0) || annualRate == null) return null
  const r = annualRate / 1200
  return Math.round((r ? principal * r / (1 - (1 + r) ** -months) : principal / months) * 100) / 100
}

export function buildAffordability(application, decision, inputs = {}) {
  const financing = application?.financing || {}
  const applicant = application?.applicant || {}
  const employment = applicant.employment || {}
  const address = applicant.address || {}
  const downPayment = n(inputs.down_payment) ?? n(financing.down_payment) ?? 0
  const tradeEquity = Math.max(0, (n(inputs.trade_value) ?? n(financing.trade_value) ?? 0) - (n(inputs.trade_payoff) ?? n(financing.trade_payoff) ?? 0))
  const desiredPayment = n(inputs.desired_payment) ?? n(financing.payment)
  const approvedAmount = decision?.decision === 'approved' || decision?.decision === 'conditional' ? n(decision.approved_amount) : null
  const apr = n(decision?.rate) ?? n(financing.apr) ?? n(inputs.apr)
  const term = n(decision?.term_months) ?? n(financing.term) ?? n(inputs.term_months)
  const maxByPayment = desiredPayment != null && apr != null && term
    ? Math.round((apr ? desiredPayment * (1 - (1 + apr / 1200) ** -term) / (apr / 1200) : desiredPayment * term) * 100) / 100
    : null
  const financeCap = approvedAmount != null && maxByPayment != null ? Math.min(approvedAmount, maxByPayment) : approvedAmount ?? maxByPayment
  return {
    gross_monthly_income: n(employment.income_monthly), housing_payment: n(address.payment),
    desired_payment: desiredPayment, down_payment: downPayment, trade_equity: tradeEquity,
    approved_amount: approvedAmount, apr, term_months: term,
    max_vehicle_price: financeCap == null ? null : Math.max(0, financeCap + downPayment + tradeEquity),
    source: decision ? 'selected_lender_decision' : application ? 'credit_application_inputs' : 'customer_inputs',
    assumptions_complete: apr != null && term != null,
  }
}

export function rankAvailableInventory(rows, affordability, preferences = {}) {
  const wantedBody = String(preferences.body_style || '').toLowerCase()
  const wantedFeatures = Array.isArray(preferences.features) ? preferences.features.map(x => String(x).toLowerCase()) : []
  const max = affordability.max_vehicle_price
  return (rows || []).filter(v => v.status === 'available' && !v.archived_at && v.awaiting_possession !== true)
    .filter(v => max == null || n(v.price) == null || n(v.price) <= max)
    .map(v => {
      const haystack = `${v.description || ''} ${JSON.stringify(v.specs_manual || {})} ${JSON.stringify(v.vin_data || {})}`.toLowerCase()
      const bodyMatch = !wantedBody || String(v.body_style || '').toLowerCase() === wantedBody
      const featureMatches = wantedFeatures.filter(f => haystack.includes(f))
      const budgetFit = max == null || n(v.price) == null ? 20 : Math.max(0, Math.min(50, Math.round(50 * (1 - n(v.price) / Math.max(max, 1)) + 25)))
      const score = Math.max(0, Math.min(100, budgetFit + (bodyMatch ? 30 : 0) + Math.min(20, featureMatches.length * 5)))
      const principal = Math.max(0, (n(v.price) ?? 0) - affordability.down_payment - affordability.trade_equity)
      return {
        inventory_id: v.id, photo: Array.isArray(v.image_urls) ? v.image_urls[0] || null : null,
        year: v.year, make: v.make, model: v.model, trim: v.trim, stock_number: v.stocknumber,
        price: n(v.price), estimated_payment: monthlyPayment(principal, affordability.apr, affordability.term_months),
        fit_score: score,
        reasons: [max != null ? 'Within the supported vehicle budget' : null, bodyMatch && wantedBody ? `Matches ${preferences.body_style}` : null,
          ...featureMatches.map(f => `Includes ${f}`)].filter(Boolean),
      }
    }).sort((a, b) => b.fit_score - a.fit_score || (a.price ?? Infinity) - (b.price ?? Infinity))
}

export function registerVehicleFit(app) {
  app.post('/customers/:id/vehicle-fit', requireAuth, requireMfa, requirePermission('fni.credit_application.view'), requirePermission('inventory.view'), async (req, res) => {
    const contactId = String(req.params.id)
    const { data: contact } = await supabaseAdmin.from('contacts').select('id').eq('id', contactId).eq('dealership_id', req.dealershipId).maybeSingle()
    if (!contact) return res.status(404).json({ error: 'Customer not found' })
    const { data: application } = await supabaseAdmin.from('credit_applications').select('*')
      .eq('dealership_id', req.dealershipId).eq('contact_id', contactId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    const { data: decision } = application?.deal_id ? await supabaseAdmin.from('deal_lender_decisions').select('*')
      .eq('dealership_id', req.dealershipId).eq('deal_id', application.deal_id).eq('selected', true).maybeSingle() : { data: null }
    const { data: inventory, error } = await supabaseAdmin.from('inventory').select('id, year, make, model, trim, stocknumber, price, body_style, image_urls, description, specs_manual, vin_data, status, archived_at, awaiting_possession')
      .eq('dealership_id', req.dealershipId).eq('status', 'available').is('archived_at', null).limit(500)
    if (error) return res.status(500).json({ error: error.message })
    const affordability = buildAffordability(application, decision, req.body || {})
    const matches = rankAvailableInventory(inventory, affordability, req.body || {}).slice(0, 20)
    const next_action = !application && affordability.max_vehicle_price == null ? 'Request Missing Information'
      : matches.length ? 'Send Vehicle Options' : 'Manager Review'
    res.json({ affordability, matches, next_action, inventory_as_of: new Date().toISOString() })
  })
}

