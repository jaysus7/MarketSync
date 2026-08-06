-- API keys are revocable, scoped, and optionally time-bound. Existing keys remain
-- usable until explicitly revoked because expires_at defaults to NULL.

ALTER TABLE IF EXISTS public.api_keys
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS api_keys_active_expiry_idx
  ON public.api_keys (dealership_id, expires_at)
  WHERE revoked_at IS NULL;
