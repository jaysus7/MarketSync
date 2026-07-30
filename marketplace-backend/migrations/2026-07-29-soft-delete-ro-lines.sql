-- Retain service repair-order line provenance after a correction/removal.

ALTER TABLE IF EXISTS public.ro_lines
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ro_lines_active_idx
  ON public.ro_lines (ro_id, created_at)
  WHERE deleted_at IS NULL;
