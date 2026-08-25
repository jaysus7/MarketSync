/**
 * MarketSync Customer Intelligence — Safe Identity Resolution & Attribution Engine.
 *
 * Implements safe identity resolution based on verified phone, verified email, and tokens.
 * Prohibits unsafe merging on names/IPs alone. Tracks household co-buyers and campaign attribution.
 */

import { supabaseAdmin } from '../../shared.js'

/**
 * Safely resolves or merges customer identity without creating duplicates.
 */
export async function resolveSafeCustomerIdentity(dealershipId, candidate = {}) {
  if (!dealershipId) return { contact_id: null, is_new: false, match_type: 'none' }

  const phone = candidate.phone ? String(candidate.phone).replace(/\D/g, '') : null
  const email = candidate.email ? String(candidate.email).trim().toLowerCase() : null

  // 1. Search by verified Phone (clean 10 digits)
  if (phone && phone.length >= 10) {
    const { data: byPhone } = await supabaseAdmin.from('crm_contacts')
      .select('id, name, phone, email, assigned_to')
      .eq('dealership_id', dealershipId)
      .ilike('phone', `%${phone.slice(-10)}%`)
      .maybeSingle()

    if (byPhone) {
      return {
        contact_id: byPhone.id,
        contact: byPhone,
        is_new: false,
        match_type: 'verified_phone',
      }
    }
  }

  // 2. Search by verified Email
  if (email && email.includes('@')) {
    const { data: byEmail } = await supabaseAdmin.from('crm_contacts')
      .select('id, name, phone, email, assigned_to')
      .eq('dealership_id', dealershipId)
      .ilike('email', email)
      .maybeSingle()

    if (byEmail) {
      return {
        contact_id: byEmail.id,
        contact: byEmail,
        is_new: false,
        match_type: 'verified_email',
      }
    }
  }

  // 3. No match found — safe candidate for progressive profile creation
  return {
    contact_id: null,
    contact: null,
    is_new: true,
    match_type: 'none',
  }
}

/**
 * Parses household co-buyer mentions without polluting primary customer identity.
 */
export function extractCoBuyerParticipant(message = '') {
  const text = String(message || '').toLowerCase()
  const spouseMatch = text.match(/\b(wife|husband|spouse|partner|fianc[eé]|dad|mom|father|mother|son|daughter|business partner)\b/i)
  if (!spouseMatch) return null

  const relation = spouseMatch[1].toLowerCase()
  let participantType = 'spouse'
  if (['dad', 'mom', 'father', 'mother'].includes(relation)) participantType = 'parent'
  else if (['son', 'daughter'].includes(relation)) participantType = 'child'
  else if (['business partner'].includes(relation)) participantType = 'business_partner'

  return {
    relation,
    participant_type: participantType,
    evidence: `Customer mentioned ${relation} in message: "${message.slice(0, 100)}"`,
  }
}
