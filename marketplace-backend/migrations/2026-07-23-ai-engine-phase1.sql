-- AI Engine — Phase 1 schema (persistent CRM-native AI). Service-role-only RLS.
-- Timeline is NOT a new table — AI actions emit events. Already applied to
-- project omyuqzveegzspeojrqkd. See docs/AI_ENGINE_STAGE0.md.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  contact_id uuid,                       -- null until the visitor is captured
  visitor_token text,                    -- anonymous identity before capture
  website text,
  source text,
  status text not null default 'active', -- active | handoff | closed
  assigned_salesperson uuid,
  summary text,
  sentiment text,
  lead_score int not null default 0,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ai_conv_dealer_idx on public.ai_conversations (dealership_id, last_message_at desc);
create index if not exists ai_conv_contact_idx on public.ai_conversations (dealership_id, contact_id);
create index if not exists ai_conv_visitor_idx on public.ai_conversations (dealership_id, visitor_token);
alter table public.ai_conversations enable row level security;

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  dealership_id uuid not null,
  role text not null,                    -- user | assistant | system
  message text not null,
  tokens int,
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists ai_msg_conv_idx on public.ai_messages (conversation_id, created_at);
alter table public.ai_messages enable row level security;

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  contact_id uuid not null,
  memory_type text not null,
  value text,
  confidence numeric(3,2) not null default 0.7,
  source_conversation_id uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists ai_memory_key on public.ai_memory (dealership_id, contact_id, memory_type);
alter table public.ai_memory enable row level security;
