/**
 * MarketSync Reporting — canonical dimension registry.
 * Sensitive demographic dimensions are omitted unless lawfully collected and approved.
 */

export const DIMENSIONS = Object.freeze({
  dealership: { id: 'dealership', group: 'organization', source: 'dealerships.id', pii: false },
  rooftop: { id: 'rooftop', group: 'organization', source: 'stores.id', pii: false },
  department: { id: 'department', group: 'organization', source: 'profiles.department', pii: false },
  team: { id: 'team', group: 'organization', source: 'profiles.team_id', pii: false },
  employee: { id: 'employee', group: 'organization', source: 'profiles.id', pii: true },
  manager: { id: 'manager', group: 'organization', source: 'profiles.manager_id', pii: true },
  salesperson: { id: 'salesperson', group: 'organization', source: 'deals.created_by|leads.assigned_to', pii: true },

  vin: { id: 'vin', group: 'vehicle', source: 'inventory.vin', pii: false },
  stock_number: { id: 'stock_number', group: 'vehicle', source: 'inventory.stock_number', pii: false },
  make: { id: 'make', group: 'vehicle', source: 'inventory.make', pii: false },
  model: { id: 'model', group: 'vehicle', source: 'inventory.model', pii: false },
  trim: { id: 'trim', group: 'vehicle', source: 'inventory.trim', pii: false },
  model_year: { id: 'model_year', group: 'vehicle', source: 'inventory.year', pii: false },
  body_style: { id: 'body_style', group: 'vehicle', source: 'inventory.body_style', pii: false },
  exterior_colour: { id: 'exterior_colour', group: 'vehicle', source: 'inventory.exterior_color', pii: false },
  interior_colour: { id: 'interior_colour', group: 'vehicle', source: 'inventory.interior_color', pii: false },
  fuel_type: { id: 'fuel_type', group: 'vehicle', source: 'inventory.fuel_type', pii: false },
  drivetrain: { id: 'drivetrain', group: 'vehicle', source: 'inventory.drivetrain', pii: false },
  transmission: { id: 'transmission', group: 'vehicle', source: 'inventory.transmission', pii: false },
  engine: { id: 'engine', group: 'vehicle', source: 'inventory.engine', pii: false },
  new_used: { id: 'new_used', group: 'vehicle', source: 'inventory.condition', pii: false },
  mileage_band: { id: 'mileage_band', group: 'vehicle', source: 'derived:mileage', pii: false },
  price_band: { id: 'price_band', group: 'vehicle', source: 'derived:price', pii: false },
  payment_band: { id: 'payment_band', group: 'vehicle', source: 'derived:payment', pii: false },
  gross_band: { id: 'gross_band', group: 'vehicle', source: 'derived:gross', pii: false },
  acquisition_source: { id: 'acquisition_source', group: 'vehicle', source: 'inventory.acquisition_source', pii: false },
  inventory_age: { id: 'inventory_age', group: 'vehicle', source: 'derived:lot_age', pii: false },

  lead_source: { id: 'lead_source', group: 'crm', source: 'leads.source|contacts.source', pii: false },
  campaign: { id: 'campaign', group: 'marketing', source: 'marketing_campaigns.id', pii: false },
  channel: { id: 'channel', group: 'marketing', source: 'leads.channel|campaigns.channel', pii: false },
  opportunity_stage: { id: 'opportunity_stage', group: 'crm', source: 'contacts.status', pii: false },
  customer_cohort: { id: 'customer_cohort', group: 'crm', source: 'derived:first_purchase_month', pii: false },
  geography: { id: 'geography', group: 'crm', source: 'contacts.city|province', pii: false },
  repeat_new: { id: 'repeat_new', group: 'crm', source: 'derived:prior_deal', pii: false },
  referral: { id: 'referral', group: 'crm', source: 'contacts.referral', pii: false },
  trade_no_trade: { id: 'trade_no_trade', group: 'crm', source: 'deals.has_trade', pii: false },
  contact_method: { id: 'contact_method', group: 'crm', source: 'communications.channel', pii: false },

  hour: { id: 'hour', group: 'time', source: 'EXTRACT(HOUR FROM event_at AT TIME ZONE dealer_tz)', pii: false },
  day: { id: 'day', group: 'time', source: 'DATE(event_at AT TIME ZONE dealer_tz)', pii: false },
  weekday: { id: 'weekday', group: 'time', source: 'DOW(event_at AT TIME ZONE dealer_tz)', pii: false },
  week: { id: 'week', group: 'time', source: 'DATE_TRUNC(week)', pii: false },
  month: { id: 'month', group: 'time', source: 'DATE_TRUNC(month)', pii: false },
  quarter: { id: 'quarter', group: 'time', source: 'DATE_TRUNC(quarter)', pii: false },
  year: { id: 'year', group: 'time', source: 'DATE_TRUNC(year)', pii: false },
  season: { id: 'season', group: 'time', source: 'derived:northern_meteorological_season', pii: false },
  fiscal_period: { id: 'fiscal_period', group: 'time', source: 'dealerships.fiscal_calendar', pii: false },
  time_since_lead: { id: 'time_since_lead', group: 'time', source: 'derived:now-lead.created_at', pii: false },
  time_since_acquisition: { id: 'time_since_acquisition', group: 'time', source: 'derived:now-inventory.acquired_at', pii: false },
  time_since_last_contact: { id: 'time_since_last_contact', group: 'time', source: 'derived:now-last_touch', pii: false },

  ad_set: { id: 'ad_set', group: 'marketing', source: 'ad_sets.id', pii: false },
  ad: { id: 'ad', group: 'marketing', source: 'ads.id', pii: false },
  creative: { id: 'creative', group: 'marketing', source: 'creatives.id', pii: false },
  keyword: { id: 'keyword', group: 'marketing', source: 'ad_insights.keyword', pii: false },
  landing_page: { id: 'landing_page', group: 'marketing', source: 'website_events.path', pii: false },
  source_medium: { id: 'source_medium', group: 'marketing', source: 'leads.source_medium', pii: false },
  attribution_model: { id: 'attribution_model', group: 'marketing', source: 'query.attribution_model', pii: false },

  advisor: { id: 'advisor', group: 'service', source: 'repair_orders.advisor_id', pii: true },
  technician: { id: 'technician', group: 'service', source: 'repair_orders.technician_id', pii: true },
  ro_type: { id: 'ro_type', group: 'service', source: 'repair_orders.ro_type', pii: false },
  repair_category: { id: 'repair_category', group: 'service', source: 'repair_orders.category', pii: false },
  vehicle_age: { id: 'vehicle_age', group: 'service', source: 'derived:year', pii: false },

  role: { id: 'role', group: 'people', source: 'profiles.role', pii: false },
  tenure: { id: 'tenure', group: 'people', source: 'derived:hire_date', pii: false },
  shift: { id: 'shift', group: 'people', source: 'time_clock.shift', pii: false },
  training_cohort: { id: 'training_cohort', group: 'people', source: 'academy.cohort_id', pii: false },
  certification_state: { id: 'certification_state', group: 'people', source: 'academy.certification_state', pii: false },
  fni_manager: { id: 'fni_manager', group: 'organization', source: 'deals.fni_manager', pii: true }
})

