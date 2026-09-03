/** Canonical metric registry. Formulas are locked; UI/AI may only select IDs. */
export const TIME_GRAINS = Object.freeze(['hour','day','weekday','week','month','quarter','year','season','fiscal_period'])
export const WON_DEAL_STATUSES = Object.freeze(['sold','fni','delivered'])
const C = ['dealership','rooftop','department','team','employee','manager','day','weekday','week','month','quarter','year','season']
const V = ['make','model','trim','model_year','body_style','exterior_colour','interior_colour','fuel_type','drivetrain','transmission','new_used','mileage_band','price_band','payment_band','gross_band','acquisition_source','inventory_age']
const R = ['lead_source','campaign','channel','opportunity_stage','customer_cohort','geography','repeat_new','referral','trade_no_trade','contact_method']
const SALES_DIMS = [...C, ...V, ...R, 'salesperson']

function m(id, display_name, department, source_entity, formula, unit, extra = {}) {
  return Object.freeze({
    id, display_name, department, source_entity, formula, unit,
    description: extra.description || display_name,
    numerator: extra.numerator || id,
    denominator: extra.denominator || null,
    currency: extra.currency || (unit === 'money' ? 'CAD' : null),
    allowed_dimensions: extra.dims || [...C],
    supported_time_grains: TIME_GRAINS,
    filters: ['date_range','dealership_id','employee_id','new_used'],
    null_rules: 'exclude_null_numerator; missing denominator stays null',
    tenant_isolation: 'dealership_id required on every query',
    historical_recompute: true,
    freshness: 'near_realtime'
  })
}

