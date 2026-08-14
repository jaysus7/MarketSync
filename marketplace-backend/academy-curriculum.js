/**
 * The MarketSync curriculum (Phase 7 PR 7.3).
 *
 * Checked in rather than typed into a database by hand, for the same reason
 * `permissions-catalog.js` is: it has to be reviewable in a diff, and CI has no database.
 * `scripts/academy-sync.mjs` pushes it into `staff_training_courses` as global rows
 * (`dealership_id = null`).
 *
 * WHAT THIS IS NOT: the 189-entry array in `dashboard-part24.js`. That is reference material —
 * a searchable library, kept, and deliberately never the default experience. This is the far
 * smaller set of courses that MarketSync will actually *require* of somebody, assign to them
 * by role, and certify against. Padding it to look impressive would make Your Path useless,
 * which is precisely the problem the Academy rebuild exists to fix.
 *
 * `level` decides where a course appears:
 *   required   — assigned automatically, produces a My Day action, blocks a certification
 *   foundation — what competent operation of that department actually needs
 *   advanced   — the deeper capabilities, offered, never forced
 *   reference  — the library; searchable, never pushed
 */

export const DEPARTMENTS = [
  'Sales', 'Inventory', 'F&I', 'Service', 'Parts', 'Accounting', 'Marketing', 'Management', 'HR', 'Products', 'MarketSync HQ',
]

// Role → the department whose curriculum they get. Same two vocabularies people-identity.js
// already joins; this does not invent a third.
export const ROLE_CURRICULUM = {
  MANAGER: ['Management', 'Sales', 'Products'],
  SALES_REP: ['Sales', 'Products'],
  FNI: ['F&I', 'Sales'],
  SERVICE: ['Service', 'Parts'],
  SERVICE_TECH: ['Service', 'Parts'],
  ACCOUNTING: ['Accounting'],
  CLEANUP: ['Inventory'],
  MARKETER: ['Marketing', 'Products'],
  HQ_STAFF: ['MarketSync HQ', 'Products', 'Management'],
}

const c = (course_key, title, department, level, estimated_minutes, description, sort) => ({
  course_key, title, department, level, estimated_minutes, description, sort,
})