export const SEASON_BY_MONTH = Object.freeze({
  1: 'winter', 2: 'winter', 3: 'spring', 4: 'spring', 5: 'spring',
  6: 'summer', 7: 'summer', 8: 'summer', 9: 'fall', 10: 'fall', 11: 'fall', 12: 'winter'
})

export function seasonFromIso(iso, timeZone = 'America/Toronto') {
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const month = Number(new Intl.DateTimeFormat('en-CA', { timeZone, month: 'numeric' }).format(d))
  return SEASON_BY_MONTH[month] || null
}

export function listDimensions() {
  return Object.values(DIMENSIONS)
}

export function getDimension(id) {
  return DIMENSIONS[id] || null
}

export function assertApprovedDimensions(ids = [], metric) {
  const unknown = ids.filter((id) => !DIMENSIONS[id])
  if (unknown.length) {
    const err = new Error(`Unknown dimension IDs: ${unknown.join(', ')}`)
    err.code = 'UNKNOWN_DIMENSION'
    throw err
  }
  if (metric?.allowed_dimensions) {
    const disallowed = ids.filter((id) => !metric.allowed_dimensions.includes(id))
    if (disallowed.length) {
      const err = new Error(`Dimensions not allowed for ${metric.id}: ${disallowed.join(', ')}`)
      err.code = 'DIMENSION_NOT_ALLOWED'
      throw err
    }
  }
  return ids.map((id) => DIMENSIONS[id])
}

export function dimensionsCount() {
  return Object.keys(DIMENSIONS).length
}
