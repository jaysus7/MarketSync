-- Professional Design Studio collaboration and template governance.
-- Additive only: existing designs, revisions, assets, auth, and permissions remain canonical.

CREATE TABLE IF NOT EXISTS public.studio_design_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES public.studio_designs(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  mentioned_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.studio_design_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID NOT NULL REFERENCES public.studio_designs(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  revision_number INT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','revision_requested','cancelled')),
  note TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.studio_template_governance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  template_id UUID,
  template_key TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  locked_element_ids TEXT[] NOT NULL DEFAULT '{}',
  required_fields TEXT[] NOT NULL DEFAULT '{}',
  allowed_color_values TEXT[] NOT NULL DEFAULT '{}',
  allowed_font_values TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  configured_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_comments_design ON public.studio_design_comments(design_id, created_at);
CREATE INDEX IF NOT EXISTS idx_studio_comments_dealership ON public.studio_design_comments(dealership_id);
CREATE INDEX IF NOT EXISTS idx_studio_comments_created_by ON public.studio_design_comments(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studio_comments_resolved_by ON public.studio_design_comments(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studio_approvals_design ON public.studio_design_approvals(design_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_approvals_dealership ON public.studio_design_approvals(dealership_id);
CREATE INDEX IF NOT EXISTS idx_studio_approvals_requested_by ON public.studio_design_approvals(requested_by) WHERE requested_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studio_approvals_decided_by ON public.studio_design_approvals(decided_by) WHERE decided_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_studio_governance_dealer ON public.studio_template_governance(dealership_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_governance_configured_by ON public.studio_template_governance(configured_by) WHERE configured_by IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_governance_template_key ON public.studio_template_governance(dealership_id, template_key);

ALTER TABLE public.studio_design_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_design_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_template_governance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_design_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.studio_design_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.studio_template_governance FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_comments_view" ON public.studio_design_comments;
DROP POLICY IF EXISTS "studio_comments_add" ON public.studio_design_comments;
DROP POLICY IF EXISTS "studio_approvals_view" ON public.studio_design_approvals;
DROP POLICY IF EXISTS "studio_approvals_add" ON public.studio_design_approvals;
DROP POLICY IF EXISTS "studio_governance_view" ON public.studio_template_governance;

DO $$
BEGIN
  IF to_regprocedure('authz.current_dealership_id()') IS NOT NULL
     AND to_regprocedure('authz.has_permission(uuid,text)') IS NOT NULL
     AND to_regprocedure('authz.is_platform_staff()') IS NOT NULL THEN
    CREATE POLICY "studio_comments_view" ON public.studio_design_comments FOR SELECT TO authenticated USING (dealership_id = (select authz.current_dealership_id()) AND (authz.has_permission(dealership_id, 'marketing.view') OR (select authz.is_platform_staff())));
    CREATE POLICY "studio_comments_add" ON public.studio_design_comments FOR INSERT TO authenticated WITH CHECK (dealership_id = (select authz.current_dealership_id()) AND (authz.has_permission(dealership_id, 'marketing.edit') OR (select authz.is_platform_staff())));
    CREATE POLICY "studio_approvals_view" ON public.studio_design_approvals FOR SELECT TO authenticated USING (dealership_id = (select authz.current_dealership_id()) AND (authz.has_permission(dealership_id, 'marketing.view') OR (select authz.is_platform_staff())));
    CREATE POLICY "studio_approvals_add" ON public.studio_design_approvals FOR INSERT TO authenticated WITH CHECK (dealership_id = (select authz.current_dealership_id()) AND (authz.has_permission(dealership_id, 'marketing.edit') OR (select authz.is_platform_staff())));
    CREATE POLICY "studio_governance_view" ON public.studio_template_governance FOR SELECT TO authenticated USING (dealership_id = (select authz.current_dealership_id()) AND (authz.has_permission(dealership_id, 'marketing.view') OR (select authz.is_platform_staff())));
  END IF;
END $$;

REVOKE ALL ON public.studio_design_comments, public.studio_design_approvals, public.studio_template_governance FROM anon, authenticated;
GRANT ALL ON public.studio_design_comments, public.studio_design_approvals, public.studio_template_governance TO service_role;
