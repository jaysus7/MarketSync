# AI Engine — Stage 0 (concrete build package)

Design doc for the persistent, CRM-native AI Engine. Builds on the frozen kernel
(events · workflow · executor · timeline · accounting · config) per
`docs/KERNEL_CONTRACT.md` and the vision in `docs/DEALEROS_AND_AI_ENGINE.md` §4.

**Law:** the AI never touches the DB. It calls **tools**; every tool wraps an
engine's own read/write API and emits events. State lives on records; memory is
loaded before every response. One engine, plugged into the kernel.

---

## 1. Schema (Phase 1 — additive, service-role-only RLS)

```
ai_conversations
  id, dealership_id, contact_id (nullable until captured),
  visitor_token (anon identity before capture), website, source,
  status (active|handoff|closed), assigned_salesperson,
  summary, sentiment, lead_score,
  started_at, last_message_at, created_at

ai_messages            (permanent — every message kept)
  id, conversation_id, dealership_id, role (user|assistant|system),
  message, tokens, attachments (jsonb), created_at

ai_memory              (long-term per-customer memory)
  id, dealership_id, contact_id, memory_type
  (vehicle_interest|budget|trade|family|credit|financing|appointment|notes|...),
  value (text), confidence (numeric), source_conversation_id, updated_at, created_at
```

The **timeline is not new** — AI actions emit `events` (`ai.conversation`,
`ai.lead_scored`, `ai.appointment_booked`) so they appear beside human activity in
the existing unified timeline. Lead score + summary also mirror onto `contacts`.

## 2. Tool registry (the only way the AI acts)

`{ name, description, input_schema, handler }`. Handlers call existing engine APIs
(no raw DB). MCP-compatible shape so any LLM/agent uses the same backend. Every call
emits an event / writes audit.

```
get_customer(contact_id)              → Customer Engine getContact()
save_message(conversation_id, …)      → AI Engine
save_memory(contact_id, type, value)  → AI Engine
get_timeline(entity_type, entity_id)  → events read (existing /timeline)
search_inventory(query)               → Inventory Engine
create_lead(…) / get_customer         → leads.js + crm.js (findOrCreateContact)
create_task(…)                        → ensureDealTasks / dealer_tasks
create_appointment(…)                 → calendar/service engine
send_sms(to,body) / send_email(…)     → Action Executor (retry-safe)
decode_vin(vin)                       → Inventory Engine VIN decode
create_trade(…)                       → trade_appraisals
calculate_payment(…)                  → deal desk math
summarize_conversation(conversation_id) → AI Engine (LLM)
```

Most handlers already exist as engine functions — the registry just wraps them.

## 3. Memory-retrieval pipeline (before every AI response, fixed order)

1. conversation history (`ai_messages`)
2. CRM profile (`getContact`)
3. customer timeline (`events`)
4. AI memory (`ai_memory`)
5. viewed inventory + 6. current inventory (`searchInventory`)
→ assemble system prompt (tone/greeting from `ai_personality` config) → generate.

Returning visitor identified by login / email / phone / cookie / `visitor_token`
→ load prior conversation + memory → continue naturally.

## 4. Summaries + lead scoring

Each conversation auto-generates a structured summary (wants/budget/trade/needs/
concern/next step) → `ai_conversations.summary` + mirrored to CRM. Lead score updates
continuously from signals (vehicle viewed, trade discussed, finance Qs, appt request,
contact shared, return visits) → conversation + `contacts`; each change emits
`ai.lead_scored`. Notification rules (`config`: appt / trade / finance / score>80 /
asks-for-human) fire salesperson alerts via the Action Executor.

## 5. Widget + integrations (later phases)

- **Widget:** `<script src="marketsync-chat.js" data-dealer="PUBLIC_ID">` → public,
  CORS-enabled chat endpoint gated by `ai_chatbot_active`. Embeds on LeadBox/eDealer/
  WordPress/anywhere. (This is what the standalone AI Chatbot add-on sells.)
- **CRM push (Integration Engine), best→worst:** CRM API → ADF email → webhook →
  Chrome extension. MarketSync stays source of truth; syncs copies outward.

## 6. Phases

- **Phase 1 (this package):** schema + Customer Engine read API (`getContact`) +
  `ai_memory` read/write (`saveMemory`/`getMemory`). Additive, safe.
- **Phase 2:** AI Engine core — conversation/message persistence, the tool registry,
  the retrieval pipeline, summarizer, lead scorer. Server-side, no UI.
- **Phase 3:** widget (`marketsync-chat.js`) + public CORS endpoint (entitlement-
  gated) + dealer console (live conversations, takeover/hand-back) + notifications.
- **Phase 4:** Integration Engine (4-level CRM push).
- **Phase 5:** MCP surface over the tool registry.

Every phase conforms to the Kernel Contract §8 (subscribe, emit, read APIs, tools,
own only its tables, read config).
