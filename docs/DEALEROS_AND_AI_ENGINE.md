# DealerOS + AI Engine — how we get there

This answers two questions together, because they are the same question:
1. How does MarketSync become a **Dealer Operating System** (engines, not pages)?
2. How does the AI bot become a **CRM-native persistent AI employee**?

The AI Assistant is not a separate project. It is **one engine inside DealerOS**,
built on the exact kernel we already shipped.

---

## 0. The realization: the kernel already exists

The DealerOS vision needs four things under every engine. We built all four this month:

| DealerOS requirement | What already exists | Status |
|---|---|---|
| **Event bus** (everything is an event) | `events` spine + `emitEvent()` + in-process bus (`onEvent`) | ✅ shipped |
| **Automation** (events trigger work) | Workflow engine: templates → tasks → executors | ✅ shipped |
| **One timeline** (whole dealership) | `GET /timeline/:type/:id` — merges customer + deal + vehicle events | ✅ shipped |
| **Side-effect layer** (do things safely) | Action executor + `system_action_runs` (retry, dead-letter) | ✅ shipped |
| **Financial truth** | Accounting engine: events → rules → double-entry journals → statements | ✅ shipped |

**So MarketSync is already ~two-thirds of a DealerOS.** What remains is not a rewrite —
it is registering the remaining engines onto the same kernel. Every new capability
answers one question: *which engine owns this, and what event does it emit?*

---

## 1. One Record, One Truth (the data foundation)

Five core objects. Every engine reads/writes these — never a private copy.

| Core object | Canonical table today | Owning engine |
|---|---|---|
| Customer | `contacts` | Customer Engine |
| Vehicle | `inventory` (+ `recon`) | Inventory Engine |
| Deal | `deals` | Deal Engine |
| Employee | `profiles` | Identity Engine |
| Organization (Dealer) | `dealerships` | Core Engine |

Everything else (messages, tasks, journals, appraisals, ROs, AI conversations)
**references** these five by id and emits events about them. The timeline is the
union of all events for an object + its related objects — already live.

**Rule going forward:** no feature creates a parallel customer/vehicle/deal record.
If a module needs customer data, it reads `contacts` (via the Customer Engine),
never a copy.

---

## 2. The engine catalog (which engine owns what)

```
MarketSync OS  (kernel: events · workflow · timeline · executors · journals)
├── Core Engine          dealerships, settings, entitlements            ✅ exists
├── Identity Engine      profiles, roles, RBAC, staff roles             ✅ exists
├── Customer Engine      contacts, communications, CRM, timeline        ✅ exists (partial)
├── Inventory Engine     inventory, VIN, pricing, photos, recon, syndic ✅ exists
├── Sales Engine         leads, pipeline, appointments, desking, trades ✅ exists
├── Deal Engine          deals, F&I, documents, delivery                ✅ exists
├── Accounting Engine    journals, AR/AP, commissions, payroll, reports ✅ shipped (A1–A8)
├── Marketing Engine     website, campaigns, automation, ads            ✅ exists (partial)
├── Communication Engine email, SMS, notifications, webhooks            ✅ exists (as executors)
├── Automation Engine    workflow templates + rules                     ✅ shipped
├── Integration Engine   external CRM/accounting sync, extension        ◑ partial
├── Analytics Engine     reports, exec dashboard, forecasting           ◑ partial
├── Service Engine       ROs, service appts, parts, technicians         ◑ partial (service.js)
├── AI Engine            chat, SMS, email, phone, scoring, memory        ✗ to build (see §4)
└── Marketplace Engine   FB Marketplace, AutoTrader, Kijiji syndication ✅ exists
```

The point: **there is a home for everything.** New work = pick the engine, emit the
event. If the owning engine is unclear, the design needs refinement.

---

## 3. The design law (every feature must pass this)

> "Does this reduce clicks, tabs, or duplicate data entry?"

Concretely, every screen answers **"what do I need to do next?"** (the Operations
page already does this for workflows; the morning-dashboard pattern generalizes it).
Enforced principles:
- **Zero duplicate entry** — enter a VIN once → decode, photos, sticker, listings,
  syndication, AI description all fire via the automation engine.
- **Everything searchable** — one global spotlight over the five core objects.
- **Mobile-first for employees** — scan VIN, add customer, text, deposit, license
  scan, walk-around video, book appt — each under a minute.
- **API-first** — every engine exposes tools; web, mobile, AI, and third parties call
  the same services (this is also what makes the AI Engine possible — see §4.5).

---

## 4. The AI Engine (the persistent CRM-native assistant)

The AI bot becomes an engine that **remembers, records, and acts** — every
interaction stored, every action a timeline event, embeddable anywhere.

### 4.1 Data model (new tables, referencing the five core objects)
```
ai_conversations  id, dealer_id, customer_id, website, source, status,
                  started_at, last_message_at, assigned_salesperson,
                  summary, sentiment, lead_score
ai_messages       id, conversation_id, role, message, tokens, attachments, created_at   (permanent)
ai_memory         id, customer_id, memory_type, value, confidence, updated_at
                  (vehicle_interest, budget, trade, family, credit, financing, notes…)
```
The **timeline is not a new table** — AI actions emit `events` (`ai.conversation`,
`ai.appointment_booked`, `ai.lead_scored`), so they already appear beside every human
action in the existing unified timeline. This reuses the kernel exactly.

