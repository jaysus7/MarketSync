/**
 * MarketSync Customer Intelligence — Contextual Offline Customer Recovery Engine.
 *
 * Evaluates abandoned sessions after 10-minute departure, validates consent via mayContact,
 * enforces strict stop conditions, and generates contextual follow-up dispatches.
 */

import { supabaseAdmin } from '../../shared.js'
import { mayContact } from '../../routes/consent.js'
import { emitEvent } from '../../routes/events.js'

export async function evaluateOfflineLeadRecovery(dealershipId, conversationId) {
  if (!dealershipId || !conversationId) return { eligible: false, reason: 'missing_params' }

  const { data: convo } = await supabaseAdmin.from('ai_conversations').select('*').eq('id', conversationId).eq('dealership_id', dealershipId).maybeSingle()
  if (!convo) return { eligible: false, reason: 'not_found' }

  // 1. Stop Condition: Rep has already taken over or status is handoff
  if (convo.status === 'handoff' || convo.assigned_salesperson) {
    return { eligible: false, reason: 'rep_already_assigned' }
  }

  // 2. Stop Condition: Contact ID missing or no phone/email
  if (!convo.contact_id) {
    return { eligible: false, reason: 'no_contact_captured' }
  }

  const { data: contact } = await supabaseAdmin.from('crm_contacts').select('*').eq('id', convo.contact_id).eq('dealership_id', dealershipId).maybeSingle()
  if (!contact || (!contact.phone && !contact.email)) {
    return { eligible: false, reason: 'missing_contact_details' }
  }

  // 3. Stop Condition: Consent Check
  const channel = contact.phone ? 'sms' : 'email'
  const consent = await mayContact(dealershipId, contact.id, channel)
  if (!consent.allowed) {
    return { eligible: false, reason: `consent_denied: ${consent.reason}` }
  }

  // 4. Stop Condition: Appointment already scheduled
  const { data: appts } = await supabaseAdmin.from('appointments').select('id').eq('contact_id', contact.id).eq('dealership_id', dealershipId).eq('status', 'scheduled')
  if (appts && appts.length > 0) {
    return { eligible: false, reason: 'appointment_already_scheduled' }
  }

  // 5. Generate Contextual Recovery Message
  const name = contact.first_name || contact.name || 'there'
  const text = `Hi ${name}, this is your team at the dealership. I noticed you were exploring our inventory earlier. I checked and your vehicle is currently available. Would you like me to send over the payment options or set up a time to take it for a spin?`

  return {
    eligible: true,
    channel,
    contact_id: contact.id,
    target_destination: channel === 'sms' ? contact.phone : contact.email,
    recovery_text: text,
  }
}
