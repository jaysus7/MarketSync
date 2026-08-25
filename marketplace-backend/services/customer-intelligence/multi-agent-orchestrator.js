/**
 * MarketSync Customer Intelligence — Multi-Agent Orchestration & Persona Engine.
 *
 * Implements specialized internal agents with narrow contracts, coordinated by a central orchestrator:
 * - ConversationAgent (customer language)
 * - IntentAgent (classification & journey)
 * - ObjectionAgent (detection & root-cause)
 * - ProductMatchAgent (inventory fit)
 * - FinanceAssistAgent (payment & pre-qual education)
 * - TradeAgent (appraisal & payoff context)
 * - AppointmentAgent (calendar slots)
 * - CustomerMemoryAgent (continuity & facts)
 * - HandoffAgent (escalation & routing)
 * - QualityAgent (truth verification & policy compliance)
 *
 * Supports digital employee personas: Avery (Sales), Mia (Service), Alex (Reception).
 */

export const DIGITAL_PERSONAS = {
  AVERY_SALES: {
    id: 'avery_sales',
    name: 'Avery',
    department: 'Sales',
    role: 'Digital Sales Consultant',
    tone: 'consultative, knowledgeable, friendly, transparent',
    avatar: '/assets/avatars/avery.png',
  },
  MIA_SERVICE: {
    id: 'mia_service',
    name: 'Mia',
    department: 'Service',
    role: 'Service Concierge',
    tone: 'efficient, helpful, empathetic, clear',
    avatar: '/assets/avatars/mia.png',
  },
  ALEX_RECEPTION: {
    id: 'alex_reception',
    name: 'Alex',
    department: 'Reception',
    role: 'Dealership Host',
    tone: 'warm, welcoming, concise',
    avatar: '/assets/avatars/alex.png',
  },
}

/**
 * Runs specialized internal agent evaluations in parallel and aggregates structured specialist results.
 */
export async function runOrchestrationGraph(context = {}) {
  const { message, customerState, tools = {}, inventory = [], dealership = {} } = context
  const startTime = Date.now()

  // 1. Parallel Specialist Evaluations
  const [
    intentResult,
    objectionResult,
    productResult,
    financeResult,
    tradeResult,
    memoryResult,
  ] = await Promise.all([
    // Intent Agent
    (async () => {
      const lower = (message || '').toLowerCase()
      let primary = 'general_inquiry'
      if (/\b(service|oil change|brakes|maintenance)\b/i.test(lower)) {
        primary = 'service_inquiry'
      } else if (/\b(speak to someone|real person|human|sales rep|call me)\b/i.test(lower)) {
        primary = 'human_request'
      } else if (/\b(test drive|appointment|come in|visit|saturday)\b/i.test(lower)) {
        primary = 'appointment_request'
      } else if (/\b(available|in stock|look at|inventory|see)\b/i.test(lower)) {
        primary = 'vehicle_availability'
      } else if (/\b(payment|per month|\/mo|down|budget)\b/i.test(lower)) {
        primary = 'payment_affordability'
      } else if (/\b(trade|owe|payoff|carfax)\b/i.test(lower)) {
        primary = 'trade_inquiry'
      }
      return { agent: 'IntentAgent', primary_intent: primary }
    })(),

    // Objection Agent
    (async () => {
      const lower = (message || '').toLowerCase()
      let objection = null
      if (/\b(too much|too high|expensive|cannot afford|out of my budget)\b/i.test(lower)) {
        objection = { type: 'payment_too_high', label: 'Payment/Price Affordability' }
      }
      return { agent: 'ObjectionAgent', objection }
    })(),

    // Product Match Agent
    (async () => {
      const matched = (inventory || []).filter(v => v.status === 'available').slice(0, 3)
      return { agent: 'ProductMatchAgent', candidate_count: matched.length, top_candidates: matched }
    })(),

    // Finance Assist Agent
    (async () => {
      const mentionsPmt = /\b(\$?\d{2,4}\s*(?:\/|\s*a\s*|\s*per\s*)?mo|payment)\b/i.test(message)
      return {
        agent: 'FinanceAssistAgent',
        requires_deterministic_calc: mentionsPmt,
        guidance: 'Never guarantee interest rate or loan approval without verified lender submission',
      }
    })(),

    // Trade Agent
    (async () => {
      const mentionsTrade = /\b(trade|trading|owe|payoff|terrain|f-150|rav4|cr-v)\b/i.test(message)
      return {
        agent: 'TradeAgent',
        trade_mentioned: mentionsTrade,
        action: mentionsTrade ? 'collect_mileage_condition' : 'none',
      }
    })(),

    // Memory Agent
    (async () => {
      const knownFacts = customerState?.memories?.facts || []
      return { agent: 'CustomerMemoryAgent', known_facts_count: knownFacts.length }
    })(),
  ])

  // Select appropriate Persona
  let selectedPersona = DIGITAL_PERSONAS.AVERY_SALES
  if (intentResult.primary_intent === 'service_inquiry') {
    selectedPersona = DIGITAL_PERSONAS.MIA_SERVICE
  } else if (intentResult.primary_intent === 'general_inquiry' && !customerState?.vehicle_interest?.primary_vehicle?.value) {
    selectedPersona = DIGITAL_PERSONAS.ALEX_RECEPTION
  }

  const executionTimeMs = Date.now() - startTime

  return {
    persona: selectedPersona,
    specialists: {
      intent: intentResult,
      objection: objectionResult,
      product: productResult,
      finance: financeResult,
      trade: tradeResult,
      memory: memoryResult,
    },
    orchestration_metadata: {
      parallel_execution: true,
      execution_time_ms: executionTimeMs,
      agents_invoked: 6,
    },
  }
}
