-- Migration: Final Security Hardening Pass
-- 1. E-Sign token hashing support
-- 2. Calendar OAuth token encryption columns
-- 3. Ad Spend OAuth token encryption columns
-- 4. Service-role-only access locks on integration & sensitive token tables

-- ── 1. E-Sign requests token hash ─────────────────────────────────────────────
ALTER TABLE public.esign_requests
  ADD COLUMN IF NOT EXISTS token_hash text;

CREATE INDEX IF NOT EXISTS esign_requests_token_hash_idx
  ON public.esign_requests (token_hash);

-- ── 2. Calendar connections encrypted credentials ────────────────────────────
ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS credentials_enc text,
  ADD COLUMN IF NOT EXISTS credentials_encryption_version int DEFAULT 1;

-- ── 3. Ad connections encrypted credentials ──────────────────────────────────
ALTER TABLE public.ad_connections
  ADD COLUMN IF NOT EXISTS credentials_enc text,
  ADD COLUMN IF NOT EXISTS credentials_encryption_version int DEFAULT 1;

-- ── 4. Table permissions security posture ────────────────────────────────────
-- Ensure authenticated / anon roles cannot directly query credentials or tokens
REVOKE ALL ON TABLE public.calendar_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.ad_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.esign_requests FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ad_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.esign_requests TO service_role;