### 4.2 Continuation + memory retrieval (the pipeline)
On a returning visitor, identify via login / email / phone / cookie / secure visitor
token → load. **Before every AI response**, assemble context in this fixed order:
1. conversation history (`ai_messages`)
2. CRM profile (`contacts`)
3. customer timeline (`events`)
4. AI memory (`ai_memory`)
5. viewed inventory + 6. current inventory (`inventory`)
→ generate response. "Welcome back Jason — last time we discussed the NX350 and your
CR-V trade. Continue?"

### 4.3 Summaries + lead scoring
Every conversation auto-generates a structured summary (wants / budget / trade /
needs / concern / next step) stored on `ai_conversations.summary` and pushed to CRM.
Lead score updates continuously from signals (vehicle viewed, trade discussed,
finance questions, appt requested, contact shared, return visits) → stored on the
conversation + the contact, and each change emits `ai.lead_scored` (timeline).

### 4.4 The widget (embed anywhere)
```html
<script src="marketsync.js"></script>
<marketsync-chat dealer-id="123"></marketsync-chat>
```
One include. Works on eDealer, DealerOn, Dealer Inspire, DealerFire, WordPress,
Squarespace, Wix, and plain HTML. A dealer dashboard shows live conversations
(customer, vehicle, status, salesperson, unread, lead score, last message); a
manager can reply manually, let AI continue, take over, or hand back.

### 4.5 The tool layer (this is the critical design choice)
The AI **never queries the database directly.** Every capability is a tool the model
calls — so any LLM (Anthropic, OpenAI, Gemini) uses the same backend, and each tool
call becomes an auditable event:
```
get_customer() · save_message() · create_lead() · create_task() ·
create_appointment() · send_sms() · send_email() · search_inventory() ·
calculate_payment() · decode_vin() · create_trade() · save_memory() ·
get_timeline() · summarize_conversation()
```
**Most of these already exist as engine functions** (createNotification,
ensureDealTasks, emitEvent, VIN decode, the action executor's email/sms). The AI
Engine wraps them as a **tool registry** — the same shape as the action-executor
registry we already built. Design it MCP-compatible from day one.

### 4.6 CRM integration — four layers, best to worst (dealer picks at signup)
MarketSync is always the **source of truth**; it then syncs a copy outward.
1. **CRM API** (DealerSocket, VinSolutions, Elead, CDK, Reynolds, AutoRaptor, Tekion)
   — create/update leads, notes, tasks, appointments, push the conversation.
2. **Email / ADF-XML** — send an industry-standard ADF lead to `leads@dealer.com`;
   almost every CRM ingests this. (We already send ADF for leads — reuse it.)
3. **Webhook** — POST the lead payload to the CRM's inbound hook.
4. **Chrome extension** — detect the CRM page, autofill the lead, paste the
   conversation, create tasks. (We already ship an extension — extend it.)
The Integration Engine implements all four behind one `pushLead(dealer, payload)`
that routes by the dealer's chosen method.

---

## 5. Exactly how we achieve it — phased roadmap

Each phase is small, event-native, and reviewable. Nothing is rebuilt.

**Phase 1 — Customer Engine hardening (foundation for AI memory).**
Make `contacts` the undisputed single customer record; ensure every channel writes to
it. Add `ai_memory`. (Small; unblocks everything AI.)

**Phase 2 — AI Engine core (server-side).**
`ai_conversations` + `ai_messages` + the memory-retrieval pipeline (§4.2) + the tool
registry (§4.5, wrapping existing engine functions) + conversation summarizer + lead
scorer. Every AI action emits events (timeline for free). No UI yet.

**Phase 3 — The widget + dealer console.**
`marketsync.js` embeddable web component + the live-conversations dashboard + manual
takeover/hand-back + salesperson notifications (appt / trade / finance / score>80 /
"asks for human").

**Phase 4 — Integration Engine (4 levels).**
`pushLead()` router: ADF email (fastest to ship) → webhook → CRM APIs → extension.
Dealer picks method at signup; MarketSync stays source of truth, syncs copies out.

**Phase 5 — DealerOS finishing (parallelizable).**
Complete Service Engine (RO lifecycle already has `service.closed` accounting),
Analytics/Forecast depth, global spotlight search, and the "what's next" morning
dashboard that unifies every engine's open items.

**Phase 6 — MCP surface.**
Expose the tool registry as an MCP server so external agents (and future LLMs) drive
MarketSync through the same audited tools.

---

## 6. Why this wins

We are not competing with CDK feature-for-feature. We are building the platform they
would build if they started today: **every engine designed together on one kernel,
one data model, one event bus, one timeline** — instead of acquisitions stitched
together. The AI Engine is the proof: because everything is already events + tools +
one customer record, the assistant can remember every interaction, record every
action in the CRM timeline, act through audited tools, and embed on any website —
sharing the same customer history across every channel.

The next concrete step is **Phase 1 + 2** (Customer Engine hardening + AI Engine
core). Say the word and I'll produce the Stage 0 package for it, the same way we did
for the workflow and accounting engines.
