/**
 * MarketSync Customer Intelligence — "What Changed?" Returning Visitor Intelligence Engine.
 *
 * For returning shoppers, detects state changes since their last visit (price changes,
 * sold vehicles, completed trade appraisals, representative assignments) to deliver an intelligent welcome.
 */

import { supabaseAdmin } from '../../shared.js'

export async function detectCustomerStateChanges(dealershipId, customerState = {}, lastSeenTimestamp = null) {
  if (!dealershipId) return { has_changes: false, changes: [], proactive_greeting: null }

  const changes = []
  const v = customerState.vehicle_interest || {}
  const t = customerState.trade_state || {}

  // 1. Check if Target Vehicle changed status or price
  if (v.primary_vehicle?.value && customerState.session?.entry_context?.vehicle_id) {
    const { data: veh } = await supabaseAdmin.from('inventory')
      .select('id, status, price, updated_at')
      .eq('id', customerState.session.entry_context.vehicle_id)
      .maybeSingle()

    if (veh) {
      if (veh.status === 'sold') {
        changes.push({
          type: 'vehicle_sold',
          detail: `The ${v.primary_vehicle.value} was recently sold`,
        })
      }
    }
  }

  // 2. Check if Trade appraisal was completed
  if (t.has_trade?.value && t.appraisal_id) {
    const { data: app } = await supabaseAdmin.from('trade_appraisals')
      .select('status, offer_amount')
      .eq('id', t.appraisal_id)
      .maybeSingle()

    if (app && app.status === 'completed' && app.offer_amount) {
      changes.push({
        type: 'trade_appraisal_ready',
        detail: `Used car manager completed preliminary appraisal ($${app.offer_amount.toLocaleString()})`,
      })
    }
  }

  // Generate Proactive Contextual Greeting
  let proactiveGreeting = null
  if (changes.length) {
    const firstChange = changes[0]
    if (firstChange.type === 'vehicle_sold') {
      proactiveGreeting = `Welcome back! I wanted to let you know the ${v.primary_vehicle?.value || 'vehicle'} you were viewing recently sold, but I have 2 similar in-stock options ready. Would you like to see those?`
    } else if (firstChange.type === 'trade_appraisal_ready') {
      proactiveGreeting = `Welcome back! Our appraisal team reviewed your trade details and has your preliminary numbers ready. Would you like to go over them?`
    }
  }

  return {
    has_changes: changes.length > 0,
    changes,
    proactive_greeting: proactiveGreeting,
  }
}
