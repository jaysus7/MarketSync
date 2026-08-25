/**
 * MarketSync Customer Intelligence — Durable Memory & Cross-Channel Continuity Engine.
 *
 * Distinguishes FACT, INFERENCE, and TEMPORARY_CONTEXT.
 * Manages cross-channel customer memory across Web, SMS, and Email.
 */

import { supabaseAdmin } from '../../shared.js'
import { saveMemory } from '../../routes/ai-engine.js'

export const MEMORY_TIERS = {
  FACT: 'fact',
  INFERENCE: 'inference',
  TEMPORARY_CONTEXT: 'temporary',
}

/**
 * Persists high-value verified customer facts into durable memory.
 */
export async function persistDurableCustomerFacts(dealershipId, contactId, intelligenceState, conversationId = null) {
  if (!dealershipId || !contactId || !intelligenceState) return

  const s = intelligenceState
  const v = s.vehicle_interest
  const p = s.purchase_state
  const t = s.trade_state
  const id = s.identity

  // 1. Persist Target Vehicle Preference
  if (v.primary_vehicle?.value && v.primary_vehicle?.status === 'known') {
    await saveMemory(dealershipId, contactId, 'vehicle_preference', v.primary_vehicle.value, { conversationId }).catch(() => {})
  }

  // 2. Persist Trade Vehicle
  if (t.has_trade?.value && t.year?.value) {
    const tradeStr = [t.year.value, t.make?.value, t.model?.value, t.mileage?.value ? `(${t.mileage.value} mi/km)` : null].filter(Boolean).join(' ')
    await saveMemory(dealershipId, contactId, 'trade_vehicle', tradeStr, { conversationId }).catch(() => {})
  }

  // 3. Persist Budget / Payment Comfort
  if (p.payment_comfort?.value) {
    await saveMemory(dealershipId, contactId, 'budget_preference', `Target monthly: ${p.payment_comfort.value}`, { conversationId }).catch(() => {})
  }

  // 4. Persist Preferred Contact Channel
  if (id.preferred_contact_channel?.value) {
    await saveMemory(dealershipId, contactId, 'contact_preference', id.preferred_contact_channel.value, { conversationId }).catch(() => {})
  }
}

/**
 * Loads durable memories and hydrates initial intelligence state.
 */
export async function hydrateCustomerStateFromDurableMemory(dealershipId, contactId, initialState = {}) {
  if (!dealershipId || !contactId) return initialState

  const { data: mems } = await supabaseAdmin.from('ai_memories')
    .select('key, value, created_at')
    .eq('dealership_id', dealershipId)
    .eq('contact_id', contactId)

  if (!mems || !mems.length) return initialState

  for (const m of mems) {
    if (m.key === 'vehicle_preference' && !initialState.vehicle_interest?.primary_vehicle?.value) {
      initialState.vehicle_interest.primary_vehicle.value = m.value
      initialState.vehicle_interest.primary_vehicle.status = 'known'
      initialState.vehicle_interest.primary_vehicle.source = 'durable_memory'
    } else if (m.key === 'trade_vehicle' && !initialState.trade_state?.has_trade?.value) {
      initialState.trade_state.has_trade.value = true
      initialState.trade_state.has_trade.status = 'known'
      initialState.trade_state.make.value = m.value
      initialState.trade_state.make.status = 'inferred'
      initialState.trade_state.source = 'durable_memory'
    } else if (m.key === 'contact_preference') {
      initialState.identity.preferred_contact_channel.value = m.value
    }
  }

  return initialState
}
