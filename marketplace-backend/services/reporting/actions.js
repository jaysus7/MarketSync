/**
 * Report actions hand off to canonical MarketSync engines.
 * No duplicate workflows live here.
 */

export const REPORT_ACTIONS = Object.freeze({
  create_followup_tasks: { engine: 'tasks', route: 'POST /crm/tasks', description: 'Create follow-up tasks' },
  assign_leads: { engine: 'crm', route: 'POST /leads/assign', description: 'Assign leads' },
  notify_manager: { engine: 'notifications', route: 'POST /notifications', description: 'Notify manager' },
  build_recovery_campaign: { engine: 'marketing', route: 'POST /marketing/campaigns', description: 'Build recovery campaign' },
  create_audience: { engine: 'marketing', route: 'POST /marketing/audiences', description: 'Create audience' },
  start_email_campaign: { engine: 'marketing', route: 'POST /marketing/email', description: 'Start email campaign' },
  start_sms_campaign: { engine: 'marketing', route: 'POST /marketing/sms', description: 'Start SMS campaign' },
  create_automation: { engine: 'workflow', route: 'POST /workflow', description: 'Create automation' },
  change_inventory_priority: { engine: 'inventory', route: 'POST /inventory/priority', description: 'Change inventory priority' },
  open_pricing_review: { engine: 'inventory', route: 'GET /inventory/pricing-review', description: 'Open pricing review' },
  open_appraisal: { engine: 'inventory', route: 'GET /appraisals', description: 'Open appraisal' },
  open_customer_workspace: { engine: 'crm', route: 'GET /contacts/:id', description: 'Open customer workspace' },
  schedule_coaching: { engine: 'people', route: 'POST /academy/coaching', description: 'Schedule coaching' },
  assign_academy_training: { engine: 'people', route: 'POST /academy/assign', description: 'Assign Academy training' },
  export_accounting_exceptions: { engine: 'accounting', route: 'GET /accounting/exceptions.csv', description: 'Export accounting exceptions' }
})

export function resolveReportAction(actionId) {
  const action = REPORT_ACTIONS[actionId]
  if (!action) {
    const err = new Error(`Unknown report action: ${actionId}`)
    err.code = 'UNKNOWN_ACTION'
    throw err
  }
  return { id: actionId, ...action, duplicate_workflow: false }
}

export function supportedActions() {
  return Object.entries(REPORT_ACTIONS).map(([id, a]) => ({ id, ...a }))
}
