/**
 * Ingestion script for all AI Knowledge across MarketSync's 3 chatbots.
 * 1. MarketSync Marketing & Sales Assistant (data/marketsync-kb.md)
 * 2. DealerOS Employee Copilot (DealerOS 19-module workflows & curriculum)
 * 3. Dealership Customer Concierge (Customer engagement & operational standards)
 *
 * Chunks, generates 1536-dimensional embeddings, and idempotently upserts to pgvector.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ingestDocument, GLOBAL_KNOWLEDGE_DEALERSHIP_ID } from '../services/vectorIngestion.js'
import { supabaseAdmin } from '../shared.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const KB_PATH = path.resolve(__dirname, '../data/marketsync-kb.md')

// All three chatbots are MarketSync-owned, cross-dealer knowledge → the global sentinel.
// required_permission stays null: this is public product/concierge/copilot knowledge.
const GLOBAL = GLOBAL_KNOWLEDGE_DEALERSHIP_ID

/**
 * Dealership Concierge Knowledge Base (Chatbot 3)
 */
const CONCIERGE_KNOWLEDGE = `
[DEALERSHIP CONCIERGE STANDARDS: VEHICLE INVENTORY INQUIRIES]
The dealership customer concierge assists shoppers with real-time stock checks, vehicle specs, pricing breakdown, and availability.
- Always provide transparent vehicle details including VIN, exterior/interior color, transmission, mileage, and internet price.
- If a specific trim or color is unavailable, suggest similar in-stock vehicles or offer to place a custom factory order.
- Provide clear call-to-actions to schedule a VIP test drive or request a personalized video walkaround.

[DEALERSHIP CONCIERGE STANDARDS: TEST DRIVE SCHEDULING]
- Customers can book test drives online or via chat 24/7.
- Required information for test drive booking: customer full name, contact phone number, email address, preferred date and time, and vehicle of interest.
- Inform customers that a valid driver's license and proof of auto insurance are required at arrival.
- Provide dealership address, hours of operation, and sales department contact info.

[DEALERSHIP CONCIERGE STANDARDS: TRADE-IN VALUATION PROCESS]
- The concierge guides customers through trade appraisals powered by MarketSync's valuation engine.
- Step 1: Collect year, make, model, trim, exact mileage, and current condition (Excellent, Good, Fair, Needs Work).
- Step 2: Ask for VIN or license plate state/number for precise options decoding.
- Step 3: Present preliminary trade-in range estimate and schedule a 15-minute in-person physical appraisal for firm check payoff.

[DEALERSHIP CONCIERGE STANDARDS: SERVICE APPOINTMENT & REPAIR ORDERS]
- Service concierge helps vehicle owners schedule maintenance, check recall status, and review repair order progress.
- Services available for online booking: Oil & Filter Change, Tire Rotation & Alignment, Brake Inspection, Battery Replacement, Multi-Point Inspection, Transmission Flush, and Factory Scheduled Maintenance.
- Explain drop-off options, shuttle availability, loaner vehicle policy, and service department business hours.

[DEALERSHIP CONCIERGE STANDARDS: FINANCING & CREDIT APPLICATION]
- Assist buyers with prime/subprime auto financing inquiries, lease options, and cash purchase procedures.
- Direct customers to complete the secure 256-bit encrypted online credit application.
- Clarify pre-qualification terms, soft credit pull options, trade equity rollover, and current promotional APR rates.

[DEALERSHIP CONCIERGE STANDARDS: ESCALATION & HUMAN HANDOFF]
- Immediately hand off to a human sales/service specialist when:
  1. A customer asks for a final out-the-door price lock or written quote.
  2. A customer experiences frustration or requests human manager assistance.
  3. A customer asks complex legal, tax, or out-of-province registration questions.
- Capture customer name, phone, email, and reason for handoff, and output the [CAPTURE] token.
`

/**
 * DealerOS Copilot Knowledge Base (Chatbot 2)
 */
const DEALEROS_COPILOT_KNOWLEDGE = `
[DEALEROS WORKFLOW: DASHBOARD & PULSE]
DealerOS Command Dashboard provides real-time dealership performance analytics across 5 key revenue tiers.
- Live lead feed, active store visitors, inventory turn rates, gross profit tracking, and rep activity leaderboards.
- Key metrics: Monthly Recurring Revenue (MRR), Average Days on Lot, Lead Response Time, Closing Ratio, and Service Revenue.

[DEALEROS WORKFLOW: SALES CRM & LEADS]
Manage sales leads across the full buyer funnel from initial inquiry to delivery.
- Automatic lead capture from website forms, Facebook Marketplace, phone calls, and AI ChatBot.
- Round-robin sales rep distribution, automated follow-up sequences (SMS & Email), lead scoring, and activity logging.
- Pipeline stages: New Lead, Contacted, Appointment Set, Showed, Negotiating, Won (Delivered), Lost.

[DEALEROS WORKFLOW: INVENTORY MANAGEMENT & DESKING]
Complete vehicle inventory management with MarketCheck integration, VIN decoding, and automated price adjustments.
- Features: Vehicle details, photo gallery management, window sticker generation, VDP builder, and syndication feeds.
- Desking & Deal Studio: Structure cash, lease, and finance deals with trade payoff, down payment, interest rates, tax calculations, and printable Bill of Sale.

[DEALEROS WORKFLOW: F&I & ACCOUNTING]
Financial Services & Dealer Accounting module.
- F&I menu presentation: Extended Warranties, Gap Insurance, Tire & Wheel Protection, Paint Protection, and Service Contracts.
- Double-entry accounting engine: General Ledger, Chart of Accounts, Bank Reconciliation, Expense Tracking, Tax Reports, and Commission Paystub generation.

[DEALEROS WORKFLOW: SERVICE & PARTS ENGINE]
Integrated Service Operations and Parts Inventory.
- Service: Online appointment booking, Repair Order (RO) management, technician dispatching, labor rate calculator, and customer SMS updates.
- Parts: OEM & aftermarket parts catalog, stock levels, reorder alerts, bin locations, and parts markup pricing rules.

[DEALEROS WORKFLOW: CREATIVE & MARKETING SUITE]
Design Studio, Video Creator, Social Scheduler, and Campaign Builder.
- Design Studio: Canvas graphics editor for dealership promotional banners, Facebook post templates, and inventory overlays.
- Video Creator: Generate 30-second AI vehicle walkaround videos with automated text-to-speech voiceovers and background music.
- Social Scheduler: Auto-post inventory listings to Facebook Marketplace and scheduled social media posts.
- Campaign Builder: SMS & Email marketing campaigns with audience segmentation and engagement tracking.
`

