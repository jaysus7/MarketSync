/**
 * The core onboarding and offboarding checklists (Phase 7 PR 7.5).
 *
 * These 18 tasks were ALREADY seeded into `staff_lifecycle_template_tasks` for five
 * dealerships, with stable `task_key`s and genuinely good content. This file is not a rewrite
 * of them — it is the same content, checked in, for two reasons:
 *
 *   1. A dealership created after that seed ran has NO templates at all, so onboarding could
 *      never be assigned there. There was no producer for the templates either.
 *   2. Checked in, they are reviewable in a diff and a fix reaches every dealership, the same
 *      reason `academy-curriculum.js` and `permissions-catalog.js` are checked in.
 *
 * `system_key` + `task_key` are what make seeding idempotent: re-running updates the wording
 * of a task rather than creating a second copy beside it.
 */

const t = (task_key, title, description, category, due_offset_days, assignee_type, required, sort_order) => ({
  task_key, title, description, category, due_offset_days, assignee_type, required, sort_order,
})

export const LIFECYCLE_TEMPLATES = [
  {
    system_key: 'core_employee_onboarding',
    name: 'Core Employee Onboarding',
    lifecycle_type: 'onboarding',
    description: 'What has to happen for somebody to start work safely and lawfully.',
    tasks: [
      t('complete_profile', 'Complete employee profile',
        'Confirm contact information and provide required employee details.', 'profile', 0, 'employee', true, 10),
      t('verify_account_security', 'Verify account and enable MFA',
        'Verify the work email and configure multi-factor authentication before receiving privileged access.', 'security', 0, 'employee', true, 20),
      t('review_role_permissions', 'Review role and product permissions',
        'Confirm the employee has only the dealership, product, department, and record permissions needed for their work.', 'access', 0, 'manager', true, 30),
      t('acknowledge_privacy_monitoring', 'Acknowledge privacy and monitoring notices',
        'Assign the dealership privacy, acceptable-use, and electronic-monitoring notices that apply to this employee.', 'compliance', 1, 'employee', true, 40),
      t('complete_workplace_orientation', 'Complete workplace conduct and safety orientation',
        'Complete applicable violence, harassment, emergency, accessibility, and workplace conduct orientation.', 'safety', 3, 'employee', true, 50),
      t('complete_role_training', 'Complete department and product training',
        'Complete the required MarketSync and dealership workflow training for the assigned department.', 'training', 7, 'employee', true, 60),
      t('issue_assets', 'Issue equipment, keys, and credentials',
        'Record assigned equipment, access cards, keys, devices, and other dealership property.', 'assets', 1, 'manager', true, 70),
      t('manager_week_one_checkin', 'Complete first-week manager check-in',
        'Review access, training progress, role expectations, blockers, and outstanding documents.', 'manager', 7, 'manager', true, 80),
      t('manager_day_thirty_review', 'Complete 30-day onboarding review',
        'Confirm required tasks are complete and record any follow-up training or access changes.', 'manager', 30, 'manager', true, 90),
    ],
  },
  {
    system_key: 'core_employee_offboarding',
    name: 'Core Employee Offboarding',
    lifecycle_type: 'offboarding',
    description: 'What has to happen so a departure does not leave access, work or records behind.',
    tasks: [
      t('record_end_details', 'Record employment end details',
        'Record the effective date, reason, final manager, and any approved transition notes.', 'employment', 0, 'manager', true, 10),
      t('revoke_sessions', 'Revoke login sessions and authentication factors',
        'Disable application access and revoke active sessions at the effective offboarding time.', 'security', 0, 'manager', true, 20),
      t('remove_permissions', 'Remove product, role, and integration access',
        'Remove dealership roles, permission overrides, API access, connected calendars, and external system credentials.', 'access', 0, 'manager', true, 30),
      t('reassign_work', 'Reassign leads, tasks, appointments, and ownership',
        'Transfer open customer work, scheduled activities, records, and unresolved approvals.', 'operations', 0, 'manager', true, 40),
      t('recover_assets', 'Recover equipment, keys, devices, and access cards',
        'Record the return and condition of all dealership property assigned to the employee.', 'assets', 1, 'manager', true, 50),
      t('finalize_time_compensation', 'Finalize time entries and compensation records',
        'Complete outstanding time approvals, commissions, expense items, and payroll export information.', 'payroll', 3, 'manager', true, 60),
      t('preserve_required_records', 'Preserve required employee and compliance records',
        'Apply the dealership retention schedule and restrict access to employment, policy, training, and incident records.', 'compliance', 3, 'manager', true, 70),
      t('transfer_knowledge', 'Complete knowledge and document handoff',
        'Transfer required procedures, files, customer context, and operational responsibilities.', 'records', 2, 'manager', false, 80),
      t('close_offboarding', 'Complete final offboarding review',
        'Verify required tasks are complete and close the employee lifecycle assignment.', 'manager', 5, 'manager', true, 90),
    ],
  },
]

export const LIFECYCLE_SYSTEM_KEYS = LIFECYCLE_TEMPLATES.map(x => x.system_key)
