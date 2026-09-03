/**
 * AI maps language onto the semantic layer. It does not calculate financial truth.
 */

import { METRICS, getMetric } from './metric-registry.js'
import { DIMENSIONS } from './dimension-registry.js'
import { buildReportPlan } from './query-engine.js'

const METRIC_ALIASES = [
  [/units? sold|sold units|deliveries/i, 'units_sold'],
  [/revenue|sales dollars/i, 'revenue'],
  [/front gross/i, 'front_gross'],
  [/back gross|f&i gross|fni gross/i, 'back_gross'],
  [/total gross/i, 'total_gross'],
  [/close rate|conversion/i, 'close_rate'],
  [/appointment rate/i, 'appointment_rate'],
  [/show rate/i, 'show_rate'],
  [/response time|speed to lead/i, 'response_time'],
  [/follow-?up/i, 'followup_completion_rate'],
  [/video send/i, 'video_send_rate'],
  [/video view/i, 'video_view_rate'],
  [/video to sale|video.*sale/i, 'video_to_sale_rate'],
  [/days to sell|days on lot/i, 'days_to_sell'],
  [/inventory turn|turn rate/i, 'inventory_turn'],
  [/roas/i, 'roas'],
  [/cac|cost per acqui/i, 'cac'],
  [/cpl|cost per lead/i, 'cpl'],
  [/f&i pen|fni pen/i, 'fni_penetration'],
  [/untouched/i, 'untouched_leads'],
  [/overdue/i, 'overdue_followups'],
  [/ai cost/i, 'ai_cost'],
  [/service revenue/i, 'service_revenue']
]

const DIM_ALIASES = [
  [/sales ?people|salesperson|rep\b/i, 'salesperson'],
  [/make\b/i, 'make'],
  [/model\b/i, 'model'],
  [/colour|color/i, 'exterior_colour'],
  [/season/i, 'season'],
  [/lead source|source/i, 'lead_source'],
  [/campaign/i, 'campaign'],
  [/hour|time of day/i, 'hour'],
  [/weekday|day of week/i, 'weekday'],
  [/month/i, 'month'],
  [/channel/i, 'channel']
]

function pickMetrics(question) {
  const hits = []
  for (const [re, id] of METRIC_ALIASES) {
    if (re.test(question) && METRICS[id] && !hits.includes(id)) hits.push(id)
  }
  return hits.length ? hits : ['units_sold']
}

function pickDimensions(question) {
  const hits = []
  for (const [re, id] of DIM_ALIASES) {
    if (re.test(question) && DIMENSIONS[id] && !hits.includes(id)) hits.push(id)
  }
  return hits.slice(0, 5)
}

function pickFilters(question) {
  const filters = {}
  const leadN = question.match(/more than (\d+)\s+internet leads/i)
  if (leadN) filters.min_internet_leads = Number(leadN[1])
  const resp = question.match(/slower than (\d+)\s+minutes/i)
  if (resp) filters.min_response_minutes = Number(resp[1])
  const vids = question.match(/fewer than (\d+).*video/i)
  if (vids) filters.max_personalized_videos = Number(vids[1])
  if (/last month/i.test(question)) filters.relative_range = 'last_month'
  if (/\bused\b/i.test(question)) filters.new_used = 'used'
  const price = question.match(/\$?(\d+)\s*k?\s*[\u2013-]\s*\$?(\d+)\s*k/i)
  if (price) filters.price_band = `${price[1]}K-${price[2]}K`
  return filters
}

export function interpretReportingQuestion(question = '', ctx = {}) {
  if (ctx.requested_metric_ids) {
    for (const id of ctx.requested_metric_ids) {
      if (!getMetric(id)) {
        const err = new Error(`AI cannot invent metric IDs: ${id}`)
        err.code = 'UNKNOWN_METRIC'
        throw err
      }
    }
  }
  if (ctx.requested_tables) {
    const err = new Error('AI cannot access unapproved tables')
    err.code = 'UNAPPROVED_TABLE'
    throw err
  }

  const metric_ids = ctx.requested_metric_ids || pickMetrics(question)
  const dimensions = pickDimensions(question)
  const filters = pickFilters(question)
  const plan = buildReportPlan({
    metric_ids,
    dimensions,
    filters,
    date_range: filters.relative_range === 'last_month' ? { days: 30 } : { days: 30 },
    visualization: dimensions.length ? 'table' : 'kpi',
    comparison: /below store average|vs store|compared/i.test(question) ? 'benchmark' : null
  })

  return {
    question,
    definition: {
      name: question.slice(0, 140),
      description: 'AI-interpreted report. Values are computed only by the semantic engine.',
      metric_ids: plan.metric_ids,
      default_dimensions: plan.dimensions,
      filters: plan.filters,
      date_range: plan.date_range,
      comparison: plan.comparison,
      visualization: plan.visualization,
      origin: 'ai_query_layer'
    },
    plan,
    explanation: 'Selected approved metric IDs and dimensions from the registries. No values were invented.',
    constraints: {
      calculates_financial_truth: false,
      invents_values: false,
      may_query_arbitrary_tables: false,
      may_bypass_permissions: false,
      may_claim_causation: false
    }
  }
}
