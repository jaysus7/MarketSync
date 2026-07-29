-- Retain marketing-spend history after a correction/removal.

ALTER TABLE IF EXISTS public.marketing_spend
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketing_spend_active_idx
  ON public.marketing_spend (dealership_id, period DESC)
  WHERE deleted_at IS NULL;
