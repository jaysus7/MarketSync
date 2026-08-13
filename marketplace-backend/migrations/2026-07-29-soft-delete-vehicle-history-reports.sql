-- Preserve report provenance for compliance. Archived reports stay retained in
-- the database but are excluded from normal dealership history views.

ALTER TABLE IF EXISTS public.vehicle_history_reports
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vehicle_history_reports_active_idx
  ON public.vehicle_history_reports (dealership_id, created_at DESC)
  WHERE deleted_at IS NULL;