export const COURSES = [
  // ── Level 1: Start Here (Everyone, regardless of department) ─────────────
  c('ms_getting_started', 'Getting around MarketSync', null, 'required', 12,
    'Where your work lives: My Day, your workspace, and how to find a customer or a vehicle.', 10),
  c('ms_privacy_basics', 'Customer privacy and consent', null, 'required', 15,
    'What consent means before you contact somebody, why the system refuses some messages, and what to do instead.', 20),

  // ── Sales ─────────────────────────────────────────────────────────────────
  c('sales_crm_basics', 'Working your customers', 'Sales', 'foundation', 18,
    'The customer record, assignment, and keeping a book that does not go stale.', 100),
  c('sales_lead_workflow', 'Lead handling, start to finish', 'Sales', 'required', 20,
    'What happens when a lead arrives, who owns it, and the response time that decides whether you sell the car.', 110),
  c('sales_appraisal', 'Appraisals and trade', 'Sales', 'foundation', 16,
    'Taking an appraisal, what the numbers mean, and handing it to Inventory cleanly.', 120),
  c('sales_video', 'Video that gets watched', 'Sales', 'advanced', 14,
    'Recording a walkaround worth opening — and reading what the watch data actually tells you.', 200),
  c('sales_pipeline_advanced', 'Pipeline and follow-up at volume', 'Sales', 'advanced', 22,
    'Working a large book without dropping anybody: automation, sequencing and honest forecasting.', 210),

  // ── Inventory ─────────────────────────────────────────────────────────────
  c('inv_import', 'Getting your inventory in', 'Inventory', 'required', 15,
    'Feeds, imports and what to check before you trust the numbers on your lot.', 100),
  c('inv_merchandising', 'Photos, descriptions and listings', 'Inventory', 'foundation', 18,
    'What makes a vehicle get clicked, and the merchandising checks that catch a bad listing early.', 110),
  c('inv_pricing', 'Pricing, aging and turn', 'Inventory', 'advanced', 24,
    'Reading market position, acting on aging before it costs you, and defending a price.', 200),
  c('inv_syndication', 'Syndication and marketplaces', 'Inventory', 'advanced', 16,
    'Where your vehicles appear, why a listing fails, and how to tell the difference.', 210),

  // ── F&I ───────────────────────────────────────────────────────────────────
  c('fni_credit_compliance', 'Credit applications and privacy law', 'F&I', 'required', 25,
    'Handling an application lawfully: what you may collect, who may see it, and what must be recorded.', 100),
  c('fni_funding', 'Funding and lender workflow', 'F&I', 'foundation', 20,
    'From contract to funded: what a lender needs, and why Contracts in Transit is the number to watch.', 110),
  c('fni_products', 'F&I products and disclosure', 'F&I', 'foundation', 18,
    'Presenting products honestly, and the disclosures that keep the deal defensible.', 120),

  // ── Service ───────────────────────────────────────────────────────────────
  c('svc_appointments', 'Appointments and check-in', 'Service', 'foundation', 14,
    'Booking, arrival, and starting a repair order that the shop can actually work from.', 100),
  c('svc_ro_workflow', 'The repair order, start to close', 'Service', 'required', 22,
    'The states an RO moves through, who may move it, and why authorization comes before work.', 110),
  c('svc_authorization', 'Estimates and customer authorization', 'Service', 'required', 16,
    'Getting authorization that holds up, and what to do when the job changes mid-repair.', 120),
  c('svc_fixed_ops', 'Fixed Ops performance', 'Service', 'advanced', 22,
    'Dispatch, effective labour rate, and where a shop quietly loses hours.', 200),

  // ── Parts ─────────────────────────────────────────────────────────────────
  c('parts_workflow', 'Parts requests and issuing', 'Parts', 'required', 16,
    'From a technician asking to a part on the bench, and keeping the stock ledger honest.', 100),
  c('parts_inventory', 'Stock, reorder and receipts', 'Parts', 'foundation', 18,
    'Reorder points, receiving, and the counts that decide whether a job waits.', 110),

  // ── Accounting ────────────────────────────────────────────────────────────
  c('acct_posting', 'How the books get written', 'Accounting', 'required', 24,
    'Which business events post, what a posted journal means, and why a failure must never be silent.', 100),
  c('acct_deal_settlement', 'Deals, CIT and receivables', 'Accounting', 'foundation', 22,
    'What a delivered deal owes you, why Contracts in Transit exists, and reading AR without guessing.', 110),
  c('acct_close', 'Month end and close controls', 'Accounting', 'advanced', 26,
    'The close checklist, what blocks it, and why a locked period is a protection rather than an obstacle.', 200),
  c('acct_reconciliation', 'Reconciliation in practice', 'Accounting', 'advanced', 20,
    'Matching what the bank says against what the ledger says, and what to do when they disagree.', 210),

  // ── Marketing & Products ──────────────────────────────────────────────────
  c('mkt_campaigns', 'Campaigns that can be measured', 'Marketing', 'required', 18,
    'Why a campaign needs an id, how spend is recorded, and what "attributed" honestly means.', 100),
  c('mkt_social', 'Social accounts and publishing', 'Marketing', 'foundation', 16,
    'Connecting accounts, who may publish as whom, and reading a publication that failed.', 110),
  c('prod_design_studio', 'Design Studio ($5/mo)', 'Products', 'foundation', 15,
    'Creating dealership graphics, logo asset vaults, and branded social assets.', 120),
  c('prod_autoposter', 'Facebook AutoPoster ($19-$79/mo)', 'Products', 'foundation', 18,
    'Salesperson and dealer Marketplace posting workflows, posting caps, and Chrome extension.', 130),
  c('prod_social_scheduler', 'Social Scheduler ($59/mo)', 'Products', 'foundation', 16,
    'Multi-channel calendar scheduling, team publishing queues, and post analytics.', 140),
  c('prod_video_suite', 'Video Suite ($99/mo)', 'Products', 'foundation', 16,
    'Recording 1080p vehicle walkarounds, branded overlays, and video SMS delivery.', 150),
  c('prod_dealer_website', 'Dealer Website & VDP Showroom ($249/mo)', 'Products', 'foundation', 20,
    'VDP showroom builder, lead capture forms, custom domains, and automotive SEO.', 160),
  c('prod_ai_chatbot', 'AI ChatBot ($299/mo)', 'Products', 'foundation', 18,
    '24/7 AI inventory assistant, test drive booking, lead routing, and human takeover.', 170),

  // ── Management ────────────────────────────────────────────────────────────
  c('mgmt_my_day', 'Running the day', 'Management', 'required', 16,
    'Reading My Day across departments, and what an incomplete day is telling you.', 100),
  c('mgmt_people', 'Hiring, onboarding and offboarding', 'Management', 'required', 20,
    'Adding somebody properly, what their role grants, and leaving without orphaning their customers.', 110),
  c('mgmt_approvals', 'Approvals and controls', 'Management', 'foundation', 18,
    'What needs your approval, why some things refuse to proceed, and how to read an audit trail.', 120),
  c('mgmt_analytics', 'Reading the dealership', 'Management', 'advanced', 24,
    'Cross-department numbers, what they are derived from, and which ones cannot be trusted yet.', 200),

  // ── MarketSync HQ ─────────────────────────────────────────────────────────
  c('hq_platform_overview', 'MarketSync Platform Architecture', 'MarketSync HQ', 'required', 25,
    'Internal architecture: DealerOS, Marketing Products, RLS security, and positioning.', 300),
  c('hq_customer_success', 'Customer Onboarding & Retention', 'MarketSync HQ', 'foundation', 20,
    'Guiding a store from single products to DealerOS, preventing churn, and support escalation.', 310),
]

