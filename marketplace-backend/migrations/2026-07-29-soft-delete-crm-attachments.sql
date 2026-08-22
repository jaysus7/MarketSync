-- Preserve customer-file provenance. Removed attachments remain available for
-- authorized audit/recovery, but do not appear in the normal CRM record.

ALTER TABLE IF EXISTS public.crm_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_attachments_active_idx
  ON public.crm_attachments (contact_id, created_at DESC)
  WHERE deleted_at IS NULL;
