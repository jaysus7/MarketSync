/**
 * Predefined report library.
 * Definitions only — no per-report frontend pages.
 */

import { METRICS } from './metric-registry.js'
import { DIMENSIONS } from './dimension-registry.js'

export const DEPARTMENT_TARGETS = Object.freeze({
  executive: 80,
  sales: 150,
  inventory: 140,
  crm: 140,
  marketing: 130,
  website: 100,
  fni: 90,
  service: 120,
  parts: 70,
  accounting: 80,
  people: 100,
  customers: 80,
  communications: 60,
  automations: 60
})

const DEPT_METRICS = {
  executive: ['units_sold', 'revenue', 'total_gross', 'close_rate', 'roas', 'cac', 'service_revenue', 'ai_cost'],
  sales: ['units_sold', 'revenue', 'front_gross', 'total_gross', 'close_rate', 'show_rate', 'days_to_sell', 'employee_productivity'],
  inventory: ['days_to_sell', 'inventory_turn', 'market_position', 'leads_per_vehicle', 'units_sold', 'vdp_views'],
  crm: ['response_time', 'appointment_rate', 'show_rate', 'close_rate', 'followup_completion_rate', 'untouched_leads', 'overdue_followups'],
  marketing: ['roas', 'cac', 'cpl', 'cost_per_appointment', 'cost_per_sale', 'revenue', 'units_sold'],
  website: ['vdp_views', 'leads_per_vehicle', 'close_rate', 'units_sold'],
  fni: ['fni_penetration', 'back_gross', 'total_gross', 'revenue'],
  service: ['service_revenue', 'effective_labour_rate', 'technician_efficiency'],
  parts: ['parts_turn', 'service_revenue'],
  accounting: ['revenue', 'front_gross', 'back_gross', 'total_gross', 'ai_cost'],
  people: ['employee_productivity', 'close_rate', 'response_time', 'followup_completion_rate', 'video_send_rate'],
  customers: ['ltv', 'close_rate', 'units_sold', 'service_revenue'],
  communications: ['video_send_rate', 'video_view_rate', 'video_to_sale_rate', 'response_time'],
  automations: ['automation_roi', 'ai_cost', 'ai_influenced_revenue']
}

const DEPT_DIMS = {
  executive: ['month', 'department', 'rooftop', 'season'],
  sales: ['salesperson', 'make', 'model', 'exterior_colour', 'season', 'lead_source', 'hour', 'weekday'],
  inventory: ['make', 'model', 'exterior_colour', 'season', 'price_band', 'acquisition_source', 'inventory_age'],
  crm: ['salesperson', 'lead_source', 'hour', 'channel', 'campaign'],
  marketing: ['campaign', 'channel', 'source_medium', 'creative', 'hour'],
  website: ['model', 'make', 'landing_page', 'channel'],
  fni: ['fni_manager', 'salesperson', 'new_used', 'month'],
  service: ['advisor', 'technician', 'ro_type', 'repair_category'],
  parts: ['month', 'repair_category'],
  accounting: ['month', 'department', 'salesperson'],
  people: ['employee', 'role', 'tenure', 'training_cohort'],
  customers: ['customer_cohort', 'geography', 'repeat_new', 'lead_source'],
  communications: ['salesperson', 'model', 'hour', 'lead_source'],
  automations: ['month', 'employee', 'department']
}

const VIZ_CYCLE = ['kpi', 'table', 'bar', 'line', 'heatmap', 'funnel']
const RANGE_CYCLE = [7, 30, 90, 180, 365]
const COMPARE_CYCLE = [null, 'prior_period', 'prior_year']
const ACTIONS = {
  sales: ['assign_leads', 'create_followup_tasks', 'schedule_coaching', 'open_customer_workspace'],
  crm: ['create_followup_tasks', 'assign_leads', 'notify_manager', 'start_sms_campaign'],
  inventory: ['change_inventory_priority', 'open_pricing_review', 'open_appraisal'],
  marketing: ['create_audience', 'start_email_campaign', 'start_sms_campaign', 'create_automation'],
  communications: ['start_sms_campaign', 'create_followup_tasks'],
  people: ['schedule_coaching', 'assign_academy_training', 'notify_manager'],
  accounting: ['export_accounting_exceptions'],
  default: ['notify_manager']
}

