-- Security Hardening Migration: Immutability for AI Messages and Authoritative AI Memory
-- Phase: Security Hardening (XSS / Strong MFA / AI Chat Authz / SSRF)

-- 1. AI Messages: Immutable append-only audit trail
-- Revoke browser client update permissions on ai_messages
revoke update on table public.ai_messages from anon, authenticated;

-- Ensure RLS is active on ai_messages
alter table public.ai_messages enable row level security;

-- Drop any existing permissive update policy if present
drop policy if exists "Users can update their own ai messages" on public.ai_messages;
drop policy if exists "Enable update for users based on dealership_id" on public.ai_messages;

-- 2. AI Memory: Service-role / backend authoritative
-- Disallow direct client browser update/insert on ai_memory
revoke insert, update, delete on table public.ai_memory from anon, authenticated;
grant select on table public.ai_memory to authenticated;

-- Ensure RLS is active on ai_memory
alter table public.ai_memory enable row level security;

drop policy if exists "Enable insert for authenticated users on ai_memory" on public.ai_memory;
drop policy if exists "Enable update for authenticated users on ai_memory" on public.ai_memory;
drop policy if exists "Enable delete for authenticated users on ai_memory" on public.ai_memory;

-- 3. AI Conversations: Strict dealership isolation
alter table public.ai_conversations enable row level security;

comment on table public.ai_messages is 'Immutable transcript messages for AI conversations. Writes are append-only.';
comment on table public.ai_memory is 'Authoritative customer memory extracted by backend AI workers.';
