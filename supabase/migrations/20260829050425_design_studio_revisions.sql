-- Design Studio foundation: durable revisions and explicit publication state.
-- The existing studio_designs.scene remains the current draft for backwards
-- compatibility; revisions are immutable checkpoints used for history/rollback.

-- Some deployments received the Studio API before the original backend-only
-- schema migration. Bootstrap the minimum design record here so this additive
-- migration remains safe on those older staging databases. Existing tables are
-- left untouched; optional product foreign keys are intentionally added by the
-- owning product migrations when those tables exist.
CREATE TABLE IF NOT EXISTS public.studio_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ownership TEXT NOT NULL DEFAULT 'dealership',
  name TEXT NOT NULL DEFAULT 'Untitled Design',
  format_key TEXT NOT NULL DEFAULT 'square',
  width INT NOT NULL DEFAULT 1080,
  height INT NOT NULL DEFAULT 1080,
  scene JSONB NOT NULL DEFAULT '{"version":2,"pages":[]}'::jsonb,
  vehicle_id UUID,
  campaign_id UUID,
  template_id UUID,
  preview_asset_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.studio_designs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.studio_designs TO service_role;
GRANT SELECT ON TABLE public.studio_designs TO authenticated;

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
DROP POLICY IF EXISTS "studio_revisions_insert" ON public.studio_design_revisions;
DO $$
BEGIN
  -- Older staging projects do not yet expose the shared authz helpers. Keep
  -- RLS enabled there and install the tenant policies automatically once the
  -- authorization migration is present.
  IF to_regprocedure('authz.current_dealership_id()') IS NOT NULL
     AND to_regprocedure('authz.has_permission(uuid,text)') IS NOT NULL
     AND to_regprocedure('authz.is_platform_staff()') IS NOT NULL THEN
    CREATE POLICY "studio_revisions_select" ON public.studio_design_revisions
      FOR SELECT TO authenticated
      USING (dealership_id = authz.current_dealership_id()
        AND (authz.has_permission(dealership_id, 'marketing.view') OR authz.is_platform_staff()));
    CREATE POLICY "studio_revisions_insert" ON public.studio_design_revisions
      FOR INSERT TO authenticated
      WITH CHECK (dealership_id = authz.current_dealership_id()
        AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff()));
  END IF;
END $$;

GRANT ALL ON TABLE public.studio_design_revisions TO service_role;
GRANT SELECT ON TABLE public.studio_design_revisions TO authenticated;