// The first reports in every department are named operating reports that a
// dealership can recognize immediately. The remaining definitions expand each
// library with valid metric/dimension combinations for deeper analysis.
const CURATED_REPORTS = Object.freeze({
  executive: [
    ['Dealer Principal Daily Scorecard', 'units_sold', 'day'],
    ['Month-to-Date Revenue', 'revenue', 'day'],
    ['Total Gross Performance', 'total_gross', 'month'],
    ['Store Close Rate', 'close_rate', 'month']
  ],
  sales: [
    ['Daily Sales Pace', 'units_sold', 'day'],
    ['Salesperson Unit Scorecard', 'units_sold', 'salesperson'],
    ['Salesperson Gross Scorecard', 'total_gross', 'salesperson'],
    ['Lead Source Close Rate', 'close_rate', 'lead_source']
  ],
  inventory: [
    ['Inventory Aging & Days to Sell', 'days_to_sell', 'inventory_age'],
    ['Inventory Turn by Make', 'inventory_turn', 'make'],
    ['Price-to-Market by Model', 'market_position', 'model'],
    ['Leads per Vehicle', 'leads_per_vehicle', 'model']
  ],
  crm: [
    ['Speed-to-Lead by Salesperson', 'response_time', 'salesperson'],
    ['Untouched Leads', 'untouched_leads', 'lead_source'],
    ['Overdue Follow-Ups', 'overdue_followups', 'employee'],
    ['Appointment Conversion', 'appointment_rate', 'lead_source']
  ],
  marketing: [
    ['Return on Ad Spend by Campaign', 'roas', 'campaign'],
    ['Cost per Lead by Channel', 'cpl', 'channel'],
    ['Customer Acquisition Cost', 'cac', 'campaign'],
    ['Cost per Sale', 'cost_per_sale', 'campaign']
  ],
  website: [
    ['Vehicle Detail Page Views', 'vdp_views', 'model'],
    ['Website Leads per Vehicle', 'leads_per_vehicle', 'model'],
    ['Website Lead Close Rate', 'close_rate', 'lead_source'],
    ['VDP Views by Make', 'vdp_views', 'make']
  ],
  fni: [
    ['F&I Product Penetration', 'fni_penetration', 'fni_manager'],
    ['Back Gross by F&I Manager', 'back_gross', 'fni_manager'],
    ['Accounting Back Gross by Salesperson', 'back_gross', 'salesperson'],
    ['F&I Revenue Trend', 'revenue', 'month']
  ],
  service: [
    ['Service Revenue by Advisor', 'service_revenue', 'advisor'],
    ['Service Revenue by Technician', 'service_revenue', 'technician'],
    ['Effective Labour Rate', 'effective_labour_rate', 'advisor'],
    ['Technician Efficiency', 'technician_efficiency', 'technician']
  ],
  parts: [
    ['Parts Inventory Turn', 'parts_turn', 'month'],
    ['Parts-Supported Service Revenue', 'service_revenue', 'repair_category'],
    ['Parts Turn Trend', 'parts_turn', 'month'],
    ['Service Revenue by Repair Category', 'service_revenue', 'repair_category']
  ],
  accounting: [
    ['Revenue by Month', 'revenue', 'month'],
    ['Front Gross by Salesperson', 'front_gross', 'salesperson'],
    ['Back Gross by Salesperson', 'back_gross', 'salesperson'],
    ['Total Gross by Department', 'total_gross', 'department']
  ],
  people: [
    ['Employee Productivity', 'employee_productivity', 'employee'],
    ['Close Rate by Salesperson', 'close_rate', 'salesperson'],
    ['Follow-Up Completion by Employee', 'followup_completion_rate', 'employee'],
    ['Video Adoption by Salesperson', 'video_send_rate', 'salesperson']
  ],
  customers: [
    ['Customer Lifetime Value', 'ltv', 'customer_cohort'],
    ['Repeat vs New Customer Sales', 'units_sold', 'repeat_new'],
    ['Customer Close Rate by Source', 'close_rate', 'lead_source'],
    ['Customer Revenue by Geography', 'revenue', 'geography']
  ],
  communications: [
    ['Video Send Rate by Salesperson', 'video_send_rate', 'salesperson'],
    ['Video View Rate by Salesperson', 'video_view_rate', 'salesperson'],
    ['Video-to-Sale Conversion', 'video_to_sale_rate', 'salesperson'],
    ['Response Time by Contact Channel', 'response_time', 'channel']
  ],
  automations: [
    ['Automation Return on Investment', 'automation_roi', 'month'],
    ['AI Usage Cost', 'ai_cost', 'month'],
    ['AI-Influenced Revenue', 'ai_influenced_revenue', 'month'],
    ['Automation ROI by Department', 'automation_roi', 'department']
  ]
})

function combinations(arr, k) {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const out = []
  const rec = (start, path) => {
    if (path.length === k) { out.push([...path]); return }
    for (let i = start; i < arr.length; i++) {
      path.push(arr[i])
      rec(i + 1, path)
      path.pop()
    }
  }
  rec(0, [])
  return out
}

