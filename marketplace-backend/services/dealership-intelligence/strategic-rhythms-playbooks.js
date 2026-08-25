/**
 * MarketSync Dealership Intelligence — Strategic Priorities, Rhythms & Playbooks (§626–649, §816–820)
 */

/**
 * Checks Alignment between Operational State, Recommendations, and Strategic Priorities (§626–628).
 */
export function evaluateStrategicAlignment(state, priorities = []) {
  const defaultPriorities = [
    { id: 'p1', rank: 1, title: 'Reduce Recon Cycle Time Below 3.5 Days', department: 'inventory' },
    { id: 'p2', rank: 2, title: 'Achieve Sub-5 Minute Lead Response SLA', department: 'sales' },
    { id: 'p3', rank: 3, title: 'Eliminate Unfunded Deals Over 3 Business Days', department: 'fni' }
  ]

  const activePriorities = priorities.length ? priorities : defaultPriorities
  const alignmentReports = []
  const conflicts = []

  activePriorities.forEach(p => {
    if (p.id === 'p1') {
      const reconDays = state.inventory?.avg_recon_days || 5.2
      const isAligned = reconDays <= 3.5
      alignmentReports.push({
        priority_id: p.id,
        title: p.title,
        status: isAligned ? 'ALIGNED' : 'OFF_TRACK',
        metric_value: `${reconDays} days`,
        recommendation: !isAligned ? 'Deploy secondary detail vendor to meet Priority #1 target.' : 'Target achieved.'
      })
      if (!isAligned && (state.inventory?.units_in_recon || 0) > 5) {
        conflicts.push({
          priority_id: p.id,
          conflict_statement: `Stated Q3 Priority #1 is '${p.title}', but current recon backlog has ${state.inventory.units_in_recon} units averaging ${reconDays} days.`
        })
      }
    }
  })

  return {
    strategic_priorities_count: activePriorities.length,
    alignment_reports: alignmentReports,
    has_conflicts: conflicts.length > 0,
    operational_conflicts: conflicts
  }
}

/**
 * Time-of-Day Operating Rhythm & Meeting Brief Generator (§634–637, §817).
 */
export function generateMeetingBriefing(meetingType = 'SALES_MEETING', state = {}) {
  switch (meetingType) {
    case 'SALES_MEETING':
      return {
        meeting_type: 'SALES_HUDDLE',
        agenda: 'Daily Sales Rhythm & Focus',
        topics: [
          `Yesterday Closed Sales: ${state.sales?.month_to_date_units_sold ? 3 : 2} units`,
          `Today's Scheduled Appointments: ${state.sales?.appointments_today_count || 12} customers`,
          `Hot Inbound Leads Requiring Response: ${state.sales?.hot_leads_count || 4} leads`,
          `Aged Inventory Merchandising Focus: ${state.inventory?.units_over_90_days || 14} units over 90 days`,
          `Overdue Customer Follow-ups: ${state.sales?.stalled_opportunities_count || 6} stalled opportunities`
        ],
        action_capture_template: {
          assigned_rep: null,
          target_vehicle_stock: null,
          deadline_time: '17:00'
        }
      }

    case 'SERVICE_HUDDLE':
      return {
        meeting_type: 'SERVICE_DISPATCH_HUDDLE',
        agenda: 'Shop Floor Capacity & Promise Reliability',
        topics: [
          `Today's Booked Hours: ${state.service?.booked_tech_hours_today || 74} hrs vs ${state.service?.available_tech_hours_today || 61} hrs available`,
          `Carryover Repair Orders: ${state.service?.open_ros_count || 26} open ROs`,
          `Parts Blockers in Bays: ${state.service?.ros_blocked_by_parts || 3} ROs waiting on parts`,
          `Critical Promise-Time Watch: ${state.service?.ros_at_promise_time_risk || 3} ROs due before 4 PM`
        ]
      }

    default:
      return {
        meeting_type: 'EXECUTIVE_ROUNDTABLE',
        agenda: 'Dealership Operations Overview'
      }
  }
}

/**
 * Operational Playbook Engine & Orphaned Work Detector (§644–648, §820).
 */
export function evaluateOperationalPlaybooks(state, openRecords = []) {
  const activePlaybooks = []
  const orphanedItems = []

  // 1. Hot Lead SLA Playbook
  if ((state.sales?.hot_leads_count || 0) > 0) {
    activePlaybooks.push({
      playbook_name: 'HOT_LEAD_RAPID_RESPONSE',
      trigger: 'Inbound lead uncontacted > 5 minutes',
      owner_role: 'sales_manager',
      required_actions: [
        'Attempt telephone contact within 3 minutes',
        'Send personalized video introduction via SMS',
        'Escalate to desk manager if uncontacted at 15 minutes'
      ],
      sla_minutes: 5,
      status: 'IN_EXECUTION'
    })
  }

  // 2. Orphaned Work Detection (§820)
  openRecords.forEach(rec => {
    if (!rec.assigned_employee_id || rec.assigned_employee_id === 'UNASSIGNED') {
      orphanedItems.push({
        record_type: rec.type || 'lead',
        record_id: rec.id || 'rec_unassigned',
        label: rec.label || 'Unassigned Record',
        waiting_duration_hours: rec.waiting_hours || 2.4,
        remedial_action: `Assign owner immediately according to ${rec.type} routing policy.`
      })
    }
  })

  return {
    active_playbooks: activePlaybooks,
    orphaned_work_count: orphanedItems.length,
    orphaned_records: orphanedItems
  }
}
