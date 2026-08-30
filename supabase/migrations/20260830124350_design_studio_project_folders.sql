-- Design Studio project organization.
-- Folders are tenant-scoped metadata; designs remain canonical studio_designs records.

CREATE TABLE IF NOT EXISTS public.studio_project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563eb',
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT studio_project_folders_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT studio_project_folders_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS studio_project_folders_active_name_uk
  ON public.studio_project_folders (dealership_id, lower(btrim(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS studio_project_folders_dealership_idx
  ON public.studio_project_folders (dealership_id, position, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.studio_designs
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.studio_project_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS studio_designs_folder_idx
  ON public.studio_designs (dealership_id, folder_id, updated_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.studio_project_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_project_folders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_project_folders_select" ON public.studio_project_folders;
DROP POLICY IF EXISTS "studio_project_folders_insert" ON public.studio_project_folders;
DROP POLICY IF EXISTS "studio_project_folders_update" ON public.studio_project_folders;
DROP POLICY IF EXISTS "studio_project_folders_delete" ON public.studio_project_folders;

DO $$
BEGIN
  IF to_regprocedure('authz.current_dealership_id()') IS NOT NULL
     AND to_regprocedure('authz.has_permission(uuid,text)') IS NOT NULL
     AND to_regprocedure('authz.is_platform_staff()') IS NOT NULL THEN
    CREATE POLICY "studio_project_folders_select" ON public.studio_project_folders
      FOR SELECT TO authenticated
      USING (
        dealership_id = authz.current_dealership_id()
        AND deleted_at IS NULL
        AND (authz.has_permission(dealership_id, 'marketing.view') OR authz.is_platform_staff())
      );
    CREATE POLICY "studio_project_folders_insert" ON public.studio_project_folders
      FOR INSERT TO authenticated
      WITH CHECK (
        dealership_id = authz.current_dealership_id()
        AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
      );
    CREATE POLICY "studio_project_folders_update" ON public.studio_project_folders
      FOR UPDATE TO authenticated
      USING (
        dealership_id = authz.current_dealership_id()
        AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
      )
      WITH CHECK (
        dealership_id = authz.current_dealership_id()
        AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
      );
    CREATE POLICY "studio_project_folders_delete" ON public.studio_project_folders
      FOR DELETE TO authenticated
      USING (
        dealership_id = authz.current_dealership_id()
        AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
      );
  END IF;
END $$;

GRANT ALL ON TABLE public.studio_project_folders TO service_role;
GRANT SELECT ON TABLE public.studio_project_folders TO authenticated;
