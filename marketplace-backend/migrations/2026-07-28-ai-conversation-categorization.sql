-- AI Chat dashboard: categorize + record every chatbot conversation so the AI Chat
-- page can show a filterable feed (by department + lead type/tags) and insight tiles.
-- Populated by ai-runtime.categorizeConversation() after each turn (widget + dealer site).
alter table ai_conversations add column if not exists department    text;   -- sales | service | parts | general
alter table ai_conversations add column if not exists lead_type     text;   -- appointment | parts | service | financing | trade | vehicle_inquiry | general
alter table ai_conversations add column if not exists tags          text[] default '{}';  -- makes, new/used/demo, year, asked_manager, …
alter table ai_conversations add column if not exists booked        boolean default false; -- an appointment was booked in this conversation
alter table ai_conversations add column if not exists requested_rep text;   -- customer asked for a specific rep by name

create index if not exists idx_ai_conversations_department on ai_conversations (dealership_id, department);
create index if not exists idx_ai_conversations_lead_type  on ai_conversations (dealership_id, lead_type);
create index if not exists idx_ai_conversations_booked     on ai_conversations (dealership_id, booked);