/**
 * Certifications. Each names the courses it requires — a credential issued because somebody
 * opened a page is worth nothing, so `issueCertification` checks every one of these.
 */
export const CERTIFICATIONS = [
  { certification_key: 'ms_certified_sales', name: 'MarketSync Certified Sales Professional',
    department: 'Sales', validity_months: 24,
    description: 'Competent operation of the Sales workspace end to end: leads, customers, appraisals and delivery.',
    courses: ['ms_getting_started', 'ms_privacy_basics', 'sales_crm_basics', 'sales_lead_workflow', 'sales_appraisal'] },

  { certification_key: 'ms_certified_inventory', name: 'MarketSync Certified Inventory Specialist',
    department: 'Inventory', validity_months: 24,
    description: 'Getting inventory in, merchandised, priced and syndicated.',
    courses: ['ms_getting_started', 'inv_import', 'inv_merchandising', 'inv_pricing'] },

  { certification_key: 'ms_certified_fni', name: 'MarketSync Certified F&I Specialist',
    department: 'F&I', validity_months: 12,
    description: 'Credit handling, funding and disclosure — renewed yearly because the law moves.',
    courses: ['ms_getting_started', 'ms_privacy_basics', 'fni_credit_compliance', 'fni_funding', 'fni_products'] },

  { certification_key: 'ms_certified_service_advisor', name: 'MarketSync Certified Service Advisor',
    department: 'Service', validity_months: 24,
    description: 'Running a repair order from appointment to close, with authorization that holds up.',
    courses: ['ms_getting_started', 'svc_appointments', 'svc_ro_workflow', 'svc_authorization'] },

  { certification_key: 'ms_certified_technician', name: 'MarketSync Certified Technician',
    department: 'Service', validity_months: 24,
    description: 'Working assigned repair order lines and the Parts workflow behind them.',
    courses: ['ms_getting_started', 'svc_ro_workflow', 'parts_workflow'] },

  { certification_key: 'ms_certified_parts', name: 'MarketSync Certified Parts Specialist',
    department: 'Parts', validity_months: 24,
    description: 'Parts requests, issuing, receiving and a stock ledger that stays honest.',
    courses: ['ms_getting_started', 'parts_workflow', 'parts_inventory'] },

  { certification_key: 'ms_certified_accountant', name: 'MarketSync Certified Dealer Accountant',
    department: 'Accounting', validity_months: 24,
    description: 'How the books get written, what a delivered deal owes, and closing a period properly.',
    courses: ['ms_getting_started', 'acct_posting', 'acct_deal_settlement', 'acct_close'] },

  { certification_key: 'ms_certified_marketer', name: 'MarketSync Certified Automotive Marketer',
    department: 'Marketing', validity_months: 24,
    description: 'Campaigns that can be measured, publishing that is authorized, attribution that is honest.',
    courses: ['ms_getting_started', 'ms_privacy_basics', 'mkt_campaigns', 'mkt_social', 'prod_design_studio', 'prod_autoposter'] },

  { certification_key: 'ms_certified_operator', name: 'MarketSync Certified Dealer Operator',
    department: 'Management', validity_months: 24,
    description: 'Running the dealership across departments: the day, the people, the approvals and the numbers.',
    courses: ['ms_getting_started', 'mgmt_my_day', 'mgmt_people', 'mgmt_approvals', 'mgmt_analytics'] },
]

export const COURSE_KEYS = new Set(COURSES.map(x => x.course_key))