export async function runIngestion() {
  console.log('[ingest-all-knowledge] Starting multi-chatbot vector knowledge ingestion...')

  const results = {
    marketsyncSales: { count: 0 },
    dealerosCopilot: { count: 0 },
    dealerConcierge: { count: 0 },
  }

  // 1. Chatbot 1: MarketSync Marketing & Sales Assistant
  let marketsyncKbText = ''
  try {
    marketsyncKbText = fs.readFileSync(KB_PATH, 'utf8')
  } catch (err) {
    console.warn('[ingest-all-knowledge] Warning: Could not read marketsync-kb.md:', err.message)
  }

  if (marketsyncKbText) {
    console.log('[ingest-all-knowledge] Ingesting Chatbot 1: MarketSync Marketing KB...')
    const res1 = await ingestDocument({
      dealershipId: GLOBAL,
      sourceType: 'marketsync_sales_assistant',
      sourceKey: 'marketsync-marketing-kb',
      sourceName: 'MarketSync Marketing & Sales Assistant',
      content: marketsyncKbText,
      metadata: { chatbot: 'marketsync_sales_assistant', scope: 'global' },
    })
    results.marketsyncSales.count = res1.count
    console.log(`[ingest-all-knowledge] Ingested ${res1.count} chunks for MarketSync Marketing Assistant.`)
  }

  // 2. Chatbot 2: DealerOS Employee Copilot
  console.log('[ingest-all-knowledge] Ingesting Chatbot 2: DealerOS Employee Copilot KB...')
  const res2 = await ingestDocument({
    dealershipId: GLOBAL,
    sourceType: 'dealeros_employee_copilot',
    sourceKey: 'dealeros-training-curriculum',
    sourceName: 'DealerOS Employee Copilot',
    content: DEALEROS_COPILOT_KNOWLEDGE,
    metadata: { chatbot: 'dealeros_employee_copilot', scope: 'global' },
  })
  results.dealerosCopilot.count = res2.count
  console.log(`[ingest-all-knowledge] Ingested ${res2.count} chunks for DealerOS Employee Copilot.`)

  // 3. Chatbot 3: Dealership Customer Concierge
  console.log('[ingest-all-knowledge] Ingesting Chatbot 3: Dealership Customer Concierge Standards...')
  const res3 = await ingestDocument({
    dealershipId: GLOBAL,
    sourceType: 'dealership_customer_concierge',
    sourceKey: 'dealership-concierge-standards',
    sourceName: 'Dealership Customer Concierge',
    content: CONCIERGE_KNOWLEDGE,
    metadata: { chatbot: 'dealership_customer_concierge', scope: 'global' },
  })
  results.dealerConcierge.count = res3.count
  console.log(`[ingest-all-knowledge] Ingested ${res3.count} chunks for Dealership Customer Concierge.`)

  const totalChunks = results.marketsyncSales.count + results.dealerosCopilot.count + results.dealerConcierge.count
  console.log(`[ingest-all-knowledge] Multi-chatbot vector knowledge ingestion complete! Total chunks ingested: ${totalChunks}`)
  return results
}

/**
 * Reads back the persisted state directly from the database so the CLI proves the
 * rows and embeddings actually landed (rather than trusting the in-process counts).
 */
async function verifyGlobalKnowledge() {
  const { data, error } = await supabaseAdmin
    .from('ai_knowledge_chunks')
    .select('id, embedding, embedding_model', { count: 'exact' })
    .eq('dealership_id', GLOBAL)
  if (error) throw new Error(`Verification query failed: ${error.message}`)
  const total = (data || []).length
  const embedded = (data || []).filter(r => r.embedding != null).length
  const model = (data || [])[0]?.embedding_model || '(none)'
  console.log(`[ingest-all-knowledge] Verified global knowledge: total_chunks=${total}, embedded_chunks=${embedded}, model=${model}`)
  if (total === 0 || embedded === 0) {
    throw new Error(`Post-ingest verification failed: total_chunks=${total}, embedded_chunks=${embedded}`)
  }
  return { total, embedded, model }
}

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('ingest-all-knowledge.js')) {
  runIngestion()
    .then(() => verifyGlobalKnowledge())
    .catch((err) => {
      console.error('[ingest-all-knowledge] Ingestion failed:', err)
      process.exit(1)
    })
}
