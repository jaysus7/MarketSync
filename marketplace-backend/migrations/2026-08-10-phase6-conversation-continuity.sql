-- Phase 6 PR 6.4 — conversation continuity across channels.
--
-- The customer is the identity; the channel is not. A shopper who asks about a Silverado on
-- the website, then texts "are you open at 2?", is one conversation — not a web chat plus an
-- unrelated SMS thread that a salesperson has to mentally staple together.
--
-- `ai_conversations` already had the hard part: contact_id AND visitor_token, so an
-- anonymous visitor can later become a known customer. What was missing is which channel a
-- conversation is currently on, which channel each message arrived through, and what happens
-- when an identified customer already has a conversation open.
--
-- Nothing is renamed. `status` keeps 'active' (its default) and 'handoff' (what the AI
-- runtime writes today); the vocabulary is widened rather than replaced.
--
-- APPLIED TO STAGING ONLY.

-- ── Which channel, and who is waiting on whom ───────────────────────────────
alter table public.ai_conversations add column if not exists channel text not null default 'web';
alter table public.ai_conversations add column if not exists takeover_by uuid references public.profiles(id) on delete set null;
alter table public.ai_conversations add column if not exists takeover_at timestamptz;
alter table public.ai_conversations add column if not exists last_customer_at timestamptz;
alter table public.ai_conversations add column if not exists last_dealer_at timestamptz;
alter table public.ai_conversations add column if not exists closed_at timestamptz;
alter table public.ai_conversations add column if not exists closed_by uuid references public.profiles(id) on delete set null;
-- When two conversations turn out to be the same customer, the loser points at the winner
-- rather than being deleted — the transcript is evidence of what was said.
alter table public.ai_conversations add column if not exists merged_into uuid references public.ai_conversations(id) on delete set null;

do $$ begin
  alter table public.ai_conversations add constraint ai_conversations_channel_valid
    check (channel in ('web','sms','email','phone'));
exception when duplicate_object then null; end $$;

-- 'active' and 'handoff' are what already exists; the rest name states the product needs.
-- Deliberately small: a conversation nobody can describe in one word is a conversation
-- nobody will act on.
do $$ begin
  alter table public.ai_conversations add constraint ai_conversations_status_valid
    check (status in ('active','waiting_customer','waiting_dealer','handoff','closed','merged'));
exception when duplicate_object then null; end $$;

-- ONE open conversation per customer per department. This is what makes continuity real
-- rather than aspirational: a second one cannot quietly appear because the customer
-- switched channel. Anonymous visitors are excluded — they have no contact to be one of.
create unique index if not exists ai_conversations_one_open_per_contact
  on public.ai_conversations (dealership_id, contact_id, coalesce(department, 'sales'))
  where contact_id is not null and status not in ('closed','merged');

create index if not exists ai_conversations_visitor_idx
  on public.ai_conversations (dealership_id, visitor_token) where visitor_token is not null;

-- ── Which channel each message came through ─────────────────────────────────
-- Without this, a merged conversation reads as one undifferentiated wall of text and
-- nobody can tell what the customer saw where.
alter table public.ai_messages add column if not exists channel text not null default 'web';
alter table public.ai_messages add column if not exists external_id text;   -- provider message id, for dedupe

do $$ begin
  alter table public.ai_messages add constraint ai_messages_channel_valid
    check (channel in ('web','sms','email','phone'));
exception when duplicate_object then null; end $$;

-- An inbound provider message must not be recorded twice when a webhook retries.
create unique index if not exists ai_messages_external_uk
  on public.ai_messages (dealership_id, channel, external_id) where external_id is not null;

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);
