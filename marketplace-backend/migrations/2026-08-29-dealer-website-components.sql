-- Reusable Website Builder sections. Components store the same structured JSON
-- used by page sections, never an uncontrolled HTML document.
CREATE TABLE IF NOT EXISTS public.dealer_website_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  section JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, name)
);
CREATE INDEX IF NOT EXISTS dealer_website_components_dealer_idx
  ON public.dealer_website_components (dealership_id, updated_at DESC);
ALTER TABLE public.dealer_website_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dealer_website_components_service_only ON public.dealer_website_components;
CREATE POLICY dealer_website_components_service_only ON public.dealer_website_components
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_website_components TO service_role;
