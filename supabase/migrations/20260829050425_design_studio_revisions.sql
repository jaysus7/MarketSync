-- Design Studio foundation: durable revisions and explicit publication state.
-- The existing studio_designs.scene remains the current draft for backwards
-- compatibility; revisions are immutable checkpoints used for history/rollback.

ALTER TABLE public.studio_designs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS revision_number INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_revision_number INT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_saved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'studio_designs_status_check'
      AND conrelid = 'public.studio_designs'::regclass
  ) THEN
    ALTER TABLE public.studio_designs
      ADD CONSTRAINT studio_designs_status_check CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.studio_design_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES public.studio_designs(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  name TEXT NOT NULL,
  scene JSONB NOT NULL,
  format_key TEXT NOT NULL DEFAULT 'square',
  width INT NOT NULL DEFAULT 1080,
  height INT NOT NULL DEFAULT 1080,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (design_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_studio_revisions_design
  ON public.studio_design_revisions(design_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_studio_revisions_dealership
  ON public.studio_design_revisions(dealership_id, created_at DESC);

ALTER TABLE public.studio_design_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_design_revisions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_revisions_select" ON public.studio_design_revisions;
CREATE POLICY "studio_revisions_select" ON public.studio_design_revisions
  FOR SELECT TO authenticated
  USING (
    dealership_id = authz.current_dealership_id()
    AND (authz.has_permission(dealership_id, 'marketing.view') OR authz.is_platform_staff())
  );

DROP POLICY IF EXISTS "studio_revisions_insert" ON public.studio_design_revisions;
CREATE POLICY "studio_revisions_insert" ON public.studio_design_revisions
  FOR INSERT TO authenticated
  WITH CHECK (
    dealership_id = authz.current_dealership_id()
    AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
  );

GRANT ALL ON TABLE public.studio_design_revisions TO service_role;
GRANT SELECT ON TABLE public.studio_design_revisions TO authenticated;