function titleDept(dept) {
  return ({
    executive: 'Executive', sales: 'Sales', inventory: 'Inventory', crm: 'CRM & Follow-Up',
    marketing: 'Marketing', website: 'Website & Discoverability', fni: 'F&I', service: 'Service',
    parts: 'Parts', accounting: 'Accounting', people: 'People', customers: 'Customers',
    communications: 'Communications', automations: 'Automations & AI'
  })[dept] || dept
}

function reportName(dept, metrics, dims) {
  const m = metrics.map((id) => METRICS[id]?.display_name || id).join(' + ')
  const d = dims.length ? ` by ${dims.map((id) => DIMENSIONS[id]?.id || id).join(' × ')}` : ''
  return `${titleDept(dept)}: ${m}${d}`.slice(0, 120)
}

function recommendedActions(dept) {
  return ACTIONS[dept] || ACTIONS.default
}

export function seedReportLibrary() {
  const reports = []
  for (const [dept, target] of Object.entries(DEPARTMENT_TARGETS)) {
    const metrics = (DEPT_METRICS[dept] || ['units_sold']).filter((id) => METRICS[id])
    const dims = (DEPT_DIMS[dept] || ['month']).filter((id) => DIMENSIONS[id])
    let n = 0
    let seq = 0
    for (const [name, metricId, dimension] of CURATED_REPORTS[dept] || []) {
      if (n >= target || !METRICS[metricId]) break
      const allowed = METRICS[metricId].allowed_dimensions || []
      const dimensions = dimension && allowed.includes(dimension) ? [dimension] : []
      seq++
      reports.push({
        id: `rpt_${dept}_${String(seq).padStart(4, '0')}`,
        name,
        description: `${METRICS[metricId].description}. Live ${titleDept(dept)} operating report${dimensions.length ? ` grouped by ${dimensions.join(', ')}` : ''}.`,
        department: dept,
        metric_ids: [metricId],
        default_dimensions: dimensions,
        filters: {},
        date_range: { days: 30 },
        comparison: 'prior_period',
        visualization: dimensions.length ? 'bar' : 'kpi',
        drilldowns: dimensions.length ? [...dimensions] : ['month'],
        recommended_actions: recommendedActions(dept),
        permissions: [`reports.${dept}.view`, 'reports.view']
      })
      n++
    }
    while (n < target) {
      for (const metricId of metrics) {
        if (n >= target) break
        const dimPool = (METRICS[metricId].allowed_dimensions || dims).filter((d) => dims.includes(d) || DIMENSIONS[d])
        const uniqueDims = [...new Set(dimPool)].slice(0, 8)
        const combos = [
          [],
          ...uniqueDims.map((d) => [d]),
          ...combinations(uniqueDims, 2).slice(0, 20),
          ...combinations(uniqueDims, 3).slice(0, 12)
        ]
        for (const combo of combos) {
          if (n >= target) break
          const allowed = combo.every((d) => (METRICS[metricId].allowed_dimensions || []).includes(d))
          if (combo.length && !allowed) continue
          seq++
          reports.push({
            id: `rpt_${dept}_${String(seq).padStart(4, '0')}`,
            name: reportName(dept, [metricId], combo),
            description: `${METRICS[metricId].description} Sliced by ${combo.join(', ') || 'store totals'}.`,
            department: dept,
            metric_ids: [metricId],
            default_dimensions: combo,
            filters: {},
            date_range: { days: RANGE_CYCLE[seq % RANGE_CYCLE.length] },
            comparison: COMPARE_CYCLE[seq % COMPARE_CYCLE.length],
            visualization: VIZ_CYCLE[seq % VIZ_CYCLE.length],
            drilldowns: combo.length ? [...combo, 'employee'] : ['salesperson', 'model'],
            recommended_actions: recommendedActions(dept),
            permissions: [`reports.${dept}.view`, 'reports.view']
          })
          n++
        }
      }
      if (n < target) {
        seq++
        reports.push({
          id: `rpt_${dept}_${String(seq).padStart(4, '0')}`,
          name: `${titleDept(dept)} snapshot ${seq}`,
          description: 'Department snapshot from the shared registry.',
          department: dept,
          metric_ids: [metrics[seq % metrics.length]],
          default_dimensions: ['month'],
          filters: {},
          date_range: { days: 30 },
          comparison: 'prior_period',
          visualization: 'kpi',
          drilldowns: ['month'],
          recommended_actions: recommendedActions(dept),
          permissions: [`reports.${dept}.view`, 'reports.view']
        })
        n++
      }
    }
  }
  return reports
}

let _cache = null
export function getReportLibrary() {
  if (!_cache) _cache = seedReportLibrary()
  return _cache
}

export function getReportById(id) {
  return getReportLibrary().find((r) => r.id === id) || null
}

export function listReportsByDepartment(dept) {
  return getReportLibrary().filter((r) => r.department === dept)
}

export function predefinedReportCount() {
  return getReportLibrary().length
}
