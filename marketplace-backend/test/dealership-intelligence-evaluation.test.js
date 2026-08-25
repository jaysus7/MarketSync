/**
 * Dealership Intelligence & Decision Support Suite — Automated Evaluation Suite
 * Sections 448–603 / Phases 26–35
 * 
 * Verifies all 9 operational departments, digital twin relationships, attention prioritizer,
 * executive briefings, explainable health scores, blocker propagation, revenue leakage,
 * natural query contract, and the Section 601 North Star executive query scenario.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  createDealershipState,
  resolveDealershipGraph,
  calculatePriorityScore,
  evaluateDealershipAttention,
  processDealershipEvent,
  generateExecutiveMyDay,
  generateMorningBrief,
  generateEndOfDayBrief,
  detectDealershipDeltas,
  calculateDealershipHealth,
  generateOperationalForecasts,
  evaluateGoalVariance,
  traceBlockerPropagation,
  detectDealershipBottlenecks,
  analyzeProcessStepDurations,
  explainDealershipAnomaly,
  identifyCrossDepartmentSynergies,
  detectRevenueLeakage,
  prioritizeStrategicOpportunities,
  analyzeInventoryDemandAlignment,
  evaluateVehicleMerchandising,
  generateProcessCoachingInsights,
  evaluateServicePromiseRisk,
  evaluateAccountingCloseReadiness,
  queryDealershipIntelligence,
  simulateBusinessScenario,
  buildRoleControlTowerView,
  filterIntelligenceByRole,
  evaluateAuditReadiness,
  evaluateDealerGroupTransfers
} from '../services/dealership-intelligence/index.js'

describe('Dealership Intelligence & Decision Support Suite (Sections 448–603)', () => {
  // ── 1. Dealership State Model & Digital Twin (§449–451) ────────────────────
  describe('1. Dealership State Model & Digital Twin (§449–451)', () => {
    it('creates a complete canonical dealership state across all 9 workspaces', () => {
      const state = createDealershipState('dlr_test')
      assert.ok(state.sales, 'Sales operational state present')
      assert.ok(state.inventory, 'Inventory operational state present')
      assert.ok(state.fni, 'F&I operational state present')
      assert.ok(state.service, 'Service operational state present')
      assert.ok(state.parts, 'Parts operational state present')
      assert.ok(state.accounting, 'Accounting operational state present')
      assert.ok(state.hr, 'HR operational state present')
      assert.ok(state.marketing, 'Marketing operational state present')
      assert.ok(state.ai, 'AI operational state present')
      assert.equal(state.sales.month_to_date_units_sold, 41)
    })

    it('resolves relational connections in the digital twin graph without shadow DBs', () => {
      const graph = resolveDealershipGraph({
        repair_orders: [
          { id: 'RO-1', needed_parts: ['P-100'], status: 'BLOCKED_PARTS' },
          { id: 'RO-2', needed_parts: ['P-200'], status: 'IN_PROGRESS' }
        ],
        deals: [
          { id: 'D-1', status: 'DELIVERED_PENDING_FUNDING', customer: 'Alice' }
        ]
      })

      const blocked = graph.getROsBlockedByPart('P-100')
      assert.equal(blocked.length, 1)
      assert.equal(blocked[0].id, 'RO-1')

      const pendingFunding = graph.getDealsPendingFunding()
      assert.equal(pendingFunding.length, 1)
    })
  })

  // ── 2. Attention Engine, Event Stream & Priority Scorer (§452–454, §584–586) ──
  describe('2. Unified Attention Engine & Event Stream (§452–454)', () => {
    it('calculates reasoned multi-dimensional priority score into appropriate severity tiers', () => {
      const criticalPriority = calculatePriorityScore({
        customer_impact: 0.95,
        revenue_impact: 0.9,
        time_sensitivity: 0.95,
        financial_risk: 0.85
      })
      assert.equal(criticalPriority.tier, 'CRITICAL')
      assert.equal(criticalPriority.routing, 'INTERRUPT')

      const lowPriority = calculatePriorityScore({
        customer_impact: 0.2,
        revenue_impact: 0.1,
        time_sensitivity: 0.2,
        financial_risk: 0.1
      })
      assert.equal(lowPriority.tier, 'LOW')
      assert.equal(lowPriority.routing, 'REPORTING')
    })

    it('extracts prioritized operational attention items across departments', () => {
      const state = createDealershipState('dlr_test')
      const items = evaluateDealershipAttention(state)
      assert.ok(items.length >= 4, 'Multiple attention items detected')
      assert.ok(items[0].priority_score >= items[1].priority_score, 'Sorted by priority score descending')
      assert.ok(items.some(i => i.department === 'sales' && i.owner_role === 'sales_manager'))
      assert.ok(items.some(i => i.department === 'fni' && i.owner_role === 'fni_manager'))
    })

    it('updates state dynamically in response to canonical events', () => {
      const initial = createDealershipState('dlr_test')
      const updated = processDealershipEvent(initial, {
        type: 'deal.closed',
        payload: { deal_id: 'D-99', gross: 2400 }
      })
      assert.equal(updated.sales.month_to_date_units_sold, initial.sales.month_to_date_units_sold + 1)
      assert.equal(updated.sales.deliveries_today_count, initial.sales.deliveries_today_count + 1)
    })
  })

  // ── 3. Executive My Day, Briefings & "What Changed?" Engine (§455–459, §541) ─
  describe('3. Executive My Day, Briefings & Delta Engine (§455–459)', () => {
    it('generates executive My Day payload for Dealer Principal / GM', () => {
      const state = createDealershipState('dlr_test')
      const myDay = generateExecutiveMyDay(state)
      assert.equal(myDay.role, 'executive_gm')
      assert.ok(myDay.today.sales_appointments > 0)
      assert.ok(myDay.needs_attention.length > 0)
      assert.ok(myDay.opportunities.length > 0)
    })

    it('generates concise morning and end-of-day dealership briefings', () => {
      const state = createDealershipState('dlr_test')
      const morning = generateMorningBrief(state)
      assert.equal(morning.type, 'MORNING_BRIEF')
      assert.ok(morning.brief_text.includes('sales appointments'))
      assert.ok(morning.top_priorities.length > 0)

      const eod = generateEndOfDayBrief(state, { units_sold_today: 4 })
      assert.equal(eod.type, 'END_OF_DAY_BRIEF')
      assert.ok(eod.brief_text.includes('Units Sold Today: 4'))
    })

    it('detects and highlights only material operational changes in "What Changed?" engine', () => {
      const morningState = createDealershipState('dlr_test')
      const afternoonState = createDealershipState('dlr_test', {
        sales: { month_to_date_units_sold: 44 }, // +3 sales
        fni: { funding_over_3_days_count: 0 },   // funding delay resolved
        hr: { today_absences_count: 2 }          // +1 absence
      })

      const diff = detectDealershipDeltas(morningState, afternoonState)
      assert.equal(diff.material_changes_count, 3)
      assert.ok(diff.deltas.some(d => d.department === 'sales' && d.direction === 'POSITIVE'))
      assert.ok(diff.deltas.some(d => d.department === 'fni' && d.direction === 'POSITIVE'))
      assert.ok(diff.deltas.some(d => d.department === 'hr' && d.direction === 'NEGATIVE'))
    })
  })

  // ── 4. Explainable Health Scoring & Forecasts (§460–466, §568–570) ──────────
  describe('4. Explainable Health Scoring & Forecasting (§460–466)', () => {
    it('computes explainable departmental health scores with concrete reasons and actions', () => {
      const state = createDealershipState('dlr_test')
      const health = calculateDealershipHealth(state)
      assert.ok(health.composite_score > 0 && health.composite_score <= 100)
      assert.ok(health.department_scores.inventory.reasons.length > 0)
      assert.ok(health.department_scores.inventory.recommended_actions.length > 0)
      assert.ok(health.department_scores.service.reasons.length > 0)
    })

    it('generates probabilistic sales pace, service capacity, and cash flow forecasts', () => {
      const state = createDealershipState('dlr_test')
      const forecasts = generateOperationalForecasts(state, { remaining_selling_days: 8, elapsed_selling_days: 18 })
      assert.equal(forecasts.sales_pace.confidence, 'MEDIUM')
      assert.ok(forecasts.sales_pace.projected_range.includes('units'))
      assert.equal(forecasts.service_capacity.deficit_hours, 13)
      assert.ok(forecasts.cash_flow_signal.expected_cash_in > 0)
    })

    it('evaluates goal variance against target operating plan without hallucinating gap reasons', () => {
      const state = createDealershipState('dlr_test', { sales: { projected_month_units: 53 } })
      const variance = evaluateGoalVariance(state, { monthly_units_target: 60 })
      assert.equal(variance.variances.sales_units.gap, 7)
      assert.equal(variance.variances.sales_units.status, 'GAP_IDENTIFIED')
      assert.ok(variance.variances.sales_units.recommended_focus.length > 0)
    })
  })

  // ── 5. Cross-Department Blocker Propagation & Bottlenecks (§467–478, §548) ───
  describe('5. Cross-Department Blocker Propagation & Bottlenecks (§467–478)', () => {
    it('traces multi-step blocker propagation across Parts -> Service -> Accounting -> CSAT', () => {
      const propagation = traceBlockerPropagation({
        source_department: 'parts',
        blocker_type: 'PART_BACKORDERED',
        entity_id: 'PART-10492',
        details: { ro_number: '1842', ro_value: 1420 }
      })
      assert.equal(propagation.propagation_depth, 5)
      assert.equal(propagation.downstream_impact_chain[0].department, 'parts')
      assert.equal(propagation.downstream_impact_chain[1].department, 'service')
      assert.equal(propagation.downstream_impact_chain[3].department, 'accounting')
    })

    it('detects recon bottlenecks and calculates quantified tied-up capital', () => {
      const state = createDealershipState('dlr_test', { inventory: { avg_recon_days: 5.2, units_in_recon: 6 } })
      const bottlenecks = detectDealershipBottlenecks(state)
      assert.ok(bottlenecks.some(b => b.area.includes('Reconditioning') && b.quantified_impact.includes('$192,000')))
    })

    it('detects process step duration deviations vs historical benchmark', () => {
      const analysis = analyzeProcessStepDurations([
        { process_name: 'Vehicle Inspection', entity_id: 'RO-1842', duration_minutes: 134, benchmark_minutes: 35 },
        { process_name: 'Detailing', entity_id: 'STK-201', duration_minutes: 40, benchmark_minutes: 45 }
      ])
      assert.equal(analysis[0].status, 'DEVIATION_DETECTED')
      assert.equal(analysis[1].status, 'NORMAL')
    })

    it('articulates causal caution in structured anomaly explanation', () => {
      const explanation = explainDealershipAnomaly({
        metric: 'Service Revenue',
        direction: 'DOWN',
        magnitude_pct: 18
      })
      assert.ok(explanation.cautionary_note.includes('avoid attributing sole causality'))
      assert.ok(explanation.causal_explanation.includes('appears associated with'))
    })

    it('identifies cross-department synergies connecting Sales demand, Inventory shortages, and Marketing', () => {
      const state = createDealershipState('dlr_test')
      const synergies = identifyCrossDepartmentSynergies(state, { active_suv_requests: 7 })
      assert.equal(synergies.length, 1)
      assert.deepEqual(synergies[0].connected_departments, ['sales', 'inventory', 'marketing', 'acquisition'])
    })
  })

  // ── 6. Revenue Leakage & Inventory Demand Alignment (§479–489) ──────────────
  describe('6. Revenue Leakage & Inventory Demand Alignment (§479–489)', () => {
    it('detects legitimate revenue leakage across Sales, Service, Parts, and Accounting', () => {
      const state = createDealershipState('dlr_test')
      const leaks = detectRevenueLeakage(state)
      assert.ok(leaks.length >= 3)
      assert.ok(leaks.some(l => l.category === 'UNANSWERED_LEADS'))
      assert.ok(leaks.some(l => l.category === 'DECLINED_SERVICE_UNTOUCHED'))
      assert.ok(leaks.some(l => l.category === 'FUNDING_OVERDUE'))
    })

    it('prioritizes strategic opportunities by intent, value, timing, and feasibility', () => {
      const prioritized = prioritizeStrategicOpportunities([
        { id: 'opp_1', customer_intent_score: 0.9, potential_value: 4000, urgency_score: 0.9, feasibility_score: 0.9 },
        { id: 'opp_2', customer_intent_score: 0.3, potential_value: 500, urgency_score: 0.2, feasibility_score: 0.5 }
      ])
      assert.equal(prioritized[0].id, 'opp_1')
      assert.equal(prioritized[0].tier, 'HIGH_PRIORITY')
      assert.equal(prioritized[1].tier, 'LOW_PRIORITY')
    })

    it('matches customer demand with aged inventory and identifies missing stock', () => {
      const inventory = [
        { stock_number: 'STK-1822', year: 2024, make: 'GMC', model: 'Terrain', days_in_stock: 83, price: 34500 }
      ]
      const demands = [
        { make: 'GMC', model: 'Terrain', max_price: 38000 },
        { make: 'GMC', model: 'Terrain', max_price: 36000 },
        { is_unmet: true, matching_inventory_count: 0 }
      ]

      const result = analyzeInventoryDemandAlignment(inventory, demands)
      assert.equal(result.aged_inventory_with_live_demand.length, 1)
      assert.equal(result.aged_inventory_with_live_demand[0].active_matching_buyers_count, 2)
      assert.ok(result.missing_inventory_acquisition_signals.length > 0)
    })
  })

  // ── 7. Pricing Merchandising & Objective Coaching (§490–496, §503–514) ──────
  describe('7. Pricing Merchandising & Objective Coaching (§490–496, §503–514)', () => {
    it('evaluates vehicle pricing position and media completeness without autonomous repricing', () => {
      const review = evaluateVehicleMerchandising({
        stock_number: 'STK-2025A',
        year: 2025,
        make: 'Chevrolet',
        model: 'Tahoe LT',
        days_in_stock: 71,
        market_price_position_pct: 4.8,
        leads_30d: 2,
        photos_count: 14
      })
      assert.equal(review.price_review_required, true)
      assert.ok(review.pricing_recommendation.includes('Human approval required'))
      assert.ok(review.media_quality_score > 0)
    })

    it('generates objective coaching recommendations without personal or psychological profiling', () => {
      const coaching = generateProcessCoachingInsights({
        rep_id: 'emp_401',
        rep_name: 'James Wilson',
        appointments_set_mtd: 28,
        appointments_show_rate_pct: 48,
        overdue_promises_count: 1
      })
      assert.equal(coaching.coaching_insights.length, 2)
      assert.equal(coaching.coaching_insights[0].topic, 'Appointment Confirmation & Show Cadence')
      assert.ok(coaching.coaching_insights[0].suggested_action.includes('video confirmations'))
    })

    it('calculates service promise risk and checks High-Voltage EV certification dispatch', () => {
      const evRisk = evaluateServicePromiseRisk({
        ro_number: 'RO-1842',
        remaining_labor_hours: 2.1,
        parts_status: 'BACKORDERED',
        is_ev_vehicle: true,
        assigned_tech: { id: 'tech_12', certified_ev: false }
      })
      assert.equal(evRisk.is_at_risk, true)
      assert.equal(evRisk.risk_level, 'CRITICAL')
      assert.ok(evRisk.drivers.some(d => d.includes('High-Voltage EV')))
    })

    it('evaluates period accounting close readiness and flags hard blockers', () => {
      const closeAudit = evaluateAccountingCloseReadiness({
        month_name: 'August',
        unmatched_bank_recs: 2,
        unfunded_deals_count: 3,
        commission_exceptions_count: 1
      })
      assert.equal(closeAudit.is_close_blocked, true)
      assert.equal(closeAudit.blockers_count, 3)
      assert.ok(closeAudit.close_readiness_pct < 100)
    })
  })

  // ── 8. Control Tower Natural Query & Scenario Simulation (§528–531, §561–564) ─
  describe('8. Dealership Control Tower & Simulation Engine (§528–531, §561–564)', () => {
    it('answers natural dealership queries with Answer, Evidence, Confidence, Records, and Actions', () => {
      const state = createDealershipState('dlr_test')
      const res = queryDealershipIntelligence(state, 'What is slowing Service today?')
      assert.ok(res.answer.includes('Service is currently constrained'))
      assert.ok(res.evidence.length >= 2)
      assert.equal(res.confidence, 'HIGH')
      assert.ok(res.affected_records.length > 0)
      assert.ok(res.recommended_actions.length > 0)
    })

    it('answers unfunded deal queries with deterministic evidence and affected deal records', () => {
      const state = createDealershipState('dlr_test')
      const res = queryDealershipIntelligence(state, 'Which deals are delivered but not funded?')
      assert.ok(res.answer.includes('pending cash'))
      assert.equal(res.confidence, 'DETERMINISTIC')
      assert.equal(res.affected_records.length, 2)
    })

    it('simulates operational staffing scenarios (e.g. adding 1 service technician)', () => {
      const state = createDealershipState('dlr_test')
      const sim = simulateBusinessScenario(state, {
        type: 'ADD_TECHNICIAN',
        params: { technicians_count: 1 }
      })
      assert.equal(sim.scenario_type, 'STAFFING_SIMULATION')
      assert.equal(sim.simulated_outcome.projected_capacity_deficit, 5) // 13 - 8 = 5
      assert.ok(sim.disclaimer.includes('Simulation estimate'))
    })

    it('builds role-specific control tower views with selectable explanation depth', () => {
      const state = createDealershipState('dlr_test')
      const view = buildRoleControlTowerView(state, 'general_manager', 'DETAIL')
      assert.equal(view.user_role, 'general_manager')
      assert.equal(view.view_depth, 'DETAIL')
      assert.ok(view.primary_intel)
      assert.ok(view.department_summary)
    })
  })

  // ── 9. Governance, Field Security & Audit Readiness (§551–556, §577–580, §598) ─
  describe('9. Governance, Field Security & Audit Readiness (§577–580, §598)', () => {
    it('strictly redacts sensitive financial and HR fields from customer-facing AI and line staff', () => {
      const state = createDealershipState('dlr_test')
      const filteredForAI = filterIntelligenceByRole(state, 'customer_facing_ai')
      assert.equal(filteredForAI.accounting, undefined)
      assert.equal(filteredForAI.hr, undefined)
      assert.equal(filteredForAI.needs_attention, undefined)

      const filteredForSalesperson = filterIntelligenceByRole(state, 'salesperson')
      assert.equal(filteredForSalesperson.accounting?.cash_position_available, undefined)
    })

    it('evaluates comprehensive audit readiness across HR, Accounting, and F&I stips', () => {
      const state = createDealershipState('dlr_test')
      const audit = evaluateAuditReadiness(state)
      assert.equal(audit.status, 'EXCEPTIONS_IDENTIFIED')
      assert.ok(audit.findings.some(f => f.category === 'HR_COMPLIANCE'))
      assert.ok(audit.findings.some(f => f.category === 'FNI_COMPLIANCE'))
    })

    it('suggests multi-store vehicle transfers to accelerate turn with human approval required', () => {
      const locations = [
        { name: 'MarketSync North', unmet_suv_demand_count: 5 },
        { name: 'MarketSync South', aged_suv_units_count: 2 }
      ]
      const transfers = evaluateDealerGroupTransfers(locations)
      assert.equal(transfers.length, 1)
      assert.equal(transfers[0].requires_human_approval, true)
      assert.ok(transfers[0].reason.includes('MarketSync South'))
    })
  })

  // ── 10. Section 601 North Star End-to-End Dealership Intelligence Scenario ───
  describe('10. Section 601 North Star End-to-End Scenario (§601, §602, §603)', () => {
    it('executes the complete Section 601 Dealer Principal "What should I know right now?" scenario', () => {
      const state = createDealershipState('dlr_north_star')
      const answer = queryDealershipIntelligence(state, 'What should I know right now?', 'dealer_principal')

      // 1. Core 3 Attention Points
      assert.ok(answer.answer.includes('4 hot leads waiting over 10 minutes'))
      assert.ok(answer.answer.includes('3 ROs at risk of missing promise time'))
      assert.ok(answer.answer.includes('$92,000 in delivered deals remains unfunded'))

      // 2. High-Intent Commercial Opportunity
      assert.ok(answer.answer.includes('Seven active customers are looking for AWD SUVs under $40k'))

      // 3. Normal Baseline
      assert.ok(answer.answer.includes('Everything else is operating within normal range') || answer.answer.includes('within normal ranges'))

      // 4. Traceable Evidence & 1-Click Affected Records
      assert.ok(answer.evidence.length >= 4)
      assert.equal(answer.affected_records.length, 3)
      assert.ok(answer.affected_records.some(r => r.id === 'SALES-HOT-QUEUE'))
      assert.ok(answer.affected_records.some(r => r.id === 'RO-PROMISE-RISK'))
      assert.ok(answer.affected_records.some(r => r.id === 'UNFUNDED-DEALS'))

      // 5. Recommended Actions
      assert.ok(answer.recommended_actions.length >= 3)
    })
  })
})
