-- Studio Designs and Templates Persistent Schema (Phase 1 Canva-Style Design Studio)
CREATE TABLE IF NOT EXISTS public.studio_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ownership TEXT NOT NULL DEFAULT 'dealership' CHECK (ownership IN ('dealership', 'user')),
  name TEXT NOT NULL DEFAULT 'Untitled Design',
  format_key TEXT NOT NULL DEFAULT 'square',
  width INT NOT NULL DEFAULT 1080,
  height INT NOT NULL DEFAULT 1080,
  scene JSONB NOT NULL DEFAULT '{"version":1,"pages":[{"id":"page-1","width":1080,"height":1080,"elements":[]}]}'::jsonb,
  vehicle_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  template_id UUID,
  preview_asset_id UUID REFERENCES public.marketing_assets(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.studio_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID REFERENCES public.dealerships(id) ON DELETE CASCADE, -- NULL = global template
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Generic Social',
  format_key TEXT NOT NULL DEFAULT 'square',
  width INT NOT NULL DEFAULT 1080,
  height INT NOT NULL DEFAULT 1080,
  scene JSONB NOT NULL,
  thumbnail_url TEXT,
  version_number INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_studio_designs_dealership ON public.studio_designs(dealership_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_studio_designs_vehicle ON public.studio_designs(vehicle_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_studio_templates_dealership ON public.studio_templates(dealership_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_studio_templates_category ON public.studio_templates(category) WHERE active = true;

-- Enable RLS
ALTER TABLE public.studio_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_templates ENABLE ROW LEVEL SECURITY;

-- studio_designs RLS Policies
CREATE POLICY "studio_designs_select" ON public.studio_designs
  FOR SELECT TO authenticated
  USING (
    dealership_id = authz.current_dealership_id()
    AND deleted_at IS NULL
    AND (authz.has_permission(dealership_id, 'marketing.view') OR authz.is_platform_staff())
  );

CREATE POLICY "studio_designs_insert" ON public.studio_designs
  FOR INSERT TO authenticated
  WITH CHECK (
    dealership_id = authz.current_dealership_id()
    AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
  );

CREATE POLICY "studio_designs_update" ON public.studio_designs
  FOR UPDATE TO authenticated
  USING (
    dealership_id = authz.current_dealership_id()
    AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
  )
  WITH CHECK (
    dealership_id = authz.current_dealership_id()
    AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
  );

CREATE POLICY "studio_designs_delete" ON public.studio_designs
  FOR DELETE TO authenticated
  USING (
    dealership_id = authz.current_dealership_id()
    AND (authz.has_permission(dealership_id, 'marketing.edit') OR authz.is_platform_staff())
  );

-- studio_templates RLS Policies
CREATE POLICY "studio_templates_select" ON public.studio_templates
  FOR SELECT TO authenticated
  USING (
    (dealership_id IS NULL OR dealership_id = authz.current_dealership_id())
    AND active = true
  );

CREATE POLICY "studio_templates_insert" ON public.studio_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    (dealership_id = authz.current_dealership_id() AND authz.has_permission(dealership_id, 'marketing.edit'))
    OR authz.is_platform_staff()
  );

-- Service Role Grants
GRANT ALL ON TABLE public.studio_designs TO service_role;
GRANT ALL ON TABLE public.studio_templates TO service_role;
GRANT SELECT ON TABLE public.studio_designs TO authenticated;
GRANT SELECT ON TABLE public.studio_templates TO authenticated;
