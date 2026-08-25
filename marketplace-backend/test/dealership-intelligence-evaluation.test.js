/**
 * Dealership Intelligence & Decision Support Suite — Complete Evaluation Suite
 * Sections 448–905 / Phases 26–50
 * 
 * Verifies all operational departments, digital twin, attention engine, causal operating model,
 * driver trees, Theory of Constraints, multi-objective decision matrix, controlled experiments,
 * strategic playbooks, risk register, semantic query planner, collision prevention,
 * and the Section 900 Ultimate North Star closed-loop lifecycle.
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
  evaluateDealerGroupTransfers,
  rankRootCauses,
  analyzeVarianceContribution,
  simulateCounterfactual,
  evaluateDriverTree,
  identifySystemConstraint,
  evaluateDecisionMatrix,
  analyzeWorkflowFlowEfficiency,
  createDealershipExperiment,
  evaluateExperimentResults,
  recordManagementDecision,
  evaluateDecisionOutcome,
  evaluateStrategicAlignment,
  generateMeetingBriefing,
  evaluateOperationalPlaybooks,
  evaluateOperationalRiskRegister,
  evaluateControlExceptions,
  translateTechnicalIncident,
  planSemanticAnalyticsQuery,
  evaluateOutreachCollisionGuard,
  validateAgentAction,
  querySingleBiggestConstraint,
  executeClosedLoopIntervention,
  CANONICAL_METRICS,
  NON_NEGOTIABLE_HUMAN_ACTIONS
} from '../services/dealership-intelligence/index.js'

describe('Dealership Intelligence & Decision Support Platform (Sections 448–905)', () => {
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
        sales: { month_to_date_units_sold: 44 },
        fni: { funding_over_3_days_count: 0 },
        hr: { today_absences_count: 2 }
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
      assert.equal(sim.simulated_outcome.projected_capacity_deficit, 5)
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

      assert.ok(answer.answer.includes('4 hot leads waiting over 10 minutes'))
      assert.ok(answer.answer.includes('3 ROs at risk of missing promise time'))
      assert.ok(answer.answer.includes('$92,000 in delivered deals remains unfunded'))
      assert.ok(answer.answer.includes('Seven active customers are looking for AWD SUVs under $40k'))
      assert.ok(answer.evidence.length >= 4)
      assert.equal(answer.affected_records.length, 3)
      assert.ok(answer.recommended_actions.length >= 3)
    })
  })

  // ── 11. Causal Operating Model, Driver Trees & Counterfactuals (§604–608, §650–657) ──
  describe('11. Causal Operating Model & Driver Trees (§604–608, §650–657)', () => {
    it('ranks root causes for KPI movement without raw correlation confusion', () => {
      const rootCause = rankRootCauses({
        metric_name: 'Sales Pace',
        change_pct: -14,
        observed_factors: [
          { name: 'Appointment Volume', change_pct: -18, sensitivity: 0.8 },
          { name: 'Lead Response Time', change_pct: +116, sensitivity: 0.75 }
        ]
      })
      assert.equal(rootCause.primary_suspect, 'Lead Response Time')
      assert.ok(rootCause.ranked_contributors.length >= 2)
      assert.equal(rootCause.ranked_contributors[0].relationship_type, 'CAUSAL_EMPIRICAL')
    })

    it('performs mathematically supportable contribution analysis on variances', () => {
      const contribution = analyzeVarianceContribution({
        metric: 'Service Gross',
        variance_amount: -18400
      })
      assert.equal(contribution.contributions[0].contribution_pct, 55)
      assert.equal(contribution.contributions[0].relative_weight, 'MAJOR')
    })

    it('executes counterfactual simulation clearly marked as simulation', () => {
      const sim = simulateCounterfactual({
        current_response_time_minutes: 11,
        actual_appointments_booked: 42,
        target_response_time_minutes: 4.5
      })
      assert.equal(sim.is_simulation, true)
      assert.ok(sim.disclaimer.includes('SIMULATION ONLY'))
      assert.ok(sim.simulated_total_appointments > 42)
    })

    it('detects value stream chain breaks in drillable executive driver trees', () => {
      const driverTree = evaluateDriverTree('SALES', {
        leads: 120,
        response_time_min: 11.5,
        appointments: 24,
        shows: 18,
        sales: 5
      })
      assert.equal(driverTree.chain_break_assessment.break_detected, true)
      assert.equal(driverTree.chain_break_assessment.location, 'LEAD_CREATION_TO_FIRST_RESPONSE')
    })
  })

  // ── 12. Theory of Constraints & Flow Efficiency (§609–620, §821–832) ───────
  describe('12. Theory of Constraints & Flow Efficiency (§609–620, §821–832)', () => {
    it('identifies the active system constraint, workload, relief, and next constraint shift', () => {
      const state = createDealershipState('dlr_test', {
        sales: { avg_response_time_minutes: 11.0 }
      })
      const constraint = identifySystemConstraint(state)
      assert.equal(constraint.current_constraint, 'SALES_LEAD_RESPONSE_CAPACITY')
      assert.ok(constraint.relief_options.length >= 2)
      assert.equal(constraint.expected_next_constraint, 'SHOWROOM_APPOINTMENT_CAPACITY')
    })

    it('scores decision options across multiple balanced dimensions in decision matrix', () => {
      const matrix = evaluateDecisionMatrix('SERVICE_CAPACITY_DEFICIT')
      assert.equal(matrix.evaluated_options.length, 2)
      assert.ok(matrix.evaluated_options[0].composite_score > 0)
      assert.ok(matrix.evaluated_options[0].tradeoff_note)
    })

    it('calculates workflow flow efficiency comparing active work vs waiting time', () => {
      const flow = analyzeWorkflowFlowEfficiency(5.2, 18.6)
      assert.equal(flow.flow_efficiency_pct, 21.8)
      assert.equal(flow.primary_wait_bottleneck, 'WAITING_PART')
    })
  })

  // ── 13. Controlled Experiments & Decision Memory (§621–625, §732–739) ───────
  describe('13. Controlled Experiments & Decision Memory (§621–625, §732–739)', () => {
    it('strictly blocks illegal experiments on credit approval or pricing discrimination', () => {
      assert.throws(() => {
        createDealershipExperiment({ domain: 'CREDIT_APPROVAL' })
      }, /SAFETY VIOLATION/)
    })

    it('evaluates controlled experiment results with sample sizes and lift verification', () => {
      const exp = createDealershipExperiment({ title: 'Lead Overflow Experiment' })
      const results = evaluateExperimentResults(exp, {
        control_sample_size: 140,
        variant_sample_size: 142,
        control_conversions: 31,
        variant_conversions: 44
      })
      assert.equal(results.status, 'COMPLETED')
      assert.equal(results.lift.absolute_pct, 8.9)
      assert.ok(results.recommendation.includes('Promote variant'))
    })

    it('records and evaluates decision memory follow-up outcome against baseline', () => {
      const decision = recordManagementDecision({
        decision: 'Reduced recon threshold to 3 days',
        approver: 'Jason M.'
      })
      const outcome = evaluateDecisionOutcome(decision, { baseline_value: 5.2, actual_value: 3.8 })
      assert.equal(outcome.verdict, 'DECISION_SUCCESSFUL')
      assert.equal(outcome.improvement_delta, 1.4)
    })
  })

  // ── 14. Strategic Priorities, Rhythms & Playbooks (§626–649, §816–820) ───────
  describe('14. Strategic Priorities, Rhythms & Playbooks (§626–649, §816–820)', () => {
    it('evaluates strategic priority alignment and flags conflicting operational reality', () => {
      const state = createDealershipState('dlr_test', { inventory: { avg_recon_days: 5.2, units_in_recon: 6 } })
      const alignment = evaluateStrategicAlignment(state)
      assert.equal(alignment.has_conflicts, true)
      assert.ok(alignment.operational_conflicts[0].conflict_statement.includes('Priority #1'))
    })

    it('generates meeting-specific briefings for daily Sales and Service huddles', () => {
      const state = createDealershipState('dlr_test')
      const salesHuddle = generateMeetingBriefing('SALES_MEETING', state)
      assert.equal(salesHuddle.meeting_type, 'SALES_HUDDLE')
      assert.ok(salesHuddle.topics.length >= 4)

      const serviceHuddle = generateMeetingBriefing('SERVICE_HUDDLE', state)
      assert.equal(serviceHuddle.meeting_type, 'SERVICE_DISPATCH_HUDDLE')
      assert.ok(serviceHuddle.topics.some(t => t.includes('Booked Hours')))
    })

    it('executes operational playbooks and detects orphaned unassigned records', () => {
      const state = createDealershipState('dlr_test')
      const records = [
        { id: 'lead_1', type: 'lead', assigned_employee_id: 'UNASSIGNED', label: 'Inbound Equinox Lead' },
        { id: 'ro_1', type: 'ro', assigned_employee_id: 'emp_2', label: 'RO #1842' }
      ]
      const playbooks = evaluateOperationalPlaybooks(state, records)
      assert.ok(playbooks.active_playbooks.length > 0)
      assert.equal(playbooks.orphaned_work_count, 1)
      assert.equal(playbooks.orphaned_records[0].record_id, 'lead_1')
    })
  })

  // ── 15. Operational Risk Register & Control Signals (§658–670, §835–846) ────
  describe('15. Operational Risk Register & Control Signals (§658–670, §835–846)', () => {
    it('compiles multi-department risk register with probability, impact, and blast radius', () => {
      const state = createDealershipState('dlr_test')
      const riskRegister = evaluateOperationalRiskRegister(state)
      assert.ok(riskRegister.total_active_risks >= 3)
      assert.ok(riskRegister.risks.some(r => r.category === 'FINANCIAL' && r.blast_radius.affected_deals_count > 0))
    })

    it('articulates neutral, non-accusatory review statements for control anomalies', () => {
      const exceptions = evaluateControlExceptions([
        { id: 'exc_1', control_area: 'ACCOUNTS_RECEIVABLE', pattern: 'Duplicate receipt attempt' }
      ])
      assert.equal(exceptions[0].requires_escalation, true)
      assert.ok(exceptions[0].neutral_review_statement.includes('Unusual pattern detected'))
    })

    it('translates technical system incidents into concrete business impact', () => {
      const incident = translateTechnicalIncident({
        service_name: 'Inventory Syndication Feed',
        duration_hours: 3.5
      })
      assert.ok(incident.business_impact_translation.impact_summary.includes('27 vehicle price and status updates pending'))
    })
  })

  // ── 16. Semantic Layer, Query Planner & Human Boundary (§671–689, §809, §904) ─
  describe('16. Semantic Layer & Non-Negotiable Human Authority (§671–689, §809, §904)', () => {
    it('plans safe semantic metric queries without arbitrary SQL generation', () => {
      const plan = planSemanticAnalyticsQuery('What was our lead response time?')
      assert.equal(plan.query_plan.tool, 'metric.get')
      assert.equal(plan.query_plan.metric, CANONICAL_METRICS.LEAD_RESPONSE_TIME.key)
      assert.equal(plan.query_plan.safe_execution, true)
    })

    it('governs customer communication frequency and prevents cross-department message collisions', () => {
      const guard = evaluateOutreachCollisionGuard('cust_100', {
        department: 'marketing',
        recent_outreach_history: [
          { timestamp: new Date().toISOString(), department: 'sales', channel: 'SMS' }
        ]
      })
      assert.equal(guard.collision_detected, true)
      assert.equal(guard.verdict, 'SUPPRESS_OUTREACH')
      assert.ok(guard.reason.includes('Suppressing marketing outreach'))
    })

    it('enforces non-negotiable human authority boundaries on consequential decisions', () => {
      const priceAction = validateAgentAction({
        action_type: 'BINDING_VEHICLE_PRICE_CONCESSION'
      })
      assert.equal(priceAction.allowed, false)
      assert.equal(priceAction.escalation_tier, 'HUMAN_AUTHORITY_REQUIRED')

      const creditAction = validateAgentAction({
        action_type: 'BINDING_CREDIT_DECISION_OR_APPROVAL'
      })
      assert.equal(creditAction.allowed, false)

      const routineAction = validateAgentAction({
        action_type: 'SEND_APPOINTMENT_CONFIRMATION',
        is_routine_approved: true
      })
      assert.equal(routineAction.allowed, true)
      assert.equal(routineAction.escalation_tier, 'ROUTINE_AUTOMATED')
    })
  })

  // ── 17. Section 900 Ultimate Dealership Intelligence North Star Journey (§900–905) ──
  describe('17. Section 900 Ultimate Dealership Intelligence North Star (§900–905)', () => {
    it('answers "What is the single biggest thing holding us back right now?" with exact Section 900 contract', () => {
      const state = createDealershipState('dlr_test', {
        sales: { avg_response_time_minutes: 11.0 }
      })
      const constraint = querySingleBiggestConstraint(state)

      assert.equal(constraint.current_constraint, 'Sales lead response')
      assert.ok(constraint.evidence.some(e => e.includes('Lead response median rose from 4m to 11m')))
      assert.ok(constraint.evidence.some(e => e.includes('Appointment-set rate fell from 31% to 22%')))
      assert.ok(constraint.evidence.some(e => e.includes('4:00 PM and 7:00 PM')))
      assert.ok(constraint.options.length === 3)
      assert.ok(constraint.recommendation.includes('Test real-time overflow routing (Option B) for a 7-day controlled trial'))
      assert.equal(constraint.confidence, 'HIGH')
      assert.ok(constraint.measurement_plan.primary_metric.includes('Appointment-set rate'))
    })

    it('executes the full closed-loop lifecycle: Detect -> Recommend -> Intervene -> Verify Outcome (§900, §905)', () => {
      const state = createDealershipState('dlr_test', {
        sales: { avg_response_time_minutes: 11.0 }
      })
      const closedLoop = executeClosedLoopIntervention(state)

      assert.equal(closedLoop.lifecycle_status, 'CLOSED_LOOP_VERIFIED')
      assert.ok(closedLoop.diagnostic)
      assert.equal(closedLoop.active_intervention.domain, 'LEAD_RESPONSE_WORKFLOW')
      assert.equal(closedLoop.verified_outcome.lift.absolute_pct, 8.9)
      assert.ok(closedLoop.closure_summary.includes('increased appointment-set rate by +8.9%'))
    })
  })
})
