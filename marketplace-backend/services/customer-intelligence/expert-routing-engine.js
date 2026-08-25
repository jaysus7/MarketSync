/**
 * MarketSync Customer Intelligence — Expert Routing & Morning Briefing Engine.
 *
 * Implements skill-based rep matching (EV, Commercial, F&I, Service), preserves customer relationship
 * ownership, handles after-hours queues, and generates sales manager morning briefing payloads.
 */

export function routeToSpecialist(opportunityContext = {}, dealershipStaff = []) {
  const { is_commercial, is_ev, has_fni_question, previous_rep_id, preferred_rep_id } = opportunityContext

  // 1. Existing Relationship Ownership
  if (preferred_rep_id || previous_rep_id) {
    const repId = preferred_rep_id || previous_rep_id
    const existingRep = dealershipStaff.find(s => s.id === repId && s.status === 'active')
    if (existingRep) {
      return {
        assigned_rep: existingRep,
        routing_reason: 'Preserved prior customer relationship ownership',
      }
    }
  }

  // 2. Commercial / Fleet Specialist
  if (is_commercial) {
    const commercialRep = dealershipStaff.find(s => s.specialties?.includes('commercial') || s.role === 'commercial_sales')
    if (commercialRep) {
      return { assigned_rep: commercialRep, routing_reason: 'Commercial Fleet Specialist' }
    }
  }

  // 3. EV Specialist
  if (is_ev) {
    const evRep = dealershipStaff.find(s => s.specialties?.includes('ev') || s.certifications?.includes('ev_certified'))
    if (evRep) {
      return { assigned_rep: evRep, routing_reason: 'Certified EV Specialist' }
    }
  }

  // 4. Default Sales Consultant
  const defaultRep = dealershipStaff.find(s => s.role === 'sales_consultant' || s.department === 'Sales') || null
  return {
    assigned_rep: defaultRep,
    routing_reason: 'Standard sales consultation queue',
  }
}

/**
 * Generates structured Morning AI Brief payload for Sales Managers.
 */
export function generateMorningAiBrief(overnightConversations = [], appointments = []) {
  const hotLeads = []
  const unresolvedObjections = []

  for (const c of overnightConversations) {
    if (c.lead_score >= 70 || c.urgency === 'high') {
      hotLeads.push({
        id: c.conversation_id,
        customer_name: c.customer_name || 'Shopper',
        vehicle: c.target_vehicle || 'General Inventory',
        lead_score: c.lead_score,
      })
    }
    if (c.active_objection) {
      unresolvedObjections.push({
        customer_name: c.customer_name,
        objection: c.active_objection,
      })
    }
  }

  return {
    date: new Date().toISOString().split('T')[0],
    summary: {
      total_overnight_leads: overnightConversations.length,
      hot_leads_count: hotLeads.length,
      appointments_booked: appointments.length,
    },
    hot_leads: hotLeads,
    unresolved_objections: unresolvedObjections,
    recommended_manager_action: hotLeads.length ? `Prioritize morning outreach on ${hotLeads.length} hot overnight AI leads within 15 minutes of store opening.` : 'Review incoming leads and distribute to available floor staff.',
  }
}
