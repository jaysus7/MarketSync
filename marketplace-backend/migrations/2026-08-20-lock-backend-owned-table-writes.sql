-- Migration: Lock Backend-Owned Table Writes & Direct PostgREST Access
-- Tables: ai_conversations, ai_messages, ai_memory, social_accounts, seo_connections
--
-- Operational Architecture:
-- 1. These systems use backend Express routes with service_role for authoritative operations.
-- 2. Browser clients (anon, authenticated) must not directly INSERT, UPDATE, or DELETE records.
-- 3. Sensitive tokens, visitor tokens, and encrypted OAuth credentials (credentials_enc, visitor_token)
--    must never be readable or writable directly via PostgREST.
-- 4. service_role retains full access (SELECT, INSERT, UPDATE, DELETE) for backend controllers and workers.

DO $$
BEGIN
  -- ── 1. ai_conversations ───────────────────────────────────────────────────
  -- Customer chat & visitor tracking table containing sensitive visitor_token.
  -- Authoritative operations occur via backend /conversations and /ai routes.
  ALTER TABLE IF EXISTS public.ai_conversations ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.ai_conversations FROM anon, authenticated;
  GRANT ALL ON TABLE public.ai_conversations TO service_role;

  -- ── 2. ai_messages ───────────────────────────────────────────────────────
  -- Conversation messages & transcripts. Writes must be immutable audit logs via backend.
  ALTER TABLE IF EXISTS public.ai_messages ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.ai_messages FROM anon, authenticated;
  GRANT ALL ON TABLE public.ai_messages TO service_role;

  -- ── 3. ai_memory ─────────────────────────────────────────────────────────
  -- AI customer memory extracted authoritatively by backend AI workers.
  ALTER TABLE IF EXISTS public.ai_memory ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.ai_memory FROM anon, authenticated;
  GRANT ALL ON TABLE public.ai_memory TO service_role;

  -- ── 4. social_accounts ────────────────────────────────────────────────────
  -- Connected social accounts containing encrypted OAuth tokens (credentials_enc).
  -- All connections and operations are managed authoritatively via /social backend routes.
  ALTER TABLE IF EXISTS public.social_accounts ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.social_accounts FROM anon, authenticated;
  GRANT ALL ON TABLE public.social_accounts TO service_role;

  -- ── 5. seo_connections ───────────────────────────────────────────────────
  -- SEO Search Console & Search integration credentials and OAuth tokens.
  -- Managed strictly by backend services and service_role.
  ALTER TABLE IF EXISTS public.seo_connections ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.seo_connections FROM anon, authenticated;
  GRANT ALL ON TABLE public.seo_connections TO service_role;

  -- ── 6. social_account_grants ──────────────────────────────────────────────
  -- Account delegation grants. Mutations occur via backend permission-checked routes.
  ALTER TABLE IF EXISTS public.social_account_grants ENABLE ROW LEVEL SECURITY;
  REVOKE INSERT, UPDATE, DELETE ON TABLE public.social_account_grants FROM anon, authenticated;
  GRANT ALL ON TABLE public.social_account_grants TO service_role;

END $$;