export const METRICS = Object.freeze({
  units_sold: m('units_sold','Units Sold','sales','deals','COUNT(deals WHERE deal_status IN won)','units',{numerator:'won_deals',dims:SALES_DIMS}),
  revenue: m('revenue','Revenue','sales','deals','SUM(deals.selling_price WHERE deal_status IN won)','money',{numerator:'selling_price',dims:SALES_DIMS}),
  front_gross: m('front_gross','Front Gross','sales','deals','SUM(selling_price - cost) WHERE cost > 0 AND deal_status IN won','money',{numerator:'selling_price_minus_cost',dims:[...C,...V,'salesperson','gross_band']}),
  back_gross: m('back_gross','Back Gross','fni','deals','SUM(fni_items.price) on won deals','money',{numerator:'fni_item_price',dims:[...C,'fni_manager','salesperson']}),
  total_gross: m('total_gross','Total Gross','sales','deals','front_gross + back_gross','money',{numerator:'front_plus_back',dims:[...C,...V,'salesperson']}),
  close_rate: m('close_rate','Close Rate','sales','leads+deals','won_deals / leads','percent',{numerator:'won_deals',denominator:'leads',dims:[...C,...R,'salesperson','hour']}),
  appointment_rate: m('appointment_rate','Appointment Rate','crm','appointments+leads','appointments / leads','percent',{numerator:'appointments',denominator:'leads',dims:[...C,...R,'salesperson','hour']}),
  show_rate: m('show_rate','Show Rate','sales','appointments','shows / appointments','percent',{numerator:'shows',denominator:'appointments',dims:[...C,...R,'salesperson','hour']}),
  response_time: m('response_time','Response Time','crm','leads','MEDIAN(responded_at - created_at) in minutes','minutes',{numerator:'response_minutes',dims:[...C,...R,'salesperson','hour']}),
  followup_completion_rate: m('followup_completion_rate','Follow-Up Completion Rate','crm','crm_tasks','done_tasks / due_tasks','percent',{numerator:'done_tasks',denominator:'due_tasks',dims:[...C,'salesperson','employee']}),
  video_send_rate: m('video_send_rate','Video Send Rate','communications','videos+leads','videos_sent / leads','percent',{numerator:'videos_sent',denominator:'leads',dims:SALES_DIMS}),
  video_view_rate: m('video_view_rate','Video View Rate','communications','videos','videos_played / videos_delivered','percent',{numerator:'videos_played',denominator:'videos_delivered',dims:[...C,'salesperson','model','hour']}),
  video_to_sale_rate: m('video_to_sale_rate','Video to Sale Rate','communications','videos+deals','won_with_video / leads_with_video','percent',{numerator:'won_with_video',denominator:'leads_with_video',dims:[...C,...V,'salesperson']}),
  days_to_sell: m('days_to_sell','Days to Sell','inventory','inventory','AVG(sold_at - lot_date) in days','days',{numerator:'days_on_lot',dims:[...C,...V]}),
  inventory_turn: m('inventory_turn','Inventory Turn','inventory','inventory+deals','units_sold / avg_on_hand','ratio',{numerator:'units_sold',denominator:'avg_on_hand',dims:[...C,...V]}),
  market_position: m('market_position','Market Position','inventory','inventory','(asking_price / market_mid) - 1','percent',{numerator:'asking_price',denominator:'market_mid',dims:[...C,...V]}),
  roas: m('roas','ROAS','marketing','marketing_campaigns+deals','attributed_revenue / spend','ratio',{numerator:'attributed_revenue',denominator:'spend',dims:[...C,'campaign','ad_set','ad','creative','channel','source_medium']}),
  cac: m('cac','CAC','marketing','marketing_campaigns+deals','spend / attributed_units','money',{numerator:'spend',denominator:'attributed_units',dims:[...C,'campaign','channel','source_medium']}),
  ltv: m('ltv','LTV','customers','contacts+deals','SUM(total_gross) / DISTINCT customers','money',{numerator:'customer_gross',denominator:'customers',dims:[...C,...R]}),
  service_revenue: m('service_revenue','Service Revenue','service','repair_orders','SUM(ro.customer_total) WHERE status closed','money',{numerator:'ro_customer_total',dims:[...C,'advisor','technician','ro_type','repair_category']}),
  effective_labour_rate: m('effective_labour_rate','Effective Labour Rate','service','repair_orders','labour_dollars / billed_hours','money',{numerator:'labour_dollars',denominator:'billed_hours',dims:[...C,'advisor','technician','ro_type']}),
  technician_efficiency: m('technician_efficiency','Technician Efficiency','service','time_clock+repair_orders','flagged_hours / clocked_hours','percent',{numerator:'flagged_hours',denominator:'clocked_hours',dims:[...C,'technician','shift']}),
  parts_turn: m('parts_turn','Parts Turn','parts','parts','parts_cogs / avg_parts_on_hand_value','ratio',{numerator:'parts_cogs',denominator:'avg_parts_on_hand_value'}),
  fni_penetration: m('fni_penetration','F&I Penetration','fni','deals','deals_with_fni / won_deals','percent',{numerator:'deals_with_fni',denominator:'won_deals',dims:[...C,'fni_manager','salesperson','new_used']}),
  employee_productivity: m('employee_productivity','Employee Productivity','people','deals+profiles','units_sold / active_employees','ratio',{numerator:'units_sold',denominator:'active_employees',dims:[...C,'role','tenure','shift','training_cohort']}),
  automation_roi: m('automation_roi','Automation ROI','automations','automations+deals','(influenced_gross - automation_cost) / automation_cost','ratio',{numerator:'influenced_gross_minus_cost',denominator:'automation_cost'}),
  ai_cost: m('ai_cost','AI Cost','automations','ai_usage','SUM(ai_usage.cost)','money',{dims:[...C,'employee']}),
  ai_influenced_revenue: m('ai_influenced_revenue','AI-Influenced Revenue','automations','ai_usage+deals','SUM(selling_price) WHERE ai_touched','money',{numerator:'ai_touched_revenue',dims:[...C,'salesperson','campaign']}),
  cpl: m('cpl','Cost Per Lead','marketing','marketing_campaigns+leads','spend / attributed_leads','money',{numerator:'spend',denominator:'attributed_leads',dims:[...C,'campaign','channel','source_medium']}),
  cost_per_appointment: m('cost_per_appointment','Cost Per Appointment','marketing','marketing_campaigns+appointments','spend / attributed_appointments','money',{numerator:'spend',denominator:'attributed_appointments',dims:[...C,'campaign','channel']}),
  cost_per_sale: m('cost_per_sale','Cost Per Sale','marketing','marketing_campaigns+deals','spend / attributed_units','money',{numerator:'spend',denominator:'attributed_units',dims:[...C,'campaign','channel']}),
  vdp_views: m('vdp_views','VDP Views','website','website_events','COUNT(events WHERE type = vdp_view)','count',{dims:[...C,...V]}),
  leads_per_vehicle: m('leads_per_vehicle','Leads Per Vehicle','inventory','leads+inventory','leads / vehicles','ratio',{numerator:'leads',denominator:'vehicles',dims:[...C,...V]}),
  untouched_leads: m('untouched_leads','Untouched Leads','crm','leads','COUNT(leads WHERE responded_at IS NULL AND status open)','count',{numerator:'untouched',dims:[...C,...R,'salesperson']}),
  overdue_followups: m('overdue_followups','Overdue Follow-Ups','crm','crm_tasks','COUNT(tasks WHERE done = false AND due_at < now)','count',{numerator:'overdue_tasks',dims:[...C,'salesperson','employee']})
})

export function listMetrics() { return Object.values(METRICS) }
export function getMetric(id) { return METRICS[id] || null }
export function assertApprovedMetricIds(ids = []) {
  const unknown = ids.filter((id) => !METRICS[id])
  if (unknown.length) {
    const err = new Error(`Unknown metric IDs: ${unknown.join(', ')}`)
    err.code = 'UNKNOWN_METRIC'
    throw err
  }
  return ids.map((id) => METRICS[id])
}
export function metricsCount() { return Object.keys(METRICS).length }
